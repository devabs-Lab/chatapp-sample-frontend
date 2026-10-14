import React from "react";
import { getAuthenticatedFileUrl } from "../utils/mediaUtils";
import m from "../pages/styling/mobile.module.css";

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.split(" ").filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const formatLastSeen = (value) => {
  if (!value) return "Offline";
  const seen = new Date(value);
  if (Number.isNaN(seen.getTime())) return "Offline";

  const diffMin = Math.floor((Date.now() - seen.getTime()) / 60000);
  if (diffMin < 1) return "Last seen just now";
  if (diffMin < 60) return `Last seen ${diffMin}m ago`;
  if (diffMin < 60 * 24) return `Last seen ${Math.floor(diffMin / 60)}h ago`;

  return `Last seen ${seen.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
};

/* Shared-media tile styling per message type */
const tileFor = (message) => {
  switch (message.message_type) {
    case "image":
      return { cls: m.tileImage, icon: "ti-photo", label: "IMG" };
    case "video":
      return { cls: m.tileVideo, icon: "ti-video", label: "MP4" };
    case "audio":
      return { cls: m.tileAudio, icon: "ti-music", label: "MP3" };
    default: {
      const name = (message.filename || "").toLowerCase();
      if (name.endsWith(".pdf"))
        return { cls: m.tilePdf, icon: "ti-file-text", label: "PDF" };
      if (name.endsWith(".ppt") || name.endsWith(".pptx"))
        return { cls: m.tileSlide, icon: "ti-presentation", label: "PPT" };
      return { cls: m.tileDoc, icon: "ti-file", label: "DOC" };
    }
  }
};

/**
 * Read-only profile screen used on mobile.
 * Shows another user when `isSelf` is false, otherwise the signed-in user.
 */
const ContactInfo = ({
  person,
  isSelf = false,
  onBack,
  onMessage,
  onCall,
  onVideo,
  onMore,
  onEdit,
  onOpenMedia,
  /* Messages of the open conversation; used for the shared-media grid. */
  messages = [],
}) => {
  if (!person) return null;

  const name = person.username || person.other_username || "Unknown";
  const isOnline = person.status === "online";

  /* Only a real conversation has shared media worth listing. */
  const sharedMedia = isSelf
    ? []
    : (messages || [])
        .filter((msg) => msg.message_type && msg.message_type !== "text")
        .slice(-9)
        .reverse();

  /* The bio reads as the hero subtitle, so it is not repeated below. */
  const subtitle = person.bio || person.department || "";

  const aboutRows = [
    person.department && {
      icon: "ti-building",
      label: "Department",
      value: person.department,
    },
    person.phone && {
      icon: "ti-phone",
      label: "Phone",
      value: person.phone,
    },
    !isSelf && {
      icon: "ti-clock",
      label: "Status",
      value: isOnline ? "Online now" : formatLastSeen(person.last_seen),
    },
  ].filter(Boolean);

  return (
    <div className={m.profileScreen}>
      {/* magenta hero */}
      <div className={m.profileHero}>
        {onBack && (
          <button className={m.heroBack} onClick={onBack} aria-label="Back">
            <i className="ti ti-arrow-left"></i>
          </button>
        )}

        {isSelf && onEdit && (
          <button className={m.heroEdit} onClick={onEdit} aria-label="Edit profile">
            <i className="ti ti-pencil"></i>
          </button>
        )}

        <div className={m.heroAvatar}>
          {person.avatar_url ? (
            <img src={person.avatar_url} alt={name} />
          ) : (
            getInitials(name)
          )}
        </div>

        <h2 className={m.heroName}>{name}</h2>

        {subtitle && <p className={m.heroSubtitle}>{subtitle}</p>}

        {!isSelf && (
          <div className={m.heroStatus}>
            <span
              className={`${m.heroStatusDot} ${isOnline ? "" : m.offline}`}
            ></span>
            {isOnline ? "Online now" : formatLastSeen(person.last_seen)}
          </div>
        )}

        <div className={m.heroActions}>
          {!isSelf && (
            <button className={m.heroAction} onClick={onMessage}>
              <span className={m.heroActionIcon}>
                <i className="ti ti-message-circle"></i>
              </span>
              Message
            </button>
          )}

          <button className={m.heroAction} onClick={onCall}>
            <span className={m.heroActionIcon}>
              <i className="ti ti-phone"></i>
            </span>
            Call
          </button>

          <button className={m.heroAction} onClick={onVideo}>
            <span className={m.heroActionIcon}>
              <i className="ti ti-video"></i>
            </span>
            Video
          </button>

          <button className={m.heroAction} onClick={onMore}>
            <span className={m.heroActionIcon}>
              <i className="ti ti-dots"></i>
            </span>
            More
          </button>
        </div>
      </div>

      {/* About */}
      <h3 className={m.sectionLabel}>About</h3>

      {aboutRows.length === 0 ? (
        <p className={m.emptyInline}>
          {isSelf
            ? "Add a bio, department and phone number so people know who you are."
            : "This user hasn't added any details yet."}
        </p>
      ) : (
        <div className={m.aboutList}>
          {aboutRows.map((row) => (
            <div className={m.aboutRow} key={row.label}>
              <span className={m.aboutIcon}>
                <i className={`ti ${row.icon}`}></i>
              </span>
              <div className={m.aboutBody}>
                <span className={m.aboutLabel}>{row.label}</span>
                <span className={m.aboutValue}>{row.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Shared media */}
      {!isSelf && (
        <>
          <h3 className={m.sectionLabel}>Shared media</h3>

          {sharedMedia.length === 0 ? (
            <p className={m.emptyInline}>No files shared in this chat yet.</p>
          ) : (
            <div className={m.mediaGrid}>
              {sharedMedia.map((msg) => {
                const tile = tileFor(msg);
                const thumb =
                  msg.message_type === "image"
                    ? msg.fileUrl || getAuthenticatedFileUrl(msg)
                    : null;

                return (
                  <button
                    key={msg.id || msg.temp_id}
                    className={`${m.mediaTile} ${tile.cls}`}
                    onClick={() => onOpenMedia?.(msg)}
                    title={msg.filename || tile.label}
                  >
                    {thumb ? (
                      <img src={thumb} alt={msg.filename || "shared image"} />
                    ) : (
                      <>
                        <i className={`ti ${tile.icon}`}></i>
                        {tile.label}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ContactInfo;
