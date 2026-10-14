import React, { useState, useRef, useMemo, useEffect } from "react";
import { format } from "date-fns";
import classes from "../pages/styling/chat.module.css";
import chatAreaClasses from "../pages/styling/chatArea.module.css";
import { useVideoVisibilitys } from "./UseVideoVisibilitys";
import { Plyr } from "plyr-react";
import "plyr-react/plyr.css";
import { getAuthenticatedFileUrl, getMediaFrameStyle } from "../utils/mediaUtils.js";
import FileMessage from "./FileMessage.jsx";
import InitialsAvatar from "./InitialsAvatar";

export const VideoMessage = React.memo(
  ({ message, user, onDownloadClick, onLoad, onCancel, onAvatarClick, showSenderName = false }) => {
    const videoRef = useRef(null);
    const clickTimeout = useRef(null);

    useVideoVisibilitys(videoRef);
    const formatMessageTime = (timestamp) => {
      try {
        return format(new Date(timestamp), "h:mm a");
      } catch {
        return "";
      }
    };

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
          onAvatarClick={onAvatarClick}
          showSenderName={showSenderName}
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
          {/* Avatar column — clicking the other person's avatar opens their profile */}
          <div className={chatAreaClasses.avatarWrapper}>
            <InitialsAvatar
              name={message.sender_id === user.userid ? user.username : message.sender_username}
              imageUrl={message.sender_id === user.userid ? user.avatar_url : message.sender_avatar_url}
              size="sm"
              status="none"
              backgroundColor={message.sender_id === user.userid ? "var(--lav)" : undefined}
              color={message.sender_id === user.userid ? "var(--m-dk)" : undefined}
              onClick={message.sender_id !== user.userid ? onAvatarClick : undefined}
            />
          </div>

          <div className={chatAreaClasses.messageContent}>
            {showSenderName && message.sender_id !== user.userid && (
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

                  {message.filesize != null && (
                    <span className={chatAreaClasses.mediaSizeBadge}>
                      {formatFileSize(message.filesize)}
                    </span>
                  )}
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

                  {message.filesize != null && (
                    <span className={chatAreaClasses.mediaSizeBadge}>
                      {formatFileSize(message.filesize)}
                    </span>
                  )}
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

            <span className={chatAreaClasses.messageTime}>
              {formatMessageTime(message.delivered_at || message.created_at)}
              {message.sender_id === user.userid && (
                <span style={{ marginLeft: "4px" }}>
                  {message.status === "pending"
                    ? pendingSpinner(80)
                    : message.is_read
                      ? " · ✓✓"
                      : " · ✓"}
                </span>
              )}
            </span>
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
