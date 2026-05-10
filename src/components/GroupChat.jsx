import React, { useState, useEffect, useRef, useContext } from "react";
import { Appstate } from "../App";
import axiosbase from "../axiosconfig";
import { io } from "socket.io-client";
import { format } from "date-fns";
import { IoMdSend, IoMdExit } from "react-icons/io";
import { showSuccessAlert, showErrorAlert } from "./alerthelper";
import classes from "../pages/styling/chat.module.css";

const GroupChat = ({ group, onLeaveGroup }) => {
  const { user } = useContext(Appstate);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io("http://localhost:5500"); // Local development
    setSocket(newSocket);

    // Join group room
    newSocket.emit("join-group", group.id);

    // Listen for new messages
    newSocket.on("receive-group-message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Load existing messages
    fetchMessages();

    return () => {
      newSocket.emit("leave-group", group.id);
      newSocket.disconnect();
    };
  }, [group.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const response = await axiosbase.get(`/messages/group/${group.id}`);
      setMessages(response.data);
      setLoading(false);
    } catch (error) {
      console.error(
        "Error fetching from group messages(groupchat.jsx):",
        error,
      );
      showErrorAlert("Error", "Failed to load messages(groupchat.jsx)");
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const response = await axiosbase.post(`/messages/group/${group.id}`, {
        content: newMessage,
        message_type: "text",
      });
      // console.log("response", response);
      //
      setMessages((prev) => [...prev, response.data.data]);

      const messageData = {
        ...response.data.data,
        sender_username: user.username,
      };

      // Emit to socket for real-time
      socket.emit("new-group-message", {
        ...messageData,
        group_id: group.id,
      });

      setNewMessage("");
    } catch (error) {
      console.error("Error sending message(groupchat.jsxhandlesend):", error);
      showErrorAlert(
        "Error",
        "Failed to send message(groupchat.jsxhandlesend)",
      );
    }
  };

  const handleLeaveGroup = async () => {
    try {
      await axiosbase.delete(`/groups/${group.id}/leave`);
      showSuccessAlert("Success", "Successfully left the group");
      onLeaveGroup();
    } catch (error) {
      console.error("Error leaving group(groupchat.jsxhandleleave):", error);
      showErrorAlert(
        "Error",
        error.response?.data?.error || "Failed to leave group",
      );
    }
  };

  const formatMessageTime = (timestamp) => {
    return format(new Date(timestamp), "HH:mm");
  };

  if (loading) {
    return (
      <div className={classes.chatLoading}>
        <div className={classes.loadingSpinner}></div>
        <p>Loading messages...</p>
      </div>
    );
  }

  return (
    <div className={classes.groupChatContainer}>
      {/* Chat Header */}
      <div className={classes.chatHeader}>
        <div className={classes.chatHeaderInfo}>
          <h3>{group.name}</h3>
          <p>
            {group.member_count} members • {group.description}
          </p>
        </div>
        <div className={classes.chatHeaderActions}>
          {group.user_role === "admin" && (
            <span className={classes.adminBadge}>Admin</span>
          )}
          <button
            className={classes.leaveButton}
            onClick={handleLeaveGroup}
            title="Leave Group"
          >
            <IoMdExit />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className={classes.messagesArea}>
        {messages.length === 0 ? (
          <div className={classes.emptyMessages}>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`${classes.messageItem} ${
                message.sender_id === user.userid ? classes.ownMessage : ""
              }`}
            >
              <div className={classes.messageContent}>
                <div className={classes.messageHeader}>
                  <span className={classes.messageSender}>
                    {message.sender_username}
                  </span>
                  <span className={classes.messageTime}>
                    {formatMessageTime(message.created_at)}
                  </span>
                </div>
                <div className={classes.messageText}>{message.content}</div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form className={classes.messageInput} onSubmit={handleSendMessage}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className={classes.messageInputField}
          disabled={isTyping}
        />
        <button
          type="submit"
          className={classes.sendButton}
          disabled={!newMessage.trim() || isTyping}
        >
          <IoMdSend size={26} color={newMessage.trim() ? "#0b93f6" : "#999"} />
        </button>
      </form>
    </div>
  );
};

export default GroupChat;
