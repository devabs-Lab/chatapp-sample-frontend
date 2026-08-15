import React, { memo, useCallback } from "react";
import TextMessage from "./TextMessage.jsx";
import ImageMessage from "./ImageMessage.jsx";
import VideoMessage from "./VideoMessage.jsx";
import FileMessage from "./FileMessage.jsx";
import AudioMessage from "./AudioMessage.jsx";

const MessageRenderer = memo(function MessageRenderer({
  message,
  onDownloadClick,
  chatContainerRef,
  user,
  handleMediaLoad,
  onCancel,
}) {
  const ts =
    message.delivered_at || message.created_at || new Date().toISOString();

  const isSender = message.sender_id === user.userid;
  const handleLoad = useCallback(() => {
    handleMediaLoad?.(message.id || message.tempId, isSender);
  }, [message.id, message.tempId, isSender, handleMediaLoad]);

  switch (message.message_type) {
    case "text":
      return <TextMessage message={message} user={user} />;
    case "image":
      return (
        <ImageMessage
          message={message}
          onDownloadClick={onDownloadClick}
          user={user}
          chatContainerRef={chatContainerRef}
          onLoad={handleLoad}
          onCancel={onCancel}
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
        />
      );
  }
});

export default MessageRenderer;
