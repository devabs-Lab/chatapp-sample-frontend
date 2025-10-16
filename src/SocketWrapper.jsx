import React, { useState, useEffect, useRef, useContext } from "react";
import { Appstate } from "./App";
import { useSocket } from "./Socketprovider";
import { CryptoContext } from "./App";
import { PrivateChatStorage } from "./db/dexieDB.js";
import axiosbase from "./axiosconfig.js";

const SocketWrapper = ({ children }) => {
  const { cryptoKey } = useContext(CryptoContext);
  const { user } = useContext(Appstate);
  const socket = useSocket();

  const atBottomRef = useRef(true);
  const pendingAutoScrollRef = useRef(false);
  const hydratedChatsRef = useRef({});
  const pendingMessagesRef = useRef({});

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
        new Date(a.delivered_at || a.created_at) -
        new Date(b.delivered_at || b.created_at)
    );
  };

  useEffect(() => {
    if (!socket || !cryptoKey) return;
    const interval = setInterval(() => {
      if (!navigator.onLine) return;

      Object.entries(pendingMessagesRef.current).forEach(([userId, msgs]) => {
        msgs.forEach((msg) => {
          if (msg.message_type === "text") {
            resendPendingMessage(msg);
          } else {
            sendFileToServer(msg);
          }
        });
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [socket, cryptoKey]);

  useEffect(() => {
    if (!socket || !cryptoKey || !user?.userid) return;

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
        // Append message to cache for the correct conversation
        updateCache(otherUserId, message);
        setUnreadCount((prev) => ({
          ...prev,
          [otherUserId]: (prev[otherUserId] || 0) + 1,
        }));
      }
    };

    const handleMessageRead = ({ messageId, receiver_id }) => {
      if (selectedConversation?.other_user_id === receiver_id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, is_read: true } : m))
        );
      } else {
        markerCache(receiver_id, messageId);
      }

      try {
        PrivateChatStorage.updateMessageRead(receiver_id, messageId);
      } catch (error) {
        console.log(error);
      }
    };

    const fetchUnreadMessages = async () => {
      try {
        const res = await axiosbase.get("/messages/unread");
        const unreadMessages = res.data;
        if (!unreadMessages.length) return;

        for (const msg of unreadMessages) {
          const alreadyInCache = messagesCache[msg.sender_id]?.some(
            (m) => m.id === msg.id
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

    socket.on("receive-private-message", handleIncomingmessage);
    socket.on("message-read", handleMessageRead);

    return () => {
      socket.off("message-read", handleMessageRead);
      socket.off("receive-private-message", handleIncomingmessage);
      window.removeEventListener("online", handleOnline);
    };
  }, [socket, cryptoKey, user?.userid, selectedConversation?.other_user_id]);

  const resendPendingMessage = async (msg) => {
    try {
      const response = await axiosbase.post(
        `/messages/private/${msg.receiver_id}`,
        {
          content: msg.content,
          message_type: msg.message_type,
          delivered_at: msg.delivered_at,
        }
      );

      const backendMessage = response.data.data;

      setMessages((prev) =>
        prev.map((m) =>
          m.tempId === msg.tempId ? { ...backendMessage, status: "sent" } : m
        )
      );

      pendingMessagesRef.current[msg.receiver_id] = pendingMessagesRef.current[
        msg.receiver_id
      ].filter((m) => m.tempId !== msg.tempId);

      socket.emit("new-private-message", {
        ...backendMessage,
        sender_username: user.username,
      });
      // Save confirmed message into Dexie
      if (cryptoKey) {
        try {
          await PrivateChatStorage.deletemessage(
            backendMessage.receiver_id,
            msg.tempId
          );
        } catch (error) {
          console.log("Error deleting message from Dexie:", error);
        }
        await PrivateChatStorage.saveMessage(
          {
            ...backendMessage,
            chatId: backendMessage.receiver_id,
            status: "sent",
          },
          cryptoKey
        );

        console.log("Message saved into Dexie:", backendMessage.id);
      }
    } catch (err) {
      // keep as pending, will retry in next interval
      console.warn("Retry failed, still pending:", msg.content);
    }
  };

  const sendFileToServer = async (msg) => {
    try {
      if (!navigator.onLine) throw new Error("Offline");

      const formData = new FormData();
      formData.append("file", msg.file);
      formData.append("receiver_id", msg.receiver_id);
      formData.append("message_type", msg.message_type);
      formData.append("delivered_at", msg.delivered_at);
      formData.append("sender_id", msg.sender_id);

      // add more metadata if needed

      const res = await axiosbase.post("/messages/file/private", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 0)
          );
          setMessages((prev) =>
            prev.map((m) =>
              m.tempId === msg.tempId ? { ...m, uploadProgress: percent } : m
            )
          );
        },
      });

      const serverMsg = res.data;
      //   console.log(serverMsg);

      setMessages((prev) =>
        prev.map((m) =>
          m.tempId === msg.tempId
            ? {
                ...serverMsg,
                status: "sent",
                uploadProgress: 100,
                fileurl: msg.fileurl,
              }
            : m
        )
      );

      if (pendingMessagesRef?.current?.[msg.receiver_id]) {
        pendingMessagesRef.current[msg.receiver_id] =
          pendingMessagesRef.current[msg.receiver_id].filter(
            (m) => m.tempId !== msg.tempId
          );
      }

      socket.emit("new-private-message", {
        ...serverMsg,
        preview: msg.preview,
        sender_username: user.username,
      });

      //   Save to Dexie
      if (cryptoKey) {
        try {
          await PrivateChatStorage.deletemessage(msg.receiver_id, msg.tempId);
        } catch (error) {
          console.log("Error deleting message from Dexie:", error);
        }
        await PrivateChatStorage.saveMessage(
          {
            ...serverMsg,
            chatId: serverMsg.receiver_id,
            status: "sent",
            preview: msg.preview,
            sender_username: user.username,
          },
          cryptoKey
        );
      }
    } catch (err) {
      console.error("File upload failed:", err);
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
        m.id === messageId ? { ...m, is_read: true } : m
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
    updateCache,
  });
};

export default SocketWrapper;
