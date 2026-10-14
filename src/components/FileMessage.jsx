import React from "react";
import classes from "../pages/styling/chat.module.css";
import chatAreaClasses from "../pages/styling/chatArea.module.css";
import { getAuthenticatedFileUrl } from "../utils/mediaUtils.js";
import InitialsAvatar from "./InitialsAvatar";

export const FileMessage = ({ message, user, onDownloadClick, onCancel, onAvatarClick, showSenderName = false }) => {
  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return "";

    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const isSender = message.sender_id !== user.userid;
  const isOwnMessage = message.sender_id === user.userid;
  const isDownloading = message.isDownloading ?? false;
  const isDownloaded = message.isDownloaded ?? false;
  const isPaused = message.isPaused ?? false;
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
  const isUploading =
    isOwnMessage &&
    isTempUpload &&
    uploadProgress !== null &&
    uploadProgress < 100;
  const isFileBusy = isUploading || isDownloading || isPaused;
  const activeFileProgress = isUploading
    ? uploadProgress
    : downloadProgress !== null
      ? downloadProgress
      : 0;

  const handleCancel = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onCancel?.();
  };

  const handleOpen = () => {
    window.open(message.fileUrl || getAuthenticatedFileUrl(message), "_blank");
  };

  const renderFileSpinner = (progress) => {
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
      className={`${chatAreaClasses.messageItem} ${
        isOwnMessage ? chatAreaClasses.ownMessage : ""
      }`}
    >
      {/* Avatar column — clicking the other person's avatar opens their profile */}
      <div className={chatAreaClasses.avatarWrapper}>
        <InitialsAvatar
          name={isOwnMessage ? user.username : message.sender_username}
          imageUrl={isOwnMessage ? user.avatar_url : message.sender_avatar_url}
          size="sm"
          status="none"
          backgroundColor={isOwnMessage ? "var(--lav)" : undefined}
          color={isOwnMessage ? "var(--m-dk)" : undefined}
          onClick={!isOwnMessage ? onAvatarClick : undefined}
        />
      </div>

      {/* Bubble + text column */}
      <div className={chatAreaClasses.messageContent}>
        {showSenderName && !isOwnMessage && (
          <span className={chatAreaClasses.messageSender}>
            {message.sender_username}
          </span>
        )}
        {/* File Attachment Bubble */}
        <div className={chatAreaClasses.fileAttachmentBubble} onClick={handleOpen} style={{ cursor: "pointer" }}>
          <div className={chatAreaClasses.fileIconBox}>
            <i className="ti ti-file-text"></i>
          </div>
          <div className={chatAreaClasses.fileInfo}>
            <span className={chatAreaClasses.fileName}>{message.filename}</span>
            <span className={chatAreaClasses.fileMeta}>
              {formatFileSize(message.filesize)} · Document
            </span>
          </div>
        </div>

        <span className={chatAreaClasses.messageTime}>
          {message.created_at ? new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ""}
          {isOwnMessage && (
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
  );
};

export default FileMessage;
