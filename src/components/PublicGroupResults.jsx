import React from "react";
import InitialsAvatar from "./InitialsAvatar";

/* A "Public groups" section shown above the normal inbox list whenever the
   search box matches a public group the user hasn't joined yet. Private
   groups never appear here — the backend already filters those out of
   /groups/public, and the only way into one is a group admin adding the
   member directly (see GroupChat.jsx's "Add member" panel). `classes` is
   the caller's inbox.module.css classes object, reused so these rows look
   identical to a normal conversation row except for the Join button. */
const PublicGroupResults = ({ results, onJoin, classes }) => (
  <div className={classes.publicGroupResults}>
    <div className={classes.publicGroupResultsHeader}>Public groups</div>
    {results.map((g) => (
      <div key={`public-${g.id}`} className={classes.conversationItem}>
        <div className={classes.avatarWrapper}>
          <InitialsAvatar name={g.name} size="lg" status="none" borderRadius="11px" />
        </div>
        <div className={classes.conversationContent}>
          <div className={classes.conversationHeader}>
            <h4 className={classes.conversationName}>{g.name}</h4>
          </div>
          <div className={classes.conversationFooter}>
            <p className={classes.conversationPreview}>
              {g.member_count} members
              {g.creator_name ? ` · by ${g.creator_name}` : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          className={classes.joinGroupBtn}
          onClick={(e) => {
            e.stopPropagation();
            onJoin(g);
          }}
          title="Join group"
        >
          <i className="ti ti-user-plus"></i>
        </button>
      </div>
    ))}
  </div>
);

export default PublicGroupResults;
