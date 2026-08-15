import React from "react";
import classes from "../pages/styling/chat.module.css";
import chatAreaClasses from "../pages/styling/chatArea.module.css";
import { format } from "date-fns";
import InitialsAvatar from "./InitialsAvatar";

export const TextMessage = ({ message, user }) => {
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
            <circle cx="25" cy="25" r="10" fill="none" stroke="var(--m)" strokeWidth="8" />
            <circle
              cx="25"
              cy="25"
              r="10"
              fill="none"
              stroke="white"
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
      {/* Avatar column */}
      <div className={chatAreaClasses.avatarWrapper}>
        <InitialsAvatar
          name={isOwnMessage ? user.username : message.sender_username}
          imageUrl={isOwnMessage ? user.avatar_url : message.sender_avatar_url}
          size="sm"
          status="none"
          backgroundColor={isOwnMessage ? "var(--lav)" : undefined}
          color={isOwnMessage ? "var(--m-dk)" : undefined}
        />
      </div>

      {/* Bubble + text column */}
      <div className={chatAreaClasses.messageContent}>
        {!isOwnMessage && (
          <span className={chatAreaClasses.messageSender}>
            {message.sender_username}
          </span>
        )}
        
        <div className={chatAreaClasses.messageBubble}>{message.content}</div>
      </div>

      <span className={chatAreaClasses.messageTime}>
        {formatMessageTime(message.delivered_at || message.created_at)}
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
  );
};

export default TextMessage;
