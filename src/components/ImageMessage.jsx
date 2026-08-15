import React, { useState } from "react";
import classes from "../pages/styling/chat.module.css";
import chatAreaClasses from "../pages/styling/chatArea.module.css";
import { getMediaFrameStyle } from "../utils/mediaUtils.js";

export const ImageMessage = React.memo(
  ({ message, user, onLoad, onCancel }) => {
    const formatFileSize = (bytes) => {
      if (!bytes && bytes !== 0) return "";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const isSender = message.sender_id !== user.userid;
    const isOwnMessage = message.sender_id === user.userid;
    const [previewUrl, setPreviewUrl] = useState(null);
    const imageSrc =
      message.fileUrl ||
      message.preview ||
      (typeof message.fileurl === "string" &&
      message.fileurl.startsWith("data:")
        ? message.fileurl
        : "");
    const uploadProgress =
      Number.isFinite(Number(message.uploadProgress)) &&
      message.uploadProgress >= 0
        ? Number(message.uploadProgress)
        : null;
    const downloadProgress =
      Number.isFinite(Number(message.downloadProgress)) &&
      message.downloadProgress >= 0
        ? Number(message.downloadProgress)
        : null;
    const isTempUpload = String(message.tempId || "").startsWith("temp-");
    const isSendingUpload =
      isOwnMessage &&
      isTempUpload &&
      uploadProgress !== null &&
      uploadProgress < 100;
    const isRenderingImage =
      !isTempUpload &&
      !isSendingUpload &&
      downloadProgress !== null &&
      downloadProgress < 100;
    const activeImageProgress = isSendingUpload
      ? uploadProgress
      : isRenderingImage
        ? downloadProgress
        : null;

    const renderSpinner = ({ progress, showCancel = false, onCancel }) => {
      const circumference = 2 * Math.PI * 20; // circle perimeter
      const arcLength = Math.max((circumference * progress) / 100, 2); // min arc at 0

      return (
        <div className={classes.spinner_container}>
          {/* Spinner Circle */}
          {progress < 100 && (
            <div className={classes.progressSpinnerRotator}>
              <svg
                className={classes.imageProgressSpinner}
                width="50"
                height="50"
                viewBox="0 0 50 50"
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
            </div>
          )}

          {/* Cancel Button inside the circle */}
          {showCancel && progress < 100 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onCancel?.();
              }}
              className={`${classes.cancel_button} ${classes.imageCancelButton}`}
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
          className={`${chatAreaClasses.messageItem} ${
            isOwnMessage ? chatAreaClasses.ownMessage : ""
          }`}
        >
          <div className={chatAreaClasses.messageContent}>
            {!isOwnMessage && (
              <span className={chatAreaClasses.messageSender}>
                {message.sender_username}
              </span>
            )}

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
                    onLoad?.(
                      message.id || message.tempId,
                      isOwnMessage,
                    )
                  }
                  onClick={() => setPreviewUrl(imageSrc)}
                />
              ) : (
                <div className={classes.mediaPlaceholder}></div>
              )}

              {activeImageProgress !== null && (
                <div
                  className={`${classes.sendload_container} ${classes.imageLoadOverlay}`}
                >
                  {renderSpinner({
                    progress: activeImageProgress,
                    showCancel: isSendingUpload,
                    onCancel,
                  })}
                  <div
                    className={`${classes.sendload_percent} ${
                      isSendingUpload
                        ? classes.imageUploadPercent
                        : classes.imageRenderPercent
                    }`}
                  >
                    {activeImageProgress}%
                  </div>
                </div>
              )}
            </div>

            <div style={{fontSize: '11px', color: 'var(--gray-500)', marginTop: '4px'}}>
              {formatFileSize(message.fileSize || message.filesize)}
            </div>

            {isOwnMessage && (
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
            <img
              src={previewUrl}
              alt="Full preview"
              className={classes.image_fulldisplay}
            />
          </div>
        )}
      </>
    );
  },
);

export default ImageMessage;
