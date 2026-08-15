import React, { useState, useRef, useEffect } from "react";
import { useChatContext } from "../context/ChatContext";
import profileSidebarClasses from "../pages/styling/profileSidebar.module.css";
import { getAuthenticatedFileUrl } from "../utils/mediaUtils";

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.split(" ").filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export const OtherProfileSidebar = ({
  conversation,
  otherUser,
  showotherprofile,
  handleotherprofiledetail,
  downloadFile,
  cancelDownload,
  handleOpen,
}) => {
  const { messages } = useChatContext();
  const [enlargeProfileImage, setEnlargeProfileImage] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);

  const profileScrollRef = useRef(null);
  const lastScrollTop = useRef(0);

  useEffect(() => {
    const container = profileScrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentScroll = container.scrollTop;
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

  const imageMessages = messages?.filter((m) => m.message_type === "image") || [];
  const videoMessages = messages?.filter((m) => m.message_type === "video" && m.aspect_ratio < 2) || [];
  const audioMessages = messages?.filter((m) => m.message_type === "audio") || [];
  const fileMessages = messages?.filter((m) => m.message_type === "file" || (m.message_type === "video" && m.aspect_ratio >= 2)) || [];

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const handleVideoClick = (message) => {
    setSelectedVideo(message.fileUrl || getAuthenticatedFileUrl(message));
  };

  return (
    <div
      className={`${profileSidebarClasses.profileSidebar} ${!showotherprofile ? "hidden" : ""}`}
      style={{ display: showotherprofile ? "flex" : "none" }}
    >
      {/* Header */}
      <div className={profileSidebarClasses.sidebarHeader}>
        <span className={profileSidebarClasses.headerTitle}>Profile</span>
        <button
          className={profileSidebarClasses.closeButton}
          onClick={handleotherprofiledetail}
          title="Close Profile View"
        >
          <i className="ti ti-x"></i>
        </button>
      </div>

      {/* Profile Section */}
      <div className={profileSidebarClasses.profileInfo}>
        <div 
          className={profileSidebarClasses.profileAvatar}
          style={{ cursor: conversation.avatar_url ? "pointer" : "default" }}
          onClick={() => {
            if (conversation.avatar_url) setEnlargeProfileImage(true);
          }}
        >
          {conversation.avatar_url ? (
            <img
              src={conversation.avatar_url}
              alt=""
              style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            getInitials(conversation.other_username)
          )}
        </div>

        <h3 className={profileSidebarClasses.profileName}>{conversation.other_username}</h3>
        <p className={profileSidebarClasses.profileTitle}>
          {conversation.department || "Instructor · CS Dept."}
        </p>

        {/* Status Pill */}
        <div className={profileSidebarClasses.statusPill}>
          <span className={profileSidebarClasses.statusDot}></span>
          <span className={profileSidebarClasses.statusText}>
            {otherUser?.status === "online" ? "Online" : "Offline"}
          </span>
        </div>

        {/* Action Buttons Row */}
        <div className={profileSidebarClasses.actionsRow}>
          <button className={`${profileSidebarClasses.actionBtn} ${profileSidebarClasses.btnPlum}`} title="Call">
            <i className="ti ti-phone"></i>
          </button>
          <button className={`${profileSidebarClasses.actionBtn} ${profileSidebarClasses.btnMagenta}`} title="Video Call">
            <i className="ti ti-video"></i>
          </button>
          <button className={`${profileSidebarClasses.actionBtn} ${profileSidebarClasses.btnPale}`} title="More">
            <i className="ti ti-dots"></i>
          </button>
        </div>
      </div>

      {/* Shared Files Section */}
      <div className={profileSidebarClasses.sharedSection}>
        <h4 className={profileSidebarClasses.sectionLabel}>Shared Files</h4>
        {fileMessages.length === 0 && audioMessages.length === 0 ? (
          <p style={{ fontSize: '11px', color: 'var(--plum-lt)', margin: 0 }}>No files shared yet</p>
        ) : (
          <div className={profileSidebarClasses.fileList}>
            {[...fileMessages, ...audioMessages].slice(0, 3).map((msg, idx) => {
              const colors = [profileSidebarClasses.bgMagenta, profileSidebarClasses.bgPlum, profileSidebarClasses.bgBlue];
              const bgClass = colors[idx % 3];
              return (
                <div
                  key={msg.id || msg.tempId}
                  className={profileSidebarClasses.fileRow}
                  style={{ cursor: "pointer" }}
                  onClick={() => window.open(msg.fileUrl || getAuthenticatedFileUrl(msg), "_blank")}
                >
                  <div className={`${profileSidebarClasses.fileIconBox} ${bgClass}`}>
                    {msg.message_type === "audio" ? (
                      <i className="ti ti-music"></i>
                    ) : msg.message_type === "video" ? (
                      <i className="ti ti-video"></i>
                    ) : (
                      <i className="ti ti-file-text"></i>
                    )}
                  </div>
                  <div className={profileSidebarClasses.fileInfo}>
                    <span className={profileSidebarClasses.fileName}>{msg.filename}</span>
                    <span className={profileSidebarClasses.fileMeta}>
                      Today · {formatFileSize(msg.filesize)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Shared Media Section */}
      <div className={profileSidebarClasses.sharedSection}>
        <h4 className={profileSidebarClasses.sectionLabel}>Shared Media</h4>
        {imageMessages.length === 0 && videoMessages.length === 0 ? (
          <p style={{ fontSize: '11px', color: 'var(--plum-lt)', margin: 0 }}>No media shared yet</p>
        ) : (
          <div className={profileSidebarClasses.mediaGrid}>
            {[...imageMessages, ...videoMessages].slice(0, 6).map((msg, idx) => {
              // Exact opacities/background colors from the spec
              const styles = [
                { backgroundColor: "#D4B8CE" },
                { backgroundColor: "#ECDCE9" },
                { backgroundColor: "#91006C", opacity: 0.35 },
                { backgroundColor: "#4A335D", opacity: 0.30 },
                { backgroundColor: "#D4B8CE", opacity: 0.70 },
                { backgroundColor: "#7B5E94", opacity: 0.40 }
              ];
              const gridStyle = styles[idx % styles.length];
              return (
                <div
                  key={msg.id || msg.tempId}
                  className={profileSidebarClasses.mediaThumb}
                  style={{ 
                    ...gridStyle, 
                    cursor: "pointer", 
                    backgroundImage: `url(${msg.fileUrl || msg.preview || msg.fileurl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                  onClick={() =>
                    msg.message_type === "video"
                      ? handleVideoClick(msg)
                      : setSelectedImage(msg.fileUrl || msg.preview || msg.fileurl)
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Notifications Box */}
      <div className={profileSidebarClasses.notificationBox}>
        <span className={profileSidebarClasses.bellIcon}>
          <i className="ti ti-bell"></i>
        </span>
        <div className={profileSidebarClasses.notificationText}>
          <span className={profileSidebarClasses.notificationLabel}>Notifications on</span>
          <span className={profileSidebarClasses.notificationDesc}>All messages</span>
        </div>
      </div>

      {/* Full Screen Image Modal */}
      {selectedImage && (
        <div
          style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px'}}
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Full screen"
            style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain'}}
          />
        </div>
      )}

      {/* Full Screen Video Modal */}
      {selectedVideo && (
        <div
          style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px'}}
          onClick={() => setSelectedVideo(null)}
        >
          <div
            style={{position: 'relative', width: '80%', height: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={{position: 'absolute', top: -40, right: -40, background: 'none', border: 'none', color: 'white', fontSize: 32, cursor: 'pointer'}}
              onClick={() => setSelectedVideo(null)}
            >
              <i className="ti ti-x"></i>
            </button>
            <video
              src={selectedVideo}
              controls
              autoPlay
              style={{maxWidth: '100%', maxHeight: '100%'}}
            />
          </div>
        </div>
      )}

      {/* Enlarged Profile Image Modal */}
      {enlargeProfileImage && conversation.avatar_url && (
        <div
          style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px'}}
          onClick={() => setEnlargeProfileImage(false)}
        >
          <img
            src={conversation.avatar_url}
            alt="Profile full screen"
            style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain'}}
          />
        </div>
      )}
    </div>
  );
};

export default OtherProfileSidebar;
