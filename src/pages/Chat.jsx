import React, { useState, useEffect, useContext, useRef, use } from "react";

import { Appstate } from "../App";
import axiosbase from "../axiosconfig";
import classes from "./styling/chat.module.css";
import layoutClasses from "./styling/layout.module.css";
import inboxClasses from "./styling/inbox.module.css";
import chatAreaClasses from "./styling/chatArea.module.css";
import InitialsAvatar from "../components/InitialsAvatar";
import {
  IoMdChatboxes,
  IoMdPeople,
  IoMdPerson,
  IoMdCompass,
} from "react-icons/io";
import { FiMessageSquare, FiBook, FiVideo, FiSearch } from "react-icons/fi";
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
  FiArrowLeft,
} from "react-icons/fi";
import editimage from "../assets/edit.png";
import { useChatContext } from "../context/ChatContext";

const Chat = () => {
  const {
    selectedConversation,
    setSelectedConversation,
    messages,
    setMessages,
    messagesCache,
    setMessagesCache,
    unreadCount,
    setUnreadCount,
    offset,
    setoffset,
    atBottomRef,
    pendingAutoScrollRef,
    hydratedChatsRef,
    pendingMessagesRef,
    activeUploadsRef,
    resendPendingMessage,
    sendFileToServer,
    updateCache,
    replaceCache,
  } = useChatContext();

  const { user, setuser } = useContext(Appstate);
  // console.log("Chat component rendered with user:", user);
  const fileInputRef = useRef(null);

  const [scrollPositions, setScrollPositions] = useState({});
  // console.log(scrollPositions);

  const [activeTab, setActiveTab] = useState("all"); // 'all', 'groups', 'inbox', 'create'
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
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [showedit, setshowedit] = useState(false);
  const [mobileView, setMobileView] = useState("list");

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobile]);



  useEffect(() => {
    const loadInitialChatData = async () => {
      setLoading(true);
      await Promise.allSettled([
        fetchUserGroups(),
        fetchConversations(),
        fetchAllUsers(),
      ]);
      setLoading(false);
    };

    loadInitialChatData();
  }, []);

  // replaceCache is retrieved from useChatContext()

  const fetchUserGroups = async () => {
    setGroupsLoading(true);
    try {
      const response = await axiosbase.get("/groups/my-groups");
      setGroups(response.data);
    } catch (error) {
      console.error("Error fetching groups:(chat.jsxfetchusergroups)", error);
      showErrorAlert(
        "Error",
        "Failed to load your groups(chat.jsxfetchusergroups)",
      );
    } finally {
      setGroupsLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await axiosbase.get("/messages/users/all");
      setAllUsers(response.data);
    } catch (error) {
      console.error("Error fetching all users:", error);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchConversations = async () => {
    setConversationsLoading(true);
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
      setConversationsLoading(false);
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

  if (loading || conversationsLoading) {
    return (
      <div className={classes.loadingContainer}>
        <div className={classes.loadingSpinner}></div>
        <p>Loading chat...</p>
      </div>
    );
  }

  const inboxUsers = allUsers.filter((u) => u.userid !== user.userid);

  return (
    <div className={`${layoutClasses.chatContainer} ${!selectedConversation && !selectedGroup ? layoutClasses.profileClosed : ""}`}>
      {/* Sidebar */}
      {!isMobile && (
        <>
          {/* 1. NAV RAIL */}
          <div className={layoutClasses.navRail}>
            {/* Branding */}
            <div className={layoutClasses.branding}>
              <div className={layoutClasses.logoBox}>U</div>
              <div className={layoutClasses.brandText}>
                <h2>UoPeople Chat</h2>
                <p>Student Portal</p>
              </div>
            </div>

            {/* Global Search */}
            <div className={layoutClasses.globalSearch}>
              <div className={layoutClasses.searchInputWrapper}>
                <span className={layoutClasses.searchIcon}><i className="ti ti-search"></i></span>
                <input type="text" placeholder="Search..." />
              </div>
            </div>

            {/* MAIN section */}
            <div className={layoutClasses.navSection}>
              <h4 className={layoutClasses.sectionHeader}>MAIN</h4>
              <div className={layoutClasses.navItems}>
                <button 
                  className={`${layoutClasses.navItem} ${activeTab === "inbox" ? layoutClasses.active : ""}`}
                  onClick={() => { setActiveTab("inbox"); setSelectedConversation(null); setSelectedGroup(null); }}
                >
                  <span className={layoutClasses.navIcon}><i className="ti ti-message-circle"></i></span>
                  <span>Messages</span>
                  {Object.values(unreadCount).reduce((a, b) => a + b, 0) > 0 && (
                    <span className={layoutClasses.badge}>
                      {Object.values(unreadCount).reduce((a, b) => a + b, 0)}
                    </span>
                  )}
                </button>
                <button 
                  className={`${layoutClasses.navItem} ${activeTab === "groups" ? layoutClasses.active : ""}`}
                  onClick={() => { setActiveTab("groups"); setSelectedConversation(null); setSelectedGroup(null); }}
                >
                  <span className={layoutClasses.navIcon}><i className="ti ti-users"></i></span>
                  <span>Groups</span>
                </button>
                <button className={layoutClasses.navItem}>
                  <span className={layoutClasses.navIcon}><i className="ti ti-book"></i></span>
                  <span>Courses</span>
                </button>
                <button className={layoutClasses.navItem} disabled style={{opacity: 0.55}}>
                  <span className={layoutClasses.navIcon}><i className="ti ti-phone-call"></i></span>
                  <span>Calls</span>
                  <span className={layoutClasses.soonBadge}>Soon</span>
                </button>
                <button className={layoutClasses.navItem} disabled style={{opacity: 0.55}}>
                  <span className={layoutClasses.navIcon}><i className="ti ti-video"></i></span>
                  <span>Video</span>
                  <span className={layoutClasses.soonBadge}>Soon</span>
                </button>
              </div>
            </div>

            {/* QUICK DMS section */}
            <div className={layoutClasses.navSection} style={{ marginTop: "4px" }}>
              <h4 className={layoutClasses.sectionHeader}>QUICK DMS</h4>
              <div className={layoutClasses.quickDms}>
                {inboxUsers.slice(0, 3).map(u => (
                  <div 
                    key={u.userid} 
                    className={layoutClasses.quickDmItem}
                    onClick={() => handleConversationSelect({
                      other_user_id: u.userid,
                      other_username: u.username,
                      avatar_url: u.avatar_url,
                      bio: u.bio,
                      phone: u.phone,
                      department: u.department,
                      status: u.status,
                      last_seen: u.last_seen,
                      message_count: 0,
                    })}
                  >
                    <InitialsAvatar 
                      name={u.username} 
                      imageUrl={u.avatar_url} 
                      size="sm" 
                      status="none" 
                    />
                    <span className={layoutClasses.quickDmName}>{u.username}</span>
                    <span className={`${layoutClasses.statusDot} ${u.status === "online" ? layoutClasses.online : layoutClasses.offline}`}></span>
                  </div>
                ))}
              </div>
            </div>

            <div className={layoutClasses.spacer} />

            {/* User Profile */}
            <div className={layoutClasses.userProfileContainer} onClick={handleprofileform}>
              <InitialsAvatar 
                name={user.username} 
                imageUrl={user.avatar_url} 
                size="md" 
                status="none" 
              />
              <div className={layoutClasses.userProfileText}>
                <h4>{user.username}</h4>
                <p>CS Student · Year 2</p>
              </div>
              <div className={layoutClasses.settingsIcon}>
                <i className="ti ti-settings"></i>
              </div>
            </div>
          </div>

          {/* 2. INBOX PANEL */}
          <div className={inboxClasses.inboxPanel}>
            <div className={inboxClasses.inboxHeader}>
              <div>
                <h3 className={inboxClasses.inboxTitle}>
                  {activeTab === "groups" ? "Groups" : "Inbox"}
                </h3>
                <p style={{fontSize: '11px', color: 'var(--plum-lt)', margin: 0}}>
                  {activeTab === "groups" ? `${groups.length} groups` : `${inboxUsers.length} conversations`}
                </p>
              </div>
              <div className={inboxClasses.inboxHeaderActions}>
                <button className={inboxClasses.iconButton} onClick={() => setActiveTab("create")} title="New conversation">
                  <i className="ti ti-edit" style={{ fontSize: '19px' }}></i>
                </button>
              </div>
            </div>

            <div className={inboxClasses.searchContainer}>
              <div className={inboxClasses.searchInputWrapper}>
                <i className="ti ti-search" style={{color: 'var(--plum-lt)', flexShrink: 0, fontSize: '14px'}}></i>
                <input 
                  type="text" 
                  className={inboxClasses.searchInput} 
                  placeholder="Search conversations..." 
                />
              </div>
            </div>

            <div className={inboxClasses.filterTabs}>
              <button 
                className={`${inboxClasses.filterTab} ${activeTab === "all" ? inboxClasses.active : ""}`} 
                onClick={() => setActiveTab("all")}
              >
                All
              </button>
              <button 
                className={`${inboxClasses.filterTab} ${activeTab === "inbox" ? inboxClasses.active : ""}`} 
                onClick={() => setActiveTab("inbox")}
              >
                Direct
              </button>
              <button 
                className={`${inboxClasses.filterTab} ${activeTab === "groups" ? inboxClasses.active : ""}`} 
                onClick={() => setActiveTab("groups")}
              >
                Groups
              </button>
            </div>

            <div className={inboxClasses.conversationsList}>
              {activeTab === "all" && (
                usersLoading || groupsLoading ? (
                  <div className={inboxClasses.loadingContainer}>
                    <div className={inboxClasses.spinner}></div>
                    <p>Loading conversations...</p>
                  </div>
                ) : [...inboxUsers.map(p => ({ ...p, isGroup: false })), ...groups.map(g => ({ ...g, isGroup: true }))].length === 0 ? (
                  <div className={inboxClasses.emptyState}>
                    <IoMdChatboxes />
                    <p>No conversations found</p>
                  </div>
                ) : (
                  [...inboxUsers.map(p => ({ ...p, isGroup: false })), ...groups.map(g => ({ ...g, isGroup: true }))].map((item) => {
                    if (item.isGroup) {
                      return (
                        <div
                          key={`group-${item.id}`}
                          className={`${inboxClasses.conversationItem} ${selectedGroup?.id === item.id ? inboxClasses.selected : ""}`}
                          onClick={() => handleGroupSelect(item)}
                        >
                          <div className={inboxClasses.avatarWrapper}>
                            <InitialsAvatar 
                              name={item.name} 
                              size="lg" 
                              status="none" 
                              borderRadius="11px"
                            />
                          </div>
                          <div className={inboxClasses.conversationContent}>
                            <div className={inboxClasses.conversationHeader}>
                              <h4 className={inboxClasses.conversationName}>{item.name}</h4>
                            </div>
                            <div className={inboxClasses.conversationFooter}>
                              <p className={inboxClasses.conversationPreview}>
                                {item.member_count} members
                              </p>
                              {item.user_role === "admin" && (
                                <span className={classes.adminBadge} style={{background: 'var(--m)'}}>Admin</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div
                          key={`user-${item.userid}`}
                          className={`${inboxClasses.conversationItem} ${selectedConversation?.other_user_id === item.userid ? inboxClasses.selected : ""}`}
                          onClick={() => handleConversationSelect({
                            other_user_id: item.userid,
                            other_username: item.username,
                            avatar_url: item.avatar_url,
                            bio: item.bio,
                            phone: item.phone,
                            department: item.department,
                            status: item.status,
                            last_seen: item.last_seen,
                            message_count: 0,
                          })}
                        >
                          <div className={inboxClasses.avatarWrapper}>
                            <InitialsAvatar 
                              name={item.username} 
                              imageUrl={item.avatar_url} 
                              size="lg" 
                              status={item.status} 
                            />
                          </div>
                          <div className={inboxClasses.conversationContent}>
                            <div className={inboxClasses.conversationHeader}>
                              <h4 className={inboxClasses.conversationName}>{item.username}</h4>
                              <span className={inboxClasses.conversationTime}>
                                {item.last_seen ? "Today" : ""}
                              </span>
                            </div>
                            <div className={inboxClasses.conversationFooter}>
                              <p className={`${inboxClasses.conversationPreview} ${unreadCount[item.userid] ? inboxClasses.unread : ""}`}>
                                {unreadCount[item.userid] ? "New message received" : "Start chatting!"}
                              </p>
                              {unreadCount[item.userid] > 0 && (
                                <span className={inboxClasses.unreadBadge}>
                                  {unreadCount[item.userid]}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })
                )
              )}

              {activeTab === "inbox" && (
                usersLoading ? (
                  <div className={inboxClasses.loadingContainer}>
                    <div className={inboxClasses.spinner}></div>
                    <p>Loading users...</p>
                  </div>
                ) : inboxUsers.length === 0 ? (
                  <div className={inboxClasses.emptyState}>
                    <IoMdChatboxes />
                    <p>No other users found</p>
                  </div>
                ) : (
                  inboxUsers.map((person) => (
                    <div
                      key={person.userid}
                      className={`${inboxClasses.conversationItem} ${selectedConversation?.other_user_id === person.userid ? inboxClasses.selected : ""}`}
                      onClick={() => handleConversationSelect({
                        other_user_id: person.userid,
                        other_username: person.username,
                        avatar_url: person.avatar_url,
                        bio: person.bio,
                        phone: person.phone,
                        department: person.department,
                        status: person.status,
                        last_seen: person.last_seen,
                        message_count: 0,
                      })}
                    >
                      <div className={inboxClasses.avatarWrapper}>
                        <InitialsAvatar 
                          name={person.username} 
                          imageUrl={person.avatar_url} 
                          size="lg" 
                          status={person.status} 
                        />
                      </div>
                      <div className={inboxClasses.conversationContent}>
                        <div className={inboxClasses.conversationHeader}>
                          <h4 className={inboxClasses.conversationName}>{person.username}</h4>
                          <span className={inboxClasses.conversationTime}>
                            {person.last_seen ? "Today" : ""}
                          </span>
                        </div>
                        <div className={inboxClasses.conversationFooter}>
                          <p className={`${inboxClasses.conversationPreview} ${unreadCount[person.userid] ? inboxClasses.unread : ""}`}>
                            {unreadCount[person.userid] ? "New message received" : "Start chatting!"}
                          </p>
                          {unreadCount[person.userid] > 0 && (
                            <span className={inboxClasses.unreadBadge}>
                              {unreadCount[person.userid]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )
              )}

              {activeTab === "groups" && (
                groupsLoading ? (
                  <div className={inboxClasses.loadingContainer}>
                    <div className={inboxClasses.spinner}></div>
                    <p>Loading groups...</p>
                  </div>
                ) : groups.length === 0 ? (
                  <div className={inboxClasses.emptyState}>
                    <IoMdPeople />
                    <p>You haven't joined any groups</p>
                  </div>
                ) : (
                  groups.map((group) => (
                    <div
                      key={group.id}
                      className={`${inboxClasses.conversationItem} ${selectedGroup?.id === group.id ? inboxClasses.selected : ""}`}
                      onClick={() => handleGroupSelect(group)}
                    >
                      <div className={inboxClasses.avatarWrapper}>
                        <InitialsAvatar 
                          name={group.name} 
                          size="lg" 
                          status="none" 
                          borderRadius="11px"
                        />
                      </div>
                      <div className={inboxClasses.conversationContent}>
                        <div className={inboxClasses.conversationHeader}>
                          <h4 className={inboxClasses.conversationName}>{group.name}</h4>
                        </div>
                        <div className={inboxClasses.conversationFooter}>
                          <p className={inboxClasses.conversationPreview}>
                            {group.member_count} members
                          </p>
                          {group.user_role === "admin" && (
                            <span className={classes.adminBadge} style={{background: 'var(--m)'}}>Admin</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )
              )}

              {activeTab === "create" && (
                <CreateGroup onCreateGroup={handleCreateGroup} />
              )}
            </div>
          </div>

          {/* Main Chat Area */}
          <div style={{ display: 'contents' }}>
            {showProfileForm ? (
              <div className={chatAreaClasses.chatArea}>
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
                            src={user.avatar_url}
                            alt=""
                            className={classes.profileAvatar}
                          />
                        ) : (
                          <IoMdPerson className={classes.profileDefaultIcon} />
                        )}
                      </div>
                      <div className={classes.editIconWrapper}>
                        {" "}
                        <img
                          src={editimage}
                          alt=""
                          className={classes.editimage}
                        />
                      </div>

                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={handleAvatarUpload}
                      />
                    </label>

                    <h3 className={classes.profileUsername}>{user.username}</h3>
                  </div>

                  {/* Form Section */}
                  {!showedit && (
                    <div className={classes.profileDetails}>
                      <div className={classes.profileInfo}>
                        <div className={classes.profileInfoTitlefornobio}>
                          {user.bio ? "" : "Bio"}
                        </div>
                        <div
                          className={classes.profileedit}
                          onClick={handleEdit}
                        >
                          Edit
                        </div>
                      </div>

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
                              <div className={classes.profileInfoTitle}>
                                bio
                              </div>
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
                isMobile={isMobile}
                setMobileView={setMobileView}
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
                setMobileView={setMobileView}
                isMobile={isMobile}
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
              />
            ) : (
              <div className={`${chatAreaClasses.chatArea} ${classes.welcomeScreen}`}>
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
        </>
      )}

      {/* MOBILE VIEW */}

      {isMobile && (
        <>
          {/* MOBILE CONTENT */}

          {/* LIST / SIDEBAR SCREEN */}

          {mobileView === "list" && (
            <div className={classes.mobileSidebar}>
              {/* GROUPS TAB */}

              {activeTab === "groups" && (
                <div className={classes.groupsList}>
                  <h3>My Groups</h3>

                  {groupsLoading ? (
                    <div className={classes.inlineLoading}>
                      <div className={classes.loadingSpinner}></div>
                      <p>Loading groups...</p>
                    </div>
                  ) : groups.length === 0 ? (
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
                        onClick={() => {
                          handleGroupSelect(group);
                          setMobileView("chat");
                        }}
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

              {/* INBOX TAB */}
              {activeTab === "inbox" && (
                <div className={classes.conversationsList}>
                  {/* PROFILE */}

                  {/* HEADER */}
                  <div className={classes.profilemenu}>
                    <h3 className={classes.spanforinbox}>Inbox</h3>
                    {showProfileMenu && (
                      <div className={classes.profiledisplay}>
                        <div className={classes.profileWrapper}>
                          {user.avatar_url ? (
                            <img
                              // src={`http://localhost:5500${user.avatar_url}`} this is for local host setup
                              src={user.avatar_url}
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
                        <div className={classes.usernamefont}>
                          {" "}
                          {user.username}{" "}
                        </div>
                      </div>
                    )}
                    <span
                      className={classes.profileicon}
                      onClick={handleprofile}
                    >
                      <FiMoreVertical />
                    </span>
                  </div>

                  {/* USERS */}
                  {usersLoading ? (
                    <div className={classes.inlineLoading}>
                      <div className={classes.loadingSpinner}></div>
                      <p>Loading users...</p>
                    </div>
                  ) : inboxUsers.length === 0 ? (
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

                          setMobileView("chat");
                        }}
                      >
                        <div className={classes.avatarWrapper}>
                          {person.avatar_url ? (
                            <img
                              src={person.avatar_url}
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
                            {unreadCount[person?.userid] !== 0 &&
                              unreadCount[person?.userid]}
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

              {activeTab === "explore" && (
                <div className={classes.profilemenu}>
                  <h3 className={classes.spanforexplore}>Explore</h3>
                </div>
              )}
            </div>
          )}

          {/* CHAT SCREEN */}

          {mobileView === "chat" && (
            <div className={classes.chatArea}>
              {/* PRIVATE CHAT */}
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
                              src={user.avatar_url}
                              alt=""
                              className={classes.profileAvatar}
                            />
                          ) : (
                            <IoMdPerson
                              className={classes.profileDefaultIcon}
                            />
                          )}
                        </div>
                        <div className={classes.editIconWrapper}>
                          {" "}
                          <img
                            src={editimage}
                            alt=""
                            className={classes.editimage}
                          />
                        </div>

                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={handleAvatarUpload}
                        />
                      </label>

                      <h3 className={classes.profileUsername}>
                        {user.username}
                      </h3>
                    </div>

                    {/* Form Section */}
                    {!showedit && (
                      <div className={classes.profileDetails}>
                        <div className={classes.profileInfo}>
                          <div className={classes.profileInfoTitlefornobio}>
                            {user.bio ? "" : "Bio"}
                          </div>
                          <div
                            className={classes.profileedit}
                            onClick={handleEdit}
                          >
                            Edit
                          </div>
                        </div>

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
                                <div className={classes.profileInfoTitle}>
                                  bio
                                </div>
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
              ) : selectedConversation ? (
                <PrivateChat
                  key={selectedConversation.other_user_id}
                  conversation={selectedConversation}
                  allUsers={allUsers}
                  savedScroll={
                    scrollPositions[selectedConversation.other_user_id] || null
                  }
                  onSaveScroll={(id, pos) =>
                    setScrollPositions((prev) => ({
                      ...prev,
                      [id]: pos,
                    }))
                  }
                  onClose={() => setMobileView("list")}
                  isMobile={isMobile}
                  setMobileView={setMobileView}
                />
              ) : selectedGroup ? (
                <GroupChat
                  group={selectedGroup}
                  setMobileView={setMobileView}
                  isMobile={isMobile}
                  onLeaveGroup={() => {
                    setSelectedGroup(null);
                    setMobileView("list");
                    fetchUserGroups();
                  }}
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
          )}

          {/* PROFILE SCREEN */}

          {mobileView === "profile" && (
            <div className={classes.profileContainer}>
              <div className={classes.profileCard}>
                {/* BACK BUTTON */}
                <button
                  onClick={() => setMobileView("list")}
                  className={classes.backbuttonforprofile}
                >
                  <FiArrowLeft />
                </button>

                {/* BANNER */}
                <div className={classes.profileBanner}>
                  <img
                    src="https://www.uopeople.edu/retention/chat-bot/chatbot-header.webp"
                    alt=""
                    className={classes.profileBannerImage}
                  />
                </div>

                {/* AVATAR */}
                <div className={classes.profileAvatarSection}>
                  <label>
                    <div className={classes.profileAvatarWrapper}>
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt=""
                          className={classes.profileAvatar}
                        />
                      ) : (
                        <IoMdPerson className={classes.profileDefaultIcon} />
                      )}
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

                {/* PROFILE DETAILS */}
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
          )}

          {/* MOBILE BOTTOM NAVIGATION */}

          {mobileView !== "chat" && mobileView !== "profile" && (
            <div className={classes.mobileBottomNav}>
              <button
                className={`${classes.mobileNavButton} ${
                  activeTab === "groups" ? classes.active : ""
                }`}
                onClick={() => {
                  setActiveTab("groups");
                  setMobileView("list");
                }}
              >
                <IoMdPeople />
                <span>Groups</span>
              </button>

              <button
                className={`${classes.mobileNavButton} ${
                  activeTab === "explore" ? classes.active : ""
                }`}
                onClick={() => {
                  setActiveTab("explore");
                  setMobileView("list");
                }}
              >
                <IoMdCompass />
                <span>Explore</span>
              </button>

              <button
                className={`${classes.mobileNavButton} ${
                  activeTab === "inbox" ? classes.active : ""
                }`}
                onClick={() => {
                  setActiveTab("inbox");
                  setMobileView("list");
                }}
              >
                <IoMdPerson />
                <span>Inbox</span>
              </button>

              <button
                className={`${classes.mobileNavButton} ${
                  activeTab === "create" ? classes.active : ""
                }`}
                onClick={() => {
                  setActiveTab("create");
                  setMobileView("list");
                }}
              >
                <BsPlusCircle />
                <span>Create</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Chat;
