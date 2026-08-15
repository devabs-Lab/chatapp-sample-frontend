import React, { useState, useRef, useEffect, useMemo } from "react";
import classes from "../pages/styling/chat.module.css";
import { useVideoVisibilitys } from "./UseVideoVisibilitys";
import { Plyr } from "plyr-react";
import "plyr-react/plyr.css";
import { format } from "date-fns";
import "react-circular-progressbar/dist/styles.css";

async function compressToMaxSize(canvas, maxKB = 50, file) {
  let quality = 1;
  let dataUrl;
  do {
    dataUrl = canvas.toDataURL(
      file.type === "image/png" ? "image/png" : "image/jpeg",
      quality,
    );
    const sizeKB = Math.round((dataUrl.length * 3) / 4 / 1024);
    // console.log(sizeKB);
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
  // console.log(file);
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

/* capture a single video frame as thumbnail (data URL) */
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

export const VideoMessage = React.memo(
  ({ message, user, onDownloadClick, onLoad, onCancel }) => {
    const videoRef = useRef(null);
    const clickTimeout = useRef(null);

    useVideoVisibilitys(videoRef);
    const formatFileSize = (bytes) => {
      if (!bytes && bytes !== 0) return "";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // const isDownloaded = !!message.fileUrl;

    const isSender = message.sender_id !== user.userid;
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // console.log(
    //   message.downloadProgress
    // );

    const isMovie =
      message.aspect_ratio > 2.0 ||
      message.duration > 20000 ||
      message.filesize > 200 * 1024 * 1024;

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
              style={{
                animation: "spin 1.5s linear infinite",
                pointerEvents: "none",
              }}
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
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onCancel?.();
              }}
              className={classes.cancel_button}
            ></button>
          )}
        </div>
      );
    };

    const handleClick = () => {
      if (clickTimeout.current) return;

      clickTimeout.current = setTimeout(togglePlay, 250);
    };

    const togglePlay = () => {
      const player = videoRef.current?.plyr;
      if (!player) {
        clickTimeout.current = null;
        return;
      }

      if (player.playing) {
        player.pause();
        setIsPlaying(false);
      } else {
        player.play();
        setIsPlaying(true);
      }

      clickTimeout.current = null;
    };

    const handleDoubleClick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (clickTimeout.current) {
        clearTimeout(clickTimeout.current);
        clickTimeout.current = null;
      }

      const player = videoRef.current?.plyr;

      if (player) {
        player.pause();
      }

      setIsPlaying(false);

      setPreviewUrl(message.fileurl || message.preview);
    };

    const options = useMemo(
      () => ({
        controls: ["play", "current-time", "duration", "mute"],
        fullscreen: {
          enabled: false,
        },
        settings: [],
        disableContextMenu: true,
        hideControls: false,
      }),
      [],
    );

    const videoSource = useMemo(
      () => ({
        type: "video",
        sources: [
          {
            src: `http://localhost:5500/api/messages/file/download/${message.id}?token=${sessionStorage.getItem("token")}`,
            type: message.mime_type || "video/mp4",
          },
        ],
        // poster: message.thumburl,
      }),
      [message.id, message.mime_type],
    );

    return (
      <>
        <div
          key={message.id || message.tempId}
          data-id={message.id}
          className={`${classes.image_container} ${
            message.sender_id === user.userid ? classes.imageown : ""
          }`}
        >
          {(message.thumburl || message.preview) && isSender ? (
            isMovie ? (
              <FileMessage message={message} user={user} onCancel={onCancel} />
            ) : (
              <div className={classes.receiver_container}>
                <div
                  style={{
                    fontSize: 18,
                    color: "#666",
                    cursor: "pointer",
                  }}
                >
                  {formatFileSize(message.filesize)}
                </div>

                <div
                  onDoubleClickCapture={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDoubleClick(e);
                  }}
                  style={{
                    aspectRatio: `${message.aspect_ratio}`,
                    width: message.width,
                    maxWidth: "30vw",
                    maxHeight: "60vh",
                    borderRadius: "12px",
                    background: "black",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <Plyr
                    ref={videoRef}
                    source={videoSource}
                    options={options}
                    onClick={handleClick}
                    preload="none"
                  />
                </div>

                {/* {message.downloadProgress == 100 && (
                  <button
                    // onClick={() => onDownloadClick(message)}
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
                    ▶ "look like this "
                  </button>
                )} */}

                {message.downloadProgress < 100 && (
                  <div className={classes.sendload_container}>
                    <SpinnerWrapper
                      progress={message.downloadProgress}
                      onCancel={onCancel}
                    />
                    <div className={classes.sendload_percent}>
                      {message.downloadProgress}%
                    </div>
                  </div>
                )}
              </div>
            )
          ) : isMovie ? (
            <FileMessage message={message} user={user} onCancel={onCancel} />
          ) : (
            // downloaded or sender

            <div
              style={{
                cursor: "pointer",
                position: "relative",
                marginTop: "5px",
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  color: "#666",
                  cursor: "pointer",
                }}
              >
                {/* {message.filename || message.content}{" "} */}
                {formatFileSize(message.filesize)}
              </div>

              <div
                onDoubleClickCapture={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDoubleClick(e);
                }}
                style={{
                  aspectRatio: `${message.aspect_ratio}`,
                  width: message.width,
                  maxWidth: "30vw",
                  maxHeight: "60vh",
                  borderRadius: "12px",
                  background: "black",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <Plyr
                  ref={videoRef}
                  source={videoSource}
                  options={options}
                  onClick={handleClick}
                  preload="none"
                />
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
                message.downloadProgress >= 0) ? (
                <div className={classes.sendload_container}>
                  <SpinnerWrapper
                    progress={
                      message.uploadProgress ?? message.downloadProgress
                    }
                  />
                  <div className={classes.sendload_percent}>
                    {message.uploadProgress ?? message.downloadProgress}%
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {previewUrl && (
          <div
            onClick={() => setPreviewUrl(null)}
            className={classes.fullimage_container}
          >
            <video
              controls
              autoPlay
              preload="metadata"
              controlsList="nofullscreen"
              // poster={message.thumburl} // 👈 thumbnail
              src={`http://localhost:5500/api/messages/file/download/${
                message.id
              }?token=${sessionStorage.getItem("token")}`}
              className={classes.senderpreview_video}
              // onClick={handleClick}
            />
          </div>
        )}
      </>
    );
  },
);

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

export const FileMessage = ({ message, user, onDownloadClick, onCancel }) => {
  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return "";

    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const isSender = message.sender_id !== user.userid;
  const isDownloading = message.isDownloading;
  const isDownloaded = message.isDownloaded;
  const progress = message.uploadProgress ?? message.downloadProgress;

  const handleOpen = () => {
    // window.open(
    //   `http://localhost:5500/api/messages/file/download/${message.id}?token=${sessionStorage.getItem("token")}`,
    //   "_blank",
    // );
    return;
  };

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
            style={{
              animation: "spin 1.5s linear infinite",
            }}
          >
            {/* Background track */}
            <circle
              cx="25"
              cy="25"
              r="20"
              fill="rgba(44, 44, 44, 0.2)"
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
        {/* {progress < 100 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onCancel();
            }}
            className={classes.cancel_button}
          >
            ×
          </button> */}
        {/* )} */}
      </div>
    );
  };

  return (
    <div className={classes.file_container}>
      {/* icon */}
      {(message.thumburl || message.preview) && isSender ? (
        <div>
          <div className={classes.insidefile_container}>
            <div className={classes.file_icon}>
              {!isDownloaded && !isDownloading && (
                <div onClick={() => onDownloadClick(message)}>⬇</div>
              )}

              {isDownloading && (
                <div className={classes.sendload_container}>
                  <SpinnerWrapper
                    progress={message.downloadProgress}
                    // onCancel={onCancel}
                  />

                  <div className={classes.sendload_percent}>
                    {message.downloadProgress}%
                  </div>
                </div>
              )}

              {isDownloaded && !isDownloading && (
                <div onClick={handleOpen}>
                  {message.message_type === "video" ? "🎬" : "📄"}
                </div>
              )}
            </div>

            <div style={{ flex: 1 }}>
              <div className={classes.file_name}>{message.filename}</div>

              <div className={classes.file_size}>
                {formatFileSize(message.filesize)}
              </div>
            </div>
          </div>

          {/* {message.downloadProgress < 100 && (
            <div className={classes.sendload_container}>
              <SpinnerWrapper progress={message.downloadProgress} />
              <div className={classes.sendload_percent}>
                {message.downloadProgress}%
              </div>
            </div>
          )} */}
          
        </div>
      ) : (
        <div>
          <div className={classes.insidefile_container}>
            <div>
              {(message.uploadProgress < 100 && message.uploadProgress >= 0) ||
              (message.downloadProgress < 100 &&
                message.downloadProgress >= 0) ? (
                <div style={{ position: "relative" }}>
                  <SpinnerWrapper
                    progress={
                      message.uploadProgress ?? message.downloadProgress
                    }
                    // onCancel={onCancel}`
                  />

                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onCancel();
                    }}
                    className={classes.cancel_button}
                  >
                    ×
                  </div>

                  <div className={classes.sendload_percent}>
                    {message.uploadProgress ?? message.downloadProgress}%
                  </div>
                </div>
              ) : null}

              {!isDownloading && (
                <div onClick={handleOpen}>
                  {message.message_type === "video" ? "🎬" : "📄"}
                </div>
              )}
            </div>

            <div style={{ flex: 1 }}>
              <div className={classes.file_name}>{message.filename}</div>

              <div className={classes.file_size}>
                {formatFileSize(message.filesize)}
              </div>
            </div>
          </div>
        </div>
      )}

      {message.sender_id === user.userid && (
        <span className={classes.messageStatus}>
          {message.status === "pending" ? "⏳" : message.is_read ? "✔✔" : "✔"}
        </span>
      )}
    </div>
  );
};

export const ImageMessage = React.memo(({ message, user, onLoad }) => {
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
            <div>
              <img
                src={message.fileUrl}
                alt={message.content}
                className={classes.receiver_image}
                onClick={() => setPreviewUrl(message.fileUrl)}
                onLoad={() => {
                  return onLoad(
                    message.id || message.tempId,
                    message.sender_id === user.userid,
                  );
                }}
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
                  <SpinnerWrapper
                    progress={message.downloadProgress}
                    onCancel={onCancel}
                  />
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
                  onLoad={() =>
                    onLoad(
                      message.id || message.tempId,
                      message.sender_id === user.userid,
                    )
                  }
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
});

export const TextMessage = ({ message, user }) => {
  /**
   * Format the message time
   * @param {number} timestamp - timestamp
   * @returns {string} - formatted time
   */
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
