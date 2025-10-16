// Encrypt media (file/blob)
//
//
//
//

export async function encryptMedia(file, cryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // unique IV
  const arrayBuffer = await file.arrayBuffer();

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    arrayBuffer
  );

  // Don't mislabel the encrypted blob with original file type
  return {
    encryptedBlob: new Blob([encrypted]),
    iv,
    mimeType: file.type, // store actual type separately
  };
}

// Decrypt media back into original blob
export async function decryptMedia(encryptedBlob, cryptoKey, iv, mimeType) {
  const arrayBuffer = await encryptedBlob.arrayBuffer();

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    arrayBuffer
  );

  // Restore original MIME type here
  return new Blob([decrypted], { type: mimeType });
}
