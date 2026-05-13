import React, { useState, useEffect, useRef, useContext } from "react";
import { Appstate } from "./App";
import { useSocket } from "./Socketprovider";
// import { CryptoContext } from "./App";
// import { PrivateChatStorage } from "./db/dexieDB.js";
import axiosbase from "./axiosconfig.js";

const SocketWrapper = ({ children }) => {
  // const { cryptoKey } = useContext(CryptoContext);
  const { user } = useContext(Appstate);
  const socket = useSocket();

  const atBottomRef = useRef(true);
  const pendingAutoScrollRef = useRef(false);
  const hydratedChatsRef = useRef({});
  const pendingMessagesRef = useRef({});
  const activeUploadsRef = useRef({});

  const [offset, setoffset] = useState({});
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesCache, setMessagesCache] = useState({});
  const [unreadCount, setUnreadCount] = useState({});

  const mergeUniqueById = (arr, prev = []) => {
    const map = new Map(prev.map((m) => [m.id || m.tempId, m]));
    arr.forEach((m) => map.set(m.id || m.tempId, m));
    // const mediaMessages = arr.filter(
    //   (m) => m && m.message_type !== "text" && !m.fileUrl
    // );

    // // console.log(mediaMessages);
    // if (mediaMessages.length > 0) {
    //   mediaMessages.forEach((message) => downloadFile(message));
    // }
    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(a.delivered_at || a.created_at || 0) -
        new Date(b.delivered_at || b.created_at || 0),
    );
  };

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

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      Object.values(activeUploadsRef.current).forEach((controller) => {
        controller.abort();
      });
      activeUploadsRef.current = {};
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // useEffect(() => {
  //   if (!socket) return;
  //   const interval = setInterval(() => {
  //     if (!navigator.onLine) return;

  //     Object.entries(pendingMessagesRef.current).forEach(([userId, msgs]) => {
  //       msgs.forEach((msg) => {
  //         if (msg.message_type === "text") {
  //           resendPendingMessage(msg);
  //         } else {
  //           sendFileToServer(msg);
  //         }
  //       });
  //     });
  //   }, 8000);

  //   return () => clearInterval(interval);
  // }, [socket]);

  useEffect(() => {
    if (!socket || !user?.userid) return;

    const handleIncomingmessage = (message) => {
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

          // console.log(atBottomRef.current);
        } else {
          // console.log(atBottomRef.current);
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
        // Append message to cache for the correct conversation
        updateCache(otherUserId, message);
        setUnreadCount((prev) => ({
          ...prev,
          [otherUserId]: (prev[otherUserId] || 0) + 1,
        }));
      }
    };

    const handleMessageRead = ({ messageId, receiver_id }) => {
      // console.log(messageId, "and", receiver_id);
      if (selectedConversation?.other_user_id === receiver_id) {
        console.log(selectedConversation?.other_user_id);
        // console.log("it worked from inside");
        setMessages((prev) =>
          prev.map((m) => {
            return m.id === messageId ? { ...m, is_read: true } : m;
          }),
        );
      } else {
        console.log("it worked");
        markerCache(receiver_id, messageId);
      }

      // try {
      //   PrivateChatStorage.updateMessageRead(receiver_id, messageId);
      // } catch (error) {
      //   console.log(error);
      // }
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
              //   console.log(msg);
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

    const handleOnline = () => {
      fetchUnreadMessages();
    };

    window.addEventListener("online", handleOnline);

    socket.off("receive-private-message");
    socket.off("message-read");

    socket.on("receive-private-message", handleIncomingmessage);
    socket.on("message-read", handleMessageRead);

    return () => {
      socket.off("message-read", handleMessageRead);
      socket.off("receive-private-message", handleIncomingmessage);
      window.removeEventListener("online", handleOnline);
    };
  }, [socket, user?.userid, selectedConversation?.other_user_id]);

  const resendPendingMessage = async (msg) => {
    if (!msg.tempId) {
      console.error("No file attached to message:", msg);
      return;
    }
    console.log("Retrying message:", msg);
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

      pendingMessagesRef.current[msg.receiver_id] = pendingMessagesRef.current[
        msg.receiver_id
      ].filter((m) => m.tempId !== msg.tempId);

      // socket.emit("new-private-message", {
      //   ...backendMessage,
      //   sender_username: user.username,
      // });

      // Save confirmed message into Dexie
      // if (cryptoKey) {
      //   try {
      //     await PrivateChatStorage.deletemessage(
      //       backendMessage.receiver_id,
      //       msg.tempId
      //     );
      //   } catch (error) {
      //     console.log("Error deleting message from Dexie:", error);
      //   }
      //   await PrivateChatStorage.saveMessage(
      //     {
      //       ...backendMessage,
      //       chatId: backendMessage.receiver_id,
      //       status: "sent",
      //     },
      //     cryptoKey
      //   );

      //   console.log("Message saved into Dexie:", backendMessage.id);
      // }
    } catch (err) {
      // keep as pending, will retry in next interval
      console.warn("Retry failed, still pending:", msg.content);
    }
  };

  const sendFileToServer = async (msg) => {
    try {
      if (!navigator.onLine) throw new Error("Offline");

      const controller = new AbortController();
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

      // add more metadata if needed

      // if (msg.tempId) {
      //   console.error("No file attached to message:", msg);
      //   return;
      // }

      const res = await axiosbase.post("/messages/file/private", formData, {
        signal: controller.signal,
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000, // 30 sec timeout protection
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
      // console.log(serverMsg);

      setMessages((prev) =>
        prev.map((m) =>
          m.tempId === msg.tempId
            ? {
                ...serverMsg,
                status: "sent",
                uploadProgress: 100,
                fileUrl: msg.fileurl,
              }
            : m,
        ),
      );

      if (pendingMessagesRef?.current?.[msg.receiver_id]) {
        pendingMessagesRef.current[msg.receiver_id] =
          pendingMessagesRef.current[msg.receiver_id].filter(
            (m) => m.tempId !== msg.tempId,
          );
      }

      // socket.emit("new-private-message", {
      //   ...serverMsg,
      //   preview: msg.preview,
      //   sender_username: user.username,
      // });

      //   Save to Dexie
      // if (cryptoKey) {
      //   try {
      //     await PrivateChatStorage.deletemessage(msg.receiver_id, msg.tempId);
      //   } catch (error) {
      //     console.log("Error deleting message from Dexie:", error);
      //   }
      //   await PrivateChatStorage.saveMessage(
      //     {
      //       ...serverMsg,
      //       chatId: serverMsg.receiver_id,
      //       status: "sent",
      //       preview: msg.preview,
      //       sender_username: user.username,
      //     },
      //     cryptoKey
      //   );
      // }
    } catch (err) {
      console.error("File upload failed:", err);
      // console.log("Upload failed → will retry automatically");

      setMessages((prev) =>
        prev.map((m) =>
          m.tempId === msg.tempId ? { ...m, status: "pending" } : m,
        ),
      );
    } finally {
      if (activeUploadsRef.current[msg.tempId] === controller) {
        delete activeUploadsRef.current[msg.tempId];
      }
    }
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

  const markerCache = (other_user_id, messageId) => {
    setMessagesCache((prev) => ({
      ...prev,
      [other_user_id]: prev[other_user_id].map((m) =>
        m.id === messageId ? { ...m, is_read: true } : m,
      ),
    }));
  };

  return children({
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
    resendPendingMessage,
    sendFileToServer,
    atBottomRef,
    pendingAutoScrollRef,
    hydratedChatsRef,
    pendingMessagesRef,
    activeUploadsRef,
    updateCache,
  });
};

export default SocketWrapper;
