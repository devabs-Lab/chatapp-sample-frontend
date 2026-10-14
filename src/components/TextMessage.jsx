import React from "react";
import classes from "../pages/styling/chat.module.css";
import chatAreaClasses from "../pages/styling/chatArea.module.css";
import { format } from "date-fns";
import InitialsAvatar from "./InitialsAvatar";

export const TextMessage = ({
  message,
  user,
  onAvatarClick,
  onJumpToParent,
  showSenderName = false,
}) => {
  const formatMessageTime = (timestamp) => {
    try {
      return format(new Date(timestamp), "h:mm a");
    } catch (e) {
      return "";
    }
  };

  const isOwnMessage = message.sender_id === user.userid;

  const pendingSpinner = (progress) => {
    const circumference = 2 * Math.PI * 10;
    const arcLength = Math.max((circumference * progress) / 100, 2);

    return (
      <div className={classes.spinner_containerr} style={{ display: 'inline-block', marginLeft: '4px' }}>
        {progress < 100 && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 50 50"
            style={{
              animation: "spin 1.5s linear infinite",
              pointerEvents: "none",
            }}
          >
            {/* Colors come from .spinner_containerr in chat.module.css (a
                CSS rule beats an SVG presentation attribute regardless of
                these inline values), so both circles stay theme-aware
                instead of a fixed hex baked in here. */}
            <circle cx="25" cy="25" r="10" fill="none" strokeWidth="8" />
            <circle
              cx="25"
              cy="25"
              r="10"
              fill="none"
              strokeWidth="8"
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

      {/* Bubble + text column. The sender's name is skipped in a 1:1 chat —
          it's already shown once in the chat header — but shown here in a
          group, where a row could be any of several senders
          (showSenderName, set by GroupChat.jsx). The timestamp lives inside
          this column, right after the bubble, so it hugs the bubble's own
          width instead of being pushed to the far edge of the row by
          messageContent's flex-grow. */}
      <div className={chatAreaClasses.messageContent}>
        {showSenderName && !isOwnMessage && (
          <span className={chatAreaClasses.messageSender}>
            {message.sender_username}
          </span>
        )}
        <div className={chatAreaClasses.messageBubble}>
          {/* The quoted message sits inside the bubble with a colour bar
              down its left edge, the way Telegram renders a reply. */}
          {message.parent_message_id && (
            <div
              className={chatAreaClasses.replyQuote}
              onClick={(e) => {
                e.stopPropagation();
                onJumpToParent?.(message.parent_message_id);
              }}
            >
              <span className={chatAreaClasses.replyQuoteName}>
                {message.parent_sender_username || "Message"}
              </span>
              <span className={chatAreaClasses.replyQuoteText}>
                {message.parent_is_deleted
                  ? "Deleted message"
                  : message.parent_content ||
                    message.parent_filename ||
                    message.parent_message_type ||
                    ""}
              </span>
            </div>
          )}
          {message.content}
        </div>

        <span className={chatAreaClasses.messageTime}>
          {formatMessageTime(message.delivered_at || message.created_at)}
          {/* Telegram marks an edited message next to its timestamp rather
              than announcing it in the bubble. */}
          {message.edited_at && (
            <span style={{ marginLeft: "4px", fontStyle: "italic" }}>edited</span>
          )}
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

export default TextMessage;
