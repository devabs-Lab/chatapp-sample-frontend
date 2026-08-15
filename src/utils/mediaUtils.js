export const getAuthenticatedFileUrl = (message) => {
  if (!message?.id || String(message.id).startsWith("temp-")) {
    return message?.fileUrl || message?.fileurl || "";
  }

  const token = sessionStorage.getItem("token");
  const url = `${import.meta.env.VITE_API_URL}/api/messages/file/download/${message.id}`;

  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
};

export const getMediaFrameStyle = (message, fallbackRatio = 4 / 3) => {
  const width = Number(message?.width);
  const height = Number(message?.height);
  const savedRatio = Number(message?.aspect_ratio);
  const aspectRatio =
    savedRatio > 0
      ? savedRatio
      : width > 0 && height > 0
        ? width / height
        : fallbackRatio;

  return {
    aspectRatio: `${aspectRatio}`,
    width: width > 0 ? `${Math.min(width, 350)}px` : "260px",
  };
};

async function compressToMaxSize(canvas, maxKB = 50, file) {
  let quality = 1;
  let dataUrl;
  do {
    dataUrl = canvas.toDataURL(
      file.type === "image/png" ? "image/png" : "image/jpeg",
      quality,
    );
    const sizeKB = Math.round((dataUrl.length * 3) / 4 / 1024);
    if (sizeKB <= maxKB) return dataUrl;
    quality -= 0.1;
  } while (quality > 0.1);

  return dataUrl;
}

export async function createImageThumbnailpreview(
  file,
  maxSize = 320,
  maxKB = 50,
) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = async () => {
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        try {
          const dataUrl = await compressToMaxSize(canvas, maxKB, file);
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export async function createVideoThumbnailpreview(
  file,
  captureAtSec = 0.5,
  width = 320,
  height = 180,
  maxKB = 50,
) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;

    const clean = () => {
      URL.revokeObjectURL(url);
      video.remove();
    };

    video.onloadeddata = async () => {
      try {
        const canvas = document.createElement("canvas");
        const aspect = video.videoWidth / video.videoHeight || 16 / 9;
        canvas.width = width;
        canvas.height = Math.round(width / aspect);

        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = await compressToMaxSize(canvas, maxKB, file);
        clean();
        resolve(dataUrl);
      } catch (e) {
        clean();
        reject(e);
      }
    };

    video.onerror = (e) => {
      clean();
      reject(e);
    };
  });
}

export async function createImageThumbnail(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const w = Math.round(img.width);
        const h = Math.round(img.height);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        try {
          const dataUrl = canvas.toDataURL(
            file.type === "image/png" ? "image/png" : "image/jpeg",
            1,
          );
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export async function createVideoThumbnail(
  file,
  captureAtSec = 0.5,
  width = 320,
) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");

    video.preload = "metadata";
    video.muted = true;
    video.src = url;

    const clean = () => {
      video.src = "";
      URL.revokeObjectURL(url);
    };

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(
        captureAtSec,
        video.duration / 2 || captureAtSec,
      );
    };

    video.onseeked = () => {
      const aspect = video.videoWidth / video.videoHeight;

      const canvas = document.createElement("canvas");

      canvas.width = width;
      canvas.height = width / aspect;

      const ctx = canvas.getContext("2d");

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

      clean();

      resolve(dataUrl);
    };

    video.onerror = reject;
  });
}

export const createVideoMetadata = (file) => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");

    video.preload = "metadata";
    video.src = url;

    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const duration = video.duration;
      const aspectRatio = width / height;

      URL.revokeObjectURL(url);

      resolve({
        width,
        height,
        duration,
        aspectRatio,
      });
    };

    video.onerror = reject;
  });
};

export const createAudioMetadata = (file) => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");

    audio.preload = "metadata";
    audio.src = url;

    audio.onloadedmetadata = () => {
      const duration = audio.duration;

      URL.revokeObjectURL(url);

      resolve({
        duration,
      });
    };

    audio.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
  });
};
