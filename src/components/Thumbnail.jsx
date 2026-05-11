import React, { useState, useRef, useEffect, useMemo } from "react";
import classes from "../pages/styling/chat.module.css";
import { useVideoVisibilitys } from "./UseVideoVisibilitys";
import { Plyr } from "plyr-react";
import "plyr-react/plyr.css";
import { format } from "date-fns";
import "react-circular-progressbar/dist/styles.css";

const getAuthenticatedFileUrl = (message) => {
  if (!message?.id || String(message.id).startsWith("temp-")) {
    return message?.fileUrl || message?.fileurl || "";
  }

  const token = sessionStorage.getItem("token");
  const url = `${import.meta.env.VITE_API_URL}/api/messages/file/download/${message.id}`;

  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
};

const getMediaFrameStyle = (message, fallbackRatio = 4 / 3) => {
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

    const isMovie =
      message.aspect_ratio > 2.0 ||
      message.duration > 20000 ||
      message.filesize > 200 * 1024 * 1024;

    const SpinnerWrapper = ({ progress }) => {
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
                fill="rgba(42, 42, 42, 0.2)"
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
        </div>
      );
    };

    const pendingSpinner = (progress) => {
      const circumference = 2 * Math.PI * 10;
      const arcLength = Math.max((circumference * progress) / 100, 2);

      return (
        <div className={classes.spinner_containerr}>
          {progress < 100 && (
            <svg
              width="30"
              height="30"
              viewBox="0 0 50 50"
              style={{
                animation: "spin 1.5s linear infinite",
                pointerEvents: "none",
              }}
            >
              <circle cx="25" cy="25" r="10" fill="white" strokeWidth="4" />

              <circle
                cx="25"
                cy="25"
                r="10"
                fill="none"
                stroke="#555555"
                strokeWidth="4"
                strokeDasharray={`${arcLength} ${circumference}`}
                strokeLinecap="round"
              />
            </svg>
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
            // src: `http://localhost:5500/api/messages/file/download/${message.id}?token=${sessionStorage.getItem("token")}`, this is for local streaming
            src: getAuthenticatedFileUrl(message),
            // src: message.fileurl || message.fileUrl,
            type: message.mime_type || "video/mp4",
          },
        ],
        // poster: message.thumburl,
      }),
      [message.id, message.mime_type, message.fileUrl, message.fileurl],
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
              <FileMessage
                message={message}
                user={user}
                onCancel={onCancel}
                onDownloadClick={onDownloadClick}
              />
            ) : (
              <div className={classes.receiver_container}>
                <div
                  onDoubleClickCapture={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDoubleClick(e);
                  }}
                  style={{
                    ...getMediaFrameStyle(message, 16 / 9),
                  }}
                  className={classes.video_container}
                >
                  <Plyr
                    ref={videoRef}
                    source={videoSource}
                    options={options}
                    onClick={handleClick}
                    preload="none"
                  />
                </div>

                <div
                  style={{
                    color: "#666",
                    cursor: "pointer",
                    position: "absolute",
                    top: "3%",
                    left: "3%",
                    fontSize: "7px",
                  }}
                >
                  {formatFileSize(message.filesize)}
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
                  <div
                    style={{ position: "absolute", top: "40%", left: "40%" }}
                  >
                    <SpinnerWrapper
                      progress={
                        message.uploadProgress ?? message.downloadProgress
                      }
                    />
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onCancel();
                      }}
                      className={classes.cancel_button}
                      style={{
                        fontSize: "40px",
                        marginLeft: "12.5px",
                        marginTop: "7px",
                      }}
                    >
                      ×
                    </div>
                    <div className={classes.sendload_percent}>
                      {message.uploadProgress ?? message.downloadProgress}%
                    </div>
                  </div>
                )}
              </div>
            )
          ) : isMovie ? (
            <FileMessage
              message={message}
              user={user}
              onCancel={onCancel}
              onDownloadClick={onDownloadClick}
            />
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
                onDoubleClickCapture={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDoubleClick(e);
                }}
                style={{
                  ...getMediaFrameStyle(message, 16 / 9),
                }}
                className={classes.video_container}
              >
                <Plyr
                  ref={videoRef}
                  source={videoSource}
                  options={options}
                  onClick={handleClick}
                  preload="none"
                />
              </div>

              <div
                style={{
                  color: "#666",
                  cursor: "pointer",
                  position: "absolute",
                  top: "3%",
                  left: "3%",
                  fontSize: "7px",
                }}
              >
                {/* {message.filename || message.content}{" "} */}
                {formatFileSize(message.filesize)}
              </div>

              {message.sender_id === user.userid && (
                <span className={classes.messageStatus}>
                  {message.status === "pending"
                    ? pendingSpinner(85)
                    : message.is_read
                      ? "✔✔"
                      : "✔"}
                </span>
              )}

              {(message.uploadProgress < 100 && message.uploadProgress >= 0) ||
              (message.downloadProgress < 100 &&
                message.downloadProgress >= 0) ? (
                <div style={{ position: "absolute", top: "40%", left: "40%" }}>
                  <SpinnerWrapper
                    progress={
                      message.uploadProgress ?? message.downloadProgress
                    }
                  />
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onCancel();
                    }}
                    className={classes.cancel_button}
                    style={{
                      fontSize: "40px",
                      marginLeft: "12.5px",
                      marginTop: "7px",
                    }}
                  >
                    ×
                  </div>
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
              // src={`http://localhost:5500/api/messages/file/download/${
              //   message.id
              // }?token=${sessionStorage.getItem("token")}`} this is for local streaming
              // src="`${import.meta.env.VITE_API_URL}/api/messages/file/download/${message.id}` " // this is for aws
              src={getAuthenticatedFileUrl(message)}
              className={classes.senderpreview_video}
              // onClick={handleClick}
            />
          </div>
        )}
      </>
    );
  },
);

export const AudioMessage = React.memo(
  ({ message, user, onDownloadClick, onCancel }) => {
    const audioRef = useRef(null);

    const isSender = message.sender_id !== user.userid;
    const isDownloading = message.isDownloading ?? false;
    const isDownloaded = message.isDownloaded ?? false;
    const isPaused = message.isPaused ?? false;

    const formatFileSize = (bytes) => {
      if (!bytes && bytes !== 0) return "";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const SpinnerWrapper = ({ progress }) => {
      const circumference = 2 * Math.PI * 16;
      const arcLength = Math.max((circumference * progress) / 100, 2);

      return (
        <div className={classes.spinner_container}>
          {progress < 100 && (
            <svg
              width="30"
              height="30"
              viewBox="0 0 50 50"
              style={{
                animation: "spin 1.5s linear infinite",
                pointerEvents: "none",
              }}
            >
              <circle cx="25" cy="25" r="16" fill="#00b2ff" strokeWidth="4" />

              <circle
                cx="25"
                cy="25"
                r="16"
                fill="none"
                stroke="white"
                strokeWidth="4"
                strokeDasharray={`${arcLength} ${circumference}`}
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>
      );
    };

    const pendingSpinner = (progress) => {
      const circumference = 2 * Math.PI * 10;
      const arcLength = Math.max((circumference * progress) / 100, 2);

      return (
        <div className={classes.spinner_containerr}>
          {progress < 100 && (
            <svg
              width="30"
              height="30"
              viewBox="0 0 50 50"
              style={{
                animation: "spin 1.5s linear infinite",
                pointerEvents: "none",
              }}
            >
              <circle cx="25" cy="25" r="10" fill="white" strokeWidth="4" />

              <circle
                cx="25"
                cy="25"
                r="10"
                fill="none"
                stroke="#555555"
                strokeWidth="4"
                strokeDasharray={`${arcLength} ${circumference}`}
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>
      );
    };

    const options = useMemo(
      () => ({
        controls: ["play", "progress", "current-time", "duration"],
        settings: [],
      }),
      [],
    );

    const optionsplay = useMemo(
      () => ({
        controls: ["play", "progress", "current-time", "duration", "mute"],
        settings: [],
      }),
      [],
    );

    const emptySource = {
      type: "audio",
      sources: [
        {
          src: "", // empty source
          type: message.mime_type || "audio/mpeg",
        },
      ],
    };

    const audioSource = useMemo(() => {
      if (!message.fileUrl) return emptySource;

      return {
        type: "audio",
        sources: [
          {
            src: message.fileUrl,
            type: message.mime_type || "audio/mpeg",
          },
        ],
      };
    }, [message.fileUrl]);

    const senderAudioSource = useMemo(() => {
      return {
        type: "audio",
        sources: [
          {
            // src: `http://localhost:5500/api/messages/file/download/${message.id}?token=${sessionStorage.getItem("token")}`, this is for local streaming
            src: getAuthenticatedFileUrl(message),
            type: message.mime_type || "audio/mpeg",
          },
        ],
      };
    }, [message.id, message.fileUrl, message.fileurl]);

    useEffect(() => {
      if (isDownloaded && audioRef.current?.plyr) {
        audioRef.current.plyr.play();
      }
    }, [isDownloaded]);

    return (
      <div
        key={message.id || message.tempId}
        data-id={message.id}
        className={`${classes.audio_container} ${
          message.sender_id === user.userid ? classes.audioown : ""
        }`}
      >
        {isSender ? (
          <div className={classes.insidefile_container_audio}>
            {/* LEFT SIDE (icon / spinner / download) */}

            <div style={{ position: "relative", height: "50px" }}>
              <div
                style={{
                  marginTop: 6,
                  position: "absolute",
                  top: 45,
                  right: 0,
                  width: "100%",
                }}
                onClick={(e) => {
                  const playButton = e.target.closest('[data-plyr="play"]');

                  if (!playButton) return; // ignore mute, progress, etc.

                  if (!isDownloaded && !isDownloading) {
                    e.preventDefault();
                    e.stopPropagation();
                    onDownloadClick(message);
                  }
                }}
              >
                <Plyr
                  ref={audioRef}
                  source={
                    isDownloaded || isDownloading ? audioSource : emptySource
                  }
                  options={isDownloaded ? optionsplay : options}
                />
              </div>

              {isDownloading || isPaused ? (
                <div style={{ position: "absolute", top: 25, left: 20 }}>
                  <SpinnerWrapper progress={message.downloadProgress} />

                  <div
                    className={classes.cancel_button}
                    style={{
                      fontSize: "20px",
                      marginLeft: "9.5px",
                      marginTop: "5px",
                    }}
                  >
                    {isPaused ? (
                      <div
                        onClick={() => onDownloadClick(message)}
                        style={{
                          fontSize: "15px",
                          marginTop: "3px",
                          marginLeft: "1.3px",
                        }}
                      >
                        ⬇
                      </div>
                    ) : (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          onCancel();
                        }}
                      >
                        ×
                      </div>
                    )}
                  </div>
                  <div
                    className={classes.sendload_percent}
                    style={{ top: "40%", left: "15%" }}
                  >
                    {message.uploadProgress ?? message.downloadProgress}%
                  </div>
                </div>
              ) : null}
            </div>

            {/* RIGHT SIDE (player or info) */}

            <div
              style={{
                width: "100%",
                marginTop: 5,
                paddingLeft: 20,
              }}
            >
              <div className={classes.file_name}>{message.filename}</div>

              <div className={classes.file_size} style={{ paddingBottom: 5 }}>
                {formatFileSize(message.filesize)}
              </div>
            </div>

            {message.sender_id === user.userid && (
              <span className={classes.messageStatus}>
                {message.status === "pending"
                  ? pendingSpinner(85)
                  : message.is_read
                    ? "✔✔"
                    : "✔"}
              </span>
            )}
          </div>
        ) : (
          <div className={classes.insidefile_container_audio}>
            <div style={{ position: "relative", height: "50px" }}>
              {!message.uploadProgress && (
                <div
                  style={{
                    marginTop: 6,
                    position: "absolute",
                    top: 45,
                    right: 0,
                    width: "100%",
                  }}
                  onClick={(e) => {
                    const playButton = e.target.closest('[data-plyr="play"]');

                    if (!playButton) return; // ignore mute, progress, etc.

                    if (!isDownloaded && !isDownloading) {
                      e.preventDefault();
                      e.stopPropagation();
                      onDownloadClick(message);
                    }
                  }}
                >
                  <Plyr
                    ref={audioRef}
                    source={
                      isDownloaded || isDownloading ? audioSource : emptySource
                    }
                    options={isDownloaded ? optionsplay : options}
                  />
                </div>
              )}

              {message.uploadProgress < 100 && message.uploadProgress >= 0 ? (
                <div>
                  <div
                    style={{
                      marginTop: 6,
                      position: "absolute",
                      top: 45,
                      right: 0,
                      width: "100%",
                    }}
                  >
                    <Plyr
                      ref={audioRef}
                      source={audioSource}
                      options={options}
                    />
                  </div>
                  <div style={{ position: "absolute", top: 25, left: 20 }}>
                    <SpinnerWrapper progress={message.uploadProgress} />

                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onCancel();
                      }}
                      className={classes.cancel_button}
                      style={{
                        fontSize: "20px",
                        marginLeft: "9.5px",
                        marginTop: "5px",
                      }}
                    >
                      ×
                    </div>
                  </div>
                </div>
              ) : isDownloading || isPaused ? (
                <div style={{ position: "absolute", top: 25, left: 20 }}>
                  <SpinnerWrapper progress={message.downloadProgress} />

                  <div
                    className={classes.cancel_button}
                    style={{
                      fontSize: "20px",
                      marginLeft: "9.5px",
                      marginTop: "5px",
                    }}
                  >
                    {isPaused ? (
                      <div
                        onClick={() => onDownloadClick(message)}
                        style={{
                          fontSize: "15px",
                          marginTop: "3px",
                          marginLeft: "1.3px",
                        }}
                      >
                        ⬇
                      </div>
                    ) : (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          onCancel();
                        }}
                      >
                        ×
                      </div>
                    )}
                  </div>
                  <div
                    className={classes.sendload_percent}
                    style={{ top: "40%", left: "15%" }}
                  >
                    {message.uploadProgress ?? message.downloadProgress}%
                  </div>
                </div>
              ) : message.uploadProgress === 100 ? (
                <div
                  style={{
                    marginTop: 6,
                    position: "absolute",
                    top: 45,
                    right: 0,
                    width: "100%",
                  }}
                >
                  <Plyr
                    ref={audioRef}
                    source={senderAudioSource}
                    options={options}
                  />
                </div>
              ) : null}
            </div>

            {/* RIGHT SIDE (player or info) */}

            <div style={{ width: "100%", marginTop: 5, paddingLeft: 20 }}>
              <div className={classes.file_name}>{message.filename}</div>

              <div className={classes.file_size} style={{ paddingBottom: 0 }}>
                {formatFileSize(message.filesize)}
              </div>
            </div>
            {message.sender_id === user.userid && (
              <span className={classes.messageStatus}>
                {message.status === "pending"
                  ? pendingSpinner(85)
                  : message.is_read
                    ? "✔✔"
                    : "✔"}
              </span>
            )}
          </div>
        )}
        {/* MESSAGE STATUS */}
      </div>
    );
  },
);

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
  const isPaused = message.isPaused;
  const progress = message.uploadProgress ?? message.downloadProgress;

  // this is for local file streaming

  // const handleOpen = () => {
  //   window.open(
  //     `http://localhost:5500/api/messages/file/download/${message.id}?token=${sessionStorage.getItem("token")}`,
  //     "_blank",
  //   );
  //   return;
  // };

  // here for cloud streaming

  const handleOpen = () => {
    window.open(message.fileUrl || getAuthenticatedFileUrl(message), "_blank");
  };

  const SpinnerWrapper = ({ progress, onCancel }) => {
    const circumference = 2 * Math.PI * 20; // circle perimeter
    const arcLength = Math.max((circumference * progress) / 100, 2); // min arc at 0

    return (
      <div
        className={classes.spinner_container}
        style={{
          marginBottom: 5,
          width: 50,
          height: 50,
          minWidth: 50,
          minHeight: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
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
      </div>
    );
  };

  const pendingSpinner = (progress) => {
    const circumference = 2 * Math.PI * 10;
    const arcLength = Math.max((circumference * progress) / 100, 2);

    return (
      <div className={classes.spinner_containerr}>
        {progress < 100 && (
          <svg
            width="30"
            height="30"
            viewBox="0 0 50 50"
            style={{
              animation: "spin 1.5s linear infinite",
              pointerEvents: "none",
            }}
          >
            <circle cx="25" cy="25" r="10" fill="white" strokeWidth="4" />

            <circle
              cx="25"
              cy="25"
              r="10"
              fill="none"
              stroke="#555555"
              strokeWidth="4"
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
    );
  };

  return (
    <div
      key={message.id || message.tempId}
      data-id={message.id}
      className={`${classes.media_container} ${
        message.sender_id === user.userid ? classes.audioown : ""
      }`}
    >
      {/* icon */}
      {(message.thumburl || message.preview) && isSender ? (
        <div style={{ background: "#f0f2f5", borderRadius: "12px" }}>
          <div className={classes.insidefile_container}>
            <div className={classes.file_icon_container}>
              {!isDownloaded && !isDownloading && !isPaused && (
                <div
                  onClick={() => onDownloadClick(message)}
                  style={{ position: "relative" }}
                >
                  <svg width="50" height="50" viewBox="0 0 50 50">
                    <circle
                      cx="25"
                      cy="25"
                      r="22"
                      fill="rgba(44, 44, 44, 0.2)"
                      strokeWidth="4"
                    />
                  </svg>
                  <div className={classes.download_icon}>⬇</div>
                </div>
              )}

              {console.log(
                "rendering file message",
                isDownloading,
                isDownloaded,
                isPaused,
              )}
              {isDownloading || isPaused ? (
                <div className={classes.sendload_container}>
                  <SpinnerWrapper
                    progress={message.downloadProgress}
                    // onCancel={onCancel}
                  />
                  {!isPaused ? (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onCancel();
                      }}
                      className={classes.cancel_buttonforfile}
                    >
                      ×
                    </div>
                  ) : (
                    <div
                      onClick={() => onDownloadClick(message)}
                      className={classes.cancel_buttonforfile}
                      style={{
                        fontSize: "25px",
                        marginTop: 12,
                        marginLeft: 16,
                      }}
                    >
                      ▶
                    </div>
                  )}

                  <div className={classes.sendload_percentforfile}>
                    {message.downloadProgress}%
                  </div>
                </div>
              ) : null}

              {isDownloaded && !isDownloading && (
                <div onClick={handleOpen} className={classes.file_icon}>
                  {message.message_type === "video" ? "🎬" : "📄"}
                </div>
              )}
            </div>

            <div className={classes.file_info_container}>
              <div className={classes.file_name}>{message.filename}</div>

              <div className={classes.file_size}>
                {formatFileSize(message.filesize)}
              </div>
            </div>
          </div>
          {message.sender_id === user.userid && (
            <span className={classes.messageStatus}>
              {message.status === "pending"
                ? pendingSpinner(85)
                : message.is_read
                  ? "✔✔"
                  : "✔"}
            </span>
          )}
        </div>
      ) : (
        <div style={{ background: "#f0f2f5", borderRadius: "12px" }}>
          <div className={classes.insidefile_container}>
            <div style={{ position: "relative", height: "50px" }}>
              {(message.uploadProgress < 100 && message.uploadProgress >= 0) ||
              isDownloading ||
              isPaused ? (
                <div style={{ position: "relative" }}>
                  <SpinnerWrapper
                    progress={
                      message.uploadProgress ?? message.downloadProgress
                    }
                  />

                  {!isPaused ? (
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
                  ) : (
                    <div
                      onClick={() => onDownloadClick(message)}
                      className={classes.cancel_button}
                      style={{
                        fontSize: "25px",
                        marginTop: 12,
                        marginLeft: 16,
                      }}
                    >
                      ▶
                    </div>
                  )}

                  <div className={classes.sendload_percent}>
                    {message.uploadProgress ?? message.downloadProgress}%
                  </div>
                </div>
              ) : (isDownloaded && !isDownloading) ||
                message.uploadProgress == 100 ? (
                <div onClick={handleOpen} className={classes.file_icon}>
                  {message.message_type === "video" ? "🎬" : "📄"}
                </div>
              ) : !isDownloaded &&
                !isDownloading &&
                !isPaused &&
                !message.uploadProgress ? (
                <div
                  onClick={() => onDownloadClick(message)}
                  style={{ position: "relative" }}
                >
                  <svg width="50" height="50" viewBox="0 0 50 50">
                    <circle
                      cx="25"
                      cy="25"
                      r="22"
                      fill="rgba(44, 44, 44, 0.2)"
                      strokeWidth="4"
                    />
                  </svg>
                  <div className={classes.download_icon}>⬇</div>
                </div>
              ) : null}
            </div>

            <div
              style={{ flex: 1, width: "80%", marginTop: 5 }}
              className={classes.file_info_container}
            >
              <div className={classes.file_name}>{message.filename}</div>

              <div className={classes.file_size}>
                {formatFileSize(message.filesize)}
              </div>
            </div>
          </div>

          {message.sender_id === user.userid && (
            <span className={classes.messageStatus}>
              {message.status === "pending" ? (
                pendingSpinner(85)
              ) : message.is_read ? (
                <div
                  className={classes.messageStatus}
                >
                  ✔✔
                </div>
              ) : (
                <div
                  className={classes.messageStatus}
                >
                  ✔
                </div>
              )}
            </span>
          )}
        </div>
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
  const imageSrc =
    message.fileUrl ||
    message.preview ||
    (typeof message.fileurl === "string" && message.fileurl.startsWith("data:")
      ? message.fileurl
      : "");

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

  const pendingSpinner = (progress) => {
    const circumference = 2 * Math.PI * 10;
    const arcLength = Math.max((circumference * progress) / 100, 2);

    return (
      <div className={classes.spinner_containerr}>
        {progress < 100 && (
          <svg
            width="30"
            height="30"
            viewBox="0 0 50 50"
            style={{
              animation: "spin 1.5s linear infinite",
              pointerEvents: "none",
            }}
          >
            <circle cx="25" cy="25" r="10" fill="white" strokeWidth="4" />

            <circle
              cx="25"
              cy="25"
              r="10"
              fill="none"
              stroke="#555555"
              strokeWidth="4"
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeLinecap="round"
            />
          </svg>
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
            <div
              className={classes.mediaFrame}
              style={getMediaFrameStyle(message)}
            >
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={message.content}
                  className={classes.mediaImage}
                  onClick={() => setPreviewUrl(imageSrc)}
                  onLoad={() => {
                    return onLoad(
                      message.id || message.tempId,
                      message.sender_id === user.userid,
                    );
                  }}
                />
              ) : (
                <div className={classes.mediaPlaceholder}></div>
              )}

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
              <div
                className={classes.mediaFrame}
                style={getMediaFrameStyle(message)}
              >
                {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={message.content}
                  className={classes.mediaImage}
                  onLoad={() =>
                    onLoad(
                      message.id || message.tempId,
                      message.sender_id === user.userid,
                    )
                  }
                  onClick={() => setPreviewUrl(imageSrc)}
                />
                ) : (
                  <div className={classes.mediaPlaceholder}></div>
                )}
              </div>
              <div className={classes.sendimage_size}>
                {formatFileSize(message.fileSize)}
              </div>
              {message.sender_id === user.userid && (
                <span className={classes.messageStatus}>
                  {message.status === "pending"
                    ? pendingSpinner(85)
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
  const formatMessageTime = (timestamp) => {
    return format(new Date(timestamp), "HH:mm");
  };

  const pendingSpinner = (progress) => {
    const circumference = 2 * Math.PI * 10;
    const arcLength = Math.max((circumference * progress) / 100, 2);

    return (
      <div className={classes.spinner_containerr}>
        {progress < 100 && (
          <svg
            width="30"
            height="30"
            viewBox="0 0 50 50"
            style={{
              animation: "spin 1.5s linear infinite",
              pointerEvents: "none",
            }}
          >
            <circle cx="25" cy="25" r="10" fill="white" strokeWidth="4" />

            <circle
              cx="25"
              cy="25"
              r="10"
              fill="none"
              stroke="#555555"
              strokeWidth="4"
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
    );
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
        </div>
        <div className={classes.messageText}>{message.content}</div>
        {message.sender_id === user.userid && (
          <span className={classes.messageStatus}>
            {message.status === "pending"
              ? pendingSpinner(85)
              : message.is_read
                ? "✔✔"
                : "✔"}
          </span>
        )}
      </div>
    </div>
  );
};
