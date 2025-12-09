import React, {
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

import { IoMdSend, IoMdClose } from "react-icons/io";

// import { showErrorAlert } from "./alerthelper";
import classes from "../pages/styling/chat.module.css";

// import { PrivateChatStorage } from "../db/dexieDB.js";
import {
  TextMessage,
  ImageMessage,
  VideoMessage,
  FileMessage,
  AudioMessage,
  createVideoThumbnail,
  createImageThumbnail,
  createVideoThumbnailpreview,
  createImageThumbnailpreview,
  getVideoDuration,
} from "./Thumbnail.jsx";

const PrivateChat = ({
  conversation,
  onClose,
  messages,
  setMessages,
  atBottomRef,
  pendingAutoScrollRef,
  hydratedChatsRef,
  pendingMessagesRef,
  resendPendingMessage,
  replaceCache,
  setUnreadCount,
  unreadCount,
  savedScroll,
  onSaveScroll,
  offset,
  setoffset,
  sendFileToServer,
}) => {
  const { user } = useContext(Appstate);
  // const { cryptoKey } = useContext(CryptoContext);

  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(!messages || messages.length === 0);
  // const [loadedConversations, setLoadedConversations] = useState({});
  // const [restoringScroll, setRestoringScroll] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // console.log(savedScroll);
  const seenMessagesRef = useRef(new Set());
  const textareaRef = useRef(null);
  const chatContainerRef = useRef(null);
  const scrollRestoreRef = useRef(null);
  const observerRef = useRef(null);
  const waitingForInitialImagesRef = useRef(false);
  const loadedImageIdsRef = useRef(new Set());
  const imageLoadTimeoutRef = useRef(null);
  const isInitialLoadRef = useRef(true); // Track if this is the very first load
  const [imagesToLoad, setImagesToLoad] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const socket = useSocket();

  // console.log(messages);

  const mergeUniqueById = (arr, prev = []) => {
    const validArr = arr.filter(
      (m) => m && (m.content || m.preview || m.fileurl)
    );
    const validPrev = prev.filter(
      (m) => m && (m.content || m.preview || m.fileurl)
    );

    const map = new Map(validPrev.map((m) => [m.id || m.tempId, m]));
    validArr.forEach((m) => map.set(m.id || m.tempId, m));
    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(a.delivered_at || a.created_at) -
        new Date(b.delivered_at || b.created_at)
    );
  };

  const generateTempId = () => {
    return `temp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  };

  useEffect(() => {
    if (!socket || !user?.userid || !conversation?.other_user_id) return;

    setLoading(true);
    // fetchMessages();
    if (!hydratedChatsRef.current[conversation.other_user_id]) {
      // This is the first time opening this chat - mark as initial load
      isInitialLoadRef.current = true;
      // syncreadmessages();
      fetchMessages();
      // pendingsyncdexie();
      hydratedChatsRef.current[conversation.other_user_id] = true;
    } else {
      // User is returning to this chat - not initial load
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
    return () => {
      // window.removeEventListener("online", handleOnlineforsync);
    };
  }, [socket, user?.userid, conversation.other_user_id]);

  useEffect(() => {
    if (!conversation?.other_user_id) return;
    replaceCache(conversation.other_user_id, messages);
  }, [messages, conversation?.other_user_id]);

  useEffect(() => {
    const mediaMessages = messages.filter(
      (m) => m.message_type !== "text" && !m.fileUrl
    );
    // console.log(mediaMessages);
    mediaMessages.forEach((msg) => downloadFile(msg));
  }, [messages]);

  useEffect(() => {
    if (!messages) return;

    // Count ALL image messages, regardless of whether they have fileUrl/preview
    // Images without fileUrl will be downloaded first, then rendered
    const imageMessages = messages.filter((m) => {
      // Must be an image type
      if (m?.message_type === "image") return true;

      // Or check file extension
      const path = m?.fileurl || m?.fileUrl || "";
      if (!path) return false;
      const lower = path.toLowerCase();
      return (
        lower.includes(".jpg") ||
        lower.includes(".jpeg") ||
        lower.includes(".png") ||
        lower.includes(".gif") ||
        lower.includes(".webp")
      );
    });

    const count = imageMessages.length;
    setImagesToLoad(count);

    // Get current image IDs (all image messages, not just rendered ones)
    const currentImageIds = new Set(imageMessages.map((m) => m.id || m.tempId));

    // Clean up loadedImageIdsRef to only include current images
    const validLoadedIds = Array.from(loadedImageIdsRef.current).filter((id) =>
      currentImageIds.has(id)
    );
    loadedImageIdsRef.current = new Set(validLoadedIds);

    const loadedCount = validLoadedIds.length;
    setImagesLoaded(loadedCount);

    // Clear any existing timeout
    if (imageLoadTimeoutRef.current) {
      clearTimeout(imageLoadTimeoutRef.current);
      imageLoadTimeoutRef.current = null;
    }

    // If there are unloaded images, wait for them to load before scrolling
    // BUT only if this is a true initial load (first time opening this chat)
    // If user is returning to chat (savedScroll exists), don't wait - just restore their position
    if (count > 0 && count > loadedCount) {
      // Only wait for images on true initial load, not when returning to chat
      if (isInitialLoadRef.current) {
        waitingForInitialImagesRef.current = true;
        // Fallback: if images don't load within 3 seconds (maybe cached or error), scroll anyway
        imageLoadTimeoutRef.current = setTimeout(() => {
          if (waitingForInitialImagesRef.current) {
            waitingForInitialImagesRef.current = false;
            // Always scroll on initial load OR if pending auto scroll
            if (isInitialLoadRef.current || pendingAutoScrollRef.current) {
              scrollToBottom(true);
              if (isInitialLoadRef.current) {
                isInitialLoadRef.current = false;
              }
              if (pendingAutoScrollRef.current) {
                pendingAutoScrollRef.current = false;
                setUnreadCount((prev) => ({
                  ...prev,
                  [conversation.other_user_id]: 0,
                }));
              }
            }
          }
        }, 3000);
      } else {
        // User is returning - don't wait for images, just restore their position
        waitingForInitialImagesRef.current = false;
      }
    } else if (count === 0) {
      // No images, scroll immediately (only on initial load)
      waitingForInitialImagesRef.current = false;
      // Always scroll on initial load, regardless of savedScroll
      if (isInitialLoadRef.current) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            const container = chatContainerRef.current;
            if (container) {
              container.scrollTop = container.scrollHeight;
              atBottomRef.current = true;
              setIsAtBottom(true);
              isInitialLoadRef.current = false;
            }
          }, 200);
        });
      }
    } else if (count === loadedCount && count > 0) {
      // All images already loaded
      waitingForInitialImagesRef.current = false;
      // Scroll on initial load (only if not returning) OR if pending auto scroll
      if (
        pendingAutoScrollRef.current ||
        (isInitialLoadRef.current && savedScroll === null)
      ) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            const container = chatContainerRef.current;
            if (container) {
              container.scrollTop = container.scrollHeight;
              const { scrollTop, scrollHeight, clientHeight } = container;
              const atBottom =
                Math.abs(scrollHeight - scrollTop - clientHeight) < 5;
              atBottomRef.current = atBottom;
              setIsAtBottom(atBottom);

              if (isInitialLoadRef.current) {
                isInitialLoadRef.current = false;
              }
              if (pendingAutoScrollRef.current) {
                pendingAutoScrollRef.current = false;
                setUnreadCount((prev) => ({
                  ...prev,
                  [conversation.other_user_id]: 0,
                }));
              }
            }
          }, 200);
        });
      }
    }

    return () => {
      if (imageLoadTimeoutRef.current) {
        clearTimeout(imageLoadTimeoutRef.current);
      }
    };
  }, [messages, savedScroll]);

  useLayoutEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const updateAtBottomFlag = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const atBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 5;
      atBottomRef.current = atBottom;
    };

    // on prepended older messages, maintain the user's viewport.
    if (scrollRestoreRef.current) {
      const { prevHeight } = scrollRestoreRef.current;
      const delta = container.scrollHeight - prevHeight;
      container.scrollTop += delta; // keep the same messages at same place

      scrollRestoreRef.current = null;
      updateAtBottomFlag();
      return;
    }

    // If user is returning to chat (savedScroll exists), restore position immediately
    // BUT if pendingAutoScroll is set, that means a new message arrived - scroll to bottom instead
    if (savedScroll !== null) {
      if (pendingAutoScrollRef.current) {
        // New message arrived while user was away - scroll to bottom
        container.scrollTop = container.scrollHeight;
        pendingAutoScrollRef.current = false;
        updateAtBottomFlag();
        setUnreadCount((prev) => ({
          ...prev,
          [conversation.other_user_id]: 0,
        }));
        return;
      } else {
        // User is returning - restore their saved position
        container.scrollTop = savedScroll;
        updateAtBottomFlag();
        return;
      }
    }

    // Don't scroll if we're waiting for images to load on initial load
    if (waitingForInitialImagesRef.current && imagesLoaded < imagesToLoad) {
      updateAtBottomFlag();
      return;
    }

    // If we were waiting and now all images are loaded, ensure we scroll
    // BUT only if this is a true initial load (savedScroll is null), not when returning
    if (
      waitingForInitialImagesRef.current &&
      imagesLoaded === imagesToLoad &&
      imagesToLoad > 0
    ) {
      // Only scroll on true initial load (savedScroll is null)
      // If savedScroll exists, user is returning - don't scroll
      if (savedScroll === null && isInitialLoadRef.current) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            container.scrollTop = container.scrollHeight;
            updateAtBottomFlag();
            // Mark initial load as complete
            isInitialLoadRef.current = false;
            if (pendingAutoScrollRef.current) {
              pendingAutoScrollRef.current = false;
              setUnreadCount((prev) => ({
                ...prev,
                [conversation.other_user_id]: 0,
              }));
            }
          }, 200);
        });
      }
      return;
    }

    // If no images and initial load, scroll to bottom (only if not returning)
    if (
      imagesToLoad === 0 &&
      isInitialLoadRef.current &&
      savedScroll === null
    ) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          container.scrollTop = container.scrollHeight;
          updateAtBottomFlag();
          isInitialLoadRef.current = false;
        }, 200);
      });
      return;
    }

    // Handle pending auto scroll (for new messages when user is at bottom)
    // BUT only if there are no images waiting to load
    // If images are loading, wait for them to finish (they'll trigger scroll in handleMediaLoad)
    if (pendingAutoScrollRef.current && imagesToLoad === 0) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          container.scrollTop = container.scrollHeight;
          updateAtBottomFlag();
          pendingAutoScrollRef.current = false;
          setUnreadCount((prev) => ({
            ...prev,
            [conversation.other_user_id]: 0,
          }));
        }, 200);
      });
      return;
    }

    // If pendingAutoScroll is set but images are loading, don't scroll yet
    // The scroll will happen in handleMediaLoad when images finish
    if (
      pendingAutoScrollRef.current &&
      imagesToLoad > 0 &&
      imagesLoaded < imagesToLoad
    ) {
      return;
    }
  }, [
    messages,
    conversation?.other_user_id,
    savedScroll,
    setUnreadCount,
    imagesLoaded,
    imagesToLoad,
  ]);

  // Intersection observer for read receipts

  useEffect(() => {
    if (!chatContainerRef.current) return;
    const container = chatContainerRef.current;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      async (entries) => {
        entries.forEach(async (entry) => {
          if (entry.isIntersecting) {
            const messageId = entry.target.dataset.id;
            const message = messages.find((m) => m.id === messageId);
            if (
              message &&
              !message.is_read &&
              message.receiver_id === user.userid
            ) {
              // Update backend
              try {
                // console.log("📡 Marking message read:", message.id);
                await axiosbase.put(`/messages/read/private/${message.id}`);
                // Update locally
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === message.id ? { ...m, is_read: true } : m
                  )
                );
                // Decrease unread counter for this conversation
                setUnreadCount((prev) => ({
                  ...prev,
                  [conversation.other_user_id]: Math.max(
                    (prev[conversation.other_user_id] || 1) - 1,
                    0
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
      { root: container, threshold: 0.8 }
    ); // 80% visible

    const observeAllMessages = () => {
      const nodes = container.querySelectorAll(
        "[data-id]:not([data-observed])"
      );
      nodes.forEach((node) => {
        observerRef.current.observe(node);
        node.setAttribute("data-observed", "true");
      });
    };
    const timeoutId = setTimeout(observeAllMessages, 50);

    // Scroll listener to ensure new messages are observed if user scrolls
    const onScroll = () => observeAllMessages();
    container.addEventListener("scroll", onScroll);

    return () => {
      clearTimeout(timeoutId);
      observerRef.current.disconnect();
      container.removeEventListener("scroll", onScroll);
    };
  }, [messages, user.userid, conversation.other_user_id]);

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
        }`
      );

      if (initial) {
        setMessages((prev) => mergeUniqueById([...response.data, ...prev]));
        pendingAutoScrollRef.current = true;
      } else if (prepend) {
        if (response.data.length === 0) return;
        const container = chatContainerRef.current;
        const prevHeight = container.scrollHeight;
        setMessages((prev) => mergeUniqueById([...response.data, ...prev]));
        scrollRestoreRef.current = { prevHeight };
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
      optimisticMessage
    );
    setNewMessage("");
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

  const scrollToBottom = (smooth = false) => {
    const root = chatContainerRef.current;
    if (!root) return;

    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      if (!root) return;
      root.scrollTop = root.scrollHeight;
      // Also update the atBottom flag
      const { scrollTop, scrollHeight, clientHeight } = root;
      const atBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 5;
      atBottomRef.current = atBottom;
      setIsAtBottom(atBottom);
    });
  };

  const handleMediaLoad = (id, isSender) => {
    // Skip if this image was already loaded
    if (loadedImageIdsRef.current.has(id)) {
      return;
    }

    loadedImageIdsRef.current.add(id);

    setImagesLoaded((prev) => {
      const newCount = prev + 1;

      // For sender, ALWAYS scroll to bottom when their image loads
      // This ensures sender sees their sent image immediately
      if (isSender) {
        // Use multiple attempts to ensure scroll happens
        requestAnimationFrame(() => {
          setTimeout(() => {
            const container = chatContainerRef.current;
            if (container) {
              container.scrollTop = container.scrollHeight;
              atBottomRef.current = true;
              setIsAtBottom(true);
            }
          }, 200);
        });
      }

      // Scroll when all images/videos are loaded
      if (newCount === imagesToLoad && imagesToLoad > 0) {
        const wasWaitingForInitial = waitingForInitialImagesRef.current;
        waitingForInitialImagesRef.current = false;

        // Check current scroll position to see if user is at bottom
        const container = chatContainerRef.current;
        let isCurrentlyAtBottom = false;
        if (container) {
          const { scrollTop, scrollHeight, clientHeight } = container;
          isCurrentlyAtBottom =
            Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
        }

        // Scroll if:
        // 1. pendingAutoScroll is set (new message arrived and user was at bottom) - HIGHEST PRIORITY
        // 2. OR It's the initial load (was waiting for images on first open) AND no savedScroll
        // 3. OR user is currently at the bottom (new message arrived while at bottom)
        // Note: pendingAutoScroll ALWAYS triggers scroll - this handles receiver at bottom case
        const shouldScroll =
          pendingAutoScrollRef.current ||
          (wasWaitingForInitial &&
            isInitialLoadRef.current &&
            savedScroll === null) ||
          isCurrentlyAtBottom;

        if (shouldScroll) {
          // Use requestAnimationFrame and setTimeout to ensure DOM is fully updated
          requestAnimationFrame(() => {
            setTimeout(() => {
              const container = chatContainerRef.current;
              if (container) {
                container.scrollTop = container.scrollHeight;
                const { scrollTop, scrollHeight, clientHeight } = container;
                const atBottom =
                  Math.abs(scrollHeight - scrollTop - clientHeight) < 5;
                atBottomRef.current = atBottom;
                setIsAtBottom(atBottom);

                // Mark initial load as complete
                if (wasWaitingForInitial && isInitialLoadRef.current) {
                  isInitialLoadRef.current = false;
                }
                // Clear pending auto scroll
                if (pendingAutoScrollRef.current) {
                  pendingAutoScrollRef.current = false;
                  setUnreadCount((prev) => ({
                    ...prev,
                    [conversation.other_user_id]: 0,
                  }));
                }
              }
            }, 200);
          });
        }
      }

      return newCount;
    });
  };

  const MessageRenderer = ({ message, onDownloadClick, chatContainerRef }) => {
    const ts =
      message.delivered_at || message.created_at || new Date().toISOString();

    const ageMs = Date.now() - new Date(ts).getTime();

    const isOptimistic = String(message.tempId || "").startsWith("temp-");
    const isRecent = ageMs >= 0 && ageMs < 5_000; // 5s window for "new" messages
    const messageId = message.id || message.tempId;
    const isSender = message.sender_id === user.userid;

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
            onLoad={() =>
              handleMediaLoad(message.id || message.tempId, isSender)
            }
            atBottomRef={atBottomRef}
            pendingAutoScrollRef={pendingAutoScrollRef}
            isRecent={isRecent}
            isOptimistic={isOptimistic}
          />
        );

      case "video":
        return (
          <VideoMessage
            message={message}
            onDownloadClick={onDownloadClick}
            user={user}
            chatContainerRef={chatContainerRef}
          />
        );

      case "audio":
        return (
          <AudioMessage
            message={message}
            onDownloadClick={onDownloadClick}
            user={user}
            chatContainerRef={chatContainerRef}
          />
        );
      default:
        return (
          <FileMessage
            message={message}
            onDownloadClick={onDownloadClick}
            user={user}
            chatContainerRef={chatContainerRef}
          />
        );
    }
  };

  const downloadFile = async (message) => {
    try {
      // choose an identifier that your server understands
      const fileIdentifier = message.id;
      if (!fileIdentifier) {
        console.error("No file identifier to download");
        return;
      }

      // request URL - adapt to your backend route
      const downloadUrl = `/messages/file/download/${fileIdentifier}`;

      // mark progress start
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id ? { ...m, downloadProgress: 0 } : m
        )
      );

      const response = await axiosbase.get(downloadUrl, {
        headers: {
          Range: "bytes=0-",
        },
        responseType: "blob",
        onDownloadProgress: (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          setMessages((prev) =>
            prev.map((m) =>
              m.id === message.id ? { ...m, downloadProgress: percent } : m
            )
          );
        },
      });

      const blob = response.data;
      const blobUrl = URL.createObjectURL(blob);

      // update message (store fileUrl so UI uses it)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? {
                ...m,
                fileUrl: blobUrl,
                downloadProgress: 100,
              }
            : m
        )
      );
    } catch (err) {
      console.error("Download failed", err);
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
            file,
            preview,
            fileurl,
            uploadProgress: 0,
            downloadProgress: -1,
          };
        } else if (messageType === "video") {
          // Only optimistic render for short videos (<30s)
          const videoDuration = await getVideoDuration(file);
          if (videoDuration <= 30) {
            preview = await createVideoThumbnail(file, 0.5, 360, 200);
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
              preview,
              uploadProgress: 0,
              downloadProgress: -1,
            };
          }
        } else {
          // Other files: no optimistic UI
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
            downloadProgress: -1,
          };
        }
      } catch (err) {
        console.warn("Preview generation failed", err);
      }

      // Add optimistic message if it exists
      if (optimisticMessage) {
        setMessages((prev) => [...prev, optimisticMessage]);
        pendingAutoScrollRef.current = true;
        if (!pendingMessagesRef.current[conversation.other_user_id]) {
          pendingMessagesRef.current[conversation.other_user_id] = [];
        }
        pendingMessagesRef.current[conversation.other_user_id].push(
          optimisticMessage
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
        console.warn("File upload pending:", file.name);
      }
    }

    e.target.value = ""; // reset input
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
    <div className={classes.privateChatContainer}>
      {/* Chat Header */}
      <div className={classes.chatHeader}>
        <div className={classes.chatHeaderInfo}>
          <h3>{conversation.other_username}</h3>
          <p>Private conversation</p>
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
        style={{ paddingBottom: "0px", position: "relative", height: "100%" }}
      >
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
            />
          ))
        )}
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
          placeholder="Type your message..."
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
          <span class="material-symbols-outlined">attach_file</span>
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
  );
};

export default PrivateChat;
