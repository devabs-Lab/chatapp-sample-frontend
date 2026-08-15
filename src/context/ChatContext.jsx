import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useSocket } from "../Socketprovider";
import { Appstate } from "../App";
import axiosbase from "../axiosconfig";

const ChatContext = createContext(null);

export const useChatContext = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used inside <ChatProvider>");
  return ctx;
};

export const ChatProvider = ({ children }) => {
  const { user } = useContext(Appstate);
  const socket = useSocket();

  // ── Refs ────────────────────────────────────────────────────────────────────
  const atBottomRef = useRef(true);
  const pendingAutoScrollRef = useRef(false);
  const hydratedChatsRef = useRef({});
  const pendingMessagesRef = useRef({});
  const activeUploadsRef = useRef({});
  const downloadControllersRef = useRef({});

  // ── State ───────────────────────────────────────────────────────────────────
  const [offset, setoffset] = useState({});
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesCache, setMessagesCache] = useState({});
  const [unreadCount, setUnreadCount] = useState({});

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const mergeUniqueById = (arr, prev = []) => {
    const map = new Map(prev.map((m) => [m.id || m.tempId, m]));
    arr.forEach((m) => map.set(m.id || m.tempId, m));
    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(a.delivered_at || a.created_at || 0) -
        new Date(b.delivered_at || b.created_at || 0),
    );
  };

  const updateCache = (other_user_id, newMessage) => {
    setMessagesCache((prev) => {
      const prevMessages = prev[other_user_id] || [];
      return {
        ...prev,
        [other_user_id]: mergeUniqueById([...prevMessages, newMessage]),
      };
    });
  };

  const replaceCache = (other_user_id, messagesArray) => {
    setMessagesCache((prev) => ({
      ...prev,
      [other_user_id]: messagesArray,
    }));
  };

  const markerCache = (other_user_id, messageId) => {
    setMessagesCache((prev) => ({
      ...prev,
      [other_user_id]: (prev[other_user_id] || []).map((m) =>
        m.id === messageId ? { ...m, is_read: true } : m,
      ),
    }));
  };

  // ── Abort uploads on page unload ─────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      Object.values(activeUploadsRef.current).forEach((controller) => {
        controller.abort();
      });
      activeUploadsRef.current = {};
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // ── Retry pending messages on reconnect ──────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      console.log("Internet restored → retrying uploads");
      Object.values(pendingMessagesRef.current).forEach((msgs) => {
        msgs.forEach((msg) => {
          if (msg.message_type === "text") {
            resendPendingMessage(msg);
          } else {
            sendFileToServer(msg);
          }
        });
      });
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  // ── Socket listeners ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !user?.userid) return;

    const handleIncomingMessage = (message) => {
      const otherUserId =
        message.sender_id === user.userid
          ? message.receiver_id
          : message.sender_id;

      const belongsToCurrentChat =
        otherUserId === selectedConversation?.other_user_id;

      if (belongsToCurrentChat) {
        if (!atBottomRef.current) {
          setUnreadCount((prev) => ({
            ...prev,
            [otherUserId]: (prev[otherUserId] || 0) + 1,
          }));
        } else {
          pendingAutoScrollRef.current = true;
        }
        setMessagesCache((prev) => ({
          ...prev,
          [otherUserId]: mergeUniqueById([
            ...(prev[otherUserId] || []),
            message,
          ]),
        }));
        setMessages((prev) => mergeUniqueById([...prev, message]));
      } else {
        updateCache(otherUserId, message);
        setUnreadCount((prev) => ({
          ...prev,
          [otherUserId]: (prev[otherUserId] || 0) + 1,
        }));
      }
    };

    const handleMessageRead = ({ messageId, receiver_id }) => {
      if (selectedConversation?.other_user_id === receiver_id) {
        console.log(selectedConversation?.other_user_id);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, is_read: true } : m,
          ),
        );
      } else {
        console.log("it worked");
        markerCache(receiver_id, messageId);
      }
    };

    const fetchUnreadMessages = async () => {
      try {
        const res = await axiosbase.get("/messages/unread");
        const unreadMessages = res.data;
        if (!unreadMessages.length) return;

        for (const msg of unreadMessages) {
          const alreadyInCache = messagesCache[msg.sender_id]?.some(
            (m) => m.id === msg.id,
          );
          if (!alreadyInCache) {
            const belongsToCurrentChat =
              msg.sender_id === selectedConversation?.other_user_id;
            if (belongsToCurrentChat) {
              if (!atBottomRef.current) {
                setUnreadCount((prev) => ({
                  ...prev,
                  [msg.sender_id]: (prev[msg.sender_id] || 0) + 1,
                }));
              } else {
                pendingAutoScrollRef.current = true;
              }
              setMessagesCache((prev) => ({
                ...prev,
                [msg.sender_id]: mergeUniqueById([
                  ...(prev[msg.sender_id] || []),
                  msg,
                ]),
              }));
              setMessages((prev) => mergeUniqueById([...prev, msg]));
            } else {
              updateCache(msg.sender_id, msg);
              setUnreadCount((prev) => ({
                ...prev,
                [msg.sender_id]: (prev[msg.sender_id] || 0) + 1,
              }));
            }
          }
        }
      } catch (err) {
        console.error("Error fetching unread messages:", err);
      }
    };

    fetchUnreadMessages();

    const handleOnline = () => fetchUnreadMessages();
    window.addEventListener("online", handleOnline);

    socket.off("receive-private-message");
    socket.off("message-read");
    socket.on("receive-private-message", handleIncomingMessage);
    socket.on("message-read", handleMessageRead);

    return () => {
      socket.off("receive-private-message", handleIncomingMessage);
      socket.off("message-read", handleMessageRead);
      window.removeEventListener("online", handleOnline);
    };
  }, [socket, user?.userid, selectedConversation?.other_user_id]);

  // ── resendPendingMessage ─────────────────────────────────────────────────────
  const resendPendingMessage = async (msg) => {
    if (!msg.tempId) {
      console.error("No tempId on message:", msg);
      return;
    }
    try {
      const response = await axiosbase.post(
        `/messages/private/${msg.receiver_id}`,
        {
          content: msg.content,
          message_type: msg.message_type,
          delivered_at: msg.delivered_at,
        },
      );
      const backendMessage = response.data.data;
      setMessages((prev) =>
        prev.map((m) =>
          m.tempId === msg.tempId ? { ...backendMessage, status: "sent" } : m,
        ),
      );
      pendingMessagesRef.current[msg.receiver_id] = (
        pendingMessagesRef.current[msg.receiver_id] || []
      ).filter((m) => m.tempId !== msg.tempId);
    } catch (err) {
      console.warn("Retry failed, still pending:", msg.content);
    }
  };

  // ── sendFileToServer ─────────────────────────────────────────────────────────
  const sendFileToServer = async (msg) => {
    let controller;
    try {
      if (!navigator.onLine) throw new Error("Offline");

      controller = new AbortController();
      activeUploadsRef.current[msg.tempId] = controller;

      const safeNumber = (value, fallback = 0) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
      };

      const getSafeUploadFilename = (file, tempId) => {
        const originalName = file?.name || "upload";
        const lastDot = originalName.lastIndexOf(".");
        const rawExtension = lastDot > -1 ? originalName.slice(lastDot + 1) : "";
        const extension = rawExtension.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
        const rawBase = lastDot > -1 ? originalName.slice(0, lastDot) : originalName;
        const base =
          rawBase
            .normalize("NFKD")
            .replace(/[^\w.-]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 80) || "file";
        return `${tempId || Date.now()}-${base}${extension ? `.${extension}` : ""}`;
      };

      const safeDuration = Math.round(safeNumber(msg.duration));
      const safeUploadFilename = getSafeUploadFilename(msg.file, msg.tempId);

      const formData = new FormData();
      formData.append("file", msg.file, safeUploadFilename);
      formData.append("tempId", msg.tempId);
      formData.append("receiver_id", msg.receiver_id);
      formData.append("message_type", msg.message_type);
      formData.append("delivered_at", msg.delivered_at);
      formData.append("sender_id", msg.sender_id);
      formData.append("filename", msg.filename || msg.file?.name || "");
      formData.append("filesize", safeNumber(msg.filesize || msg.file?.size));
      formData.append("mime_type", msg.file?.type || msg.mime_type || "");
      formData.append("width", safeNumber(msg.width));
      formData.append("height", safeNumber(msg.height));
      formData.append("aspect_ratio", safeNumber(msg.aspect_ratio));
      formData.append("duration", safeDuration);

      const res = await axiosbase.post("/messages/file/private", formData, {
        signal: controller.signal,
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000,
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );
          setMessages((prev) =>
            prev.map((m) =>
              m.tempId === msg.tempId ? { ...m, uploadProgress: percent } : m,
            ),
          );
          console.log("Upload progress for", msg.tempId, ":", percent + "%");
        },
      });

      const serverMsg = res.data;

      setMessages((prev) =>
        prev.map((m) =>
          m.tempId === msg.tempId
            ? { ...serverMsg, status: "sent", uploadProgress: 100, fileUrl: msg.fileurl }
            : m,
        ),
      );

      if (pendingMessagesRef.current?.[msg.receiver_id]) {
        pendingMessagesRef.current[msg.receiver_id] =
          pendingMessagesRef.current[msg.receiver_id].filter(
            (m) => m.tempId !== msg.tempId,
          );
      }
    } catch (err) {
      console.error("File upload failed:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.tempId === msg.tempId ? { ...m, status: "pending" } : m,
        ),
      );
    } finally {
      if (controller && activeUploadsRef.current[msg.tempId] === controller) {
        delete activeUploadsRef.current[msg.tempId];
      }
    }
  };

  // ── downloadFile ─────────────────────────────────────────────────────────────
  const downloadFile = async (message) => {
    if (message.tempId) return;

    const existingBytes = message.downloadedBytes || 0;
    const fileIdentifier = message.id;
    if (!fileIdentifier) {
      console.error("No file identifier to download");
      return;
    }

    const controller = new AbortController();
    downloadControllersRef.current[fileIdentifier] = controller;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id ? { ...m, isDownloading: true, isPaused: false } : m,
      ),
    );

    try {
      const response = await axiosbase.get(
        `/messages/file/download/${fileIdentifier}`,
        {
          responseType: "blob",
          headers: existingBytes ? { Range: `bytes=${existingBytes}-` } : {},
          signal: controller.signal,
          onDownloadProgress: (e) => {
            const total = message.filesize;
            const loaded = existingBytes + e.loaded;
            const percent =
              total > 0 ? Math.min(Math.floor((loaded / total) * 100), 99) : 0;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === message.id
                  ? { ...m, downloadProgress: percent, downloadedBytes: loaded }
                  : m,
              ),
            );
          },
        },
      );

      const newBlob = response.data;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== message.id) return m;
          const combinedBlob = m.partialBlob
            ? new Blob([m.partialBlob, newBlob])
            : newBlob;
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

  // ── cancelDownload ───────────────────────────────────────────────────────────
  const cancelDownload = (id, message) => {
    if (!message.tempId) {
      if (downloadControllersRef.current[id]) {
        downloadControllersRef.current[id].abort();
        delete downloadControllersRef.current[id];
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, isDownloading: false, isPaused: true } : m,
        ),
      );
      return;
    }

    if (activeUploadsRef.current[message.tempId]) {
      activeUploadsRef.current[message.tempId].abort();
      delete activeUploadsRef.current[message.tempId];
    }

    setMessages((prev) => prev.filter((m) => m.tempId !== message?.tempId));

    if (pendingMessagesRef?.current?.[message.receiver_id]) {
      pendingMessagesRef.current[message.receiver_id] =
        pendingMessagesRef.current[message.receiver_id].filter(
          (m) => m.tempId !== message.tempId,
        );
    }
  };

  // ── Context value ────────────────────────────────────────────────────────────
  const value = {
    // State
    offset,
    setoffset,
    messages,
    setMessages,
    messagesCache,
    setMessagesCache,
    unreadCount,
    setUnreadCount,
    selectedConversation,
    setSelectedConversation,
    // Refs
    atBottomRef,
    pendingAutoScrollRef,
    hydratedChatsRef,
    pendingMessagesRef,
    activeUploadsRef,
    // Functions
    sendFileToServer,
    resendPendingMessage,
    downloadFile,
    cancelDownload,
    updateCache,
    replaceCache,
    mergeUniqueById,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export default ChatContext;
