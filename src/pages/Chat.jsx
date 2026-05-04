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
import {
  FiAtSign,
  FiInfo,
  FiGift,
  FiBell,
  FiPhone,
  FiBriefcase,
  FiMoreVertical,
} from "react-icons/fi";
import editimage from "../assets/edit.png";

const Chat = ({
  selectedConversation,
  setSelectedConversation,
  setMessages,
  setMessagesCache,
  atBottomRef,
  pendingAutoScrollRef,
  hydratedChatsRef,
  pendingMessagesRef,
  activeUploadsRef,
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
  const { user, setuser } = useContext(Appstate);
  // console.log("Chat component rendered with user:", user);
  const fileInputRef = useRef(null);

  const [scrollPositions, setScrollPositions] = useState({});
  // console.log(scrollPositions);

  const [activeTab, setActiveTab] = useState("groups"); // 'groups', 'inbox', 'create'
  const [groups, setGroups] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [bio, setBio] = useState(user.bio || "");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showedit, setshowedit] = useState(false);

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
        "Failed to load your groups(chat.jsxfetchusergroups)",
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
        error,
      );
      showErrorAlert(
        "Error",
        "Failed to load conversations(chat.jsxfetchconversations)",
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
        error.response?.data?.error || "Failed to create group",
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
        error.response?.data?.error || "Failed to join group",
      );
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    console.log("Selected avatar file:", file);

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const res = await axiosbase.post("/users/avatar", formData);
      console.log("Selected avatar file:", res.data);

      setuser((prev) => ({
        ...prev,
        avatar_url: res.data.avatar_url,
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleprofile = () => {
    setShowProfileMenu((prev) => !prev);
  };

  const handleprofileform = () => {
    setShowProfileForm((prev) => !prev);
  };

  const handleSaveProfile = async () => {
    console.log("Saving profile with data:", { bio, phone, department });
    try {
      const res = await axiosbase.put("/users/update-profile", {
        bio,
        phone,
        department,
      });

      setuser((prev) => ({
        ...prev,
        ...res.data,
      }));
      setshowedit(false);
      // setShowProfileForm(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = () => {
    setBio(user.bio || "");
    setPhone(user.phone || "");
    setDepartment(user.department || "");
    setshowedit(true);
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
              {showProfileMenu && (
                <div className={classes.profiledisplay}>
                  <div className={classes.profileWrapper}>
                    {user.avatar_url ? (
                      <img
                        src={`http://localhost:5500${user.avatar_url}`}
                        alt=""
                        className={classes.avatar}
                        onClick={handleprofileform}
                      />
                    ) : (
                      <IoMdPerson
                        className={classes.defaultAvatarIcon}
                        onClick={handleprofileform}
                      />
                    )}
                  </div>
                  <div className={classes.usernamefont}> {user.username} </div>
                </div>
              )}

              <div className={classes.profilemenu}>
                <h3 className={classes.spanforinbox}>Inbox</h3>
                <span className={classes.profileicon} onClick={handleprofile}>
                  <span>
                    <FiMoreVertical />{" "}
                  </span>
                </span>
              </div>

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
                        avatar_url: person.avatar_url,
                        bio: person.bio,
                        phone: person.phone,
                        department: person.department,
                        status: person.status,
                        last_seen: person.last_seen,
                        message_count: 0,
                      });
                    }}
                  >
                    <div className={classes.avatarWrapper}>
                      {person.avatar_url ? (
                        <img
                          src={`http://localhost:5500${person.avatar_url}`}
                          alt="avatar"
                          className={classes.avatar}
                        />
                      ) : (
                        <IoMdPerson className={classes.defaultAvatarIcon} />
                      )}
                    </div>
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
        {showProfileForm ? (
          <div className={classes.profileContainer}>
            <div className={classes.profileCard}>
              {/* {bander section} */}
              <div className={classes.profileBanner}>
                <img
                  src="https://www.uopeople.edu/retention/chat-bot/chatbot-header.webp"
                  alt=""
                  className={classes.profileBannerImage}
                />
              </div>

              {/* Avatar Section */}
              <div className={classes.profileAvatarSection}>
                <label>
                  <div className={classes.profileAvatarWrapper}>
                    {" "}
                    {user.avatar_url ? (
                      <img
                        src={`http://localhost:5500${user.avatar_url}`}
                        alt=""
                        className={classes.profileAvatar}
                      />
                    ) : (
                      <IoMdPerson className={classes.profileDefaultIcon} />
                    )}
                  </div>
                  <div className={classes.editIconWrapper}>
                    {" "}
                    <img src={editimage} alt="" className={classes.editimage} />
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleAvatarUpload}
                  />
                </label>

                <h3>{user.username}</h3>
              </div>

              {/* Form Section */}
              {!showedit && (
                <div className={classes.profileDetails}>
                  <div className={classes.profileInfo}>
                    <div className={classes.profileInfoTitlefornobio}>
                      {user.bio ? "" : "Bio"}
                    </div>
                    <div className={classes.profileedit} onClick={handleEdit}>
                      Edit
                    </div>
                  </div>
                  {/* {console.log(
                    "Rendering profile details with user data:",
                    user,
                  )} */}
                  <div className={classes.profileInfoContent}>
                    {user.bio ? (
                      <div className={classes.internalprofile}>
                        <div className={classes.profileiconinfo}>
                          <FiInfo />
                        </div>
                        <div className={classes.detailside}>
                          <div className={classes.bioforprofile}>
                            {user.bio}
                          </div>
                          <div className={classes.profileInfoTitle}>bio</div>
                        </div>
                      </div>
                    ) : (
                      <div className={classes.nobioforprofile}>
                        No bio available.
                      </div>
                    )}

                    {user.phone ? (
                      <div className={classes.internalprofile}>
                        <div className={classes.profileiconinfo}>
                          <FiPhone />
                        </div>
                        <div className={classes.detailside}>
                          <div className={classes.phoneforprofile}>
                            {user.phone}
                          </div>
                          <div className={classes.phoneTitle}>Phone</div>
                        </div>
                      </div>
                    ) : (
                      ""
                    )}

                    {user.department ? (
                      <div className={classes.internalprofile}>
                        <div className={classes.profileiconinfo}>
                          <FiBriefcase />
                        </div>
                        <div className={classes.detailside}>
                          <div className={classes.departmentforprofile}>
                            {user.department}
                          </div>
                          <div className={classes.departmentTitle}>
                            Department
                          </div>
                        </div>
                      </div>
                    ) : (
                      ""
                    )}
                  </div>
                </div>
              )}

              {showedit && (
                <div className={classes.profileForm}>
                  <div className={classes.inputGroup}>
                    <label>Bio</label>
                    <textarea
                      placeholder="Write something about yourself..."
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                    />
                  </div>

                  <div className={classes.inputGroup}>
                    <label>Phone Number</label>
                    <input
                      type="text"
                      placeholder="+251..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>

                  <div className={classes.inputGroup}>
                    <label>Department</label>
                    <input
                      type="text"
                      placeholder="e.g. Accouting"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                  </div>

                  {/* Buttons */}
                  <div className={classes.profileActions}>
                    <button
                      className={classes.saveBtn}
                      onClick={handleSaveProfile}
                    >
                      Save Changes
                    </button>

                    <button
                      className={classes.cancelBtn}
                      onClick={() => setShowProfileForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : selectedGroup ? (
          <GroupChat
            group={selectedGroup}
            onLeaveGroup={() => {
              setSelectedGroup(null);
              fetchUserGroups();
            }}
          />
        ) : selectedConversation ? (
          <PrivateChat
            key={selectedConversation.other_user_id}
            conversation={selectedConversation}
            allUsers={allUsers}
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
            activeUploadsRef={activeUploadsRef}
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
