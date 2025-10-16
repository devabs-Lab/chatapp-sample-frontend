import React, { useState, useEffect, useContext, useRef, use } from "react";
import { Appstate } from "../App";
import axiosbase from "../axiosconfig";
import classes from "./styling/chat.module.css";
import {
  IoMdChatboxes,
  IoMdPeople,
  IoMdPerson,
  IoMdCompass,
} from "react-icons/io";

import { BsPlusCircle } from "react-icons/bs";
import GroupChat from "../components/GroupChat";
import PrivateChat from "../components/PrivateChat";
import CreateGroup from "../components/CreateGroup";
import { showSuccessAlert, showErrorAlert } from "../components/alerthelper";

const Chat = ({
  selectedConversation,
  setSelectedConversation,
  setMessages,
  setMessagesCache,
  atBottomRef,
  pendingAutoScrollRef,
  hydratedChatsRef,
  pendingMessagesRef,
  resendPendingMessage,
  setUnreadCount,
  unreadCount,
  messages,
  messagesCache,
  updateCache,
  sendFileToServer,
  offset,
  setoffset,
}) => {
  const { user } = useContext(Appstate);

  const [scrollPositions, setScrollPositions] = useState({});

  const [activeTab, setActiveTab] = useState("groups"); // 'groups', 'inbox', 'create'
  const [groups, setGroups] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserGroups();
    fetchConversations();
    fetchAllUsers();
  }, []);

  const replaceCache = (other_user_id, messagesArray) => {
    setMessagesCache((prev) => ({
      ...prev,
      [other_user_id]: messagesArray, // replace with clean array
    }));
  };

  const fetchUserGroups = async () => {
    try {
      const response = await axiosbase.get("/groups/my-groups");
      setGroups(response.data);
    } catch (error) {
      console.error("Error fetching groups:(chat.jsxfetchusergroups)", error);
      showErrorAlert(
        "Error",
        "Failed to load your groups(chat.jsxfetchusergroups)"
      );
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await axiosbase.get("/messages/users/all");
      setAllUsers(response.data);
    } catch (error) {
      console.error("Error fetching all users:", error);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await axiosbase.get("/messages/conversations");
      setConversations(response.data);
      // console.log(response.data);
    } catch (error) {
      console.error(
        "Error fetching conversations:(chat.jsxfetchconversations)",
        error
      );
      showErrorAlert(
        "Error",
        "Failed to load conversations(chat.jsxfetchconversations)"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConversationSelect = (conversation) => {
    setSelectedConversation(conversation);
    setMessages(messagesCache[conversation.other_user_id] || []);
    setSelectedGroup(null);
    setActiveTab("inbox");
  };

  const handleGroupSelect = (group) => {
    setSelectedGroup(group);
    setSelectedConversation(null);
    setActiveTab("groups");
  };

  const handleCreateGroup = async (groupData) => {
    try {
      const response = await axiosbase.post("/groups", groupData);
      showSuccessAlert("Success", "Group created successfully!");
      setShowCreateGroup(false);
      fetchUserGroups();
    } catch (error) {
      console.error("Error creating group:(chat.jsxhandlecreategroup)", error);
      showErrorAlert(
        "Error",
        error.response?.data?.error || "Failed to create group"
      );
    }
  };

  const handleJoinGroup = async (group) => {
    try {
      await axiosbase.post(`/groups/${group.id}/join`);
      showSuccessAlert("Success", "Successfully joined the group!");
      fetchUserGroups();
    } catch (error) {
      console.error("Error joining group:", error);
      showErrorAlert(
        "Error",
        error.response?.data?.error || "Failed to join group"
      );
    }
  };

  if (loading) {
    return (
      <div className={classes.loadingContainer}>
        <div className={classes.loadingSpinner}></div>
        <p>Loading chat...</p>
      </div>
    );
  }
  const inboxUsers = allUsers.filter((u) => u.userid !== user.userid);

  return (
    <div className={classes.chatContainer}>
      {/* Sidebar */}
      <div className={classes.sidebar}>
        {/* Content based on active tab */}
        <div className={classes.sidebarContent}>
          {activeTab === "groups" && (
            <div className={classes.groupsList}>
              <h3>My Groups</h3>
              {groups.length === 0 ? (
                <div className={classes.emptyState}>
                  <IoMdPeople size={48} />
                  <p>You haven't joined any groups yet</p>
                  <button
                    className={classes.joinGroupButton}
                    onClick={() => setActiveTab("create")}
                  >
                    Create or Join a Group
                  </button>
                </div>
              ) : (
                groups.map((group) => (
                  <div
                    key={group.id}
                    className={`${classes.groupItem} ${
                      selectedGroup?.id === group.id ? classes.selected : ""
                    }`}
                    onClick={() => handleGroupSelect(group)}
                  >
                    <div className={classes.groupInfo}>
                      <h4>{group.name}</h4>
                      <p>{group.member_count} members</p>
                    </div>
                    {group.user_role === "admin" && (
                      <span className={classes.adminBadge}>Admin</span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "inbox" && (
            <div className={classes.conversationsList}>
              <h3>Inbox</h3>

              {inboxUsers.length === 0 ? (
                <div className={classes.emptyState}>
                  <IoMdChatboxes size={48} />
                  <p>No other users found</p>
                  <p>Start chatting by selecting a user!</p>
                </div>
              ) : (
                inboxUsers.map((person) => (
                  <div
                    key={person.userid}
                    className={classes.conversationItem}
                    onClick={() => {
                      handleConversationSelect({
                        other_user_id: person.userid,
                        other_username: person.username,
                        message_count: 0, // default
                      });
                    }}
                  >
                    <div className={classes.conversationInfo}>
                      <h4>{person.username}</h4>
                      <p>
                        {unreadCount[person?.userid] != 0 &&
                          unreadCount[person?.userid]}{" "}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "create" && (
            <CreateGroup onCreateGroup={handleCreateGroup} />
          )}
        </div>
        {/* Tab Navigation */}
        <div className={classes.tabNavigation}>
          <button
            className={`${classes.tabButton} ${
              activeTab === "groups" ? classes.active : ""
            }`}
            onClick={() => setActiveTab("groups")}
          >
            <IoMdPeople />
            <span>My Groups</span>
          </button>
          <button
            className={`${classes.tabButton} ${
              activeTab === "explore" ? classes.active : ""
            }`}
            onClick={() => setActiveTab("explore")}
          >
            <IoMdCompass />
            <span>Explore</span>
          </button>
          <button
            className={`${classes.tabButton} ${
              activeTab === "inbox" ? classes.active : ""
            }`}
            onClick={() => setActiveTab("inbox")}
          >
            <IoMdPerson />
            <span>Inbox</span>
          </button>
          <button
            className={`${classes.tabButton} ${
              activeTab === "create" ? classes.active : ""
            }`}
            onClick={() => setActiveTab("create")}
          >
            <BsPlusCircle />
            <span>Create Group</span>
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={classes.chatArea}>
        {selectedGroup ? (
          <GroupChat
            group={selectedGroup}
            onLeaveGroup={() => {
              setSelectedGroup(null);
              fetchUserGroups();
            }}
          />
        ) : selectedConversation ? (
          <PrivateChat
            conversation={selectedConversation}
            messages={messages}
            setMessages={setMessages}
            savedScroll={
              scrollPositions[selectedConversation.other_user_id] || null
            }
            onSaveScroll={(id, pos) =>
              setScrollPositions((prev) => ({
                ...prev,
                [id]: pos,
              }))
            }
            onClose={() => setSelectedConversation(null)}
            atBottomRef={atBottomRef}
            pendingAutoScrollRef={pendingAutoScrollRef}
            hydratedChatsRef={hydratedChatsRef}
            updateCache={updateCache}
            replaceCache={replaceCache}
            setUnreadCount={setUnreadCount}
            unreadCount={unreadCount}
            offset={offset}
            setoffset={setoffset}
            resendPendingMessage={resendPendingMessage}
            pendingMessagesRef={pendingMessagesRef}
            sendFileToServer={sendFileToServer}
          />
        ) : (
          <div className={classes.welcomeScreen}>
            <div className={classes.welcomeContent}>
              <IoMdChatboxes size={64} />
              <h2>Welcome to UoPeople Chat!</h2>
              <p>Select a group or conversation to start chatting</p>
              <div className={classes.welcomeActions}>
                <button
                  className={classes.primaryButton}
                  onClick={() => setActiveTab("groups")}
                >
                  Browse Groups
                </button>
                <button
                  className={classes.secondaryButton}
                  onClick={() => setActiveTab("create")}
                >
                  Create Group
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
