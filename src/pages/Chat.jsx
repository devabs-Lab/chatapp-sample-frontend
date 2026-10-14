import React, { useState, useEffect, useContext, useRef, use } from "react";

import { Appstate } from "../App";
import axiosbase from "../axiosconfig";
import classes from "./styling/chat.module.css";
import layoutClasses from "./styling/layout.module.css";
import inboxClasses from "./styling/inbox.module.css";
import chatAreaClasses from "./styling/chatArea.module.css";
import m from "./styling/mobile.module.css";
import InitialsAvatar from "../components/InitialsAvatar";
import ContactInfo from "../components/ContactInfo";
import CallScreen from "../components/CallScreen";
import MinimizedCallBar from "../components/MinimizedCallBar";
import IncomingCall from "../components/IncomingCall";
import CallsList from "../components/CallsList";
import PublicGroupResults from "../components/PublicGroupResults";
import WelcomePanel from "../components/WelcomePanel";
import ThemeMenu from "../components/ThemeMenu";
import { getStoredTheme, applyTheme } from "../utils/theme";
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
import { useCall } from "../context/CallContext";
import { useSocket } from "../Socketprovider";
import {
  formatMessagePreview,
  formatPreviewTime,
} from "../utils/messagePreview";

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
    lastMessages,
    seedLastMessages,
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
  const socket = useSocket();

  const [scrollPositions, setScrollPositions] = useState({});
  // console.log(scrollPositions);

  const [activeTab, setActiveTab] = useState("all"); // 'all', 'groups', 'inbox', 'create'
  const [groups, setGroups] = useState([]);
  /* Newest message per group, keyed by group id — mirrors ChatContext's
     lastMessages for direct conversations, but lives here instead since
     GroupChat.jsx is deliberately self-contained (see its header comment)
     and doesn't share state with ChatContext. */
  const [groupLastMessages, setGroupLastMessages] = useState({});
  const [groupUnreadCount, setGroupUnreadCount] = useState({});
  /* Loaded messages per group id. GroupChat.jsx is remounted per group
     (key={group.id}) and owns no state across that, so without this,
     switching groups and coming back re-fetched from scratch and threw
     away any older pages already scrolled back to. ChatContext's
     messagesCache does the same job for private conversations. */
  const [groupMessagesCache, setGroupMessagesCache] = useState({});

  const cacheGroupMessages = (groupId, msgs) =>
    setGroupMessagesCache((prev) =>
      prev[groupId] === msgs ? prev : { ...prev, [groupId]: msgs },
    );
  const [conversations, setConversations] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
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
  const [mobileSearch, setMobileSearch] = useState("");
  /* Public groups matching the search box that the user hasn't joined yet —
     shown as a separate "Public groups" section with a Join action, on the
     Groups/All tabs. Private groups never appear here (the backend already
     filters is_private = false in getPublicGroups); the only way into one
     of those is a group admin adding you directly. */
  const [publicGroupResults, setPublicGroupResults] = useState([]);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [theme, setTheme] = useState(getStoredTheme);
  /* Call state lives in CallProvider, not here — a call has to survive
     switching conversations, and the peer connections are held there. */
  const { call, startCall, setDirectory, minimized } = useCall();
  const activeCall = call.status !== "idle";

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

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
      /* Server-side unread counts (messages newer than this user's
         last_read_at for the group), so the badges are already right on a
         fresh page load instead of only counting what arrived over the
         socket since. The server value is authoritative — it's derived from
         the same last_read_at that opening a group updates. */
      setGroupUnreadCount((prev) => {
        const next = { ...prev };
        response.data.forEach((g) => {
          next[g.id] = Number(g.unread_count) || 0;
        });
        return next;
      });
      setGroupLastMessages((prev) => {
        const next = { ...prev };
        response.data.forEach((g) => {
          if (!g.last_message_time) return;
          const stamp = new Date(g.last_message_time).getTime();
          const current = next[g.id];
          if (current && current._t >= stamp) return;
          next[g.id] = {
            content: g.last_message,
            message_type: g.last_message_type || "text",
            filename: g.last_message_filename,
            sender_id: g.last_message_sender_id,
            time: g.last_message_time,
            _t: stamp,
          };
        });
        return next;
      });
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

  /* Search the Groups/All tabs for public groups the user hasn't joined —
     debounced, and only while there's something to search for and a tab
     where groups are actually visible. */
  useEffect(() => {
    const q = mobileSearch.trim();
    if (!q || (activeTab !== "groups" && activeTab !== "all")) {
      setPublicGroupResults([]);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const { data } = await axiosbase.get(
          `/groups/public?search=${encodeURIComponent(q)}`,
        );
        if (cancelled) return;
        const joinedIds = new Set(groups.map((g) => g.id));
        setPublicGroupResults(data.filter((g) => !joinedIds.has(g.id)));
      } catch (error) {
        console.error("Error searching public groups:", error);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [mobileSearch, activeTab, groups]);

  const fetchAllUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await axiosbase.get("/messages/users/all");
      setAllUsers(response.data);
      /* Remote call tiles only get a user id from the signalling layer —
         this is what turns that id back into a name and an avatar. */
      setDirectory(response.data);
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
      seedLastMessages(response.data);
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

  /* Join every group's Socket.IO room for the lifetime of the chat page —
     not just the one currently open — so the inbox list can show a live
     preview/unread badge for a group the user isn't looking at. Previously
     only GroupChat.jsx joined (and left on unmount), which meant a message
     to a closed group never reached the client at all until the group was
     opened and a fresh GET refetched it. */
  useEffect(() => {
    if (!socket) return;

    /* Socket.IO room membership does not survive a reconnect — a dropped
       network connection or a backend restart gets a brand new server-side
       socket.id with zero rooms joined, even though socket.io-client keeps
       reusing the *same* client-side Socket object and simply reconnects it
       (Socketprovider only creates a new object on login/logout). A ref
       tracking "already joined" by object identity was wrong for exactly
       this reason: it survived the reconnect and skipped rejoining, so a
       backend restart silently stopped this group room from ever
       delivering again for the rest of the session. "connect" fires for
       the first connection AND every reconnect, so it's the right signal —
       just (re)join everything each time; socket.join is a no-op
       server-side if already in the room, so redundant joins on a groups
       list change are harmless. */
    const joinAllGroups = () => {
      groups.forEach((g) => socket.emit("join-group", g.id));
    };

    socket.on("connect", joinAllGroups);
    if (socket.connected) joinAllGroups();

    return () => socket.off("connect", joinAllGroups);
  }, [socket, groups]);

  useEffect(() => {
    if (!socket) return;

    const onGroupMessage = (payload) => {
      const stamp = new Date(
        payload.created_at || payload.delivered_at || Date.now(),
      ).getTime();
      setGroupLastMessages((prev) => {
        const current = prev[payload.group_id];
        if (current && current._t > stamp) return prev;
        return {
          ...prev,
          [payload.group_id]: {
            content: payload.content,
            message_type: payload.message_type || "text",
            filename: payload.filename,
            sender_id: payload.sender_id,
            time: payload.created_at || payload.delivered_at,
            _t: stamp,
          },
        };
      });

      if (String(selectedGroup?.id) !== String(payload.group_id)) {
        /* This group isn't mounted, so nothing else is keeping its cache
           current — append here so reopening it shows the message that
           arrived while it was closed, without a refetch. When it *is* the
           open group, GroupChat.jsx owns the list and writes the cache
           itself; appending here too would race that. */
        setGroupMessagesCache((prev) => {
          const existing = prev[payload.group_id];
          if (!existing) return prev; // never loaded — nothing to append to
          if (existing.some((m) => m.id === payload.id)) return prev;
          return { ...prev, [payload.group_id]: [...existing, payload] };
        });

        if (payload.sender_id !== user.userid) {
          setGroupUnreadCount((prev) => ({
            ...prev,
            [payload.group_id]: (prev[payload.group_id] || 0) + 1,
          }));
        }
      }
    };

    const onAddedToGroup = () => {
      fetchUserGroups();
    };

    socket.on("receive-group-message", onGroupMessage);
    socket.on("added-to-group", onAddedToGroup);

    return () => {
      socket.off("receive-group-message", onGroupMessage);
      socket.off("added-to-group", onAddedToGroup);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, user.userid, selectedGroup?.id]);

  const handleConversationSelect = (conversation) => {
    setSelectedConversation(conversation);
    setMessages(messagesCache[conversation.other_user_id] || []);
    setSelectedGroup(null);
    setActiveTab("inbox");
  };

  /* An edit from the group info panel (name, description, @username) —
     patch the row in place so the list and header agree immediately, then
     refetch so member counts and ordering catch up too. */
  const handleGroupUpdated = (updated) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === updated.id ? { ...g, ...updated } : g)),
    );
    setSelectedGroup((prev) =>
      prev && prev.id === updated.id ? { ...prev, ...updated } : prev,
    );
    fetchUserGroups();
  };

  /* "Send a message" from a group member's profile — the same shape
     handleConversationSelect builds from an inbox row. */
  const openPrivateChatWith = (member) => {
    handleConversationSelect({
      other_user_id: member.userid,
      other_username: member.username,
      avatar_url: member.avatar_url,
      bio: member.bio,
      status: member.status,
      last_seen: member.last_seen,
      message_count: 0,
    });
  };

  const handleGroupSelect = (group) => {
    setSelectedGroup(group);
    setSelectedConversation(null);
    setActiveTab("groups");
    setGroupUnreadCount((prev) => ({ ...prev, [group.id]: 0 }));
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
      setPublicGroupResults((prev) => prev.filter((g) => g.id !== group.id));
      await fetchUserGroups();
      handleGroupSelect(group);
      setMobileSearch("");
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

  /* Desktop search box — same match rule mobileList already uses. */
  const desktopSearchQuery = mobileSearch.trim().toLowerCase();
  const matchesSearch = (name) =>
    !desktopSearchQuery || (name || "").toLowerCase().includes(desktopSearchQuery);

  /* Preview line + timestamp for a direct-conversation row. */
  const previewFor = (userId) => {
    const entry = lastMessages[userId];
    return {
      text: formatMessagePreview(entry, user.userid) || "Start chatting!",
      time: formatPreviewTime(entry?.time),
      hasMessages: Boolean(entry),
    };
  };

  const previewForGroup = (groupId, memberCount) => {
    const entry = groupLastMessages[groupId];
    if (!entry) {
      return {
        text: `${memberCount} member${memberCount === 1 ? "" : "s"}`,
        time: "",
        hasMessages: false,
      };
    }
    return {
      text: formatMessagePreview(entry, user.userid) || "",
      time: formatPreviewTime(entry.time),
      hasMessages: true,
    };
  };

  /* Most-recent-first ordering for the inbox, shared by the mobile list,
     the desktop Direct/Groups/All tabs, and search. A direct conversation's
     activity is its last message (`lastMessages`, keyed by the other
     user's id); a group's is `updated_at` — the backend already orders
     `/groups/my-groups` by that, but sorting again here keeps it correct
     once the "all" view interleaves groups with direct conversations, and
     after any client-side reordering (search, filtering). Conversations
     with no activity yet sort after ones that do (stable sort keeps them
     in their original relative order among themselves, at the bottom). */
  const activityTimeFor = (item) =>
    item.isGroup
      ? groupLastMessages[item.id]?._t ||
        (item.updated_at ? new Date(item.updated_at).getTime() : 0)
      : lastMessages[item.userid]?._t || 0;

  const byRecency = (a, b) => activityTimeFor(b) - activityTimeFor(a);

  const sortedInboxUsers = [...inboxUsers].sort((a, b) =>
    byRecency({ ...a, isGroup: false }, { ...b, isGroup: false }),
  );
  const sortedGroups = [...groups].sort((a, b) =>
    byRecency({ ...a, isGroup: true }, { ...b, isGroup: true }),
  );

  /* ---------------- mobile derived state ---------------- */

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.split(" ").filter((p) => p.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  /* One list feeding the All / Direct / Groups chips, then searched. */
  const mobileList = (() => {
    const direct = sortedInboxUsers.map((p) => ({ ...p, isGroup: false }));
    const groupItems = sortedGroups.map((g) => ({ ...g, isGroup: true }));

    let list;
    if (activeTab === "groups") list = groupItems;
    else if (activeTab === "inbox") list = direct;
    else list = [...direct, ...groupItems].sort(byRecency);

    const q = mobileSearch.trim().toLowerCase();
    if (!q) return list;

    return list.filter((item) =>
      (item.isGroup ? item.name : item.username || "")
        .toLowerCase()
        .includes(q),
    );
  })();

  /* Calls and Video are two views over the same history, so they share the
     column and only differ in what they filter to. */
  const isCallsView = activeTab === "calls" || activeTab === "video";

  /* The nav rail / bottom tab badges count *conversations* with something
     unread, not messages. Seven messages from one person is still one
     person waiting on you — the per-message count belongs on that person's
     row in the list, which is where you go to find out who and how many.
     Same rule for groups: one badge per group with unread messages,
     however many messages that group holds. */
  const unreadDirectCount = Object.values(unreadCount || {}).filter(
    (n) => Number(n) > 0,
  ).length;

  const unreadGroupsCount = Object.values(groupUnreadCount || {}).filter(
    (n) => Number(n) > 0,
  ).length;

  /* Which bottom tab reads as active for the current screen. */
  const activeMobileTab =
    mobileView === "calls"
      ? "calls"
      : mobileView === "profile"
        ? "profile"
        : activeTab === "groups"
          ? "groups"
          : "chats";

  const mobileTabs = [
    {
      key: "chats",
      label: "Chats",
      icon: "ti-message-circle",
      badge: unreadDirectCount,
      onClick: () => {
        setActiveTab("all");
        setMobileView("list");
      },
    },
    {
      key: "groups",
      label: "Groups",
      icon: "ti-users",
      badge: unreadGroupsCount,
      onClick: () => {
        setActiveTab("groups");
        setMobileView("list");
      },
    },
    {
      key: "calls",
      label: "Calls",
      icon: "ti-phone",
      onClick: () => setMobileView("calls"),
    },
    {
      key: "profile",
      label: "Profile",
      icon: "ti-user",
      onClick: () => setMobileView("profile"),
    },
  ];

  return (
    <div className={`${layoutClasses.chatContainer} ${!selectedConversation && !selectedGroup ? layoutClasses.profileClosed : ""}`}>
      {/* Call screens overlay both layouts. Ringing gets its own screen —
          answering is what opens the camera, so CallScreen must not mount
          until the call is actually accepted. */}
      <IncomingCall />
      {(call.status === "connecting" ||
        call.status === "active" ||
        (call.status === "ringing" && call.direction === "outgoing")) &&
        (minimized ? <MinimizedCallBar /> : <CallScreen />)}

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
                  className={`${layoutClasses.navItem} ${activeTab === "inbox" || activeTab === "all" ? layoutClasses.active : ""}`}
                  onClick={() => { setActiveTab("inbox"); setSelectedConversation(null); setSelectedGroup(null); }}
                >
                  <span className={layoutClasses.navIcon}><i className="ti ti-message-circle"></i></span>
                  <span>Messages</span>
                  {unreadDirectCount > 0 && (
                    <span className={layoutClasses.badge}>
                      {unreadDirectCount}
                    </span>
                  )}
                </button>
                <button
                  className={`${layoutClasses.navItem} ${activeTab === "groups" ? layoutClasses.active : ""}`}
                  onClick={() => { setActiveTab("groups"); setSelectedConversation(null); setSelectedGroup(null); }}
                >
                  <span className={layoutClasses.navIcon}><i className="ti ti-users"></i></span>
                  <span>Groups</span>
                  {unreadGroupsCount > 0 && (
                    <span className={layoutClasses.badge}>
                      {unreadGroupsCount}
                    </span>
                  )}
                </button>
                <button className={layoutClasses.navItem}>
                  <span className={layoutClasses.navIcon}><i className="ti ti-book"></i></span>
                  <span>Courses</span>
                </button>
                <button
                  className={`${layoutClasses.navItem} ${activeTab === "calls" ? layoutClasses.active : ""}`}
                  onClick={() => { setActiveTab("calls"); setSelectedConversation(null); setSelectedGroup(null); }}
                >
                  <span className={layoutClasses.navIcon}><i className="ti ti-phone-call"></i></span>
                  <span>Calls</span>
                </button>
                <button
                  className={`${layoutClasses.navItem} ${activeTab === "video" ? layoutClasses.active : ""}`}
                  onClick={() => { setActiveTab("video"); setSelectedConversation(null); setSelectedGroup(null); }}
                >
                  <span className={layoutClasses.navIcon}><i className="ti ti-video"></i></span>
                  <span>Video</span>
                </button>
              </div>
            </div>

            {/* QUICK DMS section */}
            <div className={layoutClasses.navSection} style={{ marginTop: "4px" }}>
              <h4 className={layoutClasses.sectionHeader}>QUICK DMS</h4>
              <div className={layoutClasses.quickDms}>
                {sortedInboxUsers.slice(0, 3).map(u => (
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
            <div
              className={layoutClasses.userProfileContainer}
              style={{ position: "relative" }}
              onClick={handleprofileform}
            >
              <ThemeMenu
                open={themeMenuOpen}
                theme={theme}
                onSelectTheme={(id) => {
                  setTheme(id);
                  setThemeMenuOpen(false);
                }}
                onClose={() => setThemeMenuOpen(false)}
              />

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
              <div
                className={layoutClasses.footerIcon}
                role="button"
                title="Change appearance"
                aria-label="Change appearance"
                onClick={(e) => {
                  e.stopPropagation();
                  setThemeMenuOpen((v) => !v);
                }}
              >
                <i className="ti ti-palette"></i>
              </div>

              <div
                className={layoutClasses.settingsIcon}
                role="button"
                title="Settings"
                aria-label="Settings"
              >
                <i className="ti ti-settings"></i>
              </div>
            </div>
          </div>

          {/* 2. INBOX PANEL */}
          <div className={inboxClasses.inboxPanel}>
            <div className={inboxClasses.inboxHeader}>
              <div>
                <h3 className={inboxClasses.inboxTitle}>
                  {isCallsView
                    ? activeTab === "video"
                      ? "Video calls"
                      : "Calls"
                    : activeTab === "groups"
                      ? "Groups"
                      : "Inbox"}
                </h3>
                <p style={{fontSize: '11px', color: 'var(--plum-lt)', margin: 0}}>
                  {isCallsView
                    ? "Recent activity"
                    : activeTab === "groups"
                      ? `${groups.length} groups`
                      : `${inboxUsers.length} conversations`}
                </p>
              </div>
              <div className={inboxClasses.inboxHeaderActions}>
                <button className={inboxClasses.iconButton} onClick={() => setActiveTab("create")} title="New conversation">
                  <i className="ti ti-edit" style={{ fontSize: '19px' }}></i>
                </button>
              </div>
            </div>

            {!isCallsView && (
            <>
            <div className={inboxClasses.searchContainer}>
              <div className={inboxClasses.searchInputWrapper}>
                <i className="ti ti-search" style={{color: 'var(--plum-lt)', flexShrink: 0, fontSize: '14px'}}></i>
                <input
                  type="text"
                  className={inboxClasses.searchInput}
                  placeholder="Search conversations..."
                  value={mobileSearch}
                  onChange={(e) => setMobileSearch(e.target.value)}
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
            </>
            )}

            <div className={inboxClasses.conversationsList}>
              {isCallsView && (
                <CallsList
                  selfId={user.userid}
                  variant="desktop"
                  filter={activeTab === "video" ? "video" : "all"}
                />
              )}

              {activeTab === "all" && (
                usersLoading || groupsLoading ? (
                  <div className={inboxClasses.loadingContainer}>
                    <div className={inboxClasses.spinner}></div>
                    <p>Loading conversations...</p>
                  </div>
                ) : (
                <>
                  {publicGroupResults.length > 0 && (
                    <PublicGroupResults
                      results={publicGroupResults}
                      onJoin={handleJoinGroup}
                      classes={inboxClasses}
                    />
                  )}
                  {[...sortedInboxUsers.map(p => ({ ...p, isGroup: false })), ...sortedGroups.map(g => ({ ...g, isGroup: true }))]
                    .filter((item) => matchesSearch(item.isGroup ? item.name : item.username))
                    .sort(byRecency).length === 0 && publicGroupResults.length === 0 ? (
                  <div className={inboxClasses.emptyState}>
                    <IoMdChatboxes />
                    <p>No conversations found</p>
                  </div>
                ) : (
                  [...sortedInboxUsers.map(p => ({ ...p, isGroup: false })), ...sortedGroups.map(g => ({ ...g, isGroup: true }))]
                    .filter((item) => matchesSearch(item.isGroup ? item.name : item.username))
                    .sort(byRecency)
                    .map((item) => {
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
                              imageUrl={item.avatar_url}
                              size="lg"
                              status="none"
                              borderRadius="11px"
                            />
                          </div>
                          <div className={inboxClasses.conversationContent}>
                            <div className={inboxClasses.conversationHeader}>
                              <h4 className={inboxClasses.conversationName}>{item.name}</h4>
                              <span className={inboxClasses.conversationTime}>
                                {previewForGroup(item.id, item.member_count).time}
                              </span>
                            </div>
                            <div className={inboxClasses.conversationFooter}>
                              <p className={`${inboxClasses.conversationPreview} ${groupUnreadCount[item.id] ? inboxClasses.unread : ""}`}>
                                {previewForGroup(item.id, item.member_count).text}
                              </p>
                              {/* No "Admin" chip here — being an admin is a
                                  fact about you inside the group, so it's
                                  shown next to your name in the group's
                                  member list, not on the conversation row. */}
                              {groupUnreadCount[item.id] > 0 && (
                                <span className={inboxClasses.unreadBadge}>
                                  {groupUnreadCount[item.id]}
                                </span>
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
                                {previewFor(item.userid).time}
                              </span>
                            </div>
                            <div className={inboxClasses.conversationFooter}>
                              <p className={`${inboxClasses.conversationPreview} ${unreadCount[item.userid] ? inboxClasses.unread : ""}`}>
                                {previewFor(item.userid).text}
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
                )}
                </>
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
                  sortedInboxUsers.filter((p) => matchesSearch(p.username)).map((person) => (
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
                            {previewFor(person.userid).time}
                          </span>
                        </div>
                        <div className={inboxClasses.conversationFooter}>
                          <p className={`${inboxClasses.conversationPreview} ${unreadCount[person.userid] ? inboxClasses.unread : ""}`}>
                            {previewFor(person.userid).text}
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
                ) : (
                <>
                  {publicGroupResults.length > 0 && (
                    <PublicGroupResults
                      results={publicGroupResults}
                      onJoin={handleJoinGroup}
                      classes={inboxClasses}
                    />
                  )}
                  {sortedGroups.filter((g) => matchesSearch(g.name)).length === 0 && publicGroupResults.length === 0 ? (
                  <div className={inboxClasses.emptyState}>
                    <IoMdPeople />
                    <p>
                      {desktopSearchQuery
                        ? "No groups found — try a different search"
                        : "You haven't joined any groups"}
                    </p>
                  </div>
                ) : (
                  sortedGroups.filter((g) => matchesSearch(g.name)).map((group) => (
                    <div
                      key={group.id}
                      className={`${inboxClasses.conversationItem} ${selectedGroup?.id === group.id ? inboxClasses.selected : ""}`}
                      onClick={() => handleGroupSelect(group)}
                    >
                      <div className={inboxClasses.avatarWrapper}>
                        <InitialsAvatar
                          name={group.name}
                          imageUrl={group.avatar_url}
                          size="lg"
                          status="none"
                          borderRadius="11px"
                        />
                      </div>
                      <div className={inboxClasses.conversationContent}>
                        <div className={inboxClasses.conversationHeader}>
                          <h4 className={inboxClasses.conversationName}>{group.name}</h4>
                          <span className={inboxClasses.conversationTime}>
                            {previewForGroup(group.id, group.member_count).time}
                          </span>
                        </div>
                        <div className={inboxClasses.conversationFooter}>
                          <p className={`${inboxClasses.conversationPreview} ${groupUnreadCount[group.id] ? inboxClasses.unread : ""}`}>
                            {previewForGroup(group.id, group.member_count).text}
                          </p>
                          {groupUnreadCount[group.id] > 0 && (
                            <span className={inboxClasses.unreadBadge}>
                              {groupUnreadCount[group.id]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                </>
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
                key={selectedGroup.id}
                group={selectedGroup}
                allUsers={allUsers}
                cachedMessages={groupMessagesCache[selectedGroup.id]}
                onCacheMessages={cacheGroupMessages}
                onGroupUpdated={handleGroupUpdated}
                onOpenPrivateChat={openPrivateChatWith}
                isMobile={isMobile}
                setMobileView={setMobileView}
                onStartCall={(opts) =>
                  startCall({
                    groupId: selectedGroup.id,
                    callType: opts?.audioOnly ? "audio" : "video",
                    title: selectedGroup.name,
                  })
                }
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
                onStartCall={(opts) =>
                  startCall({
                    receiverId: selectedConversation.other_user_id,
                    callType: opts?.audioOnly ? "audio" : "video",
                    title: selectedConversation.other_username,
                    peer: {
                      userid: selectedConversation.other_user_id,
                      username: selectedConversation.other_username,
                      avatar_url: selectedConversation.avatar_url,
                    },
                  })
                }
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
              <div className={chatAreaClasses.chatArea}>
                <WelcomePanel username={user.username} />
              </div>
            )}
          </div>
        </>
      )}

      {/* MOBILE VIEW */}
      {isMobile && (
        <>
          {/* ============ CHATS / GROUPS LIST ============ */}

          {mobileView === "list" && (
            <div className={m.mobileScreen}>
              <header className={m.inboxHeader}>
                <div className={m.logoBox}>U</div>
                <h1 className={m.inboxTitle}>
                  {activeTab === "groups" ? "Groups" : "Messages"}
                </h1>
                <div className={m.headerSpacer} />
                <button
                  className={m.headerIconBtn}
                  onClick={() => setActiveTab("create")}
                  aria-label="New conversation"
                >
                  <i className="ti ti-edit"></i>
                </button>
              </header>

              {activeTab === "create" ? (
                <div className={m.list}>
                  <CreateGroup onCreateGroup={handleCreateGroup} />
                </div>
              ) : (
                <>
                  <div className={m.searchWrap}>
                    <div className={m.searchField}>
                      <i className="ti ti-search"></i>
                      <input
                        className={m.searchInput}
                        placeholder="Search conversations..."
                        value={mobileSearch}
                        onChange={(e) => setMobileSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className={m.filterRow}>
                    {[
                      { key: "all", label: "All" },
                      { key: "inbox", label: "Direct" },
                      { key: "groups", label: "Groups" },
                    ].map((chip) => (
                      <button
                        key={chip.key}
                        className={`${m.filterChip} ${
                          activeTab === chip.key ? m.active : ""
                        }`}
                        onClick={() => setActiveTab(chip.key)}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  <div className={m.list}>
                    {usersLoading || groupsLoading ? (
                      <div className={m.loading}>
                        <div className={m.spinner}></div>
                        <p>Loading conversations...</p>
                      </div>
                    ) : (
                    <>
                      {publicGroupResults.length > 0 &&
                        (activeTab === "groups" || activeTab === "all") && (
                          <PublicGroupResults
                            results={publicGroupResults}
                            onJoin={(group) => {
                              handleJoinGroup(group);
                              setMobileView("chat");
                            }}
                            classes={m}
                          />
                        )}
                      {mobileList.length === 0 && publicGroupResults.length === 0 ? (
                      <div className={m.empty}>
                        <i className="ti ti-message-off"></i>
                        <p>
                          {mobileSearch
                            ? `No results for "${mobileSearch}"`
                            : "No conversations yet"}
                        </p>
                      </div>
                    ) : (
                      mobileList.map((item) =>
                        item.isGroup ? (
                          <div
                            key={`group-${item.id}`}
                            className={m.row}
                            onClick={() => {
                              handleGroupSelect(item);
                              setMobileView("chat");
                            }}
                          >
                            <div className={m.rowAvatar}>
                              {item.avatar_url ? (
                                <img src={item.avatar_url} alt={item.name} />
                              ) : (
                                item.name.slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className={m.rowBody}>
                              <div className={m.rowTop}>
                                <span className={m.rowName}>{item.name}</span>
                                <span className={m.rowTime}>
                                  {previewForGroup(item.id, item.member_count).time}
                                </span>
                              </div>
                              <div className={m.rowBottom}>
                                <span
                                  className={`${m.rowPreview} ${
                                    groupUnreadCount[item.id] ? m.unread : ""
                                  }`}
                                >
                                  {previewForGroup(item.id, item.member_count).text}
                                </span>
                                {groupUnreadCount[item.id] > 0 && (
                                  <span className={m.unreadBadge}>
                                    {groupUnreadCount[item.id]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            key={item.userid}
                            className={m.row}
                            onClick={() => {
                              handleConversationSelect({
                                other_user_id: item.userid,
                                other_username: item.username,
                                avatar_url: item.avatar_url,
                                bio: item.bio,
                                phone: item.phone,
                                department: item.department,
                                status: item.status,
                                last_seen: item.last_seen,
                                message_count: 0,
                              });
                              setMobileView("chat");
                            }}
                          >
                            <div className={m.rowAvatar}>
                              {item.avatar_url ? (
                                <img src={item.avatar_url} alt={item.username} />
                              ) : (
                                getInitials(item.username)
                              )}
                            </div>
                            <div className={m.rowBody}>
                              <div className={m.rowTop}>
                                <span className={m.rowName}>
                                  {item.username}
                                </span>
                                <span className={m.rowTime}>
                                  {previewFor(item.userid).time}
                                </span>
                              </div>
                              <div className={m.rowBottom}>
                                <span
                                  className={`${m.rowPreview} ${
                                    unreadCount[item.userid] ? m.unread : ""
                                  }`}
                                >
                                  {previewFor(item.userid).text}
                                </span>
                                {unreadCount[item.userid] > 0 && (
                                  <span className={m.unreadBadge}>
                                    {unreadCount[item.userid]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ),
                      )
                    )}
                    </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ============ OPEN CHAT ============ */}

          {mobileView === "chat" && (
            <div className={m.chatWrap}>
              {selectedConversation ? (
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
                  onOpenContact={() => setMobileView("contact")}
                  onStartCall={(opts) =>
                    startCall({
                      receiverId: selectedConversation.other_user_id,
                      callType: opts?.audioOnly ? "audio" : "video",
                      title: selectedConversation.other_username,
                      peer: {
                        userid: selectedConversation.other_user_id,
                        username: selectedConversation.other_username,
                        avatar_url: selectedConversation.avatar_url,
                      },
                    })
                  }
                />
              ) : selectedGroup ? (
                <GroupChat
                  key={selectedGroup.id}
                  group={selectedGroup}
                  allUsers={allUsers}
                  cachedMessages={groupMessagesCache[selectedGroup.id]}
                  onCacheMessages={cacheGroupMessages}
                  onGroupUpdated={handleGroupUpdated}
                  onOpenPrivateChat={(member) => {
                    openPrivateChatWith(member);
                    setMobileView("chat");
                  }}
                  setMobileView={setMobileView}
                  isMobile={isMobile}
                  onStartCall={(opts) =>
                    startCall({
                      groupId: selectedGroup.id,
                      callType: opts?.audioOnly ? "audio" : "video",
                      title: selectedGroup.name,
                    })
                  }
                  onLeaveGroup={() => {
                    setSelectedGroup(null);
                    setMobileView("list");
                    fetchUserGroups();
                  }}
                />
              ) : (
                <WelcomePanel username={user.username} />
              )}
            </div>
          )}

          {/* ============ CONTACT INFO (someone else) ============ */}

          {mobileView === "contact" && selectedConversation && (
            <ContactInfo
              person={{
                username: selectedConversation.other_username,
                avatar_url: selectedConversation.avatar_url,
                bio: selectedConversation.bio,
                phone: selectedConversation.phone,
                department: selectedConversation.department,
                status: selectedConversation.status,
                last_seen: selectedConversation.last_seen,
              }}
              messages={messages}
              onBack={() => setMobileView("chat")}
              onMessage={() => setMobileView("chat")}
              onCall={() =>
                startCall({
                  receiverId: selectedConversation.other_user_id,
                  callType: "audio",
                  title: selectedConversation.other_username,
                  peer: {
                    userid: selectedConversation.other_user_id,
                    username: selectedConversation.other_username,
                    avatar_url: selectedConversation.avatar_url,
                  },
                })
              }
              onVideo={() =>
                startCall({
                  receiverId: selectedConversation.other_user_id,
                  callType: "video",
                  title: selectedConversation.other_username,
                  peer: {
                    userid: selectedConversation.other_user_id,
                    username: selectedConversation.other_username,
                    avatar_url: selectedConversation.avatar_url,
                  },
                })
              }
            />
          )}

          {/* ============ CALLS TAB ============ */}

          {mobileView === "calls" && (
            <div className={m.mobileScreen}>
              <header className={m.inboxHeader}>
                <div className={m.logoBox}>U</div>
                <h1 className={m.inboxTitle}>Calls</h1>
              </header>

              <CallsList selfId={user.userid} />
            </div>
          )}

          {/* ============ MY PROFILE ============ */}

          {mobileView === "profile" && (
            <>
              <ContactInfo
                person={user}
                isSelf
                onEdit={handleEdit}
                onCall={() => fileInputRef.current?.click()}
                onVideo={() => fileInputRef.current?.click()}
                onMore={handleEdit}
              />

              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleAvatarUpload}
              />

              {showedit && (
                <div className={m.formSection}>
                  <div className={m.formField}>
                    <label className={m.formLabel}>Bio</label>
                    <textarea
                      className={m.formTextarea}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell people a little about yourself"
                    />
                  </div>

                  <div className={m.formField}>
                    <label className={m.formLabel}>Phone</label>
                    <input
                      className={m.formInput}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone number"
                    />
                  </div>

                  <div className={m.formField}>
                    <label className={m.formLabel}>Department</label>
                    <input
                      className={m.formInput}
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Department"
                    />
                  </div>

                  <div className={m.formActions}>
                    <button className={m.btnPrimary} onClick={handleSaveProfile}>
                      Save changes
                    </button>
                    <button
                      className={m.btnGhost}
                      onClick={() => setshowedit(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ============ BOTTOM TAB BAR ============ */}

          {!activeCall && (
            <nav className={m.tabBar}>
              {mobileTabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`${m.tabButton} ${
                    activeMobileTab === tab.key ? m.active : ""
                  }`}
                  onClick={tab.onClick}
                >
                  <i className={`ti ${tab.icon}`}></i>
                  <span>{tab.label}</span>
                  {tab.badge > 0 && (
                    <span className={m.tabBadge}>{tab.badge}</span>
                  )}
                </button>
              ))}
            </nav>
          )}
        </>
      )}
    </div>
  );
};

export default Chat;
