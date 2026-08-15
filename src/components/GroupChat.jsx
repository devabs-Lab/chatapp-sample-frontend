import React, { useState, useEffect, useRef, useContext } from "react";
import { Appstate } from "../App";
import axiosbase from "../axiosconfig";
import { format } from "date-fns";
import { IoMdSend, IoMdExit } from "react-icons/io";
import { FiArrowLeft } from "react-icons/fi";
import { showSuccessAlert, showErrorAlert } from "./alerthelper";
import classes from "../pages/styling/chat.module.css";
import chatAreaClasses from "../pages/styling/chatArea.module.css";
import InitialsAvatar from "./InitialsAvatar";
import { RiEmotionHappyLine } from "react-icons/ri";

const GroupChat = ({ group, onLeaveGroup, isMobile, setMobileView }) => {
  const { user } = useContext(Appstate);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);



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
    <div className={chatAreaClasses.chatArea}>
      {/* Chat Header */}
      <div className={chatAreaClasses.chatHeader}>
        {isMobile && (
          <button
            onClick={() => setMobileView("list")}
            className={chatAreaClasses.backButton}
          >
            <i className="ti ti-arrow-left"></i>
          </button>
        )}
        
        <InitialsAvatar name={group.name} size="md" status="none" />

        <div className={chatAreaClasses.headerInfo}>
          <h3 className={chatAreaClasses.headerName}>{group.name}</h3>
          <p className={chatAreaClasses.headerStatus} style={{ color: 'var(--plum-lt)' }}>
            {group.member_count} members • {group.description || "No description"}
          </p>
        </div>
        
        <div className={chatAreaClasses.headerActions}>
          {group.user_role === "admin" && (
            <span style={{background: 'var(--m)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', marginRight: '8px'}}>Admin</span>
          )}
          <button className={`${chatAreaClasses.iconButton} ${chatAreaClasses.bgPale}`} title="Search">
            <i className="ti ti-search"></i>
          </button>
          <button className={`${chatAreaClasses.iconButton} ${chatAreaClasses.bgPlum}`} title="Group Call">
            <i className="ti ti-phone"></i>
          </button>
          <button className={`${chatAreaClasses.iconButton} ${chatAreaClasses.bgMagenta}`} title="Group Video Call">
            <i className="ti ti-video"></i>
          </button>
          <button
            className={`${chatAreaClasses.iconButton} ${chatAreaClasses.bgPale}`}
            onClick={handleLeaveGroup}
            title="Leave Group"
          >
            <i className="ti ti-logout" style={{ transform: 'rotate(180deg)', display: 'inline-block' }}></i>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className={chatAreaClasses.messagesArea}>
        <div className={chatAreaClasses.messagesInner}>
          {messages.length === 0 ? (
            <div className={chatAreaClasses.emptyMessages}>
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isOwn = message.sender_id === user.userid;
              const prevMsg = messages[index - 1];
              const showDivider = !prevMsg || 
                new Date(message.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();
              
              return (
                <React.Fragment key={message.id}>
                  {showDivider && (
                    <div className={chatAreaClasses.dateDivider}>
                      <span className={chatAreaClasses.dateDividerText}>
                        {new Date(message.created_at).toDateString() === new Date().toDateString() ? "Today" : new Date(message.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                  <div
                    className={`${chatAreaClasses.messageItem} ${isOwn ? chatAreaClasses.ownMessage : ""}`}
                  >
                    <div className={chatAreaClasses.avatarWrapper}>
                      <InitialsAvatar
                        name={message.sender_username}
                        size="sm"
                        status="none"
                        backgroundColor={isOwn ? "var(--lav)" : undefined}
                        color={isOwn ? "var(--m-dk)" : undefined}
                      />
                    </div>
                    <div className={chatAreaClasses.messageContent}>
                      {!isOwn && (
                        <span className={chatAreaClasses.messageSender}>
                          {message.sender_username}
                        </span>
                      )}
                      <div className={chatAreaClasses.messageBubble}>{message.content}</div>
                    </div>
                    <span className={chatAreaClasses.messageTime}>
                      {formatMessageTime(message.created_at)}
                    </span>
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className={chatAreaClasses.inputContainer}>
        <form className={chatAreaClasses.inputRow} onSubmit={handleSendMessage}>
          <button
            type="button"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--plum-lt)', fontSize: '20px', display: 'flex',
              alignItems: 'center', padding: '0 2px', flexShrink: 0
            }}
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
          >
            <i className="ti ti-paperclip"></i>
          </button>

          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Write a message..."
            className={chatAreaClasses.messageInput}
            disabled={isTyping}
            rows={1}
          />
          
          <label style={{ display: 'none' }}>
            <input
              type="file"
              ref={fileInputRef}
              accept="*/*"
              multiple
            />
          </label>

          <button
            type="submit"
            className={chatAreaClasses.sendButton}
            disabled={!newMessage.trim() || isTyping}
          >
            <i className="ti ti-send"></i>
          </button>
        </form>
      </div>
    </div>
  );
};

export default GroupChat;
