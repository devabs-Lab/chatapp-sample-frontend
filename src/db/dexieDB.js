// dexieDB.js
import Dexie from "dexie";
import { encryptData, decryptData } from "../utils/crypto";
import { encryptMedia, decryptMedia } from "../utils/mediaCrypto";
// import { getOrCreateDeviceKey } from "./keyManager.js";
// Create Dexie instance
export const db = new Dexie("ChatAppDB");

if (typeof window !== "undefined") {
  window.db = db; // expose globally for debugging
}

// Define schema
db.version(4).stores({
  privateMessages:
    "&primaryKey,id,tempId,chatId,delivered_at,created_at,sender_id,sender_username,receiver_id,content,status,is_read,message_type,filename,filesize,fileurl,preview,[chatId+delivered_at]",
  deviceKey: "userId,key",
});

// Helpers for storing & retrieving encrypted private messages
export const PrivateChatStorage = {
  async saveMessage(
    {
      chatId,
      sender_username,
      sender_id,
      receiver_id,
      content,
      created_at,
      message_type,
      is_read,
      delivered_at,
      status,
      tempId,
      id,
      filename,
      filesize,
      fileurl,
      preview,
    },
    cryptoKey
  ) {
    function dataURLtoBlob(dataURL) {
      const arr = dataURL.split(",");
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    }
    let encryptedResult;
    let mediaEncrypted;
    if (["image", "video", "audio"].includes(message_type)) {
      const previewBlob = dataURLtoBlob(preview);
      mediaEncrypted = await encryptMedia(previewBlob, cryptoKey);
    } else {
      encryptedResult = await encryptData(content, cryptoKey);
      // console.log(encryptedResult);
    }

    return db.privateMessages.put({
      primaryKey: `${chatId}-${id || tempId}`,
      chatId,
      sender_username,
      sender_id,
      receiver_id,
      message_type,
      is_read,
      delivered_at,
      content: encryptedResult?.encryptedBlob || null,
      iv: encryptedResult?.iv || mediaEncrypted?.iv || null,
      mimeType: encryptedResult?.mimeType || mediaEncrypted?.mimeType || null,
      created_at,
      status,
      tempId,
      id,
      filename,
      filesize,
      fileurl,
      preview: mediaEncrypted?.encryptedBlob || null,
    });
  },

  async getMessages(chatId, cryptoKey, limit, offset, currentUserId) {
    const filtering = await db.privateMessages
      .where("chatId")
      .equals(chatId)
      .filter(
        (m) =>
          (m.sender_id === currentUserId || m.sender_id === chatId) &&
          (m.receiver_id === currentUserId || m.receiver_id === chatId)
      )
      .toArray();
    // console.log(filtering.length);

    if (offset > filtering.length) {
      return [];
    }

    const encryptedMessages = await db.privateMessages
      .where("[chatId+delivered_at]")
      .between([chatId, Dexie.minKey], [chatId, Dexie.maxKey])
      .reverse()
      .offset(offset ?? 0)
      .limit(limit)
      .toArray();

    const participantMessages = encryptedMessages.filter(
      (m) => m.sender_id === currentUserId || m.receiver_id === currentUserId
    );

    const decrypted = await Promise.all(
      participantMessages.map(async (msg) => {
        try {
          let decryptedContent;
          if (["image", "video", "audio"].includes(msg.message_type)) {
            decryptedContent = await decryptMedia(
              msg.preview,
              cryptoKey,
              msg.iv
            );
            const objectUrl = URL.createObjectURL(decryptedContent);
            return { ...msg, preview: objectUrl };
          } else {
            decryptedContent = await decryptData(
              msg.content,
              cryptoKey,
              msg.iv,
              msg.mimeType
            );
            return { ...msg, content: decryptedContent };
          }
        } catch (error) {
          console.log(error);
          console.log("Here is the message as well", msg);
        }
      })
    );

    return decrypted;
  },

  async pendingmessages(currentUserId, cryptoKey, otheruserid) {
    const participantPending = await db.privateMessages
      .filter(
        (m) =>
          m.status === "pending" &&
          (m.sender_id === currentUserId || m.receiver_id === currentUserId) &&
          (m.sender_id === otheruserid || m.receiver_id === otheruserid)
      )
      .toArray();

    // console.log(participantPending.length);
    const decrypted = await Promise.all(
      participantPending.map(async (msg) => {
        try {
          let decryptedContent;
          if (["image", "video", "audio"].includes(msg.message_type)) {
            decryptedContent = await decryptMedia(
              msg.preview,
              cryptoKey,
              msg.iv
            );
          } else {
            decryptedContent = await decryptData(
              msg.content,
              cryptoKey,
              msg.iv,
              msg.mimeType
            );
          }
          return { ...msg, content: decryptedContent };
        } catch (error) {
          console.log(error);
          console.log("Here is the message as well", msg);
        }
      })
    );
    return decrypted.filter(Boolean);
  },

  async deletemessage(chatId, tempId) {
    // console.log(chatId, "and", tempId);
    await db.privateMessages.delete(`${chatId}-${tempId}`);
  },

  async updateMessageRead(chatId, id) {
    // console.log(chatId, "and", id);
    await db.privateMessages.update(`${chatId}-${id}`, {
      is_read: true,
    });
  },

  async clearChat(chatId) {
    await db.privateMessages.where("chatId").equals(chatId).delete();
    // await db.syncState.delete(chatId);
  },
};
