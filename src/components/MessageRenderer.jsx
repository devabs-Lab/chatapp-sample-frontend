import React, { memo, useCallback } from "react";
// import { handleMediaLoad } from "./PrivateChat";
import {
  TextMessage,
  ImageMessage,
  VideoMessage,
  FileMessage,
  AudioMessage,
} from "./Thumbnail.jsx";

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

  // const ageMs = Date.now() - new Date(ts).getTime();

  // const isOptimistic = String(message.tempId || "").startsWith("temp-");
  // const isRecent = ageMs >= 0 && ageMs < 5_000; // 5s window for "new" messages
  // const messageId = message.id || message.tempId;
  const isSender = message.sender_id === user.userid;
  // const isReceiver = message.sender_id === conversation.other_user_id;
  const handleLoad = useCallback(() => {
    handleMediaLoad(message.id || message.tempId, isSender);
  }, [message.id, message.tempId, isSender]);

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
