import React, { memo, useCallback } from "react";
import TextMessage from "./TextMessage.jsx";
import ImageMessage from "./ImageMessage.jsx";
import VideoMessage from "./VideoMessage.jsx";
import FileMessage from "./FileMessage.jsx";
import AudioMessage from "./AudioMessage.jsx";
import CallLogMessage from "./CallLogMessage.jsx";
import { parseCallEvent } from "../utils/messagePreview.js";

const MessageRenderer = memo(function MessageRenderer({
  message,
  onDownloadClick,
  chatContainerRef,
  user,
  handleMediaLoad,
  onCancel,
  onAvatarClick,
  onJumpToParent,
  showSenderName,
}) {
  const ts =
    message.delivered_at || message.created_at || new Date().toISOString();

  const isSender = message.sender_id === user.userid;
  const handleLoad = useCallback(() => {
    handleMediaLoad?.(message.id || message.tempId, isSender);
  }, [message.id, message.tempId, isSender, handleMediaLoad]);

  /* A resolved call is a real message_type: "text" row whose content is
     prefixed to mark it as a call event — see messagePreview.js. */
  if (message.message_type === "text") {
    const callEvent = parseCallEvent(message.content);
    if (callEvent) {
      return (
        <CallLogMessage
          event={callEvent}
          iAmCaller={isSender}
          id={message.id || message.tempId}
        />
      );
    }
  }

  switch (message.message_type) {
    case "text":
      return (
        <TextMessage
          message={message}
          user={user}
          onAvatarClick={onAvatarClick}
          onJumpToParent={onJumpToParent}
          showSenderName={showSenderName}
        />
      );
    case "image":
      return (
        <ImageMessage
          message={message}
          onDownloadClick={onDownloadClick}
          user={user}
          chatContainerRef={chatContainerRef}
          onLoad={handleLoad}
          onCancel={onCancel}
          onAvatarClick={onAvatarClick}
          onJumpToParent={onJumpToParent}
          showSenderName={showSenderName}
        />
      );

    case "video":
      return (
        <VideoMessage
          message={message}
          onDownloadClick={onDownloadClick}
          user={user}
          chatContainerRef={chatContainerRef}
          onLoad={handleLoad}
          onCancel={onCancel}
          onAvatarClick={onAvatarClick}
          onJumpToParent={onJumpToParent}
          showSenderName={showSenderName}
        />
      );

    case "audio":
      return (
        <AudioMessage
          message={message}
          onDownloadClick={onDownloadClick}
          user={user}
          onCancel={onCancel}
          chatContainerRef={chatContainerRef}
          onAvatarClick={onAvatarClick}
          onJumpToParent={onJumpToParent}
          showSenderName={showSenderName}
        />
      );
    default:
      return (
        <FileMessage
          message={message}
          onDownloadClick={onDownloadClick}
          user={user}
          onCancel={onCancel}
          chatContainerRef={chatContainerRef}
          onAvatarClick={onAvatarClick}
          onJumpToParent={onJumpToParent}
          showSenderName={showSenderName}
        />
      );
  }
});

export default MessageRenderer;
