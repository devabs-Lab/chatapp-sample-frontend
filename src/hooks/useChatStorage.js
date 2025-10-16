// useChatStorage.js
import { useState, useEffect } from "react";
import { PrivateChatStorage } from "./dexieDB.js";

export const useChatStorage = (chatId) => {
  const [messages, setMessages] = useState([]);

  const loadRecentMessages = async (limit = 50) => {
    const recent = await PrivateChatStorage.getMessages(chatId, limit);
    setMessages(recent.reverse());
    return recent;
  };

  const saveMessage = async (message) => {
    await PrivateChatStorage.saveMessage(message);
    setMessages((prev) => [...prev, message]);
  };

  const loadOlderMessages = async (
    beforeTimestamp,
    limit = 50,
    fetchFromServer
  ) => {
    const older = (
      await PrivateChatStorage.getMessages(chatId, limit, 0)
    ).filter((msg) => msg.timestamp < beforeTimestamp);

    let combined = older;
    if (older.length < limit && fetchFromServer) {
      const needed = limit - older.length;
      const serverMessages = await fetchFromServer(
        chatId,
        beforeTimestamp,
        needed
      );

      for (let msg of serverMessages) {
        await PrivateChatStorage.saveMessage(msg);
      }

      combined = [...serverMessages, ...older];
    }

    setMessages((prev) => [...combined.reverse(), ...prev]);
    return combined;
  };

  const syncChat = async (fetchNewMessagesFunc) => {
    const since = await PrivateChatStorage.getLastSync(chatId);
    const newMessages = await fetchNewMessagesFunc(chatId, since);

    for (let msg of newMessages) {
      await PrivateChatStorage.saveMessage(msg);
    }

    if (newMessages.length > 0) {
      const lastTimestamp = newMessages[newMessages.length - 1].timestamp;
      await PrivateChatStorage.setLastSync(chatId, lastTimestamp);
      setMessages((prev) => [...prev, ...newMessages]);
    }

    return newMessages;
  };

  const clearChat = async () => {
    await PrivateChatStorage.clearChat(chatId);
    setMessages([]);
  };

  useEffect(() => {
    loadRecentMessages();
  }, [chatId]);

  return {
    messages,
    loadRecentMessages,
    saveMessage,
    loadOlderMessages,
    syncChat,
    clearChat,
  };
};
