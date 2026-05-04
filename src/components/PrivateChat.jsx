import React, {
  useCallback,
  useState,
  useEffect,
  useRef,
  useContext,
  useLayoutEffect,
} from "react";

import { Appstate } from "../App";
// import { CryptoContext } from "../App";
import axiosbase from "../axiosconfig";
import { useSocket } from "../Socketprovider";
import {
  FiAtSign,
  FiInfo,
  FiGift,
  FiBell,
  FiPhone,
  FiBriefcase,
  FiPaperclip,
  FiMoreVertical,
} from "react-icons/fi";
import { IoMdSend, IoMdPerson, IoMdClose } from "react-icons/io";
import { Plyr } from "plyr-react";
import "plyr-react/plyr.css";

// import { showErrorAlert } from "./alerthelper";
import classes from "../pages/styling/chat.module.css";
import {
  createVideoMetadata,
  createAudioMetadata,
  createImageThumbnail,
  createImageThumbnailpreview,
} from "./Thumbnail.jsx";

// import { PrivateChatStorage } from "../db/dexieDB.js";

import MessageRenderer from "./MessageRenderer";
import { set } from "date-fns";

const PrivateChat = ({
  conversation,
  onClose,
  messages,
  allUsers,
  setMessages,
  atBottomRef,
  pendingAutoScrollRef,
  hydratedChatsRef,
  pendingMessagesRef,
  resendPendingMessage,
  activeUploadsRef,
  replaceCache,
  setUnreadCount,
  unreadCount,
  savedScroll,
  onSaveScroll,
  // offset,
  // setoffset,
  sendFileToServer,
}) => {
  const { user } = useContext(Appstate);
  // const { cryptoKey } = useContext(CryptoContext);
  const [activelist, setactivelist] = useState("Media"); // photos, media, video , files
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(!messages || messages.length === 0);
  // const [loadedConversations, setLoadedConversations] = useState({});
  // const [restoringScroll, setRestoringScroll] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showotherprofile, setshowotherprofile] = useState(false);
  const [enlargeProfileImage, setEnlargeProfileImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // console.log(savedScroll);
  // const seenMessagesRef = useRef(new Set());
  const profileScrollRef = useRef(null);
  const lastScrollTop = useRef(0);
  const textareaRef = useRef(null);
  const chatContainerRef = useRef(null);
  const scrollRestoreRef = useRef(null);
  const observerRef = useRef(null);
  const controllers = useRef({});
  const loadedImageIdsRef = useRef(new Set());
  const lastPrependAtRef = useRef(0);
  // const imageLoadTimeoutRef = useRef(null);
  const isInitialLoadRef = useRef(true); // Track if this is the very first load
  const isRestoringScrollRef = useRef(false);
  // const [imagesToLoad, setImagesToLoad] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const socket = useSocket();

  const otherUser = allUsers.find(
    (u) => u.userid === conversation.other_user_id,
  );

  const mergeUniqueById = (arr, prev = []) => {
    const validArr = arr.filter(
      (m) => m && (m.content || m.preview || m.fileurl),
    );
    const validPrev = prev.filter(
      (m) => m && (m.content || m.preview || m.fileurl),
    );

    const map = new Map(validPrev.map((m) => [m.id || m.tempId, m]));
    validArr.forEach((m) => map.set(m.id || m.tempId, m));
    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(a.delivered_at || a.created_at) -
        new Date(b.delivered_at || b.created_at),
    );
  };

  const generateTempId = () => {
    return `temp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  };

  useEffect(() => {
    if (!socket || !user?.userid || !conversation?.other_user_id) return;

    setLoading(true);

    if (!hydratedChatsRef.current[conversation.other_user_id]) {
      // This is the first time opening this chat - mark as initial load
      // console.log(savedScroll);
      scrollRestoreRef.current = null;
      isInitialLoadRef.current = true;
      // syncreadmessages();
      fetchMessages();
      // pendingsyncdexie();
      hydratedChatsRef.current[conversation.other_user_id] = true;
      // if (!scrollRestoreRef.current) {
      //   onSaveScroll(conversation.other_user_id, scrollTop);
      // }

      // console.log(savedScroll);
    } else {
      // User is returning to this chat - not initial load
      // console.log(savedScroll);
      isInitialLoadRef.current = false;
      setLoading(false);
    }

    // Reset when conversation changes
    return () => {
      // Cleanup when switching conversations
    };

    // const handleOnlineforsync = () => {
    //   syncreadmessages();
    //   pendingsyncdexie();
    // };

    // window.addEventListener("online", handleOnlineforsync);
    // return () => {
    //   // window.removeEventListener("online", handleOnlineforsync);
    // };
  }, [socket, user?.userid, conversation.other_user_id, savedScroll]);

  useEffect(() => {
    if (!conversation?.other_user_id) return;
    replaceCache(conversation.other_user_id, messages);
  }, [messages, conversation?.other_user_id]);

  useEffect(() => {
    const mediaMessages = messages.filter(
      (m) =>
        m.message_type !== "text" &&
        m.message_type !== "audio" &&
        !m.fileUrl &&
        m.aspect_ratio < 2,
    );
    // console.log(mediaMessages);
    mediaMessages.forEach((msg) => downloadFile(msg));
  }, [messages]);

  // useEffect(() => {
  //   console.log("messagesInner mounted");
  //   return () => console.log("messagesInner unmounted");
  // }, []);

  // useEffect(() => {
  //   if (!messages) return;

  //   // Count ALL image messages, regardless of whether they have fileUrl/preview
  //   // Images without fileUrl will be downloaded first, then rendered
  //   const imageMessages = messages.filter((m) => {
  //     // Must be an image type
  //     // console.log(m);
  //     console.log(m.message_type);
  //     if (m?.message_type === "image") return true;

  //     console.log(m.message_type);

  //     // Or check file extension
  //     const path = m?.fileurl || m?.fileUrl || "";
  //     if (!path) return false;
  //     const lower = path.toLowerCase();
  //     return (
  //       lower.includes(".jpg") ||
  //       lower.includes(".jpeg") ||
  //       lower.includes(".png") ||
  //       lower.includes(".gif") ||
  //       lower.includes(".webp")
  //     );
  //   });

  //   const count = imageMessages.length;
  //   console.log(count);
  //   setImagesToLoad(count);

  //   // Get current image IDs (all image messages, not just rendered ones)
  //   const currentImageIds = new Set(imageMessages.map((m) => m.id || m.tempId));

  //   // Clean up loadedImageIdsRef to only include current images
  //   const validLoadedIds = Array.from(loadedImageIdsRef.current).filter((id) =>
  //     currentImageIds.has(id)
  //   );

  //   loadedImageIdsRef.current = new Set(validLoadedIds);

  //   const loadedCount = validLoadedIds.length;
  //   setImagesLoaded(loadedCount);

  //   // Clear any existing timeout
  //   if (imageLoadTimeoutRef.current) {
  //     clearTimeout(imageLoadTimeoutRef.current);
  //     imageLoadTimeoutRef.current = null;
  //   }

  //   // If there are unloaded images, wait for them to load before scrolling
  //   // BUT only if this is a true initial load (first time opening this chat)
  //   // If user is returning to chat (savedScroll exists), don't wait - just restore their position
  //   // if (count > 0 && count > loadedCount) {
  //   //   // Only wait for images on true initial load, not when returning to chat
  //   //   if (isInitialLoadRef.current) {
  //   //     waitingForInitialImagesRef.current = true;
  //   //     // Fallback: if images don't load within 3 seconds (maybe cached or error), scroll anyway
  //   //     imageLoadTimeoutRef.current = setTimeout(() => {
  //   //       if (waitingForInitialImagesRef.current) {
  //   //         waitingForInitialImagesRef.current = false;
  //   //         // Always scroll on initial load OR if pending auto scroll
  //   //         if (isInitialLoadRef.current || pendingAutoScrollRef.current) {
  //   //           scrollToBottom(true);
  //   //           if (isInitialLoadRef.current) {
  //   //             isInitialLoadRef.current = false;
  //   //           }
  //   //           if (pendingAutoScrollRef.current) {
  //   //             pendingAutoScrollRef.current = false;
  //   //             setUnreadCount((prev) => ({
  //   //               ...prev,
  //   //               [conversation.other_user_id]: 0,
  //   //             }));
  //   //           }
  //   //         }
  //   //       }
  //   //     }, 3000);
  //   //   } else {
  //   //     // User is returning - don't wait for images, just restore their position
  //   //     waitingForInitialImagesRef.current = false;
  //   //   }
  //   // } else if (count === 0) {
  //   //   // No images, scroll immediately (only on initial load)
  //   //   waitingForInitialImagesRef.current = false;
  //   //   // Always scroll on initial load, regardless of savedScroll
  //   //   if (isInitialLoadRef.current) {
  //   //     requestAnimationFrame(() => {
  //   //       setTimeout(() => {
  //   //         const container = chatContainerRef.current;
  //   //         if (container) {
  //   //           container.scrollTop = container.scrollHeight;
  //   //           atBottomRef.current = true;
  //   //           setIsAtBottom(true);
  //   //           isInitialLoadRef.current = false;
  //   //         }
  //   //       }, 200);
  //   //     });
  //   //   }
  //   // } else if (count === loadedCount && count > 0) {
  //   //   // All images already loaded
  //   //   waitingForInitialImagesRef.current = false;
  //   //   // Scroll on initial load (only if not returning) OR if pending auto scroll
  //   //   if (
  //   //     pendingAutoScrollRef.current ||
  //   //     (isInitialLoadRef.current && savedScroll === null)
  //   //   ) {
  //   //     requestAnimationFrame(() => {
  //   //       setTimeout(() => {
  //   //         const container = chatContainerRef.current;
  //   //         if (container) {
  //   //           container.scrollTop = container.scrollHeight;
  //   //           const { scrollTop, scrollHeight, clientHeight } = container;
  //   //           const atBottom =
  //   //             Math.abs(scrollHeight - scrollTop - clientHeight) < 5;
  //   //           atBottomRef.current = atBottom;
  //   //           setIsAtBottom(atBottom);

  //   //           if (isInitialLoadRef.current) {
  //   //             isInitialLoadRef.current = false;
  //   //           }
  //   //           if (pendingAutoScrollRef.current) {
  //   //             pendingAutoScrollRef.current = false;
  //   //             setUnreadCount((prev) => ({
  //   //               ...prev,
  //   //               [conversation.other_user_id]: 0,
  //   //             }));
  //   //           }
  //   //         }
  //   //       }, 200);
  //   //     });
  //   //   }
  //   // }

  //   return () => {
  //     if (imageLoadTimeoutRef.current) {
  //       clearTimeout(imageLoadTimeoutRef.current);
  //     }
  //   };
  // }, [messages, savedScroll]);

  useLayoutEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    // on prepended older messages, maintain the user's viewport.

    if (scrollRestoreRef.current) {
      const { prevHeight } = scrollRestoreRef.current;
      // console.log(prevHeight);
      // console.log(container.scrollHeight);
      setTimeout(() => {
        const delta = container.scrollHeight - prevHeight;
        // console.log(delta);
        container.scrollTop = delta; // keep the same messages at same place
        // console.log(container.scrollTop);
        onSaveScroll(conversation.other_user_id, container.scrollTop);
      }, 300);
      scrollRestoreRef.current = null;
      return;
    } else if (savedScroll !== null && !pendingAutoScrollRef.current) {
      isRestoringScrollRef.current = true;

      // const container = chatContainerRef.current;
      // if (!container) return;

      const tryRestore = () => {
        const maxScroll = container.scrollHeight - container.clientHeight + 5;

        // console.log("saved:", savedScroll, "max:", maxScroll);

        if (maxScroll >= savedScroll) {
          container.scrollTop = savedScroll;
          // console.log(savedScroll);
          // console.log(container.scrollTop);
          isRestoringScrollRef.current = false;
          return;
        }

        requestAnimationFrame(tryRestore);
      };

      tryRestore();
      return;
    }

    // scroll to bottom

    if (pendingAutoScrollRef.current) {
      scrollRestoreRef.current = null;
      container.scrollTop += container.scrollHeight;
      // console.log("from pendingautoscrollref", savedScroll);
      savedScroll = container.scrollTop;

      setTimeout(() => {
        const container = chatContainerRef.current;
        container.scrollTop = container.scrollHeight;

        setUnreadCount((prev) => ({
          ...prev,
          [conversation.other_user_id]: 0,
        }));

        pendingAutoScrollRef.current = false;
      }, 300);

      return;
    }

    // If user is returning to chat (savedScroll exists), restore position immediately
    // BUT if pendingAutoScroll is set, that means a new message arrived - scroll to bottom instead
    // if (savedScroll !== null) {
    //   if (pendingAutoScrollRef.current) {
    //     // New message arrived while user was away - scroll to bottom
    //     container.scrollTop = container.scrollHeight;
    //     pendingAutoScrollRef.current = false;
    //     updateAtBottomFlag();
    //     setUnreadCount((prev) => ({
    //       ...prev,
    //       [conversation.other_user_id]: 0,
    //     }));
    //     return;
    //   } else {
    //     // User is returning - restore their saved position
    //     container.scrollTop = savedScroll;
    //     updateAtBottomFlag();
    //     return;
    //   }
    // }

    // Don't scroll if we're waiting for images to load on initial load
    // if (waitingForInitialImagesRef.current && imagesLoaded < imagesToLoad) {
    //   updateAtBottomFlag();
    //   return;
    // }

    // If we were waiting and now all images are loaded, ensure we scroll
    // BUT only if this is a true initial load (savedScroll is null), not when returning

    // if (
    //   waitingForInitialImagesRef.current &&
    //   imagesLoaded === imagesToLoad &&
    //   imagesToLoad > 0
    // ) {
    //   // Only scroll on true initial load (savedScroll is null)
    //   // If savedScroll exists, user is returning - don't scroll
    //   if (savedScroll === null && isInitialLoadRef.current) {
    //     requestAnimationFrame(() => {
    //       setTimeout(() => {
    //         container.scrollTop = container.scrollHeight;
    //         updateAtBottomFlag();
    //         // Mark initial load as complete
    //         isInitialLoadRef.current = false;
    //         if (pendingAutoScrollRef.current) {
    //           pendingAutoScrollRef.current = false;
    //           setUnreadCount((prev) => ({
    //             ...prev,
    //             [conversation.other_user_id]: 0,
    //           }));
    //         }
    //       }, 200);
    //     });
    //   }
    //   return;
    // }

    // If no images and initial load, scroll to bottom (only if not returning)

    // if (
    //   imagesToLoad === 0 &&
    //   isInitialLoadRef.current &&
    //   savedScroll === null
    // ) {
    //   requestAnimationFrame(() => {
    //     setTimeout(() => {
    //       container.scrollTop = container.scrollHeight;
    //       updateAtBottomFlag();
    //       isInitialLoadRef.current = false;
    //     }, 200);
    //   });
    //   return;
    // }

    // Handle pending auto scroll (for new messages when user is at bottom)
    // BUT only if there are no images waiting to load
    // If images are loading, wait for them to finish (they'll trigger scroll in handleMediaLoad)

    // if (pendingAutoScrollRef.current && imagesToLoad === 0) {
    //   requestAnimationFrame(() => {
    //     setTimeout(() => {
    //       container.scrollTop = container.scrollHeight;
    //       updateAtBottomFlag();
    //       pendingAutoScrollRef.current = false;
    //       setUnreadCount((prev) => ({
    //         ...prev,
    //         [conversation.other_user_id]: 0,
    //       }));
    //     }, 200);
    //   });
    //   return;
    // }

    // If pendingAutoScroll is set but images are loading, don't scroll yet
    // The scroll will happen in handleMediaLoad when images finish
    // if (
    //   pendingAutoScrollRef.current &&
    //   imagesToLoad > 0 &&
    //   imagesLoaded < imagesToLoad
    // ) {
    //   return;
    // }
  }, [
    messages,
    conversation?.other_user_id,
    savedScroll,
    setUnreadCount,
    pendingAutoScrollRef,
  ]);

  useEffect(() => {
    // savedScroll = null;
    scrollRestoreRef.current = null;
    isInitialLoadRef.current = true;
  }, [conversation.other_user_id]);

  // Intersection observer for read receipts

  useEffect(() => {
    if (!chatContainerRef.current) return;
    const container = chatContainerRef.current;

    if (observerRef.current) observerRef.current.disconnect();

    const markMessageRead = async (node) => {
      const messageId = node.dataset.id;
      const message = messages.find((m) => m.id === messageId);

      if (!message || message.is_read || message.receiver_id !== user.userid)
        return;

      // console.log("✅ Mark read:", message.id);

      if (messageId.startsWith("temp-")) {
        return;
      }

      try {
        await axiosbase.put(`/messages/read/private/${message.id}`);

        setMessages((prev) =>
          prev.map((m) => (m.id === message.id ? { ...m, is_read: true } : m)),
        );
        observerRef.current.unobserve(node);
      } catch (err) {
        console.error(err);
      }
    };

    // console.log(observerRef.current);
    observerRef.current = new IntersectionObserver(
      async (entries) => {
        entries.forEach(async (entry) => {
          if (entry.isIntersecting) {
            console.log("Message in view:", entry.isIntersecting);
            const messageId = entry.target.dataset.id;
            const message = messages.find((m) => m.id === messageId);
            console.log(
              "Message in view:",
              message,
              !message.is_read,
              message.receiver_id === user.userid,
            );
            if (
              message &&
              !message.is_read &&
              message.sender_id !== user.userid &&
              message.receiver_id === user.userid
            ) {
              // Update backend
              try {
                console.log("📡 Marking message read:", message.id);
                await axiosbase.put(`/messages/read/private/${message.id}`);
                // Update locally
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === message.id ? { ...m, is_read: true } : m,
                  ),
                );
                // Decrease unread counter for this conversation
                setUnreadCount((prev) => ({
                  ...prev,
                  [conversation.other_user_id]: Math.max(
                    (prev[conversation.other_user_id] || 1) - 1,
                    0,
                  ),
                }));

                // console.log(message);
                // await PrivateChatStorage.saveMessage(
                //   {
                //     id: message.id,
                //     sender_username: message.sender_username,
                //     chatId: conversation.other_user_id,
                //     sender_id: message.sender_id,
                //     receiver_id: message.receiver_id,
                //     content: message.content,
                //     created_at: message.created_at,
                //     message_type: message.message_type,
                //     is_read: true,
                //     delivered_at: message.delivered_at,
                //     preview: message.preview,
                //     fileUrl: message.fileurl,
                //     fileName: message.filename,
                //     filesize: message.filesize,
                //   },
                //   cryptoKey
                // );
              } catch (err) {
                console.error("Error marking message as read:", err);
              }
            }
          }
        });
      },
      { root: container, threshold: 0.65 },
    );
    // 80% visible

    const observeAllMessages = () => {
      const nodes = container.querySelectorAll("[data-id]");
      nodes.forEach((node) => {
        const msg = messages.find((m) => m.id === node.dataset.id);

        if (msg && !msg.is_read && msg.receiver_id === user.userid) {
          observerRef.current.observe(node);
        }

        checkVisibility(node);
      });
    };

    const checkVisibility = (node) => {
      const containerRect = container.getBoundingClientRect();

      const rect = node.getBoundingClientRect();

      const visibleHeight =
        Math.min(rect.bottom, containerRect.bottom) -
        Math.max(rect.top, containerRect.top);

      const ratio = visibleHeight / rect.height;

      // console.log("visibility ratio:", ratio);

      if (ratio >= 0.65) markMessageRead(node);
    };

    const timeout = setTimeout(() => {
      observeAllMessages();
    }, 50);

    const onScroll = () => observeAllMessages();

    container.addEventListener("scroll", onScroll);

    return () => {
      clearTimeout(timeout);
      observerRef.current.disconnect();
      container.removeEventListener("scroll", onScroll);
    };

    // const nodes = container.querySelectorAll("[data-id]");
    // nodes.forEach((node) => observerRef.current.observe(node));

    // return () => observerRef.current.disconnect();
  }, [messages, user.userid, conversation.other_user_id]);

  // otherprofile description section
  useEffect(() => {
    const container = profileScrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentScroll = container.scrollTop;
      // const movedUp = lastScrollTop.current - currentScroll;
      // console.log(movedUp);
      // if image is open and user scrolls upward a little
      if (enlargeProfileImage && currentScroll > lastScrollTop.current) {
        setEnlargeProfileImage(false);
        container.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }

      lastScrollTop.current = currentScroll;
    };

    container.addEventListener("scroll", handleScroll);

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [enlargeProfileImage]);

  // const pendingsyncdexie = async () => {
  //   const token = sessionStorage.getItem("token");
  //   if (!token || !cryptoKey) return;
  //   try {
  //     const userpending = await PrivateChatStorage.pendingmessages(
  //       user.userid,
  //       cryptoKey,
  //       conversation.other_user_id
  //     );
  //     if (!pendingMessagesRef.current[conversation.other_user_id]) {
  //       pendingMessagesRef.current[conversation.other_user_id] = [];
  //     }
  //     for (const msg of userpending) {
  //       pendingMessagesRef.current[conversation.other_user_id].push(msg);
  //       await resendPendingMessage(msg);
  //     }
  //   } catch (error) {
  //     console.log(error);
  //   }
  // };

  // const syncreadmessages = async () => {
  //   const token = sessionStorage.getItem("token");
  //   if (!token || !cryptoKey) return;

  //   try {
  //     const response = await axiosbase.get(
  //       `/messages/syncread/${conversation.other_user_id}`
  //     );

  //     const messages = response.data;

  //     await Promise.all(
  //       messages.map(async (message) => {
  //         await PrivateChatStorage.updateMessageRead(
  //           message.receiver_id,
  //           message.id
  //         );
  //       })
  //     );

  //     // setMessages((prev) =>
  //     //   prev.map((m) => (m.id === messages.id ? { ...m, is_read: true } : m))
  //     // );
  //   } catch (error) {
  //     console.log(error);
  //   }
  // };

  const fetchMessages = async (initial = true, prepend = false) => {
    const token = sessionStorage.getItem("token");
    if (!token) return;

    // if (!token || !cryptoKey) return;

    // if (initial) {
    //   setoffset((prev) => ({
    //     ...prev,
    //     [conversation.other_user_id]: 0,
    //   }));
    // }

    try {
      // 1. Try local Dexie first

      // const localMsgs = await PrivateChatStorage.getMessages(
      //   conversation.other_user_id,
      //   cryptoKey,
      //   20,
      //   initial ? 0 : offset[conversation.other_user_id],
      //   user.userid
      // );

      // if (localMsgs.length && offset[conversation.other_user_id] == undefined) {
      //   setMessages((prev) => mergeUniqueById([...localMsgs, ...prev]));
      //   setoffset((prev) => ({
      //     ...prev,
      //     [conversation.other_user_id]:
      //       prev[conversation.other_user_id] + localMsgs.length,
      //   }));

      //   // console.log(
      //   //   `from ${localMsgs[0].receiver_id}`,
      //   //   offset[conversation.other_user_id]
      //   // );

      //   setLoading(false);
      //   pendingAutoScrollRef.current = true;
      //   return;
      // } else if (localMsgs.length && offset[conversation.other_user_id] !== 0) {
      //   setMessages((prev) => mergeUniqueById([...localMsgs, ...prev]));
      //   setoffset((prev) => ({
      //     ...prev,
      //     [conversation.other_user_id]:
      //       prev[conversation.other_user_id] + localMsgs.length,
      //   }));

      //   // console.log(
      //   //   `from ${localMsgs[0].receiver_id}`,
      //   //   offset[conversation.other_user_id]
      //   // );
      //   const container = chatContainerRef.current;
      //   const prevHeight = container.scrollHeight;
      //   scrollRestoreRef.current = { prevHeight };
      //   return;
      // } else if (!localMsgs.length) {
      //   setoffset((prev) => ({
      //     ...prev,
      //     [conversation.other_user_id]: prev[conversation.other_user_id] + 20,
      //   }));
      // }

      // 2. Then sync from server

      const response = await axiosbase.get(
        `/messages/private/${conversation.other_user_id}?limit=20&offset=${
          initial ? 0 : messages.length
        }`,
      );

      if (initial) {
        setMessages((prev) => mergeUniqueById([...response.data, ...prev]));
        // console.log(response.data);
        pendingAutoScrollRef.current = true;
      } else if (prepend) {
        if (response.data.length === 0) return;
        const container = chatContainerRef.current;

        const prevHeight = container.scrollHeight;
        setMessages((prev) => mergeUniqueById([...response.data, ...prev]));
        scrollRestoreRef.current = { prevHeight };
        lastPrependAtRef.current = Date.now();
      }

      // Save to Dexie (encrypted)
      // for (const msg of response.data) {
      //   await PrivateChatStorage.saveMessage(
      //     {
      //       chatId: conversation.other_user_id,
      //       sender_username: msg.sender_username,
      //       sender_id: msg.sender_id,
      //       receiver_id: msg.receiver_id,
      //       content: msg.content,
      //       created_at: msg.created_at,
      //       message_type: msg.message_type,
      //       is_read: msg.is_read,
      //       delivered_at: msg.delivered_at,
      //       id: msg.id,
      //       fileurl: msg.fileurl || null,
      //       fielname: msg.filename || null,
      //       filesize: msg.filesize || null,
      //     },
      //     cryptoKey
      //   );
      // }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching messages:", error);
      setLoading(false);
    }
  };

  const handleScroll = () => {
    if (!chatContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const atBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 5;
    setIsAtBottom(atBottom);

    atBottomRef.current = atBottom;

    // console.log(pendingAutoScrollRef.current);
    // console.log(!scrollRestoreRef.current);
    // console.log(scrollRestoreRef);
    // console.log(scrollTop);
    // console.log(savedScroll);

    if (!scrollRestoreRef.current) {
      onSaveScroll(conversation.other_user_id, scrollTop);
    }

    if (scrollTop === 0) {
      fetchMessages(false, true); // load older
    }

    if (atBottom)
      setUnreadCount((prev) => ({
        ...prev,
        [conversation.other_user_id]: 0,
      }));
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim()) return;
    scrollRestoreRef.current == null;

    console.log("Sending message:", newMessage);
    const tempId = generateTempId();
    const optimisticMessage = {
      id: tempId,
      tempId,
      content: newMessage,
      sender_id: user.userid,
      receiver_id: conversation.other_user_id,
      sender_username: user.username,
      created_at: null,
      is_read: false,
      delivered_at: new Date().toISOString(),
      status: "pending",
      message_type: "text",
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    if (!pendingMessagesRef.current[conversation.other_user_id]) {
      pendingMessagesRef.current[conversation.other_user_id] = [];
    }

    pendingMessagesRef.current[conversation.other_user_id].push(
      optimisticMessage,
    );
    setNewMessage("");
    scrollRestoreRef.current = null;
    pendingAutoScrollRef.current = true;

    // Save pending into Dexie
    // if (cryptoKey) {
    //   PrivateChatStorage.saveMessage(
    //     {
    //       id: optimisticMessage.id,
    //       chatId: conversation.other_user_id,
    //       sender_username: optimisticMessage.sender_username,
    //       sender_id: optimisticMessage.sender_id,
    //       receiver_id: optimisticMessage.receiver_id,
    //       content: optimisticMessage.content,
    //       created_at: optimisticMessage.created_at,
    //       message_type: optimisticMessage.message_type,
    //       is_read: optimisticMessage.is_read,
    //       delivered_at: optimisticMessage.delivered_at,
    //       status: optimisticMessage.status,
    //       tempId: optimisticMessage.tempId,
    //     },
    //     cryptoKey
    //   );
    // }

    try {
      if (!navigator.onLine) throw new Error("Offline");
      await resendPendingMessage(optimisticMessage);
    } catch (error) {
      console.warn("Message pending:", optimisticMessage.content);
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "20px"; // reset to min height
    const scrollHeight = textarea.scrollHeight;

    if (scrollHeight <= 150) {
      textarea.style.height = scrollHeight + "px"; // grow
    } else {
      textarea.style.height = "150px"; // max height
      textarea.scrollTop = textarea.scrollHeight; // scroll inside
    }
  };

  // const scrollToBottom = (smooth = false) => {
  //   const root = chatContainerRef.current;
  //   if (!root) return;

  //   // Use requestAnimationFrame to ensure DOM is updated
  //   requestAnimationFrame(() => {
  //     if (!root) return;
  //     root.scrollTop = root.scrollHeight;
  //     // Also update the atBottom flag
  //     const { scrollTop, scrollHeight, clientHeight } = root;
  //     const atBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 5;
  //     atBottomRef.current = atBottom;
  //     setIsAtBottom(atBottom);
  //   });
  // };

  const handleMediaLoad = (id, isSender) => {
    // Skip if this image was already loaded
    if (loadedImageIdsRef.current.has(id)) {
      return;
    }

    // console.log(loadedImageIdsRef.current);

    loadedImageIdsRef.current.add(id);

    setImagesLoaded((prev) => {
      // console.log(prev);
      const newCount = prev + 1;
      // console.log(newCount);

      // For sender, ALWAYS scroll to bottom when their image loads
      // This ensures sender sees their sent image immediately

      if (isSender && pendingAutoScrollRef.current) {
        scrollRestoreRef.current = null;
        // Use multiple attempts to ensure scroll happens
        // const container = chatContainerRef.current;
        // console.log(container.scrollHeight);
        // console.log(container.scrollTop);
        requestAnimationFrame(() => {
          setTimeout(() => {
            const container = chatContainerRef.current;
            if (container) {
              // console.log(container.scrollTop);
              container.scrollTop += container.scrollHeight;
              // console.log(container.scrollTop);
              savedScroll = container.scrollTop;

              atBottomRef.current = true;
              setIsAtBottom(true);
            }
          }, 200);
        });
      }

      // Scroll when all images/videos are loaded
      // if (newCount === imagesToLoad && imagesToLoad > 0) {
      //   const wasWaitingForInitial = waitingForInitialImagesRef.current;
      //   waitingForInitialImagesRef.current = false;

      //   // Check current scroll position to see if user is at bottom
      //   const container = chatContainerRef.current;
      //   let isCurrentlyAtBottom = false;
      //   if (container) {
      //     const { scrollTop, scrollHeight, clientHeight } = container;
      //     isCurrentlyAtBottom =
      //       Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
      //   }

      //   // Scroll if:
      //   // 1. pendingAutoScroll is set (new message arrived and user was at bottom) - HIGHEST PRIORITY
      //   // 2. OR It's the initial load (was waiting for images on first open) AND no savedScroll
      //   // 3. OR user is currently at the bottom (new message arrived while at bottom)
      //   // Note: pendingAutoScroll ALWAYS triggers scroll - this handles receiver at bottom case
      //   const shouldScroll =
      //     pendingAutoScrollRef.current ||
      //     (wasWaitingForInitial &&
      //       isInitialLoadRef.current &&
      //       savedScroll === null) ||
      //     isCurrentlyAtBottom;

      //   if (shouldScroll) {
      //     // Use requestAnimationFrame and setTimeout to ensure DOM is fully updated
      //     requestAnimationFrame(() => {
      //       setTimeout(() => {
      //         const container = chatContainerRef.current;
      //         if (container) {
      //           container.scrollTop = container.scrollHeight;
      //           const { scrollTop, scrollHeight, clientHeight } = container;
      //           const atBottom =
      //             Math.abs(scrollHeight - scrollTop - clientHeight) < 5;
      //           atBottomRef.current = atBottom;
      //           setIsAtBottom(atBottom);

      //           // Mark initial load as complete
      //           if (wasWaitingForInitial && isInitialLoadRef.current) {
      //             isInitialLoadRef.current = false;
      //           }
      //           // Clear pending auto scroll
      //           if (pendingAutoScrollRef.current) {
      //             pendingAutoScrollRef.current = false;
      //             setUnreadCount((prev) => ({
      //               ...prev,
      //               [conversation.other_user_id]: 0,
      //             }));
      //           }
      //         }
      //       }, 200);
      //     });
      //   }
      // }

      return newCount;
    });
  };

  const downloadFile = async (message) => {
    if (message.tempId) {
      return;
    }

    const existingBytes = message.downloadedBytes || 0;

    const fileIdentifier = message.id;
    if (!fileIdentifier) {
      console.error("No file identifier to download");
      return;
    }

    // 🚫 Videos are streamed by the browser — do nothing
    // if (message.message_type === "video") {
    //   // console.log("Video uses native streaming:", fileIdentifier);
    //   return;
    // }

    const controller = new AbortController();
    controllers.current[fileIdentifier] = controller;
    // const isDownloaded = !!message.fileUrl;
    // start progress
    setMessages((prev) =>
      prev.map(
        (m) =>
          m.id === message.id
            ? { ...m, isDownloading: true, isPaused: false }
            : m,
        6,
      ),
    );

    try {
      const downloadUrl = `/messages/file/download/${fileIdentifier}`;
      const response = await axiosbase.get(downloadUrl, {
        responseType: "blob",
        headers: existingBytes ? { Range: `bytes=${existingBytes}-` } : {},
        signal: controller.signal,
        onDownloadProgress: (e) => {
          const total = message.filesize;
          const loaded = existingBytes + e.loaded;

          const percent = Math.floor((loaded / total) * 100);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === message.id
                ? { ...m, downloadProgress: percent, downloadedBytes: loaded }
                : m,
            ),
          );
        },
      });

      const newBlob = response.data;

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== message.id) return m;

          const combinedBlob = m.partialBlob
            ? new Blob([m.partialBlob, newBlob])
            : newBlob;

          const blobUrl = URL.createObjectURL(combinedBlob);

          return {
            ...m,
            partialBlob: combinedBlob,
            fileUrl: blobUrl,
            isDownloading: false,
            downloadProgress: 100,
            isDownloaded: true,
            isPaused: false,
            downloadedBytes: message.filesize,
          };
        }),
      );
    } catch (err) {
      console.error("Download failed", err);
    }
  };

  const cancelDownload = (id, message) => {
    if (!message.tempId) {
      if (controllers.current[id]) {
        controllers.current[id].abort();
        delete controllers.current[id];
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, isDownloading: false, isPaused: true } : m,
        ),
      );

      return;
    }

    if (activeUploadsRef.current[message.tempId]) {
      activeUploadsRef.current[message.tempId].abort();
      delete activeUploadsRef.current[message.tempId];

      setMessages((prev) => prev.filter((m) => m.tempId !== message?.tempId));
    }

    // remove from UI

    if (pendingMessagesRef?.current?.[message.receiver_id]) {
      pendingMessagesRef.current[message.receiver_id] =
        pendingMessagesRef.current[message.receiver_id].filter(
          (m) => m.tempId !== message.tempId,
        );
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    for (const file of files) {
      const tempId = generateTempId();

      // Detect message type
      let messageType = "file";
      if (file.type.startsWith("image/")) messageType = "image";
      else if (file.type.startsWith("video/")) messageType = "video";
      else if (file.type.startsWith("audio/")) messageType = "audio";

      // console.log(file.type);

      let preview = null;
      let optimisticMessage = null;
      let fileurl = null;

      // Only create preview for images or short videos
      try {
        if (messageType === "image") {
          // For sender, we can show full image immediately
          preview = await createImageThumbnailpreview(file);
          fileurl = await createImageThumbnail(file);
          // fileUrl = URL.createObjectURL(file);
          // console.log(file);
          optimisticMessage = {
            id: tempId,
            tempId,
            content: null,
            filename: file.name,
            filesize: file.size,
            sender_id: user.userid,
            receiver_id: conversation.other_user_id,
            sender_username: user.username,
            is_read: false,
            delivered_at: new Date().toISOString(),
            status: "pending",
            message_type: messageType,
            width: 0,
            height: 0,
            aspect_ratio: 0,
            duration: 0,
            file,
            preview,
            fileurl,
            uploadProgress: 0,
            downloadProgress: 0,
          };
        } else if (messageType === "video") {
          // Only optimistic render for short videos (<30s)

          const metadata = await createVideoMetadata(file);

          if (metadata.duration) {
            // preview = await createVideoThumbnail(file);
            optimisticMessage = {
              id: tempId,
              tempId,
              content: null,
              filename: file.name,
              filesize: file.size,
              sender_id: user.userid,
              receiver_id: conversation.other_user_id,
              sender_username: user.username,
              created_at: new Date().toISOString(),
              is_read: false,
              delivered_at: new Date().toISOString(),
              status: "pending",
              message_type: messageType,
              width: metadata.width,
              height: metadata.height,
              aspect_ratio: metadata.aspectRatio,
              duration: metadata.duration,
              file,
              preview,
              fileurl,
              uploadProgress: 0,
              downloadProgress: 0,
            };
          }
        } else if (messageType === "audio") {
          const audioMetadata = await createAudioMetadata(file);
          // Other files: no optimistic UI
          if (audioMetadata.duration) {
            optimisticMessage = {
              id: tempId,
              tempId,
              content: null,
              filename: file.name,
              filesize: file.size,
              sender_id: user.userid,
              receiver_id: conversation.other_user_id,
              sender_username: user.username,
              created_at: new Date().toISOString(),
              is_read: false,
              delivered_at: new Date().toISOString(),
              status: "pending",
              message_type: messageType,
              file,
              uploadProgress: 0,
              downloadProgress: 0,
              width: 0,
              height: 0,
              aspect_ratio: 0,
              duration: audioMetadata.duration,
            };
          }
        } else {
          optimisticMessage = {
            id: tempId,
            tempId,
            content: null,
            filename: file.name,
            filesize: file.size,
            sender_id: user.userid,
            receiver_id: conversation.other_user_id,
            sender_username: user.username,
            created_at: new Date().toISOString(),
            is_read: false,
            delivered_at: new Date().toISOString(),
            status: "pending",
            message_type: messageType,
            file,
            uploadProgress: 0,
            downloadProgress: 0,
            width: 0,
            height: 0,
            aspect_ratio: 0,
            duration: 0,
          };
        }
      } catch (err) {
        console.log("Preview generation failed", err);
      }

      // Add optimistic message if it exists
      if (optimisticMessage) {
        setMessages((prev) => [...prev, optimisticMessage]);
        pendingAutoScrollRef.current = true;
        if (!pendingMessagesRef.current[conversation.other_user_id]) {
          pendingMessagesRef.current[conversation.other_user_id] = [];
        }
        pendingMessagesRef.current[conversation.other_user_id].push(
          optimisticMessage,
        );
      }

      // if (cryptoKey) {
      //   await PrivateChatStorage.saveMessage(
      //     {
      //       chatId: conversation.other_user_id,
      //       id: optimisticMessage.tempId,
      //       tempId: optimisticMessage.tempId,
      //       content: optimisticMessage.content,
      //       filename: optimisticMessage.filename,
      //       filesize: optimisticMessage.filesize,
      //       sender_id: optimisticMessage.sender_id,
      //       receiver_id: optimisticMessage.receiver_id,
      //       sender_username: optimisticMessage.sender_username,
      //       created_at: optimisticMessage.created_at,
      //       is_read: optimisticMessage.is_read,
      //       delivered_at: optimisticMessage.delivered_at,
      //       status: "pending",
      //       message_type: optimisticMessage.message_type,
      //       preview: optimisticMessage.preview,
      //       uploadProgress: optimisticMessage.uploadProgress,
      //       downloadProgress: optimisticMessage.downloadProgress,
      //     },
      //     cryptoKey
      //   );
      // }

      // Upload file to server
      try {
        if (!navigator.onLine) throw new Error("Offline");
        await sendFileToServer(optimisticMessage);
      } catch (error) {
        console.log("File upload pending:", file.name);
      }
    }

    e.target.value = ""; // reset input
  };

  const handleotherprofiledetail = () => {
    setshowotherprofile((prev) => !prev);
  };
  const handleImageClick = (message) => {
    setSelectedImage(message.fileUrl);
  };

  const handleVideoClick = (message) => {
    setSelectedVideo(message.fileUrl);
  };

  // const handleAudioClick = (message) => {
  //   setSelectedAudio(message.fileUrl);
  // };

  const handleFilesClick = (message) => {
    setSelectedFile(message.fileUrl);
  };

  const imageMessages = messages?.filter((m) => m.message_type === "image");
  const videoMessages = messages?.filter(
    (m) => m.message_type === "video" && m.aspect_ratio < 2,
  );
  const audioMessages = messages?.filter((m) => m.message_type === "audio");
  const fileMessages = messages?.filter(
    (m) =>
      m.message_type === "file" ||
      (m.message_type === "video" && m.aspect_ratio >= 2),
  );

  const SpinnerWrapper = ({ progress, onCancel }) => {
    const circumference = 2 * Math.PI * 20; // circle perimeter
    const arcLength = Math.max((circumference * progress) / 100, 2); // min arc at 0

    return (
      <div className={classes.spinner_container} style={{ marginBottom: 5 }}>
        {/* Spinner Circle */}
        {progress < 100 && (
          <svg
            width="50"
            height="50"
            viewBox="0 0 50 50"
            style={{
              animation: "spin 1.5s linear infinite",
            }}
          >
            {/* Background track */}
            <circle
              cx="25"
              cy="25"
              r="20"
              fill="rgba(44, 44, 44, 0.2)"
              strokeWidth="4"
            />
            {/* Progress arc */}
            <circle
              cx="25"
              cy="25"
              r="20"
              fill="none"
              stroke="white"
              strokeWidth="4"
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
    );
  };
  const handleOpen = () => {
    window.open(
      `http://localhost:5500/api/messages/file/download/${message.id}?token=${sessionStorage.getItem("token")}`,
      "_blank",
    );
    return;
  };
  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return "";

    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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
    <>
      <div className={classes.privateChatContainer}>
        {/* Chat Header */}
        <div
          ref={profileScrollRef}
          className={`${classes.otherprofileContainer} ${showotherprofile ? classes.showotherprofile : classes.hideotherprofile}`}
        >
          {/* profile part  */}

          <div className={classes.otherprofileCard}>
            <div className={classes.otherprofileAvatarSection}>
              {/* close button  */}
              {!enlargeProfileImage && (
                <div
                  className={classes.closingActions}
                  onClick={handleotherprofiledetail}
                >
                  <button
                    className={classes.closeButtonprofile}
                    title="Close Profile View"
                  >
                    <IoMdClose className={classes.closebuttonicon} />
                  </button>
                  <div className={classes.otherprofileTitles}>User Info</div>
                </div>
              )}

              {/* profile section  */}

              {!enlargeProfileImage && (
                <div className={classes.otherprofileCardinner}>
                  <label>
                    <div
                      className={classes.otherprofileAvatarWrapper}
                      onClick={() => {
                        setEnlargeProfileImage(true);
                        lastScrollTop.current =
                          profileScrollRef.current.scrollTop;
                      }}
                    >
                      {conversation.avatar_url ? (
                        <img
                          src={`http://localhost:5500${conversation.avatar_url}`}
                          alt=""
                          className={classes.otherprofileAvatar}
                        />
                      ) : (
                        <IoMdPerson
                          className={classes.otherprofileDefaultIcon}
                        />
                      )}
                    </div>
                  </label>

                  <h3>{conversation.other_username}</h3>
                  <p className={classes.statusprofile}>
                    {otherUser?.status || "offline"}
                  </p>
                </div>
              )}

              {enlargeProfileImage && (
                <div className={classes.profileImageModal}>
                  <div
                    className={classes.closingActions}
                    onClick={handleotherprofiledetail}
                  >
                    <button
                      className={classes.closeButtonprofile}
                      title="Close Profile View"
                    >
                      <IoMdClose className={classes.closebuttonicon} />
                    </button>
                    <div className={classes.otherprofileTitles}>User Info</div>
                  </div>

                  <img
                    src={`http://localhost:5500${conversation.avatar_url}`}
                    alt="Profile"
                    className={classes.profileImageLarge}
                    onClick={() => setEnlargeProfileImage(false)}
                  />

                  <div className={classes.profileImageInfo}>
                    <h3>{conversation.other_username}</h3>
                    <p className={classes.statusprofile}>
                      {otherUser?.status || "offline"}
                    </p>
                  </div>
                </div>
              )}

              {/* here the detail of the profile  */}

              <div className={classes.otherprofileDetails}>
                <div className={classes.otherprofileInfo}>
                  <div className={classes.otherprofileInfoTitles}>
                    {conversation.bio ? "" : "Bio"}
                  </div>
                </div>

                <div className={classes.otherprofileInfoContent}>
                  {conversation.bio ? (
                    <div className={classes.otherinternalprofile}>
                      <div className={classes.otherprofileicon}>
                        <FiInfo />
                      </div>
                      <div className={classes.otherprofiledescription}>
                        {" "}
                        <div className={classes.otherbioforprofiles}>
                          {conversation.bio}
                        </div>
                        <div className={classes.otherprofileInfoTitle}>bio</div>
                      </div>
                    </div>
                  ) : (
                    <div className={classes.otherbioforprofile}>
                      No bio available.
                    </div>
                  )}

                  {conversation.phone ? (
                    <div className={classes.otherinternalprofile}>
                      <div className={classes.otherprofileiconphone}>
                        <FiPhone />
                      </div>

                      <div className={classes.otherprofiledescription}>
                        <div className={classes.otherphoneforprofile}>
                          {conversation.phone}
                        </div>
                        <div className={classes.otherprofileInfoTitle}>
                          Phone
                        </div>
                      </div>
                    </div>
                  ) : (
                    ""
                  )}

                  {conversation.department ? (
                    <div className={classes.otherinternalprofile}>
                      <div className={classes.otherprofileiconphone}>
                        <FiBriefcase />
                      </div>
                      <div className={classes.otherprofiledescription}>
                        <div className={classes.otherdepartmentforprofile}>
                          {conversation.department}
                        </div>
                        <div className={classes.otherprofileInfoTitle}>
                          Department
                        </div>
                      </div>
                    </div>
                  ) : (
                    ""
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* // profile chat type navigation */}

          <div className={classes.chattypeoptions}>
            <button
              className={`${classes.Listoption} ${activelist == "Media" ? classes.active : ""}`}
              onClick={() => setactivelist("Media")}
            >
              Media
            </button>
            <button
              className={`${classes.Listoption} ${activelist == "Photos" ? classes.active : ""}`}
              onClick={() => setactivelist("Photos")}
            >
              Photos
            </button>
            <button
              className={`${classes.Listoption} ${activelist == "Files" ? classes.active : ""}`}
              onClick={() => setactivelist("Files")}
            >
              Files
            </button>

            <button
              className={`${classes.Listoption} ${activelist == "Audios" ? classes.active : ""}`}
              onClick={() => setactivelist("Audios")}
            >
              Audios
            </button>
          </div>

          {/* here is the navigation content  */}
          {activelist === "Media" && (
            <div className={classes.containerofnavigation}>
              {videoMessages.length === 0 ? (
                <div className={classes.emptyMessagesfornav}>
                  <p>No Media message yet!</p>
                </div>
              ) : (
                <div className={classes.innercontainernav}>
                  {videoMessages.map((message) => (
                    <div
                      className={classes.messageContainernav}
                      key={message.id}
                      onClick={() => handleVideoClick(message)}
                    >
                      <video
                        src={message.fileUrl}
                        className={classes.videoPreview}
                        muted
                        preload="metadata"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activelist === "Audios" && (
            <div className={classes.containerofnavaudio}>
              {audioMessages.length === 0 ? (
                <div className={classes.emptyMessagesfornav}>
                  <p>No Audio message yet!</p>
                </div>
              ) : (
                <div className={classes.inneraudionav}>
                  {audioMessages.map((message) => {
                    const isDownloading = message.isDownloading ?? false;
                    const isDownloaded = message.isDownloaded ?? false;
                    const isPaused = message.isPaused ?? false;
                    return (
                      <div
                        className={classes.insidefile_container_audioforprofile}
                      >
                        {/* LEFT SIDE (icon / spinner / download) */}

                        <div style={{ position: "relative", height: "50px" }}>
                          <div
                            style={{
                              marginTop: 6,
                              position: "absolute",
                              top: 45,
                              right: 0,
                              width: "100%",
                            }}
                            onClick={(e) => {
                              const playButton =
                                e.target.closest('[data-plyr="play"]');

                              if (!playButton) return; // ignore mute, progress, etc.
                              if (!isDownloaded && !isDownloading) {
                                e.preventDefault();
                                e.stopPropagation();
                                downloadFile(message);
                              }
                            }}
                          >
                            <Plyr
                              options={{
                                controls: [
                                  "play",
                                  "progress",
                                  "current-time",
                                  "duration",
                                  "mute",
                                ],
                              }}
                              source={{
                                type: "audio",
                                sources: [{ src: message.fileUrl }],
                              }}
                            />
                          </div>

                          {isDownloading || isPaused ? (
                            <div
                              style={{
                                position: "absolute",
                                top: 25,
                                left: 20,
                              }}
                            >
                              <SpinnerWrapper
                                progress={message.downloadProgress}
                              />

                              <div
                                className={classes.cancel_button}
                                style={{
                                  fontSize: "20px",
                                  marginLeft: "9.5px",
                                  marginTop: "5px",
                                }}
                              >
                                {isPaused ? (
                                  <div
                                    onClick={() => onDownloadClick(message)}
                                    style={{
                                      fontSize: "15px",
                                      marginTop: "3px",
                                      marginLeft: "1.3px",
                                    }}
                                  >
                                    ⬇
                                  </div>
                                ) : (
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      onCancel();
                                    }}
                                  >
                                    ×
                                  </div>
                                )}
                              </div>
                              <div
                                className={classes.sendload_percent}
                                style={{ top: "40%", left: "15%" }}
                              >
                                {message.uploadProgress ??
                                  message.downloadProgress}
                                %
                              </div>
                            </div>
                          ) : null}
                        </div>

                        {/* RIGHT SIDE (player or info) */}

                        <div
                          style={{
                            width: "100%",
                            marginTop: 5,
                            paddingLeft: 20,
                          }}
                        >
                          <div className={classes.file_name}>
                            {message.filename}
                          </div>

                          <div
                            className={classes.file_size}
                            style={{ paddingBottom: 5 }}
                          >
                            {formatFileSize(message.filesize)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activelist === "Photos" && (
            <div className={classes.containerofnavigation}>
              {imageMessages.length === 0 ? (
                <div className={classes.emptyMessagesfornav}>
                  <p>No Media message yet!</p>
                </div>
              ) : (
                <div className={classes.innercontainernav}>
                  {imageMessages.map((message) => (
                    <div
                      className={classes.messageContainernav}
                      key={message.id}
                      onClick={() => handleImageClick(message)}
                    >
                      <img src={message.fileUrl} alt="" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activelist === "Files" && (
            <div className={classes.containerofnavfile}>
              {audioMessages.length === 0 ? (
                <div className={classes.emptyMessagesfornav}>
                  <p>No File message yet!</p>
                </div>
              ) : (
                <div className={classes.innerfilenav}>
                  {fileMessages.map((message) => {
                    const isDownloading = message.isDownloading ?? false;
                    const isDownloaded = message.isDownloaded ?? false;
                    const isPaused = message.isPaused ?? false;
                    return (
                      <div className={classes.insidefile_containerforprofile}>
                        <div style={{ position: "relative", height: "50px" }}>
                          {!isDownloaded && !isDownloading && !isPaused && (
                            <div
                              onClick={() => downloadFile(message)}
                              style={{ position: "relative" }}
                            >
                              <svg width="50" height="50" viewBox="0 0 50 50">
                                <circle
                                  cx="25"
                                  cy="25"
                                  r="22"
                                  fill="rgba(44, 44, 44, 0.2)"
                                  strokeWidth="4"
                                />
                              </svg>
                              <div className={classes.download_icon}>⬇</div>
                            </div>
                          )}

                          {isDownloading || isPaused ? (
                            <div className={classes.sendload_container}>
                              <SpinnerWrapper
                                progress={message.downloadProgress}
                                // onCancel={onCancel}
                              />
                              {!isPaused ? (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    cancelDownload(message.id, message);
                                  }}
                                  className={classes.cancel_button}
                                >
                                  ×
                                </div>
                              ) : (
                                <div
                                  onClick={() => downloadFile(message)}
                                  className={classes.cancel_button}
                                  style={{
                                    fontSize: "25px",
                                    marginTop: 12,
                                    marginLeft: 16,
                                  }}
                                >
                                  ▶
                                </div>
                              )}

                              <div className={classes.sendload_percent}>
                                {message.downloadProgress}%
                              </div>
                            </div>
                          ) : null}

                          {isDownloaded && !isDownloading && (
                            <div
                              onClick={() => handleOpen(message)}
                              className={classes.file_icon}
                            >
                              {message.message_type === "video" ? "🎬" : "📄"}
                            </div>
                          )}
                        </div>

                        <div style={{ flex: 1 }}>
                          <div className={classes.file_name}>
                            {message.filename}
                          </div>

                          <div className={classes.file_size}>
                            {formatFileSize(message.filesize)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {selectedImage && (
            <div
              className={classes.fullscreenOverlay}
              onClick={() => setSelectedImage(null)}
            >
              <img
                src={selectedImage}
                alt="preview"
                className={classes.fullscreenImage}
              />
            </div>
          )}

          {selectedVideo && (
            <div
              className={classes.videoModal}
              onClick={() => setSelectedVideo(null)}
            >
              <video src={selectedVideo} controls autoPlay />
            </div>
          )}
        </div>

        {/* chat header  */}

        <div className={classes.chatHeader}>
          <label
            className={classes.avatarWrapper}
            onClick={handleotherprofiledetail}
          >
            {conversation.avatar_url ? (
              <img
                src={`http://localhost:5500${conversation.avatar_url}`}
                alt="avatar"
                className={classes.avatar}
              />
            ) : (
              <IoMdPerson className={classes.defaultAvatarIcon} />
            )}
          </label>

          <div
            className={classes.chatHeaderInfo}
            onClick={handleotherprofiledetail}
          >
            <h3>{conversation.other_username}</h3>
            <p className={classes.status}>{otherUser?.status || "offline"}</p>
            {/* <p>Private conversation</p> */}
          </div>

          <div className={classes.chatHeaderActions}>
            <button
              className={classes.closeButton}
              onClick={onClose}
              title="Close Chat"
            >
              <IoMdClose />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className={classes.messagesArea}
        >
          <div className={classes.messagesInner}>
            {messages?.length === 0 ? (
              <div className={classes.emptyMessages}>
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages?.map((message) => (
                <MessageRenderer
                  key={message.id || message.tempId}
                  message={message}
                  onDownloadClick={() => downloadFile(message)}
                  user={user}
                  chatContainerRef={chatContainerRef}
                  handleMediaLoad={handleMediaLoad}
                  onCancel={() => cancelDownload(message.id, message)}
                />
              ))
            )}
          </div>
        </div>
        {!isAtBottom && (unreadCount[conversation.other_user_id] || 0) > 0 && (
          <button
            onClick={() => {
              chatContainerRef.current.scrollTop =
                chatContainerRef.current.scrollHeight;
              setUnreadCount((prev) => ({
                ...prev,
                [conversation.other_user_id]: 0,
              }));
            }}
            className={classes.newMessageBadge}
          >
            🔔 {unreadCount[conversation.other_user_id] || 0} new{" "}
            {(unreadCount[conversation.other_user_id] || 0) > 1
              ? "messages"
              : "message"}
          </button>
        )}
        {/* Message Input */}
        <form className={classes.messageInput} onSubmit={handleSendMessage}>
          {/* Left side: Emoji button */}
          <button type="button" className={classes.iconButton}>
            <img src="../../public/happiness.png" alt="" />
          </button>
          <textarea
            type="text"
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onInput={handleInput}
            // placeholder="Type your message..."
            className={classes.messageInputField}
          />

          <label className={classes.iconButton}>
            <input
              type="file"
              hidden
              accept="*/*"
              onChange={handleFileSelect}
              multiple
            />
            <span>
              <FiPaperclip />
            </span>
          </label>

          <button
            type="submit"
            className={classes.sendButton}
            disabled={!newMessage.trim()}
          >
            {/* <img src="../../public/paper-plane.png" alt="" /> */}
          </button>
        </form>
      </div>
    </>
  );
};

// console.log("MessageRenderer init");

export default PrivateChat;
// console.log("MessageRenderer init");
