import React, { useContext, useEffect, useRef, useState } from "react";
import { Appstate } from "../App";
import axiosbase from "../axiosconfig";
import InitialsAvatar from "./InitialsAvatar";
import { showErrorAlert, showSuccessAlert } from "./alerthelper";
import profileSidebarClasses from "../pages/styling/profileSidebar.module.css";

/* ---------------------------------------------------------------------------
   GroupInfoSidebar — the group's answer to OtherProfileSidebar.

   Three screens in one panel, the way Telegram does it: the group itself,
   a single member's profile, and settings. `details` is fetched by
   GroupChat when the conversation opens rather than here on first open, so
   the panel has something to render the moment it appears instead of
   sitting on a spinner for a round trip.

   Roles are shown *here*, next to the person they belong to — "admin"
   describes someone's standing in a group, not the group itself.
   --------------------------------------------------------------------------- */

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const GroupInfoSidebar = ({
  group,
  details,
  onRefreshDetails,
  isOpen,
  onClose,
  onGroupUpdated,
  onOpenPrivateChat,
  onLeaveGroup,
  focusMemberId,
  onFocusMemberHandled,
}) => {
  const { user } = useContext(Appstate);

  const [view, setView] = useState("info"); // "info" | "member" | "settings"
  const [selectedMemberId, setSelectedMemberId] = useState(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [saving, setSaving] = useState(false);

  const [invites, setInvites] = useState([]);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedToken, setCopiedToken] = useState(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  /* Group photo view states: circle -> expanded header -> full screen. */
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const [photoFullscreen, setPhotoFullscreen] = useState(false);
  const photoInputRef = useRef(null);

  const isAdmin = details?.user_role === "admin";
  const isOwner = Boolean(details?.is_owner);
  const members = details?.members || [];

  /* Read the member off the live details rather than snapshotting it, so a
     promotion or a permission change is reflected without reopening. */
  const selectedMember = members.find((m) => m.userid === selectedMemberId) || null;

  useEffect(() => {
    if (!details) return;
    setEditName(details.name || "");
    setEditDescription(details.description || "");
    setEditUsername(details.username || "");
  }, [details]);

  /* Admin-only, and only once the panel is actually open — an invite link
     is a credential, not something to prefetch for everyone. */
  useEffect(() => {
    if (!isOpen || !isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axiosbase.get(`/groups/${group.id}/invites`);
        if (!cancelled) setInvites(data);
      } catch (error) {
        console.error("Error loading invite links:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, isAdmin, group.id]);

  /* Clicking an avatar in the chat opens that person directly. */
  useEffect(() => {
    if (!focusMemberId || members.length === 0) return;
    if (members.some((m) => m.userid === focusMemberId)) {
      setSelectedMemberId(focusMemberId);
      setView("member");
    }
    onFocusMemberHandled?.();
  }, [focusMemberId, members, onFocusMemberHandled]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await axiosbase.patch(`/groups/${group.id}`, {
        name: editName,
        description: editDescription,
        username: editUsername,
      });
      showSuccessAlert("Saved", "Group updated");
      setEditing(false);
      onRefreshDetails?.();
      onGroupUpdated?.(data.group);
    } catch (error) {
      showErrorAlert(
        "Error",
        error.response?.data?.error || "Failed to update the group",
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again after a failure
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const { data } = await axiosbase.post(
        `/groups/${group.id}/avatar`,
        formData,
      );
      onRefreshDetails?.();
      onGroupUpdated?.({ id: group.id, avatar_url: data.avatar_url });
    } catch (error) {
      showErrorAlert(
        "Error",
        error.response?.data?.error || "Could not upload that photo",
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRoleChange = async (member, role) => {
    try {
      await axiosbase.patch(`/groups/${group.id}/members/${member.userid}/role`, {
        role,
      });
      showSuccessAlert(
        "Done",
        role === "admin"
          ? `${member.username} is now an admin`
          : `${member.username} is no longer an admin`,
      );
      onRefreshDetails?.();
    } catch (error) {
      showErrorAlert(
        "Error",
        error.response?.data?.error || "Failed to change the role",
      );
    }
  };

  const handlePermissionChange = async (member, canDelete) => {
    try {
      await axiosbase.patch(
        `/groups/${group.id}/members/${member.userid}/permissions`,
        { can_delete_messages: canDelete },
      );
      onRefreshDetails?.();
    } catch (error) {
      showErrorAlert(
        "Error",
        error.response?.data?.error || "Failed to change permissions",
      );
    }
  };

  const handleRemoveMember = async (member) => {
    try {
      await axiosbase.delete(`/groups/${group.id}/members/${member.userid}`);
      showSuccessAlert("Removed", `${member.username} was removed`);
      setView("info");
      onRefreshDetails?.();
    } catch (error) {
      showErrorAlert(
        "Error",
        error.response?.data?.error || "Failed to remove that member",
      );
    }
  };

  const handlePrivacyChange = async (isPrivate) => {
    try {
      const { data } = await axiosbase.patch(`/groups/${group.id}`, {
        is_private: isPrivate,
      });
      onRefreshDetails?.();
      onGroupUpdated?.(data.group);
    } catch (error) {
      showErrorAlert(
        "Error",
        error.response?.data?.error || "Failed to change privacy",
      );
    }
  };

  const inviteUrl = (token) => `${window.location.origin}/invite/${token}`;

  const handleCreateInvite = async () => {
    setCreatingInvite(true);
    try {
      const { data } = await axiosbase.post(`/groups/${group.id}/invites`);
      setInvites((prev) => [data.invite, ...prev]);
    } catch (error) {
      showErrorAlert(
        "Error",
        error.response?.data?.error || "Failed to create an invite link",
      );
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopy = async (token) => {
    const url = inviteUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      /* Clipboard access is refused in plenty of ordinary situations (an
         insecure origin, a browser wanting a gesture it didn't see) —
         fall back to something the user can still copy from. */
      window.prompt("Copy this invite link:", url);
    }
  };

  const handleRevoke = async (token) => {
    try {
      await axiosbase.delete(`/groups/${group.id}/invites/${token}`);
      setInvites((prev) => prev.filter((i) => i.token !== token));
    } catch (error) {
      showErrorAlert(
        "Error",
        error.response?.data?.error || "Failed to revoke the link",
      );
    }
  };

  const filteredMembers = memberSearch.trim()
    ? members.filter((m) =>
        m.username?.toLowerCase().includes(memberSearch.trim().toLowerCase()),
      )
    : members;

  const roleLabel = (member) => {
    if (details?.created_by === member.userid) return "owner";
    if (member.role === "admin") return "admin";
    return null;
  };

  if (!isOpen) return null;

  const headerTitle =
    view === "member"
      ? "Profile"
      : view === "settings"
        ? "Settings"
        : view === "edit"
          ? "Edit Group"
          : "Group Info";

  return (
    <div className={profileSidebarClasses.profileSidebar} style={{ display: "flex" }}>
      {photoFullscreen && details?.avatar_url && (
        <div
          className={profileSidebarClasses.photoViewer}
          onClick={() => setPhotoFullscreen(false)}
        >
          <button
            className={profileSidebarClasses.photoViewerClose}
            onClick={(e) => {
              e.stopPropagation();
              setPhotoFullscreen(false);
            }}
            title="Close"
          >
            <i className="ti ti-x"></i>
          </button>
          <img
            src={details.avatar_url}
            alt={details.name}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <div className={profileSidebarClasses.sidebarHeader}>
        {view !== "info" && (
          <button
            className={profileSidebarClasses.closeButton}
            onClick={() => setView("info")}
            title="Back to group info"
          >
            <i className="ti ti-arrow-left"></i>
          </button>
        )}
        <span className={profileSidebarClasses.headerTitle}>{headerTitle}</span>
        <button
          className={profileSidebarClasses.closeButton}
          onClick={onClose}
          title="Close"
        >
          <i className="ti ti-x"></i>
        </button>
      </div>

      {!details ? (
        <p className={profileSidebarClasses.groupHint} style={{ padding: 20 }}>
          Loading…
        </p>
      ) : view === "member" && selectedMember ? (
        /* ------------------------------------------------ member profile */
        <div className={profileSidebarClasses.profileInfo}>
          <div className={profileSidebarClasses.profileAvatar}>
            <InitialsAvatar
              name={selectedMember.username}
              imageUrl={selectedMember.avatar_url}
              size="lg"
              status="none"
            />
          </div>
          <h3 className={profileSidebarClasses.profileName}>
            {selectedMember.username}
          </h3>
          {roleLabel(selectedMember) && (
            <span className={profileSidebarClasses.roleTag}>
              {roleLabel(selectedMember)}
            </span>
          )}
          <p className={profileSidebarClasses.profileTitle}>
            {selectedMember.bio || "No bio yet"}
          </p>
          <div className={profileSidebarClasses.statusPill}>
            <span className={profileSidebarClasses.statusDot}></span>
            <span className={profileSidebarClasses.statusText}>
              {selectedMember.status === "online" ? "Online" : "Offline"}
            </span>
          </div>
          {selectedMember.joined_at && (
            <p className={profileSidebarClasses.groupHint}>
              Joined {formatDate(selectedMember.joined_at)}
            </p>
          )}

          {selectedMember.userid !== user.userid && (
            <>
              <div className={profileSidebarClasses.actionsRow}>
                <button
                  className={`${profileSidebarClasses.actionBtn} ${profileSidebarClasses.btnMagenta}`}
                  title="Send a message"
                  onClick={() => onOpenPrivateChat?.(selectedMember)}
                >
                  <i className="ti ti-message-circle"></i>
                </button>
              </div>

              {isAdmin && details.created_by !== selectedMember.userid && (
                <div className={profileSidebarClasses.settingsGroup}>
                  <button
                    className={profileSidebarClasses.groupActionButton}
                    onClick={() =>
                      handleRoleChange(
                        selectedMember,
                        selectedMember.role === "admin" ? "member" : "admin",
                      )
                    }
                    disabled={selectedMember.role === "admin" && !isOwner}
                  >
                    <i
                      className={
                        selectedMember.role === "admin"
                          ? "ti ti-user-minus"
                          : "ti ti-user-star"
                      }
                    ></i>
                    {selectedMember.role === "admin"
                      ? "Remove as admin"
                      : "Promote to admin"}
                  </button>

                  {/* Being an admin isn't itself permission to delete other
                      people's messages — the owner grants that separately. */}
                  {isOwner && selectedMember.role === "admin" && (
                    <label className={profileSidebarClasses.toggleRow}>
                      <span>
                        <strong>Can delete anyone's messages</strong>
                        <span className={profileSidebarClasses.toggleHint}>
                          Otherwise this admin can only delete their own.
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedMember.can_delete_messages)}
                        onChange={(e) =>
                          handlePermissionChange(selectedMember, e.target.checked)
                        }
                      />
                    </label>
                  )}

                  <button
                    className={`${profileSidebarClasses.groupActionButton} ${profileSidebarClasses.danger}`}
                    onClick={() => handleRemoveMember(selectedMember)}
                  >
                    <i className="ti ti-user-x"></i> Remove from group
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : view === "edit" ? (
        /* Editing gets the whole panel rather than being squeezed under the
           avatar — grouped cards, labelled fields, live counters, and the
           photo editable right from the top. */
        <div className={profileSidebarClasses.editScreen}>
          <div
            className={`${profileSidebarClasses.groupPhoto} ${profileSidebarClasses.groupPhotoClickable}`}
            onClick={() => photoInputRef.current?.click()}
            title="Change group photo"
          >
            <InitialsAvatar
              name={editName || details.name}
              imageUrl={details.avatar_url}
              size="lg"
              status="none"
            />
            <span className={profileSidebarClasses.groupPhotoCamera}>
              <i className={uploadingPhoto ? "ti ti-loader-2" : "ti ti-camera"}></i>
            </span>
          </div>

          <div className={profileSidebarClasses.editCard}>
            <span className={profileSidebarClasses.editCardTitle}>Group</span>

            <div className={profileSidebarClasses.editField}>
              <label className={profileSidebarClasses.editFieldLabel}>Name</label>
              <input
                className={profileSidebarClasses.editInput}
                value={editName}
                maxLength={100}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Group name"
              />
              <div className={profileSidebarClasses.editHintRow}>
                <span className={profileSidebarClasses.editHint}>
                  Shown at the top of the chat and in everyone's list.
                </span>
                <span className={profileSidebarClasses.editCounter}>
                  {editName.length}/100
                </span>
              </div>
            </div>

            <div className={profileSidebarClasses.editField}>
              <label className={profileSidebarClasses.editFieldLabel}>
                Description
              </label>
              <textarea
                className={profileSidebarClasses.editInput}
                value={editDescription}
                maxLength={255}
                rows={4}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="What is this group for?"
              />
              <div className={profileSidebarClasses.editHintRow}>
                <span className={profileSidebarClasses.editHint}>
                  A sentence or two helps people know what they're joining.
                </span>
                <span className={profileSidebarClasses.editCounter}>
                  {editDescription.length}/255
                </span>
              </div>
            </div>
          </div>

          <div className={profileSidebarClasses.editCard}>
            <span className={profileSidebarClasses.editCardTitle}>Public link</span>

            <div className={profileSidebarClasses.editField}>
              <div className={profileSidebarClasses.editInputWithPrefix}>
                <span className={profileSidebarClasses.editPrefix}>@</span>
                <input
                  className={profileSidebarClasses.editInput}
                  value={editUsername}
                  maxLength={32}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="studygroup"
                />
              </div>
              <div className={profileSidebarClasses.editHintRow}>
                <span className={profileSidebarClasses.editHint}>
                  5–32 characters: letters, numbers and underscores. Leave it
                  empty for no public link.
                </span>
                <span className={profileSidebarClasses.editCounter}>
                  {editUsername.length}/32
                </span>
              </div>
            </div>
          </div>

          <div className={profileSidebarClasses.editCard}>
            <span className={profileSidebarClasses.editCardTitle}>Group type</span>
            <label className={profileSidebarClasses.toggleRow}>
              <span>
                <strong>Private group</strong>
                <span className={profileSidebarClasses.toggleHint}>
                  Private groups never appear in search — people join by invite
                  link or by being added.
                </span>
              </span>
              <input
                type="checkbox"
                checked={Boolean(details.is_private)}
                onChange={(e) => handlePrivacyChange(e.target.checked)}
              />
            </label>
          </div>

          <div className={profileSidebarClasses.editActionsBar}>
            <button
              className={profileSidebarClasses.editSecondary}
              onClick={() => {
                setEditName(details.name || "");
                setEditDescription(details.description || "");
                setEditUsername(details.username || "");
                setView("info");
              }}
            >
              Cancel
            </button>
            <button
              className={profileSidebarClasses.editPrimary}
              onClick={async () => {
                await handleSave();
                setView("info");
              }}
              disabled={saving || !editName.trim()}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      ) : view === "settings" ? (
        /* ----------------------------------------------------- settings */
        <div className={profileSidebarClasses.sharedSection}>
          <h4 className={profileSidebarClasses.sectionLabel}>Group type</h4>
          <label className={profileSidebarClasses.toggleRow}>
            <span>
              <strong>Private group</strong>
              <span className={profileSidebarClasses.toggleHint}>
                Private groups never appear in search. People can only join
                through an invite link or by being added.
              </span>
            </span>
            <input
              type="checkbox"
              checked={Boolean(details.is_private)}
              disabled={!isAdmin}
              onChange={(e) => handlePrivacyChange(e.target.checked)}
            />
          </label>

          <h4 className={profileSidebarClasses.sectionLabel} style={{ marginTop: 18 }}>
            Admins
          </h4>
          <div className={profileSidebarClasses.memberList}>
            {members
              .filter((m) => m.role === "admin")
              .map((m) => (
                <div
                  key={m.userid}
                  className={profileSidebarClasses.memberRow}
                  onClick={() => {
                    setSelectedMemberId(m.userid);
                    setView("member");
                  }}
                >
                  <InitialsAvatar
                    name={m.username}
                    imageUrl={m.avatar_url}
                    size="sm"
                    status="none"
                  />
                  <span className={profileSidebarClasses.memberName}>
                    {m.userid === user.userid ? "You" : m.username}
                  </span>
                  <span className={profileSidebarClasses.roleTag}>
                    {roleLabel(m)}
                  </span>
                </div>
              ))}
          </div>
          <p className={profileSidebarClasses.groupHint}>
            Admins can edit the group, add members, pin messages and manage
            invite links. Deleting other people's messages is granted per
            admin by the owner.
          </p>
        </div>
      ) : (
        /* -------------------------------------------------- group screen */
        <>
          {/* Telegram's group photo has three states: the small circle, an
              expanded header with the name laid over it, and a full-screen
              viewer — each click steps to the next. Changing the photo is a
              separate camera button, so tapping the picture always means
              "show me the picture" rather than "replace it". */}
          {details.avatar_url && photoExpanded ? (
            <div
              className={profileSidebarClasses.photoHeader}
              onClick={() => setPhotoFullscreen(true)}
              title="View full size"
            >
              <img src={details.avatar_url} alt={details.name} />
              <button
                className={profileSidebarClasses.photoHeaderCollapse}
                onClick={(e) => {
                  e.stopPropagation();
                  setPhotoExpanded(false);
                }}
                title="Collapse"
              >
                <i className="ti ti-chevron-up"></i>
              </button>
              <div className={profileSidebarClasses.photoHeaderCaption}>
                <h3>{details.name}</h3>
                <span>
                  {members.length} {members.length === 1 ? "member" : "members"}
                </span>
              </div>
            </div>
          ) : null}

          <div className={profileSidebarClasses.profileInfo}>
            {!(details.avatar_url && photoExpanded) && (
              <div
                className={`${profileSidebarClasses.groupPhoto} ${
                  details.avatar_url ? profileSidebarClasses.groupPhotoClickable : ""
                }`}
                onClick={() => details.avatar_url && setPhotoExpanded(true)}
                title={details.avatar_url ? "View photo" : undefined}
              >
                <InitialsAvatar
                  name={details.name}
                  imageUrl={details.avatar_url}
                  size="lg"
                  status="none"
                />
                {isAdmin && (
                  <button
                    className={profileSidebarClasses.groupPhotoCamera}
                    onClick={(e) => {
                      e.stopPropagation();
                      photoInputRef.current?.click();
                    }}
                    title="Change group photo"
                  >
                    <i
                      className={uploadingPhoto ? "ti ti-loader-2" : "ti ti-camera"}
                    ></i>
                  </button>
                )}
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              ref={photoInputRef}
              style={{ display: "none" }}
              onChange={handlePhotoSelected}
            />

            {(
              <>
                {/* The expanded photo header already carries the name and
                    member count over the image, so repeating them here
                    would just say everything twice. */}
                {!photoExpanded && (
                  <>
                    <h3 className={profileSidebarClasses.groupTitle}>
                      {details.name}
                    </h3>
                    {details.username && (
                      <p className={profileSidebarClasses.groupUsername}>
                        @{details.username}
                      </p>
                    )}
                  </>
                )}
                <p className={profileSidebarClasses.groupSubtitle}>
                  {details.description || "No description"}
                </p>
                {!photoExpanded && (
                  <div className={profileSidebarClasses.statusPill}>
                    <span className={profileSidebarClasses.statusText}>
                      {members.length} {members.length === 1 ? "member" : "members"}
                      {details.is_private ? " · private" : " · public"}
                    </span>
                  </div>
                )}
                <div className={profileSidebarClasses.actionsRow}>
                  {isAdmin && (
                    <button
                      className={`${profileSidebarClasses.actionBtn} ${profileSidebarClasses.btnPale}`}
                      onClick={() => setView("edit")}
                      title="Edit group"
                    >
                      <i className="ti ti-pencil"></i>
                    </button>
                  )}
                  <button
                    className={`${profileSidebarClasses.actionBtn} ${profileSidebarClasses.btnPale}`}
                    onClick={() => setView("settings")}
                    title="Settings"
                  >
                    <i className="ti ti-settings"></i>
                  </button>
                </div>
                {details.created_at && (
                  <p className={profileSidebarClasses.groupHint}>
                    Created {formatDate(details.created_at)}
                    {details.creator_name ? ` by ${details.creator_name}` : ""}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Invite links — admins only */}
          {isAdmin && (
            <div className={profileSidebarClasses.sharedSection}>
              <h4 className={profileSidebarClasses.sectionLabel}>Invite Link</h4>
              {invites.length === 0 ? (
                <p className={profileSidebarClasses.groupHint}>
                  No link yet — create one to invite people who aren't on the
                  member list.
                </p>
              ) : (
                invites.map((invite) => (
                  <div key={invite.token} className={profileSidebarClasses.inviteRow}>
                    <span
                      className={profileSidebarClasses.inviteLink}
                      title={inviteUrl(invite.token)}
                    >
                      {inviteUrl(invite.token)}
                    </span>
                    <button
                      className={profileSidebarClasses.inviteBtn}
                      onClick={() => handleCopy(invite.token)}
                      title="Copy link"
                    >
                      <i
                        className={
                          copiedToken === invite.token ? "ti ti-check" : "ti ti-copy"
                        }
                      ></i>
                    </button>
                    <button
                      className={profileSidebarClasses.inviteBtn}
                      onClick={() => handleRevoke(invite.token)}
                      title="Revoke link"
                    >
                      <i className="ti ti-trash"></i>
                    </button>
                  </div>
                ))
              )}
              <button
                className={profileSidebarClasses.groupActionButton}
                onClick={handleCreateInvite}
                disabled={creatingInvite}
              >
                <i className="ti ti-link"></i>{" "}
                {creatingInvite ? "Creating…" : "Create invite link"}
              </button>
            </div>
          )}

          {/* Members */}
          <div className={profileSidebarClasses.sharedSection}>
            <h4 className={profileSidebarClasses.sectionLabel}>
              {members.length} {members.length === 1 ? "Member" : "Members"}
            </h4>
            {members.length > 6 && (
              <input
                className={profileSidebarClasses.field}
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search members"
              />
            )}
            <div className={profileSidebarClasses.memberList}>
              {filteredMembers.map((member) => (
                <div
                  key={member.userid}
                  className={profileSidebarClasses.memberRow}
                  onClick={() => {
                    setSelectedMemberId(member.userid);
                    setView("member");
                  }}
                >
                  <InitialsAvatar
                    name={member.username}
                    imageUrl={member.avatar_url}
                    size="sm"
                    status="none"
                  />
                  <span className={profileSidebarClasses.memberName}>
                    {member.userid === user.userid ? "You" : member.username}
                  </span>
                  {roleLabel(member) && (
                    <span className={profileSidebarClasses.roleTag}>
                      {roleLabel(member)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className={profileSidebarClasses.sharedSection}>
            <button
              className={`${profileSidebarClasses.groupActionButton} ${profileSidebarClasses.danger}`}
              onClick={onLeaveGroup}
            >
              <i className="ti ti-logout"></i> Leave group
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default GroupInfoSidebar;
