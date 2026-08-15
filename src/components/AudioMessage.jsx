import React, { useRef, useEffect, useMemo } from "react";
import classes from "../pages/styling/chat.module.css";
import chatAreaClasses from "../pages/styling/chatArea.module.css";
import { Plyr } from "plyr-react";
import "plyr-react/plyr.css";
import { getAuthenticatedFileUrl } from "../utils/mediaUtils.js";

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
        className={`${chatAreaClasses.messageItem} ${
          message.sender_id === user.userid ? chatAreaClasses.ownMessage : ""
        }`}
      >
        <div className={chatAreaClasses.messageContent}>
          {message.sender_id !== user.userid && (
            <span className={chatAreaClasses.messageSender}>
              {message.sender_username}
            </span>
          )}
          
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
                    onDownloadClick?.(message);
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
                        onClick={() => onDownloadClick?.(message)}
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
                          onCancel?.();
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

              <div className={classes.file_size} style={{ paddingBottom: 20 }}>
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
                      onDownloadClick?.(message);
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
                        onCancel?.();
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
                        onClick={() => onDownloadClick?.(message)}
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
                          onCancel?.();
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
        </div>
      </div>
    );
  },
);

export default AudioMessage;
