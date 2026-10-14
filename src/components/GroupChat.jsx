import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useContext,
  useLayoutEffect,
} from "react";
import { Appstate } from "../App";
import axiosbase from "../axiosconfig";
import { useSocket } from "../Socketprovider";
import { showSuccessAlert, showErrorAlert } from "./alerthelper";
import chatAreaClasses from "../pages/styling/chatArea.module.css";
import InitialsAvatar from "./InitialsAvatar";
import MessageRenderer from "./MessageRenderer";
import MessageActions from "./MessageActions";
import GroupInfoSidebar from "./GroupInfoSidebar";
import {
  createVideoMetadata,
  createAudioMetadata,
  createImageThumbnail,
  createImageThumbnailpreview,
} from "../utils/mediaUtils.js";

/* ---------------------------------------------------------------------------
   GroupChat — brought up to parity with PrivateChat.jsx.

   Before this rewrite, `fetchMessages` was defined but never called (the
   screen never left its loading spinner), nothing ever joined a group's
   socket room (`join-group`/`leave-group` exist in app.js but nothing on the
   client ever emitted them) and the one socket call that did fire
   (`new-group-message`) hit a socket state that was never set, throwing on
   every send. The backend already fully supported files, pagination, and
   read receipts for groups (sendGroupFile, getGroupMessages limit/offset,
   markGroupAsRead) — none of it was wired up here.

   This mirrors PrivateChat.jsx's proven patterns (pagination + the scroll-
   jump fixes, optimistic send, media upload/download) rather than routing
   through ChatContext, which owns *private* conversation state — keeping
   this self-contained avoids any risk of destabilizing that already-hardened
   path. Deliberately deferred (see PLAN.md): cross-visit scroll position
   memory, inbox unread badges/previews for groups, and a per-member profile
   view — each is its own separate, non-trivial feature.
   --------------------------------------------------------------------------- */

const getImageMetadata = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const width = img.naturalWidth || img.width || 0;
      const height = img.naturalHeight || img.height || 0;
      URL.revokeObjectURL(url);
      resolve({
        width,
        height,
        aspectRatio: width && height ? width / height : 4 / 3,
      });
    };

    img.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };

    img.src = url;
  });

/* A compact set for the composer. Emoji only, per the user — no GIF picker. */
const COMPOSER_EMOJI = [
  "😀", "😄", "😅", "🤣", "😊", "😍", "🥰", "😎",
  "🤔", "😐", "😴", "😭", "😡", "🤯", "🥳", "😮",
  "👍", "👎", "👏", "🙏", "🙌", "💪", "🤝", "👀",
  "❤️", "🔥", "🎉", "✨", "⭐", "💯", "✅", "❌",
  "📚", "💡", "⏰", "🚀", "☕", "🍕", "🧠", "😢",
];

const generateTempId = () =>
  `temp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const mergeUniqueById = (arr, prev = []) => {
  const map = new Map(prev.map((m) => [m.id || m.tempId, m]));
  arr.forEach((m) => map.set(m.id || m.tempId, m));
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(a.delivered_at || a.created_at || 0) -
      new Date(b.delivered_at || b.created_at || 0),
  );
};

const GroupChat = ({
  group,
  allUsers = [],
  cachedMessages,
  onCacheMessages,
  onLeaveGroup,
  onGroupUpdated,
  onOpenPrivateChat,
  isMobile,
  setMobileView,
  onStartCall,
}) => {
  const { user } = useContext(Appstate);
  const socket = useSocket();

  /* Chat.jsx keeps the loaded messages per group (and keeps them current
     while this component is unmounted, from its own socket listener), so
     switching to another group and back shows them instantly instead of
     re-fetching from scratch — matching how ChatContext's messagesCache
     already behaves for private chat. */
  const [messages, setMessages] = useState(() => cachedMessages || []);
  const [newMessage, setNewMessage] = useState("");
  /* Not "is a request in flight" but "do we have something real to show
     yet" — the empty state must never be reachable before a load has
     actually completed, or a slow/superseded request flashes
     "No messages yet" for a frame on the way to rendering the messages. */
  const [hasLoaded, setHasLoaded] = useState(
    () => (cachedMessages || []).length > 0,
  );
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  /* Admin-only "Add member" panel — the only way into a *private* group,
     since joinGroup refuses those. There's no endpoint to list a group's
     current members (only member_count), so this offers every other user
     and lets the backend reject an already-a-member pick with its existing
     400 — simpler than adding a members-list endpoint just to pre-filter. */
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberQuery, setAddMemberQuery] = useState("");
  const [addingMemberId, setAddingMemberId] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  /* Fetched as soon as the group opens, not when the panel is first
     shown — opening the panel then had to sit on "Loading…" for a round
     trip every time. The panel renders straight from this. */
  const [groupDetails, setGroupDetails] = useState(null);
  /* Set when an avatar in the chat is clicked, so the info panel opens
     straight onto that person rather than the group screen. */
  const [focusMemberId, setFocusMemberId] = useState(null);
  /* The group name can be edited from the info panel; keep the header in
     step without waiting for Chat.jsx to refetch the whole group list. */
  const [groupName, setGroupName] = useState(group.name);
  /* The message being replied to, shown as a preview above the composer
     until it's sent or dismissed. */
  const [replyingTo, setReplyingTo] = useState(null);
  /* The message currently being edited. Editing happens in the composer,
     so this drives the "Editing" bar and turns send into a tick. */
  const [editingMessage, setEditingMessage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const chatContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const scrollFrameRef = useRef(null);
  const scrollRestoreRef = useRef(null);
  const isLoadingOlderRef = useRef(false);
  /* React StrictMode double-invokes effects in dev (mount, cleanup, mount
     again) specifically to surface bugs like an in-flight request whose
     response lands after the component has already re-fetched — without
     this, both responses applied and briefly produced a duplicate React
     key. Each mount bumps the token; a response only gets applied if it's
     still the most recent request when it resolves. */
  const initialFetchTokenRef = useRef(0);
  const pendingAutoScrollRef = useRef(true); // scroll to bottom on first load
  const atBottomRef = useRef(true);
  const downloadControllersRef = useRef({});
  const activeUploadsRef = useRef({});

  /* -------------------------------------------------------------- fetch */

  const fetchMessages = async (initial = true, prepend = false, requestToken = null) => {
    if (prepend) {
      if (isLoadingOlderRef.current) return;
      isLoadingOlderRef.current = true;
    }

    const prependContainer = prepend ? chatContainerRef.current : null;
    const prevHeightAtRequest = prependContainer?.scrollHeight ?? null;

    try {
      const response = await axiosbase.get(
        `/messages/group/${group.id}?limit=20&offset=${initial ? 0 : messages.length}`,
      );

      if (initial) {
        /* Superseded by a newer mount (StrictMode's dev-only double-invoke,
           or a fast group switch): apply nothing at all — not the messages
           and not the "we've loaded" flag. A stale response marking the load
           complete while `messages` was still empty is what flashed
           "No messages yet" for a frame before the real messages landed. */
        if (requestToken !== initialFetchTokenRef.current) return;
        setMessages((prev) => mergeUniqueById([...response.data, ...prev]));
        pendingAutoScrollRef.current = true;
        setHasLoaded(true);
      } else if (prepend) {
        if (response.data.length === 0) return;
        setMessages((prev) => mergeUniqueById([...response.data, ...prev]));
        scrollRestoreRef.current = { prevHeight: prevHeightAtRequest };
      }
    } catch (error) {
      console.error("Error fetching group messages:", error);
      if (initial && requestToken === initialFetchTokenRef.current) {
        showErrorAlert("Error", "Failed to load messages");
        /* Failed, but the spinner has to stop — the empty state is the
           honest thing to show once the alert has explained why. */
        setHasLoaded(true);
      }
    } finally {
      if (prepend) isLoadingOlderRef.current = false;
    }
  };

  useEffect(() => {
    /* A warm cache is already up to date — Chat.jsx keeps appending to it
       from its own socket listener while this component is unmounted — so
       re-fetching would only throw away the scroll-back pages the user
       already loaded and make reopening a group feel like a cold start. */
    if (messages.length > 0) return;
    const token = ++initialFetchTokenRef.current;
    fetchMessages(true, false, token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  /* Group profile, members, pinned message and this user's rights. Loaded
     with the conversation so the info panel is instant, and re-fetched
     after anything that changes it (an edit, a role change, a new photo). */
  const fetchGroupDetails = useCallback(async () => {
    try {
      const { data } = await axiosbase.get(`/groups/${group.id}`);
      setGroupDetails(data);
    } catch (error) {
      console.error("Error loading group details:", error);
    }
  }, [group.id]);

  useEffect(() => {
    fetchGroupDetails();
  }, [fetchGroupDetails]);

  /* Keep Chat.jsx's per-group cache in step with whatever is on screen, so
     leaving and coming back restores this exact list. */
  useEffect(() => {
    if (!onCacheMessages) return;
    onCacheMessages(group.id, messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, group.id]);

  /* --------------------------------------------------------- real-time */

  useEffect(() => {
    if (!socket) return;

    /* "connect" fires on the first connection and every reconnect alike —
       a dropped connection or backend restart gets a brand new server-side
       socket.id with no rooms joined, even though this is still the same
       client-side Socket object (a plain emit-on-mount here would silently
       stop delivering for the rest of the session after any reconnect). */
    const join = () => socket.emit("join-group", group.id);
    socket.on("connect", join);
    if (socket.connected) join();

    const onReceive = (payload) => {
      if (String(payload.group_id) !== String(group.id)) return;
      /* getIO().to(room).emit(...) on the backend includes the sender's own
         socket (unlike private messages, which explicitly exclude the
         sender). Our own send is already handled by the optimistic append
         + the REST response replacing it — merging this echo too raced
         against that replacement and could add a second entry with the
         same real id before the REST response landed, which is what threw
         React's duplicate-key warning. Skip it entirely rather than merge
         it into a version of the message that will need de-duping. */
      if (payload.sender_id === user.userid) return;

      setMessages((prev) => mergeUniqueById([payload], prev));

      if (atBottomRef.current) {
        pendingAutoScrollRef.current = true;
      } else {
        setUnreadCount((prev) => prev + 1);
      }
    };

    /* The backend upserts last_read_at = NOW() and doesn't send a specific
       message id/timestamp with the event — it just means "reader_id has
       now read everything up to this moment". So every one of *my* messages
       currently in view can be flipped to read; there's no per-message
       tracking to reconcile against, same simplification the single is_read
       boolean already makes for 1:1 chat (see TextMessage.jsx). */
    const onReadReceipt = ({ group_id, reader_id }) => {
      if (String(group_id) !== String(group.id)) return;
      if (reader_id === user.userid) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.sender_id === user.userid && !m.is_read
            ? { ...m, is_read: true }
            : m,
        ),
      );
    };

    /* Edits, deletes and reactions all arrive as patches against a message
       already on screen — apply them in place rather than refetching, so
       someone else's edit doesn't scroll or rebuild the conversation. */
    const onEdited = ({ id, content, edited_at, group_id }) => {
      if (String(group_id) !== String(group.id)) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content, edited_at } : m)),
      );
    };

    const onDeleted = ({ id, group_id }) => {
      if (String(group_id) !== String(group.id)) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, is_deleted: true, content: null } : m,
        ),
      );
    };

    const onReactions = ({ id, group_id, reactions }) => {
      if (String(group_id) !== String(group.id)) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, reactions } : m)),
      );
    };

    const onPinnedChanged = ({ group_id }) => {
      if (String(group_id) !== String(group.id)) return;
      fetchGroupDetails();
    };

    socket.on("receive-group-message", onReceive);
    socket.on("group-read-receipt", onReadReceipt);
    socket.on("message-edited", onEdited);
    socket.on("message-deleted", onDeleted);
    socket.on("message-reactions", onReactions);
    socket.on("group-pinned-changed", onPinnedChanged);

    return () => {
      socket.off("connect", join);
      socket.off("receive-group-message", onReceive);
      socket.off("group-read-receipt", onReadReceipt);
      socket.off("message-edited", onEdited);
      socket.off("message-deleted", onDeleted);
      socket.off("message-reactions", onReactions);
      socket.off("group-pinned-changed", onPinnedChanged);
      /* No leave-group here: Chat.jsx now joins every one of the user's
         group rooms for the lifetime of the chat page (so the inbox list
         can show live previews/unread badges for groups that aren't open),
         and Socket.IO room membership is per-socket, not per-listener —
         leaving here would evict that shared membership out from under it. */
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, group.id, user.userid]);

  /* ------------------------------------------- edit / delete / react / pin */

  /* Who may do what to a given message. Editing is the author's alone —
     changing someone's words while their name stays on them is a different
     thing from removing the message. Deleting is the author's, the owner's,
     or an admin's *only* where the owner has granted that right. */
  const canEditMessage = (message) =>
    message.sender_id === user.userid &&
    message.message_type === "text" &&
    !message.is_deleted;

  const canDeleteMessage = (message) =>
    !message.is_deleted &&
    (message.sender_id === user.userid ||
      groupDetails?.is_owner ||
      (groupDetails?.user_role === "admin" &&
        groupDetails?.can_delete_messages));

  const handleEditMessage = async (message, content) => {
    const previous = message.content;
    // Optimistic: the edit is the user's own text, so show it immediately.
    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id ? { ...m, content, edited_at: new Date().toISOString() } : m,
      ),
    );
    try {
      await axiosbase.patch(`/messages/${message.id}`, { content });
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, content: previous } : m)),
      );
      showErrorAlert(
        "Error",
        error.response?.data?.error || "Could not edit that message",
      );
    }
  };

  const handleDeleteMessage = async (message) => {
    try {
      await axiosbase.delete(`/messages/${message.id}`);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id ? { ...m, is_deleted: true, content: null } : m,
        ),
      );
    } catch (error) {
      showErrorAlert(
        "Error",
        error.response?.data?.error || "Could not delete that message",
      );
    }
  };

  const handleToggleReaction = async (message, emoji) => {
    try {
      const { data } = await axiosbase.post(`/messages/${message.id}/reactions`, {
        emoji,
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id ? { ...m, reactions: data.reactions } : m,
        ),
      );
    } catch (error) {
      console.error("Error reacting to message:", error);
    }
  };

  const handleTogglePin = async (message) => {
    const alreadyPinned = groupDetails?.pinned_message_id === message.id;
    try {
      await axiosbase.put(`/groups/${group.id}/pinned`, {
        message_id: alreadyPinned ? null : message.id,
      });
      fetchGroupDetails();
    } catch (error) {
      showErrorAlert(
        "Error",
        error.response?.data?.error || "Could not pin that message",
      );
    }
  };

  /* ------------------------------------------------------------ read */

  const markRead = () => {
    axiosbase.put(`/messages/read/group/${group.id}`).catch(() => {});
  };

  useEffect(() => {
    markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  /* --------------------------------------------------------- scrolling */

  useLayoutEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    if (scrollRestoreRef.current) {
      const { prevHeight } = scrollRestoreRef.current;
      const delta = container.scrollHeight - prevHeight;
      container.scrollTop = delta;
      scrollRestoreRef.current = null;
      return;
    }

    if (pendingAutoScrollRef.current) {
      container.scrollTop = container.scrollHeight;
      atBottomRef.current = true;
      setIsAtBottom(true);
      setUnreadCount(0);
      markRead();
      pendingAutoScrollRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const handleScroll = () => {
    if (scrollFrameRef.current) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const container = chatContainerRef.current;
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const atBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 5;
      setIsAtBottom(atBottom);
      atBottomRef.current = atBottom;

      if (scrollTop === 0) {
        fetchMessages(false, true);
      }

      if (atBottom) {
        setUnreadCount(0);
        markRead();
      }
    });
  };

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
    };
  }, []);

  /* -------------------------------------------------------------- send */

  const handleComposerKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "20px";
    const scrollHeight = textarea.scrollHeight;
    if (scrollHeight <= 150) {
      textarea.style.height = scrollHeight + "px";
    } else {
      textarea.style.height = "150px";
      textarea.scrollTop = textarea.scrollHeight;
    }
  };

  /* Telegram edits in the composer, not in place in the conversation: the
     message's text is loaded into the input, an "Editing" bar appears above
     it, and the send button becomes a tick. */
  const startEditing = (message) => {
    setEditingMessage(message);
    setReplyingTo(null);
    setNewMessage(message.content || "");
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      handleInput();
    });
  };

  /* Insert at the caret rather than appending, so picking an emoji
     mid-sentence puts it where the cursor actually is. */
  const insertEmoji = (emoji) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? newMessage.length;
    const end = el?.selectionEnd ?? newMessage.length;
    const next = newMessage.slice(0, start) + emoji + newMessage.slice(end);
    setNewMessage(next);
    setShowEmojiPicker(false);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const caret = start + emoji.length;
      el.setSelectionRange(caret, caret);
      handleInput();
    });
  };

  const cancelEditing = () => {
    setEditingMessage(null);
    setNewMessage("");
    if (textareaRef.current) textareaRef.current.style.height = "20px";
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim()) return;

    // In edit mode the composer saves the edit instead of sending anything.
    if (editingMessage) {
      const target = editingMessage;
      const text = newMessage.trim();
      cancelEditing();
      if (text !== target.content) await handleEditMessage(target, text);
      return;
    }

    const tempId = generateTempId();
    const optimisticMessage = {
      id: tempId,
      tempId,
      content: newMessage,
      sender_id: user.userid,
      group_id: group.id,
      sender_username: user.username,
      sender_avatar_url: user.avatar_url,
      created_at: new Date().toISOString(),
      delivered_at: new Date().toISOString(),
      is_read: false,
      status: "pending",
      message_type: "text",
      /* Carry the quote on the optimistic copy too, so the reply renders
         with its quote immediately rather than popping in once the server
         echoes it back. */
      parent_message_id: replyingTo?.id || null,
      parent_content: replyingTo?.content || null,
      parent_message_type: replyingTo?.message_type || null,
      parent_filename: replyingTo?.filename || null,
      parent_sender_username: replyingTo?.sender_username || null,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    pendingAutoScrollRef.current = true;
    setNewMessage("");
    setReplyingTo(null);
    if (textareaRef.current) textareaRef.current.style.height = "20px";

    try {
      const response = await axiosbase.post(`/messages/group/${group.id}`, {
        content: optimisticMessage.content,
        message_type: "text",
        parent_message_id: optimisticMessage.parent_message_id,
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.tempId === tempId ? { ...response.data.data, status: "sent" } : m,
        ),
      );
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) =>
        prev.map((m) => (m.tempId === tempId ? { ...m, status: "failed" } : m)),
      );
      showErrorAlert("Error", "Failed to send message");
    }
  };

  /* --------------------------------------------------------- send file */

  const sendFileToGroupServer = async (msg) => {
    let controller;
    try {
      controller = new AbortController();
      activeUploadsRef.current[msg.tempId] = controller;

      const safeNumber = (value, fallback = 0) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
      };

      const formData = new FormData();
      formData.append("file", msg.file, msg.filename || msg.file?.name || "upload");
      formData.append("tempId", msg.tempId);
      formData.append("group_id", group.id);
      formData.append("message_type", msg.message_type);
      formData.append("delivered_at", msg.delivered_at);
      formData.append("sender_id", user.userid);
      formData.append("filename", msg.filename || msg.file?.name || "");
      formData.append("filesize", safeNumber(msg.filesize || msg.file?.size));
      formData.append("mime_type", msg.file?.type || "");
      formData.append("width", safeNumber(msg.width));
      formData.append("height", safeNumber(msg.height));
      formData.append("aspect_ratio", safeNumber(msg.aspect_ratio));
      formData.append("duration", Math.round(safeNumber(msg.duration)));

      const res = await axiosbase.post("/messages/file/group", formData, {
        signal: controller.signal,
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000,
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setMessages((prev) =>
            prev.map((m) => (m.tempId === msg.tempId ? { ...m, uploadProgress: percent } : m)),
          );
        },
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.tempId === msg.tempId
            ? { ...res.data, status: "sent", uploadProgress: 100, fileUrl: msg.fileurl }
            : m,
        ),
      );
    } catch (err) {
      console.error("Group file upload failed:", err);
      setMessages((prev) =>
        prev.map((m) => (m.tempId === msg.tempId ? { ...m, status: "failed" } : m)),
      );
    } finally {
      if (controller && activeUploadsRef.current[msg.tempId] === controller) {
        delete activeUploadsRef.current[msg.tempId];
      }
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    for (const file of files) {
      const tempId = generateTempId();

      let messageType = "file";
      if (file.type.startsWith("image/")) messageType = "image";
      else if (file.type.startsWith("video/")) messageType = "video";
      else if (file.type.startsWith("audio/")) messageType = "audio";

      let preview = null;
      let optimisticMessage = null;
      let fileurl = null;

      const base = {
        id: tempId,
        tempId,
        content: null,
        filename: file.name,
        filesize: file.size,
        sender_id: user.userid,
        group_id: group.id,
        sender_username: user.username,
        sender_avatar_url: user.avatar_url,
        is_read: false,
        created_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
        status: "pending",
        message_type: messageType,
        file,
        uploadProgress: 0,
        downloadProgress: 0,
      };

      try {
        if (messageType === "image") {
          const metadata = await getImageMetadata(file);
          preview = await createImageThumbnailpreview(file);
          fileurl = await createImageThumbnail(file);
          optimisticMessage = {
            ...base,
            width: metadata.width,
            height: metadata.height,
            aspect_ratio: metadata.aspectRatio,
            duration: 0,
            preview,
            fileurl,
          };
        } else if (messageType === "video") {
          const metadata = await createVideoMetadata(file);
          if (Number.isFinite(metadata.duration) && metadata.duration > 0) {
            optimisticMessage = {
              ...base,
              width: metadata.width,
              height: metadata.height,
              aspect_ratio: metadata.aspectRatio,
              duration: Math.round(metadata.duration),
              preview,
              fileurl,
            };
          }
        } else if (messageType === "audio") {
          const audioMetadata = await createAudioMetadata(file);
          if (Number.isFinite(audioMetadata.duration) && audioMetadata.duration > 0) {
            optimisticMessage = {
              ...base,
              width: 0,
              height: 0,
              aspect_ratio: 0,
              duration: Math.round(audioMetadata.duration),
            };
          }
        } else {
          optimisticMessage = { ...base, width: 0, height: 0, aspect_ratio: 0, duration: 0 };
        }
      } catch (err) {
        console.log("Preview generation failed", err);
      }

      if (optimisticMessage) {
        setMessages((prev) => [...prev, optimisticMessage]);
        pendingAutoScrollRef.current = true;
        try {
          if (!navigator.onLine) throw new Error("Offline");
          await sendFileToGroupServer(optimisticMessage);
        } catch {
          console.log("File upload pending:", file.name);
        }
      }
    }

    e.target.value = "";
  };

  const handleMediaLoad = (id, isSender) => {
    if (isSender && pendingAutoScrollRef.current) {
      requestAnimationFrame(() => {
        const container = chatContainerRef.current;
        if (container) container.scrollTop = container.scrollHeight;
      });
    }
  };

  /* ---------------------------------------------------------- download */

  const downloadFile = async (message) => {
    if (message.tempId) return;
    const fileIdentifier = message.id;
    if (!fileIdentifier) return;

    const existingBytes = message.downloadedBytes || 0;
    const controller = new AbortController();
    downloadControllersRef.current[fileIdentifier] = controller;

    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, isDownloading: true, isPaused: false } : m)),
    );

    try {
      const response = await axiosbase.get(`/messages/file/download/${fileIdentifier}`, {
        responseType: "blob",
        headers: existingBytes ? { Range: `bytes=${existingBytes}-` } : {},
        signal: controller.signal,
        onDownloadProgress: (e) => {
          const total = message.filesize;
          const loaded = existingBytes + e.loaded;
          const percent = total > 0 ? Math.min(Math.floor((loaded / total) * 100), 99) : 0;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === message.id ? { ...m, downloadProgress: percent, downloadedBytes: loaded } : m,
            ),
          );
        },
      });

      const newBlob = response.data;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== message.id) return m;
          const combinedBlob = m.partialBlob ? new Blob([m.partialBlob, newBlob]) : newBlob;
          const blobUrl = URL.createObjectURL(combinedBlob);
          return {
            ...m,
            partialBlob: combinedBlob,
            fileUrl: blobUrl,
            isDownloading: false,
            downloadProgress: 100,
            isDownloaded: true,
            isPaused: false,
            downloadedBytes: message.filesize,
          };
        }),
      );
    } catch (err) {
      if (err?.name !== "CanceledError" && err?.code !== "ERR_CANCELED") {
        console.error("Download failed", err);
      }
    } finally {
      if (downloadControllersRef.current[fileIdentifier] === controller) {
        delete downloadControllersRef.current[fileIdentifier];
      }
    }
  };

  const cancelDownload = (id, message) => {
    if (!message?.tempId) {
      if (downloadControllersRef.current[id]) {
        downloadControllersRef.current[id].abort();
        delete downloadControllersRef.current[id];
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, isDownloading: false, isPaused: true } : m)),
      );
      return;
    }

    if (activeUploadsRef.current[message.tempId]) {
      activeUploadsRef.current[message.tempId].abort();
      delete activeUploadsRef.current[message.tempId];
    }
    setMessages((prev) => prev.filter((m) => m.tempId !== message.tempId));
  };

  /* -------------------------------------------------------------- misc */

  const handleLeaveGroup = async () => {
    try {
      await axiosbase.delete(`/groups/${group.id}/leave`);
      showSuccessAlert("Success", "Successfully left the group");
      onLeaveGroup();
    } catch (error) {
      console.error("Error leaving group:", error);
      showErrorAlert("Error", error.response?.data?.error || "Failed to leave group");
    }
  };

  const handleAddMember = async (targetUser) => {
    setAddingMemberId(targetUser.userid);
    try {
      await axiosbase.post(`/groups/${group.id}/members`, {
        user_id: targetUser.userid,
      });
      showSuccessAlert("Success", `${targetUser.username} added to the group`);
      setShowAddMember(false);
      setAddMemberQuery("");
    } catch (error) {
      console.error("Error adding group member:", error);
      showErrorAlert(
        "Error",
        error.response?.data?.error || "Failed to add member",
      );
    } finally {
      setAddingMemberId(null);
    }
  };

  const addMemberCandidates = allUsers.filter(
    (u) =>
      u.userid !== user.userid &&
      (!addMemberQuery.trim() ||
        u.username?.toLowerCase().includes(addMemberQuery.trim().toLowerCase())),
  );

  const showMessagesLoading = !hasLoaded && messages.length === 0;

  /* Telegram removes a deleted message outright rather than leaving a
     "this was deleted" tombstone behind (that's WhatsApp's behaviour), so
     they're filtered out of the render. The rows stay soft-deleted in the
     database, which is what keeps an accidental delete recoverable — and
     `messages` itself keeps them, so the pagination offset stays correct. */
  const visibleMessages = messages.filter((mmm) => !mmm.is_deleted);

  return (
    <>
    <div style={{ display: "contents" }}>
    <div className={chatAreaClasses.chatArea}>
      {/* Chat Header */}
      <div className={chatAreaClasses.chatHeader}>
        {isMobile && (
          <button
            onClick={() => setMobileView("list")}
            className={chatAreaClasses.backButton}
          >
            <i className="ti ti-arrow-left"></i>
          </button>
        )}

        {/* Avatar and name both toggle the profile — clicking either one
            again closes it, rather than only ever opening it. */}
        <div
          onClick={() => setShowGroupInfo((v) => !v)}
          style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
        >
          <InitialsAvatar
            name={groupName}
            imageUrl={groupDetails?.avatar_url || group.avatar_url}
            size="md"
            status="none"
          />
        </div>

        <div
          className={chatAreaClasses.headerInfo}
          onClick={() => setShowGroupInfo((v) => !v)}
          style={{ cursor: "pointer" }}
        >
          <h3 className={chatAreaClasses.headerName}>{groupName}</h3>
          {/* Just the member count, like Telegram — the description belongs
              in the group info panel, not crammed into the header line. */}
          <p className={chatAreaClasses.headerStatus} style={{ color: 'var(--plum-lt)' }}>
            {group.member_count} {Number(group.member_count) === 1 ? "member" : "members"}
          </p>
        </div>

        <div className={chatAreaClasses.headerActions}>
          <button className={`${chatAreaClasses.iconButton} ${chatAreaClasses.bgPale}`} title="Search">
            <i className="ti ti-search"></i>
          </button>
          <button
            className={`${chatAreaClasses.iconButton} ${chatAreaClasses.bgPlum}`}
            onClick={() => onStartCall?.({ audioOnly: true })}
            title="Group Call"
          >
            <i className="ti ti-phone"></i>
          </button>
          <button
            className={`${chatAreaClasses.iconButton} ${chatAreaClasses.bgMagenta}`}
            onClick={() => onStartCall?.()}
            title="Group Video Call"
          >
            <i className="ti ti-video"></i>
          </button>
          {group.user_role === "admin" && (
            <button
              className={`${chatAreaClasses.iconButton} ${chatAreaClasses.bgPale}`}
              onClick={() => setShowAddMember(true)}
              title="Add member"
            >
              <i className="ti ti-user-plus"></i>
            </button>
          )}
          {/* Group info replaces the old leave button — leaving lives inside
              the panel now, next to everything else about the group. */}
          <button
            className={`${chatAreaClasses.iconButton} ${chatAreaClasses.bgPale}`}
            onClick={() => setShowGroupInfo((v) => !v)}
            title="Group info"
          >
            <i className="ti ti-info-circle"></i>
          </button>
        </div>
      </div>

      {/* Pinned message bar — sits between the header and the conversation,
          the way Telegram's does, and clicking it scrolls to the message. */}
      {groupDetails?.pinned_message && (
        <div
          className={chatAreaClasses.pinnedBar}
          onClick={() => {
            const node = chatContainerRef.current?.querySelector(
              `[data-id="${groupDetails.pinned_message.id}"]`,
            );
            node?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        >
          <i className="ti ti-pin"></i>
          <div className={chatAreaClasses.pinnedText}>
            <span className={chatAreaClasses.pinnedLabel}>Pinned message</span>
            <span className={chatAreaClasses.pinnedContent}>
              {groupDetails.pinned_message.content ||
                groupDetails.pinned_message.filename ||
                groupDetails.pinned_message.message_type}
            </span>
          </div>
          {groupDetails.user_role === "admin" && (
            <button
              className={chatAreaClasses.pinnedClose}
              title="Unpin"
              onClick={(e) => {
                e.stopPropagation();
                handleTogglePin({ id: groupDetails.pinned_message.id });
              }}
            >
              <i className="ti ti-x"></i>
            </button>
          )}
        </div>
      )}

      {/* Messages Area */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className={chatAreaClasses.messagesArea}
      >
        <div className={chatAreaClasses.messagesInner}>
          {showMessagesLoading ? (
            <div className={chatAreaClasses.chatLoading}>
              <div className={chatAreaClasses.loadingSpinner}></div>
              <p>Loading messages...</p>
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className={chatAreaClasses.emptyMessages}>
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            visibleMessages.map((message, index) => {
              const prevMsg = visibleMessages[index - 1];
              const messageDate = new Date(
                message.delivered_at || message.created_at || Date.now(),
              );
              const prevMessageDate = prevMsg
                ? new Date(prevMsg.delivered_at || prevMsg.created_at || Date.now())
                : null;
              const showDivider =
                !prevMsg || messageDate.toDateString() !== prevMessageDate.toDateString();

              return (
                <React.Fragment key={message.id || message.tempId}>
                  {showDivider && (
                    <div className={chatAreaClasses.dateDivider}>
                      <span className={chatAreaClasses.dateDividerText}>
                        {messageDate.toDateString() === new Date().toDateString()
                          ? "Today"
                          : messageDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                  <MessageActions
                    message={message}
                    currentUserId={user.userid}
                    isOwnMessage={message.sender_id === user.userid}
                    canEdit={canEditMessage(message)}
                    canDelete={canDeleteMessage(message)}
                    canPin={groupDetails?.user_role === "admin" && !message.tempId}
                    isPinned={groupDetails?.pinned_message_id === message.id}
                    onEdit={startEditing}
                    onDelete={handleDeleteMessage}
                    onPin={handleTogglePin}
                    onReact={handleToggleReaction}
                    onReply={(m) => {
                      setReplyingTo(m);
                      textareaRef.current?.focus();
                    }}
                    onJumpToMessage={(id) => {
                      chatContainerRef.current
                        ?.querySelector(`[data-id="${id}"]`)
                        ?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                  >
                    <MessageRenderer
                      message={message}
                      user={user}
                      chatContainerRef={chatContainerRef}
                      handleMediaLoad={handleMediaLoad}
                      onDownloadClick={() => downloadFile(message)}
                      onCancel={() => cancelDownload(message.id, message)}
                      onAvatarClick={() => {
                        setFocusMemberId(message.sender_id);
                        setShowGroupInfo(true);
                      }}
                      showSenderName
                    />
                  </MessageActions>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>

      {!isAtBottom && unreadCount > 0 && (
        <button
          onClick={() => {
            const container = chatContainerRef.current;
            if (container) container.scrollTop = container.scrollHeight;
            atBottomRef.current = true;
            setIsAtBottom(true);
            setUnreadCount(0);
            markRead();
          }}
          className={chatAreaClasses.newMessageBadge}
        >
          🔔 {unreadCount} new {unreadCount > 1 ? "messages" : "message"}
        </button>
      )}

      {/* Message Input */}
      <div className={chatAreaClasses.inputContainer}>
        {/* Editing bar — pencil, "Editing", and the original text, with the
            message itself loaded into the input below. */}
        {editingMessage && (
          <div className={`${chatAreaClasses.replyPreview} ${chatAreaClasses.editingPreview}`}>
            <i className="ti ti-pencil"></i>
            <div className={chatAreaClasses.replyPreviewBody}>
              <span className={chatAreaClasses.replyPreviewName}>Editing</span>
              <span className={chatAreaClasses.replyPreviewText}>
                {editingMessage.content}
              </span>
            </div>
            <button
              type="button"
              className={chatAreaClasses.replyPreviewClose}
              onClick={cancelEditing}
              title="Cancel editing"
            >
              <i className="ti ti-x"></i>
            </button>
          </div>
        )}

        {/* What you're replying to, above the composer as Telegram shows it */}
        {!editingMessage && replyingTo && (
          <div className={chatAreaClasses.replyPreview}>
            <i className="ti ti-arrow-back-up"></i>
            <div className={chatAreaClasses.replyPreviewBody}>
              <span className={chatAreaClasses.replyPreviewName}>
                {replyingTo.sender_id === user.userid
                  ? "You"
                  : replyingTo.sender_username}
              </span>
              <span className={chatAreaClasses.replyPreviewText}>
                {replyingTo.content ||
                  replyingTo.filename ||
                  replyingTo.message_type}
              </span>
            </div>
            <button
              type="button"
              className={chatAreaClasses.replyPreviewClose}
              onClick={() => setReplyingTo(null)}
              title="Cancel reply"
            >
              <i className="ti ti-x"></i>
            </button>
          </div>
        )}
        <form className={chatAreaClasses.inputRow} onSubmit={handleSendMessage}>
          <button
            type="button"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--plum-lt)', fontSize: '20px', display: 'flex',
              alignItems: 'center', padding: '0 2px', flexShrink: 0
            }}
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
          >
            <i className="ti ti-paperclip"></i>
          </button>

          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onInput={handleInput}
            onKeyDown={handleComposerKeyDown}
            placeholder="Write a message..."
            className={chatAreaClasses.messageInput}
            rows={1}
          />

          <label style={{ display: 'none' }}>
            <input
              type="file"
              ref={fileInputRef}
              accept="*/*"
              onChange={handleFileSelect}
              multiple
            />
          </label>

          {/* Emoji button, where Telegram puts it: in the composer, just
              before send. Inserts at the caret rather than appending, so it
              works mid-sentence. */}
          <div className={chatAreaClasses.emojiAnchor}>
            <button
              type="button"
              className={chatAreaClasses.emojiButton}
              onClick={() => setShowEmojiPicker((v) => !v)}
              title="Emoji"
            >
              <i className="ti ti-mood-smile"></i>
            </button>

            {showEmojiPicker && (
              <>
                <div
                  className={chatAreaClasses.emojiBackdrop}
                  onClick={() => setShowEmojiPicker(false)}
                />
                <div className={chatAreaClasses.composerEmojiPanel}>
                  {COMPOSER_EMOJI.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className={chatAreaClasses.composerEmojiBtn}
                      onClick={() => insertEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            type="submit"
            className={chatAreaClasses.sendButton}
            disabled={!newMessage.trim()}
            title={editingMessage ? "Save edit" : "Send"}
          >
            <i className={editingMessage ? "ti ti-check" : "ti ti-send"}></i>
          </button>
        </form>
      </div>
    </div>

    <GroupInfoSidebar
      group={group}
      details={groupDetails}
      onRefreshDetails={fetchGroupDetails}
      isOpen={showGroupInfo}
      onClose={() => setShowGroupInfo(false)}
      onGroupUpdated={(updated) => {
        setGroupName(updated.name);
        onGroupUpdated?.(updated);
      }}
      onOpenPrivateChat={(member) => {
        setShowGroupInfo(false);
        onOpenPrivateChat?.(member);
      }}
      onLeaveGroup={handleLeaveGroup}
      focusMemberId={focusMemberId}
      onFocusMemberHandled={() => setFocusMemberId(null)}
    />
    </div>

    {showAddMember && (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onClick={() => setShowAddMember(false)}
      >
        <div
          style={{
            background: "var(--wh)", borderRadius: 14, width: 360,
            maxWidth: "90vw", maxHeight: "70vh", display: "flex",
            flexDirection: "column", overflow: "hidden",
            boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            padding: "16px 18px", borderBottom: "1px solid var(--bdr)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <strong style={{ color: "var(--plum)" }}>Add member</strong>
            <button
              type="button"
              onClick={() => setShowAddMember(false)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--plum-lt)" }}
              aria-label="Close"
            >
              <i className="ti ti-x"></i>
            </button>
          </div>

          <div style={{ padding: "12px 18px" }}>
            <input
              type="text"
              autoFocus
              value={addMemberQuery}
              onChange={(e) => setAddMemberQuery(e.target.value)}
              placeholder="Search people..."
              style={{
                width: "100%", boxSizing: "border-box", padding: "10px 14px",
                borderRadius: 10, border: "1px solid var(--bdr)", fontSize: 14,
                fontFamily: "inherit", outline: "none",
              }}
            />
          </div>

          <div style={{ overflowY: "auto", flex: 1, padding: "0 8px 12px" }}>
            {addMemberCandidates.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--plum-lt)", fontSize: 13, padding: "16px 0" }}>
                No one found
              </p>
            ) : (
              addMemberCandidates.map((u) => (
                <div
                  key={u.userid}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", borderRadius: 10,
                  }}
                >
                  <InitialsAvatar name={u.username} imageUrl={u.avatar_url} size="sm" status="none" />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: "var(--plum)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.username}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAddMember(u)}
                    disabled={addingMemberId === u.userid}
                    style={{
                      background: "var(--m)", color: "#fff", border: "none",
                      borderRadius: 999, padding: "6px 14px", fontSize: 12.5,
                      fontWeight: 600, cursor: "pointer",
                      opacity: addingMemberId === u.userid ? 0.6 : 1,
                    }}
                  >
                    {addingMemberId === u.userid ? "Adding…" : "Add"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default GroupChat;
