// crypto.js
// Web Crypto wrapper for AES-GCM encryption (text only)

// Encrypt plain text
export async function encryptData(text, cryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoded
  );

  // Store as blob without pretending MIME type
  return {
    encryptedBlob: new Blob([encrypted]),
    iv,
    mimeType: "text/plain", // mark type for later decoding
  };
}

// Decrypt to plain text
export async function decryptData(encryptedBlob, cryptoKey, iv, mimeType) {
  const arrayBuffer = await encryptedBlob.arrayBuffer();

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    arrayBuffer
  );

  if (mimeType === "text/plain") {
    return new TextDecoder().decode(decrypted);
  }

  throw new Error(`Unsupported mimeType for text decryption: ${mimeType}`);
}
