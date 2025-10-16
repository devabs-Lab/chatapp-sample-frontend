import { useState, useRef } from "react";
import classes from "../pages/styling/chat.module.css";
import { format } from "date-fns";
import "react-circular-progressbar/dist/styles.css";

async function compressToMaxSize(canvas, maxKB = 50, file) {
  let quality = 1;
  let dataUrl;
  do {
    dataUrl = canvas.toDataURL(
      file.type === "image/png" ? "image/png" : "image/jpeg",
      quality
    );
    const sizeKB = Math.round((dataUrl.length * 3) / 4 / 1024);
    console.log(sizeKB);
    if (sizeKB <= maxKB) return dataUrl;
    quality -= 0.1;
  } while (quality > 0.1);

  return dataUrl;
}

export async function createImageThumbnailpreview(
  file,
  maxSize = 320,
  maxKB = 50
) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = async () => {
        // scale to maxSize (keeping aspect)
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

/* capture a single video frame as thumbnail (data URL) */
export async function createVideoThumbnailpreview(
  file,
  captureAtSec = 0.5,
  width = 320,
  height = 180,
  maxKB = 50
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
      // pick a time that's available
      const t = Math.min(captureAtSec, video.duration / 2 || captureAtSec);
      video.currentTime = t;
    };

    video.onseeked = async () => {
      try {
        const canvas = document.createElement("canvas");
        // preserve aspect
        const aspect = video.videoWidth / video.videoHeight || 16 / 9;
        const w = width;
        const h = Math.round(w / aspect);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = compressToMaxSize(canvas, maxKB);
        clean();
        resolve(dataUrl);
      } catch (err) {
        clean();
        reject(err);
      }
    };

    video.onerror = (e) => {
      clean();
      reject(e);
    };
  });
}

export async function createImageThumbnail(file) {
  console.log(file);
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
            1
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

/* capture a single video frame as thumbnail (data URL) */
export async function createVideoThumbnail(
  file,
  captureAtSec = 0.5,
  width = 320,
  height = 180,
  maxKB = 50
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
      // pick a time that's available
      const t = Math.min(captureAtSec, video.duration / 2 || captureAtSec);
      video.currentTime = t;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        // preserve aspect
        const aspect = video.videoWidth / video.videoHeight || 16 / 9;
        const w = width;
        const h = Math.round(w / aspect);
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

        clean();
        resolve(dataUrl);
      } catch (err) {
        clean();
        reject(err);
      }
    };

    video.onerror = (e) => {
      clean();
      reject(e);
    };
  });
}

export const getVideoDuration = (file) => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = reject;
  });
};

export const ImageMessage = ({ message, user }) => {
  const isDownloaded = !!message.fileUrl; // full file available

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isSender = message.sender_id !== user.userid;
  const [previewUrl, setPreviewUrl] = useState(null);
  const SpinnerWrapper = ({ progress, onCancel }) => {
    const circumference = 2 * Math.PI * 20; // circle perimeter
    const arcLength = Math.max((circumference * progress) / 100, 2); // min arc at 0

    return (
      <div className={classes.spinner_container}>
        {/* Spinner Circle */}
        {progress < 100 && (
          <svg
            width="50"
            height="50"
            viewBox="0 0 50 50"
            style={{ animation: "spin 1.5s linear infinite" }}
          >
            {/* Background track */}
            <circle
              cx="25"
              cy="25"
              r="20"
              fill="rgba(44, 44, 44, 0.2)"
              // stroke="rgba(0,0,0,0.1)"
              strokeWidth="4"
            />
            {/* Progress arc */}
            <circle
              cx="25"
              cy="25"
              r="20"
              fill="none"
              stroke="white"
              strokeWidth="4"
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* Cancel Button inside the circle */}
        {!isSender && progress < 100 && (
          <button
            // onClick={onCancel}
            className={classes.cancel_button}
          >
            ×
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <div
        key={message.id || message.tempId}
        data-id={message.id}
        className={`${classes.image_container} ${
          message.sender_id === user.userid ? classes.imageown : ""
        }`}
      >
        {/* show preview (thumbnail) blurred until downloaded */}
        {message.preview && isSender ? (
          <div className={classes.receiver_container}>
            <div className={classes.sender_box}>
              <img
                src={message.preview}
                alt={message.content}
                className={classes.receiver_image}
              />

              {/* {message.downloadProgress > -1 &&
              message.downloadProgress < 100 ? (
                <div className={classes.sendload_container}>
                  <button
                    onClick={() => onDownloadClick(message)}
                    className={classes.download_button}
                    title="Download"
                  >
                    ⬇ not like this
                  </button>
                </div>
              ) :  */}
              {message.downloadProgress < 100 && (
                <div className={classes.sendload_container}>
                  <SpinnerWrapper progress={message.downloadProgress} />
                  <div className={classes.sendload_percent}>
                    {message.downloadProgress}%
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // downloaded or local (sender)

          <div className={classes.sender_container}>
            <div className={classes.sender_box}>
              {(message.fileUrl || message.preview) && (
                <img
                  src={message.fileUrl || message.preview}
                  alt={message.content}
                  className={classes.sender_image}
                  onClick={() => setPreviewUrl(message.fileUrl)}
                />
              )}
              <div className={classes.sendimage_size}>
                {formatFileSize(message.fileSize)}
              </div>
              {message.sender_id === user.userid && (
                <span className={classes.messageStatus}>
                  {message.status === "pending"
                    ? "⏳"
                    : message.is_read
                    ? "✔✔"
                    : "✔"}
                </span>
              )}

              {(message.uploadProgress < 100 && message.uploadProgress >= 0) ||
                (message.downloadProgress < 100 &&
                  message.downloadProgress >= 0 && (
                    <div className={classes.sendload_container}>
                      <SpinnerWrapper
                        progress={
                          message.uploadProgress || message.downloadProgress
                        }
                      />
                      <div className={classes.sendload_percent}>
                        {message.uploadProgress || message.downloadProgress}%
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        )}
      </div>
      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          className={classes.fullimage_container}
        >
          <img
            src={previewUrl}
            alt="Full preview"
            className={classes.image_fulldisplay}
          />
        </div>
      )}
    </>
  );
};

export const VideoMessage = ({ message, onDownloadClick }) => {
  const isDownloaded = !!message.fileUrl;
  return (
    <div
      key={message.id || message.tempId}
      data-id={message.id}
      style={{ maxWidth: 420 }}
    >
      {message.preview && !isDownloaded ? (
        <div style={{ position: "relative", display: "inline-block" }}>
          <img
            src={message.preview}
            alt={message.content}
            style={{ width: 260, height: "auto", borderRadius: 12 }}
          />
          <button
            onClick={() => onDownloadClick(message)}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(255,255,255,0.95)",
              border: "none",
              padding: 10,
              borderRadius: "50%",
            }}
          >
            ▶
          </button>
          {message.downloadProgress > 0 && message.downloadProgress < 100 && (
            <div
              style={{
                position: "absolute",
                bottom: 8,
                left: 8,
                right: 8,
                height: 6,
                background: "rgba(0,0,0,0.15)",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${message.downloadProgress}%`,
                  height: "100%",
                  background: "#0b84ff",
                }}
              />
            </div>
          )}
        </div>
      ) : (
        // downloaded or sender
        <video
          controls
          src={message.fileUrl || message.preview}
          style={{ width: 420, borderRadius: 12 }}
        />
      )}
      <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
        {message.fileName || message.content} ·{" "}
        {formatFileSize(message.fileSize)}
      </div>
    </div>
  );
};

export const AudioMessage = ({ message, onDownloadClick }) => {
  const isDownloaded = !!message.fileUrl;
  return (
    <div
      key={message.id || message.tempId}
      data-id={message.id}
      style={{ display: "flex", alignItems: "center", gap: 8 }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 8,
          background: "#eee",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* show preview image if available */}
        {message.preview ? (
          <img
            src={message.preview}
            alt="thumb"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: 8,
            }}
          />
        ) : (
          <span>🎵</span>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>
          {message.fileName || message.content}
        </div>
        <div style={{ fontSize: 12, color: "#666" }}>
          {formatFileSize(message.fileSize)}
        </div>
      </div>
      {!isDownloaded ? (
        <button onClick={() => onDownloadClick(message)}>⬇</button>
      ) : (
        <audio controls src={message.fileUrl} />
      )}
    </div>
  );
};

export const FileMessage = ({ message, onDownloadClick }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <div
      key={message.id || message.tempId}
      data-id={message.id}
      style={{
        width: 48,
        height: 48,
        borderRadius: 8,
        background: "#f7f7f7",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      📄
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 600 }}>
        {message.fileName || message.content}
      </div>
      <div style={{ fontSize: 12, color: "#666" }}>
        {formatFileSize(message.fileSize)}
      </div>
    </div>
    <div>
      {!message.fileUrl ? (
        <button onClick={() => onDownloadClick(message)}>⬇</button>
      ) : (
        <a href={message.fileUrl} target="_blank" rel="noreferrer">
          Open
        </a>
      )}
    </div>
  </div>
);

export const TextMessage = ({ message, user }) => {
  const formatMessageTime = (timestamp) => {
    return format(new Date(timestamp), "HH:mm");
  };
  return (
    <div
      key={message.id || message.tempId}
      data-id={message.id}
      className={`${classes.messageItem} ${
        message.sender_id === user.userid ? classes.ownMessage : ""
      }`}
    >
      <div className={classes.messageContent}>
        <div className={classes.messageHeader}>
          <span className={classes.messageSender}>
            {message.sender_username}
          </span>
          <span className={classes.messageTime}>
            {formatMessageTime(message.delivered_at)}
          </span>
          {message.sender_id === user.userid && (
            <span className={classes.messageStatus}>
              {message.status === "pending"
                ? "⏳"
                : message.is_read
                ? "✔✔"
                : "✔"}
            </span>
          )}
        </div>
        <div className={classes.messageText}>{message.content}</div>
      </div>
    </div>
  );
};
