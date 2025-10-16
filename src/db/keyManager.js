// keyManager.js
import { db } from "./dexieDB.js";

export async function getOrCreateDeviceKey(userId) {
  const stored = await db.deviceKey.get(userId);
  if (stored) {
    const rawKey = Uint8Array.from(atob(stored.key), (c) => c.charCodeAt(0));
    return await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
  }

  const newKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const raw = await crypto.subtle.exportKey("raw", newKey);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(raw)));

  await db.deviceKey.put({ userId, key: base64 });

  return newKey;
}
