import React, { useState, useRef, useMemo, useEffect } from "react";
import classes from "../pages/styling/chat.module.css";
import chatAreaClasses from "../pages/styling/chatArea.module.css";
import { useVideoVisibilitys } from "./UseVideoVisibilitys";
import { Plyr } from "plyr-react";
import "plyr-react/plyr.css";
import { getAuthenticatedFileUrl, getMediaFrameStyle } from "../utils/mediaUtils.js";
import FileMessage from "./FileMessage.jsx";

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
            src: getAuthenticatedFileUrl(message),
            type: message.mime_type || "video/mp4",
          },
        ],
      }),
      [message.id, message.mime_type, message.fileUrl, message.fileurl],
    );

    if (isMovie) {
      return (
        <FileMessage
          message={message}
          user={user}
          onCancel={onCancel}
          onDownloadClick={onDownloadClick}
        />
      );
    }

    return (
      <>
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

            {(message.thumburl || message.preview) && isSender ? (
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
                        onCancel?.();
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
                        onCancel?.();
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

            <div style={{fontSize: '11px', color: 'var(--gray-500)', marginTop: '4px'}}>
              {formatFileSize(message.filesize)}
            </div>

            {message.sender_id === user.userid && (
              <span className={chatAreaClasses.messageTime}>
                {message.status === "pending"
                  ? "..."
                  : message.is_read
                    ? "✓✓"
                    : "✓"}
              </span>
            )}

          </div>
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
              src={getAuthenticatedFileUrl(message)}
              className={classes.senderpreview_video}
            />
          </div>
        )}
      </>
    );
  },
);

export default VideoMessage;
