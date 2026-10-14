import React, {
  useCallback,
  useState,
  useEffect,
  useRef,
  useContext,
  useLayoutEffect,
} from "react";

import { Appstate } from "../App";
// import { CryptoContext } from "../App";
import axiosbase from "../axiosconfig";
import { useSocket } from "../Socketprovider";
import {
  FiAtSign,
  FiGift,
  FiBell,
  FiPaperclip,
  FiMoreVertical,
  FiArrowLeft,
} from "react-icons/fi";
import { RiEmotionHappyLine } from "react-icons/ri";
import { IoMdSend, IoMdPerson, IoMdClose } from "react-icons/io";

// import { showErrorAlert } from "./alerthelper";
import classes from "../pages/styling/chat.module.css";
import chatAreaClasses from "../pages/styling/chatArea.module.css";
import InitialsAvatar from "./InitialsAvatar";
import {
  getAuthenticatedFileUrl,
  createVideoMetadata,
  createAudioMetadata,
  createImageThumbnail,
  createImageThumbnailpreview,
} from "../utils/mediaUtils.js";

// import { PrivateChatStorage } from "../db/dexieDB.js";

import MessageRenderer from "./MessageRenderer";
import OtherProfileSidebar from "./OtherProfileSidebar";
import { useChatContext } from "../context/ChatContext";

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

const PrivateChat = ({
  conversation,
  onClose,
  allUsers,
  savedScroll,
  onSaveScroll,
  setMobileView,
  isMobile,
  onOpenContact,
  onStartCall,
}) => {
  const {
    messages,
    setMessages,
    atBottomRef,
    pendingAutoScrollRef,
    hydratedChatsRef,
    pendingMessagesRef,
    activeUploadsRef,
    resendPendingMessage,
    sendFileToServer,
    downloadFile,
    cancelDownload,
    replaceCache,
    setUnreadCount,
    unreadCount,
    setLastMessage,
  } = useChatContext();

  const { user } = useContext(Appstate);
  // const { cryptoKey } = useContext(CryptoContext);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(!messages || messages.length === 0);
  // const [loadedConversations, setLoadedConversations] = useState({});
  // const [restoringScroll, setRestoringScroll] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showotherprofile, setshowotherprofile] = useState(false);

  // console.log(savedScroll);
  // const seenMessagesRef = useRef(new Set());
  const textareaRef = useRef(null);
  const chatContainerRef = useRef(null);
  const scrollRestoreRef = useRef(null);
  const observerRef = useRef(null);
  const fileInputRef = useRef(null);

  const loadedImageIdsRef = useRef(new Set());
  const lastPrependAtRef = useRef(0);
  /* Restoring the saved scroll position must happen exactly once per time
     this chat is opened — not on every `savedScroll` update, since that prop
     is also how the user's own live scrolling gets reported back up (via
     onSaveScroll in handleScroll). Without this guard, every scroll tick
     round-trips through parent state and back down as a new `savedScroll`,
     re-running this effect and snapping scrollTop to whatever value that
     round trip last captured — a render or two behind the real, live
     scrollTop — which fights the user's own scroll gesture and makes
     scrolling up through older messages feel broken. */
  const initialScrollRestoredRef = useRef(false);
  /* Guards against overlapping "load older messages" requests. Without it,
     a fling/momentum scroll that leaves the container sitting at scrollTop
     0 across several scroll events could fire fetchMessages(false, true)
     more than once before the first request resolved — same offset (read
     from `messages.length`, which hadn't changed yet), so a duplicate
     fetch, and whichever response's `scrollRestoreRef` write landed last
     wins even if it doesn't correspond to what actually got prepended.
     That race — not something wrong with the restore logic itself — is
     the most likely reason the scroll jump only showed up sometimes. */
  const isLoadingOlderRef = useRef(false);
  // const imageLoadTimeoutRef = useRef(null);
  const isInitialLoadRef = useRef(true); // Track if this is the very first load
  const isRestoringScrollRef = useRef(false);
  // const [imagesToLoad, setImagesToLoad] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const socket = useSocket();

  const otherUser = allUsers.find(
    (u) => u.userid === conversation.other_user_id,
  );

  const mergeUniqueById = (arr, prev = []) => {
    const validArr = arr.filter(
      (m) => m && (m.content || m.preview || m.fileurl),
    );
    const validPrev = prev.filter(
      (m) => m && (m.content || m.preview || m.fileurl),
    );

    const map = new Map(validPrev.map((m) => [m.id || m.tempId, m]));
    validArr.forEach((m) => map.set(m.id || m.tempId, m));
    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(a.delivered_at || a.created_at) -
        new Date(b.delivered_at || b.created_at),
    );
  };

  const generateTempId = () => {
    return `temp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  };

  useEffect(() => {
    if (!socket || !user?.userid || !conversation?.other_user_id) return;

    if (!hydratedChatsRef.current[conversation.other_user_id]) {
      // This is the first time opening this chat - mark as initial load
      // console.log(savedScroll);
      setLoading(true);
      scrollRestoreRef.current = null;
      isInitialLoadRef.current = true;
      // syncreadmessages();
      fetchMessages();
      // pendingsyncdexie();
      // if (!scrollRestoreRef.current) {
      //   onSaveScroll(conversation.other_user_id, scrollTop);
      // }

      // console.log(savedScroll);
    } else {
      // User is returning to this chat - not initial load
      // console.log(savedScroll);
      isInitialLoadRef.current = false;
      setLoading(false);
    }

    // Reset when conversation changes
    return () => {
      // Cleanup when switching conversations
    };


  }, [socket, user?.userid, conversation.other_user_id, savedScroll]);

  useEffect(() => {
    if (!conversation?.other_user_id) return;
    replaceCache(conversation.other_user_id, messages);
  }, [messages, conversation?.other_user_id]);

  // ✅ fix — add isDownloading guard

  useEffect(() => {
    const mediaMessages = messages.filter(
      (m) =>
        m.message_type !== "text" &&
        m.message_type !== "audio" &&
        !m.fileUrl &&
        !m.isDownloading && // skip if already in progress
        !m.isPaused &&
        m.aspect_ratio < 2,
    );
    mediaMessages.forEach((msg) => downloadFile(msg));
  }, [messages]);


  useLayoutEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    // on prepended older messages, maintain the user's viewport.

    if (scrollRestoreRef.current) {
      const { prevHeight } = scrollRestoreRef.current;
      /* This has to happen synchronously, in this same layout-effect pass —
         that's the entire reason to use useLayoutEffect instead of
         useEffect here: it runs after the DOM has the new (taller) content
         but before the browser paints, so setting scrollTop here is
         invisible to the user. The previous 300ms setTimeout threw that
         guarantee away: the browser painted the new content against the
         *old* scrollTop first (visibly jumping to whatever ended up at the
         top), then snapped to the correct position 300ms later — that
         two-step jump was the "motion" in the message area. */
      const delta = container.scrollHeight - prevHeight;
      container.scrollTop = delta; // keep the same messages at same place
      onSaveScroll(conversation.other_user_id, container.scrollTop);
      scrollRestoreRef.current = null;
      return;
    } else if (
      !initialScrollRestoredRef.current &&
      savedScroll !== null &&
      !pendingAutoScrollRef.current
    ) {
      isRestoringScrollRef.current = true;
      initialScrollRestoredRef.current = true;

      // const container = chatContainerRef.current;
      // if (!container) return;

      const tryRestore = () => {
        const maxScroll = container.scrollHeight - container.clientHeight + 5;

        // console.log("saved:", savedScroll, "max:", maxScroll);

        if (maxScroll >= savedScroll) {
          container.scrollTop = savedScroll;
          // console.log(savedScroll);
          // console.log(container.scrollTop);
          isRestoringScrollRef.current = false;
          return;
        }

        requestAnimationFrame(tryRestore);
      };

      tryRestore();
      return;
    }

    // scroll to bottom

    if (pendingAutoScrollRef.current) {
      scrollRestoreRef.current = null;
      container.scrollTop = container.scrollHeight;
      atBottomRef.current = true;
      setIsAtBottom(true);
      onSaveScroll(conversation.other_user_id, container.scrollTop);

      setUnreadCount((prev) => ({
        ...prev,
        [conversation.other_user_id]: 0,
      }));

      pendingAutoScrollRef.current = false;

      return;
    }


  }, [
    messages,
    conversation?.other_user_id,
    savedScroll,
    setUnreadCount,
    pendingAutoScrollRef,
  ]);

  useEffect(() => {
    // savedScroll = null;
    scrollRestoreRef.current = null;
    isInitialLoadRef.current = true;
  }, [conversation.other_user_id]);

  // Intersection observer for read receipts

  useEffect(() => {
    if (!chatContainerRef.current) return;
    const container = chatContainerRef.current;

    if (observerRef.current) observerRef.current.disconnect();

    const markMessageRead = async (node) => {
      const messageId = node.dataset.id;
      const message = messages.find((m) => m.id === messageId);

      if (!message || message.is_read || message.receiver_id !== user.userid)
        return;

      // console.log("✅ Mark read:", message.id);

      if (messageId.startsWith("temp-")) {
        return;
      }

      try {
        await axiosbase.put(`/messages/read/private/${message.id}`);

        setMessages((prev) =>
          prev.map((m) => (m.id === message.id ? { ...m, is_read: true } : m)),
        );
        observerRef.current.unobserve(node);
      } catch (err) {
        console.error(err);
      }
    };

    // console.log(observerRef.current);
    observerRef.current = new IntersectionObserver(
      async (entries) => {
        entries.forEach(async (entry) => {
          if (entry.isIntersecting) {
            console.log("Message in view:", entry.isIntersecting);
            const messageId = entry.target.dataset.id;
            const message = messages.find((m) => m.id === messageId);
            console.log(
              "Message in view:",
              message,
              !message.is_read,
              message.receiver_id === user.userid,
            );
            if (
              message &&
              !message.is_read &&
              message.sender_id !== user.userid &&
              message.receiver_id === user.userid
            ) {
              // Update backend
              try {
                console.log("📡 Marking message read:", message.id);
                await axiosbase.put(`/messages/read/private/${message.id}`);
                // Update locally
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === message.id ? { ...m, is_read: true } : m,
                  ),
                );
                // Decrease unread counter for this conversation
                setUnreadCount((prev) => ({
                  ...prev,
                  [conversation.other_user_id]: Math.max(
                    (prev[conversation.other_user_id] || 1) - 1,
                    0,
                  ),
                }));

                // console.log(message);
                // await PrivateChatStorage.saveMessage(
                //   {
                //     id: message.id,
                //     sender_username: message.sender_username,
                //     chatId: conversation.other_user_id,
                //     sender_id: message.sender_id,
                //     receiver_id: message.receiver_id,
                //     content: message.content,
                //     created_at: message.created_at,
                //     message_type: message.message_type,
                //     is_read: true,
                //     delivered_at: message.delivered_at,
                //     preview: message.preview,
                //     fileUrl: message.fileurl,
                //     fileName: message.filename,
                //     filesize: message.filesize,
                //   },
                //   cryptoKey
                // );
              } catch (err) {
                console.error("Error marking message as read:", err);
              }
            }
          }
        });
      },
      { root: container, threshold: 0.65 },
    );
    // 80% visible

    const observeAllMessages = () => {
      const nodes = container.querySelectorAll("[data-id]");
      nodes.forEach((node) => {
        const msg = messages.find((m) => m.id === node.dataset.id);

        if (msg && !msg.is_read && msg.receiver_id === user.userid) {
          observerRef.current.observe(node);
        }

        checkVisibility(node);
      });
    };

    const checkVisibility = (node) => {
      const containerRect = container.getBoundingClientRect();

      const rect = node.getBoundingClientRect();

      const visibleHeight =
        Math.min(rect.bottom, containerRect.bottom) -
        Math.max(rect.top, containerRect.top);

      const ratio = visibleHeight / rect.height;

      // console.log("visibility ratio:", ratio);

      if (ratio >= 0.65) markMessageRead(node);
    };

    const timeout = setTimeout(() => {
      observeAllMessages();
    }, 50);

    /* observeAllMessages() used to also re-run on every native "scroll"
       event — container.querySelectorAll("[data-id]") followed by a
       getBoundingClientRect() per message, on every scroll tick. That is
       O(message count) synchronous layout work per tick, and on a
       conversation with many messages it was heavy enough to make
       scrolling itself feel broken/stuck. It was also redundant: an
       IntersectionObserver's entire purpose is to report visibility
       changes as they happen without any scroll-event polling — the
       observer set up above (and re-armed whenever `messages` changes,
       since this whole effect re-runs then) already does the job this
       scroll listener was duplicating. */

    return () => {
      clearTimeout(timeout);
      observerRef.current.disconnect();
    };

    // const nodes = container.querySelectorAll("[data-id]");
    // nodes.forEach((node) => observerRef.current.observe(node));

    // return () => observerRef.current.disconnect();
  }, [messages, user.userid, conversation.other_user_id]);



  // const pendingsyncdexie = async () => {
  //   const token = sessionStorage.getItem("token");
  //   if (!token || !cryptoKey) return;
  //   try {
  //     const userpending = await PrivateChatStorage.pendingmessages(
  //       user.userid,
  //       cryptoKey,
  //       conversation.other_user_id
  //     );
  //     if (!pendingMessagesRef.current[conversation.other_user_id]) {
  //       pendingMessagesRef.current[conversation.other_user_id] = [];
  //     }
  //     for (const msg of userpending) {
  //       pendingMessagesRef.current[conversation.other_user_id].push(msg);
  //       await resendPendingMessage(msg);
  //     }
  //   } catch (error) {
  //     console.log(error);
  //   }
  // };

  // const syncreadmessages = async () => {
  //   const token = sessionStorage.getItem("token");
  //   if (!token || !cryptoKey) return;

  //   try {
  //     const response = await axiosbase.get(
  //       `/messages/syncread/${conversation.other_user_id}`
  //     );

  //     const messages = response.data;

  //     await Promise.all(
  //       messages.map(async (message) => {
  //         await PrivateChatStorage.updateMessageRead(
  //           message.receiver_id,
  //           message.id
  //         );
  //       })
  //     );

  //     // setMessages((prev) =>
  //     //   prev.map((m) => (m.id === messages.id ? { ...m, is_read: true } : m))
  //     // );
  //   } catch (error) {
  //     console.log(error);
  //   }
  // };

  const fetchMessages = async (initial = true, prepend = false) => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      hydratedChatsRef.current[conversation.other_user_id] = true;
      setLoading(false);
      return;
    }

    if (prepend) {
      if (isLoadingOlderRef.current) return; // a request is already in flight
      isLoadingOlderRef.current = true;
    }

    if (initial) {
      setLoading(true);
    }

    /* Captured here, before the request goes out, rather than after it
       resolves — the closer this reads to the moment the user actually hit
       the top, the less chance anything else (a socket message arriving,
       an image finishing loading) shifts the layout in between and makes
       the eventual delta wrong. */
    const prependContainer = prepend ? chatContainerRef.current : null;
    const prevHeightAtRequest = prependContainer?.scrollHeight ?? null;

    // if (!token || !cryptoKey) return;

    // if (initial) {
    //   setoffset((prev) => ({
    //     ...prev,
    //     [conversation.other_user_id]: 0,
    //   }));
    // }

    try {
      // 1. Try local Dexie first

      // const localMsgs = await PrivateChatStorage.getMessages(
      //   conversation.other_user_id,
      //   cryptoKey,
      //   20,
      //   initial ? 0 : offset[conversation.other_user_id],
      //   user.userid
      // );

      // if (localMsgs.length && offset[conversation.other_user_id] == undefined) {
      //   setMessages((prev) => mergeUniqueById([...localMsgs, ...prev]));
      //   setoffset((prev) => ({
      //     ...prev,
      //     [conversation.other_user_id]:
      //       prev[conversation.other_user_id] + localMsgs.length,
      //   }));

      //   // console.log(
      //   //   `from ${localMsgs[0].receiver_id}`,
      //   //   offset[conversation.other_user_id]
      //   // );

      //   setLoading(false);
      //   pendingAutoScrollRef.current = true;
      //   return;
      // } else if (localMsgs.length && offset[conversation.other_user_id] !== 0) {
      //   setMessages((prev) => mergeUniqueById([...localMsgs, ...prev]));
      //   setoffset((prev) => ({
      //     ...prev,
      //     [conversation.other_user_id]:
      //       prev[conversation.other_user_id] + localMsgs.length,
      //   }));

      //   // console.log(
      //   //   `from ${localMsgs[0].receiver_id}`,
      //   //   offset[conversation.other_user_id]
      //   // );
      //   const container = chatContainerRef.current;
      //   const prevHeight = container.scrollHeight;
      //   scrollRestoreRef.current = { prevHeight };
      //   return;
      // } else if (!localMsgs.length) {
      //   setoffset((prev) => ({
      //     ...prev,
      //     [conversation.other_user_id]: prev[conversation.other_user_id] + 20,
      //   }));
      // }

      // 2. Then sync from server

      const response = await axiosbase.get(
        `/messages/private/${conversation.other_user_id}?limit=20&offset=${initial ? 0 : messages.length
        }`,
      );

      if (initial) {
        setMessages((prev) => mergeUniqueById([...response.data, ...prev]));
        // console.log(response.data);
        pendingAutoScrollRef.current = true;
        hydratedChatsRef.current[conversation.other_user_id] = true;
      } else if (prepend) {
        if (response.data.length === 0) return;
        setMessages((prev) => mergeUniqueById([...response.data, ...prev]));
        scrollRestoreRef.current = { prevHeight: prevHeightAtRequest };
        lastPrependAtRef.current = Date.now();
      }

      // Save to Dexie (encrypted)
      // for (const msg of response.data) {
      //   await PrivateChatStorage.saveMessage(
      //     {
      //       chatId: conversation.other_user_id,
      //       sender_username: msg.sender_username,
      //       sender_id: msg.sender_id,
      //       receiver_id: msg.receiver_id,
      //       content: msg.content,
      //       created_at: msg.created_at,
      //       message_type: msg.message_type,
      //       is_read: msg.is_read,
      //       delivered_at: msg.delivered_at,
      //       id: msg.id,
      //       fileurl: msg.fileurl || null,
      //       fielname: msg.filename || null,
      //       filesize: msg.filesize || null,
      //     },
      //     cryptoKey
      //   );
      // }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching messages:", error);
      if (initial) {
        hydratedChatsRef.current[conversation.other_user_id] = true;
      }
      setLoading(false);
    } finally {
      if (prepend) isLoadingOlderRef.current = false;
    }
  };

  /* The native scroll event can fire far faster than React needs to react
     to it (every pixel, on a fast trackpad/wheel gesture). Each call here
     writes to parent state (onSaveScroll), which re-renders Chat.jsx and,
     on a conversation with many messages, adds up to real per-frame cost —
     on top of what the scroll itself already costs the browser. Capping
     this to once per animation frame (rAF naturally coalesces multiple
     scroll events that land in the same frame into one) keeps that work
     from competing with the scroll itself. */
  const scrollFrameRef = useRef(null);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
    };
  }, []);

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

      if (!scrollRestoreRef.current) {
        onSaveScroll(conversation.other_user_id, scrollTop);
      }

      if (scrollTop === 0) {
        fetchMessages(false, true); // load older
      }

      if (atBottom)
        setUnreadCount((prev) => ({
          ...prev,
          [conversation.other_user_id]: 0,
        }));
    });
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim()) return;
    scrollRestoreRef.current == null;

    console.log("Sending message:", newMessage);
    const tempId = generateTempId();
    const optimisticMessage = {
      id: tempId,
      tempId,
      content: newMessage,
      sender_id: user.userid,
      receiver_id: conversation.other_user_id,
      sender_username: user.username,
      created_at: null,
      is_read: false,
      delivered_at: new Date().toISOString(),
      status: "pending",
      message_type: "text",
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setLastMessage(conversation.other_user_id, optimisticMessage);
    if (!pendingMessagesRef.current[conversation.other_user_id]) {
      pendingMessagesRef.current[conversation.other_user_id] = [];
    }

    pendingMessagesRef.current[conversation.other_user_id].push(
      optimisticMessage,
    );
    setNewMessage("");
    scrollRestoreRef.current = null;
    pendingAutoScrollRef.current = true;

    // Save pending into Dexie
    // if (cryptoKey) {
    //   PrivateChatStorage.saveMessage(
    //     {
    //       id: optimisticMessage.id,
    //       chatId: conversation.other_user_id,
    //       sender_username: optimisticMessage.sender_username,
    //       sender_id: optimisticMessage.sender_id,
    //       receiver_id: optimisticMessage.receiver_id,
    //       content: optimisticMessage.content,
    //       created_at: optimisticMessage.created_at,
    //       message_type: optimisticMessage.message_type,
    //       is_read: optimisticMessage.is_read,
    //       delivered_at: optimisticMessage.delivered_at,
    //       status: optimisticMessage.status,
    //       tempId: optimisticMessage.tempId,
    //     },
    //     cryptoKey
    //   );
    // }

    try {
      if (!navigator.onLine) throw new Error("Offline");
      await resendPendingMessage(optimisticMessage);
    } catch (error) {
      console.warn("Message pending:", optimisticMessage.content);
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "20px"; // reset to min height
    const scrollHeight = textarea.scrollHeight;

    if (scrollHeight <= 150) {
      textarea.style.height = scrollHeight + "px"; // grow
    } else {
      textarea.style.height = "150px"; // max height
      textarea.scrollTop = textarea.scrollHeight; // scroll inside
    }
  };

  /* Enter sends; Shift+Enter inserts a newline. A plain <textarea> does the
     opposite by default (Enter always inserts a newline, and there is no
     built-in way to submit on it), so this has to be handled explicitly. */
  const handleComposerKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };



  const handleMediaLoad = (id, isSender) => {
    // Skip if this image was already loaded
    if (loadedImageIdsRef.current.has(id)) {
      return;
    }

    // console.log(loadedImageIdsRef.current);

    loadedImageIdsRef.current.add(id);

    setImagesLoaded((prev) => {
      // console.log(prev);
      const newCount = prev + 1;
      // console.log(newCount);

      // For sender, ALWAYS scroll to bottom when their image loads
      // This ensures sender sees their sent image immediately

      if (isSender && pendingAutoScrollRef.current) {
        scrollRestoreRef.current = null;
        // Use multiple attempts to ensure scroll happens
        // const container = chatContainerRef.current;
        // console.log(container.scrollHeight);
        // console.log(container.scrollTop);
        requestAnimationFrame(() => {
          setTimeout(() => {
            const container = chatContainerRef.current;
            if (container) {
              // console.log(container.scrollTop);
              container.scrollTop += container.scrollHeight;
              // console.log(container.scrollTop);
              savedScroll = container.scrollTop;

              atBottomRef.current = true;
              setIsAtBottom(true);
            }
          }, 200);
        });
      }

      // Scroll when all images/videos are loaded
      // if (newCount === imagesToLoad && imagesToLoad > 0) {
      //   const wasWaitingForInitial = waitingForInitialImagesRef.current;
      //   waitingForInitialImagesRef.current = false;

      //   // Check current scroll position to see if user is at bottom
      //   const container = chatContainerRef.current;
      //   let isCurrentlyAtBottom = false;
      //   if (container) {
      //     const { scrollTop, scrollHeight, clientHeight } = container;
      //     isCurrentlyAtBottom =
      //       Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
      //   }

      //   // Scroll if:
      //   // 1. pendingAutoScroll is set (new message arrived and user was at bottom) - HIGHEST PRIORITY
      //   // 2. OR It's the initial load (was waiting for images on first open) AND no savedScroll
      //   // 3. OR user is currently at the bottom (new message arrived while at bottom)
      //   // Note: pendingAutoScroll ALWAYS triggers scroll - this handles receiver at bottom case
      //   const shouldScroll =
      //     pendingAutoScrollRef.current ||
      //     (wasWaitingForInitial &&
      //       isInitialLoadRef.current &&
      //       savedScroll === null) ||
      //     isCurrentlyAtBottom;

      //   if (shouldScroll) {
      //     // Use requestAnimationFrame and setTimeout to ensure DOM is fully updated
      //     requestAnimationFrame(() => {
      //       setTimeout(() => {
      //         const container = chatContainerRef.current;
      //         if (container) {
      //           container.scrollTop = container.scrollHeight;
      //           const { scrollTop, scrollHeight, clientHeight } = container;
      //           const atBottom =
      //             Math.abs(scrollHeight - scrollTop - clientHeight) < 5;
      //           atBottomRef.current = atBottom;
      //           setIsAtBottom(atBottom);

      //           // Mark initial load as complete
      //           if (wasWaitingForInitial && isInitialLoadRef.current) {
      //             isInitialLoadRef.current = false;
      //           }
      //           // Clear pending auto scroll
      //           if (pendingAutoScrollRef.current) {
      //             pendingAutoScrollRef.current = false;
      //             setUnreadCount((prev) => ({
      //               ...prev,
      //               [conversation.other_user_id]: 0,
      //             }));
      //           }
      //         }
      //       }, 200);
      //     });
      //   }
      // }

      return newCount;
    });
  };





  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    for (const file of files) {
      const tempId = generateTempId();

      // Detect message type
      let messageType = "file";
      if (file.type.startsWith("image/")) messageType = "image";
      else if (file.type.startsWith("video/")) messageType = "video";
      else if (file.type.startsWith("audio/")) messageType = "audio";

      // console.log(file.type);

      let preview = null;
      let optimisticMessage = null;
      let fileurl = null;

      // Only create preview for images or short videos
      try {
        if (messageType === "image") {
          // For sender, we can show full image immediately
          const metadata = await getImageMetadata(file);
          preview = await createImageThumbnailpreview(file);
          fileurl = await createImageThumbnail(file);
          // fileUrl = URL.createObjectURL(file);
          // console.log(file);
          optimisticMessage = {
            id: tempId,
            tempId,
            content: null,
            filename: file.name,
            filesize: file.size,
            sender_id: user.userid,
            receiver_id: conversation.other_user_id,
            sender_username: user.username,
            is_read: false,
            delivered_at: new Date().toISOString(),
            status: "pending",
            message_type: messageType,
            width: metadata.width,
            height: metadata.height,
            aspect_ratio: metadata.aspectRatio,
            duration: 0,
            file,
            preview,
            fileurl,
            uploadProgress: 0,
            downloadProgress: 0,
          };
        } else if (messageType === "video") {
          // Only optimistic render for short videos (<30s)

          const metadata = await createVideoMetadata(file);

          if (Number.isFinite(metadata.duration) && metadata.duration > 0) {
            // preview = await createVideoThumbnail(file);
            optimisticMessage = {
              id: tempId,
              tempId,
              content: null,
              filename: file.name,
              filesize: file.size,
              sender_id: user.userid,
              receiver_id: conversation.other_user_id,
              sender_username: user.username,
              created_at: new Date().toISOString(),
              is_read: false,
              delivered_at: new Date().toISOString(),
              status: "pending",
              message_type: messageType,
              width: metadata.width,
              height: metadata.height,
              aspect_ratio: metadata.aspectRatio,
              duration: Math.round(metadata.duration),
              file,
              preview,
              fileurl,
              uploadProgress: 0,
              downloadProgress: 0,
            };
          }
        } else if (messageType === "audio") {
          const audioMetadata = await createAudioMetadata(file);
          // Other files: no optimistic UI
          if (
            Number.isFinite(audioMetadata.duration) &&
            audioMetadata.duration > 0
          ) {
            optimisticMessage = {
              id: tempId,
              tempId,
              content: null,
              filename: file.name,
              filesize: file.size,
              sender_id: user.userid,
              receiver_id: conversation.other_user_id,
              sender_username: user.username,
              created_at: new Date().toISOString(),
              is_read: false,
              delivered_at: new Date().toISOString(),
              status: "pending",
              message_type: messageType,
              file,
              uploadProgress: 0,
              downloadProgress: 0,
              width: 0,
              height: 0,
              aspect_ratio: 0,
              duration: Math.round(audioMetadata.duration),
            };
          }
        } else {
          optimisticMessage = {
            id: tempId,
            tempId,
            content: null,
            filename: file.name,
            filesize: file.size,
            sender_id: user.userid,
            receiver_id: conversation.other_user_id,
            sender_username: user.username,
            created_at: new Date().toISOString(),
            is_read: false,
            delivered_at: new Date().toISOString(),
            status: "pending",
            message_type: messageType,
            file,
            uploadProgress: 0,
            downloadProgress: 0,
            width: 0,
            height: 0,
            aspect_ratio: 0,
            duration: 0,
          };
        }
      } catch (err) {
        console.log("Preview generation failed", err);
      }

      // Add optimistic message if it exists
      if (optimisticMessage) {
        setMessages((prev) => [...prev, optimisticMessage]);
        setLastMessage(conversation.other_user_id, optimisticMessage);
        pendingAutoScrollRef.current = true;
        if (!pendingMessagesRef.current[conversation.other_user_id]) {
          pendingMessagesRef.current[conversation.other_user_id] = [];
        }
        pendingMessagesRef.current[conversation.other_user_id].push(
          optimisticMessage,
        );
      }

      // if (cryptoKey) {
      //   await PrivateChatStorage.saveMessage(
      //     {
      //       chatId: conversation.other_user_id,
      //       id: optimisticMessage.tempId,
      //       tempId: optimisticMessage.tempId,
      //       content: optimisticMessage.content,
      //       filename: optimisticMessage.filename,
      //       filesize: optimisticMessage.filesize,
      //       sender_id: optimisticMessage.sender_id,
      //       receiver_id: optimisticMessage.receiver_id,
      //       sender_username: optimisticMessage.sender_username,
      //       created_at: optimisticMessage.created_at,
      //       is_read: optimisticMessage.is_read,
      //       delivered_at: optimisticMessage.delivered_at,
      //       status: "pending",
      //       message_type: optimisticMessage.message_type,
      //       preview: optimisticMessage.preview,
      //       uploadProgress: optimisticMessage.uploadProgress,
      //       downloadProgress: optimisticMessage.downloadProgress,
      //     },
      //     cryptoKey
      //   );
      // }

      // Upload file to server
      try {
        if (!navigator.onLine) throw new Error("Offline");
        await sendFileToServer(optimisticMessage);
      } catch (error) {
        console.log("File upload pending:", file.name);
      }
    }

    e.target.value = ""; // reset input
  };

  const handleotherprofiledetail = () => {
    setshowotherprofile((prev) => !prev);
  };

  /* On mobile the profile is its own screen rather than a side panel. */
  const openProfile = () => {
    if (isMobile && onOpenContact) onOpenContact();
    else handleotherprofiledetail();
  };

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return "";

    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const showMessagesLoading =
    loading ||
    (!hydratedChatsRef.current[conversation.other_user_id] &&
      messages?.length === 0);

  return (
    <>
      <div style={{ display: 'contents' }}>
        <div className={chatAreaClasses.chatArea}>
          {/* chat header  */}
          <div className={chatAreaClasses.chatHeader}>
            {isMobile && (
              <button
                onClick={() => setMobileView("list")}
                className={chatAreaClasses.backButton}
              >
                <i className="ti ti-arrow-left"></i>
              </button>
            )}
            
            <div onClick={openProfile} style={{cursor: "pointer"}}>
              <InitialsAvatar
                name={conversation.other_username}
                imageUrl={conversation.avatar_url}
                size="md"
                status="none"
              />
            </div>

            <div
              className={chatAreaClasses.headerInfo}
              onClick={openProfile}
            >
              <h3 className={chatAreaClasses.headerName}>{conversation.other_username}</h3>
              <p className={chatAreaClasses.headerStatus}>
                ● {otherUser?.status === "online" ? "Online now" : "Offline"}
              </p>
            </div>

            <div className={chatAreaClasses.headerActions}>
              <button className={`${chatAreaClasses.iconButton} ${chatAreaClasses.bgPale}`} title="Search">
                <i className="ti ti-search"></i>
              </button>
              <button
                className={`${chatAreaClasses.iconButton} ${chatAreaClasses.bgPlum}`}
                onClick={() => onStartCall?.({ audioOnly: true })}
                title="Call"
              >
                <i className="ti ti-phone"></i>
              </button>
              <button
                className={`${chatAreaClasses.iconButton} ${chatAreaClasses.bgMagenta}`}
                onClick={() => onStartCall?.()}
                title="Video Call"
              >
                <i className="ti ti-video"></i>
              </button>
              <button className={`${chatAreaClasses.iconButton} ${chatAreaClasses.bgPale}`} onClick={openProfile} title="Profile Details">
                <i className="ti ti-dots"></i>
              </button>
            </div>
          </div>

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
              ) : messages?.length === 0 ? (
                <div className={chatAreaClasses.emptyMessages}>
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages?.map((message, index) => {
                  const prevMsg = messages[index - 1];
                  /* A message optimistically appended before the server has
                     confirmed it only has `delivered_at` (its own real
                     timestamp) — `created_at` is null until the response
                     comes back. Reading `created_at` alone here turned that
                     null into `new Date(null)` = the Unix epoch, so a
                     message you just sent could briefly show "Jan 1, 1970"
                     as its date divider. Same fallback order TextMessage.jsx
                     already uses for the per-message time. */
                  const messageDate = new Date(
                    message.delivered_at || message.created_at || Date.now(),
                  );
                  const prevMessageDate = prevMsg
                    ? new Date(prevMsg.delivered_at || prevMsg.created_at || Date.now())
                    : null;
                  const showDivider =
                    !prevMsg ||
                    messageDate.toDateString() !== prevMessageDate.toDateString();

                  return (
                    <React.Fragment key={message.id || message.tempId}>
                      {showDivider && (
                        <div className={chatAreaClasses.dateDivider}>
                          <span className={chatAreaClasses.dateDividerText}>
                            {messageDate.toDateString() === new Date().toDateString()
                              ? "Today"
                              : messageDate.toLocaleDateString([], {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                          </span>
                        </div>
                      )}
                      <MessageRenderer
                        message={message}
                        onDownloadClick={() => downloadFile(message)}
                        user={user}
                        chatContainerRef={chatContainerRef}
                        handleMediaLoad={handleMediaLoad}
                        onCancel={() => cancelDownload(message.id, message)}
                        onAvatarClick={openProfile}
                      />
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>

          {!isAtBottom && (unreadCount[conversation.other_user_id] || 0) > 0 && (
            <button
              onClick={() => {
                chatContainerRef.current.scrollTop =
                  chatContainerRef.current.scrollHeight;
                setUnreadCount((prev) => ({
                  ...prev,
                  [conversation.other_user_id]: 0,
                }));
              }}
              className={chatAreaClasses.newMessageBadge}
            >
              🔔 {unreadCount[conversation.other_user_id] || 0} new{" "}
              {(unreadCount[conversation.other_user_id] || 0) > 1
                ? "messages"
                : "message"}
            </button>
          )}

          {/* Message Input */}
          <div className={chatAreaClasses.inputContainer}>
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
                type="text"
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

              <button
                type="submit"
                className={chatAreaClasses.sendButton}
                disabled={!newMessage.trim()}
              >
                <i className="ti ti-send"></i>
              </button>
            </form>
          </div>
        </div>

        {/* Other Profile Container */}
        <OtherProfileSidebar
          conversation={conversation}
          otherUser={otherUser}
          showotherprofile={showotherprofile}
          handleotherprofiledetail={handleotherprofiledetail}
        />
      </div>
    </>
  );
};

export default PrivateChat;
