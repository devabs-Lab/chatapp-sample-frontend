import React, { useState, useEffect, useRef, useMemo } from "react";
import c from "../pages/styling/call.module.css";
import { useCall } from "../context/CallContext";

/* -------------------------------------------------------------------------
   The call screen, wired to real media.

   It renders straight from CallContext rather than props: the call outlives
   any one chat view, so the screen has to be able to unmount and remount
   (navigating between conversations, rotating a phone) without disturbing
   the peer connections, which live in the provider.

   Everything here that used to be mock data now comes from useWebRTC via
   CallContext — participants carry a MediaStream, the controls act on real
   tracks, and the in-call chat is relayed over the call room socket.
   ------------------------------------------------------------------------- */

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.split(" ").filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const formatDuration = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/* A stream can exist while its video track is disabled (camera off) or while
   it carries audio only, so the presence of a stream is not enough to decide
   whether to paint a video element. */
const hasLiveVideo = (stream, cameraOff) => {
  if (!stream || cameraOff) return false;
  return stream.getVideoTracks().some((t) => t.readyState === "live");
};

/* One video tile. Clicking a tile that is not already the main one pins it
   there — the previous main tile drops back into the side strip. This is
   the "make my video / theirs the big one" swap. */
const Tile = ({
  participant,
  small = false,
  className = "",
  muteAudio = false,
  onPin,
}) => {
  const videoRef = useRef(null);
  const stream = participant.stream;
  const showVideo = hasLiveVideo(stream, participant.cameraOff);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream || null;
    }
    if (stream) {
      /* Autoplay can still be refused on a cold tab; retrying on the next
         tick after srcObject is set clears most of those. */
      el.play?.().catch(() => {});
    }
  }, [stream, showVideo]);

  return (
    <div
      className={`${c.tile} ${participant.speaking ? c.speaking : ""} ${
        onPin ? c.tileClickable : ""
      } ${className}`}
      onClick={onPin}
      role={onPin ? "button" : undefined}
      tabIndex={onPin ? 0 : undefined}
      onKeyDown={
        onPin
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onPin();
            }
          : undefined
      }
    >
      {/* The <video> stays mounted even when the camera is off so the audio
          track keeps playing; only its visibility changes. */}
      {stream && (
        <video
          ref={videoRef}
          className={c.tileVideo}
          style={showVideo ? undefined : { display: "none" }}
          autoPlay
          playsInline
          muted={muteAudio}
        />
      )}

      {!showVideo && (
        <div className={`${c.tileAvatar} ${small ? c.small : ""}`}>
          {participant.avatar_url ? (
            <img src={participant.avatar_url} alt={participant.name} />
          ) : (
            getInitials(participant.name)
          )}
        </div>
      )}

      {participant.muted && (
        <span className={c.mutedPill}>
          <i className="ti ti-microphone-off"></i>
        </span>
      )}

      <span className={c.nameChip}>
        {participant.speaking && <span className={c.nameChipDot}></span>}
        {participant.name}
      </span>
    </div>
  );
};

const CallScreen = () => {
  const {
    call,
    participants,
    localStream,
    micOn,
    camOn,
    sharing,
    mediaError,
    toggleMic,
    toggleCam,
    toggleShare,
    leaveCall,
    callMessages,
    sendCallMessage,
    self,
    minimizeCall,
  } = useCall();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [seconds, setSeconds] = useState(0);
  /* Manual override for who is on the big stage. null = automatic (whoever
     has live video leads). Set by clicking a smaller tile — that tile
     becomes the main one and whoever was there swaps down to the strip. */
  const [pinnedId, setPinnedId] = useState(null);

  const chatEndRef = useRef(null);
  const selfVideoRef = useRef(null);

  const isRinging = call.status === "ringing";
  const isActive = call.status === "active" || call.status === "connecting";

  /* Call duration — counts from the moment the call actually connected, not
     from when the screen mounted, so a reconnect does not reset it. */
  useEffect(() => {
    if (!isActive || !call.startedAt) return;
    const tick = () =>
      setSeconds(Math.max(0, Math.floor((Date.now() - call.startedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isActive, call.startedAt]);

  /* self preview */
  useEffect(() => {
    const el = selfVideoRef.current;
    if (!el) return;
    if (el.srcObject !== localStream) el.srcObject = localStream || null;
    if (localStream) el.play?.().catch(() => {});
  }, [localStream, camOn, sharing]);

  /* keep the in-call chat pinned to the newest message */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [callMessages?.length, sheetOpen]);

  /* Esc closes the mobile sheet before it leaves the call */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (sheetOpen) setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const selfTile = useMemo(
    () => ({
      id: "self",
      name: self?.username || "You",
      avatar_url: self?.avatar_url,
      stream: localStream,
      cameraOff: !camOn && !sharing,
      muted: !micOn,
      isSelf: true,
    }),
    [self, localStream, camOn, sharing, micOn],
  );

  /* Whoever is on camera leads the stage; failing that, the first peer.
     With nobody connected yet (still ringing) you see yourself. A manual
     pin (click on a smaller tile) overrides the automatic pick — that
     participant (or "self") is moved to the front of the list. */
  const [activeSpeaker, ...others] = useMemo(() => {
    const withVideo = participants.filter((p) => hasLiveVideo(p.stream, p.cameraOff));
    const rest = participants.filter((p) => !withVideo.includes(p));
    const ordered = [...withVideo, ...rest];
    const pool = ordered.length ? ordered : [selfTile];

    if (pinnedId) {
      const all = [selfTile, ...participants];
      const pinned = all.find((p) => p.id === pinnedId);
      if (pinned) {
        return [pinned, ...all.filter((p) => p !== pinned)];
      }
    }
    return pool;
  }, [participants, selfTile, pinnedId]);

  /* If the pinned participant leaves the call, fall back to automatic. */
  useEffect(() => {
    if (!pinnedId || pinnedId === "self") return;
    if (!participants.some((p) => p.id === pinnedId)) setPinnedId(null);
  }, [pinnedId, participants]);

  const roster = useMemo(
    () => [
      { ...selfTile, name: `${selfTile.name} (You)`, role: "You" },
      ...participants,
    ],
    [selfTile, participants],
  );

  const statusLine = () => {
    if (isRinging && call.direction === "outgoing") {
      return call.remoteRinging ? "Ringing…" : "Calling…";
    }
    if (call.status === "connecting") return "Connecting…";
    if (!participants.length) return "Waiting for others to join";
    const connected = participants.filter((p) => p.connection === "connected").length;
    if (connected < participants.length) return "Connecting…";
    return `${roster.length} participants`;
  };

  const handleSend = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    sendCallMessage?.(text);
    setDraft("");
  };

  const stageIsSelfOnly = activeSpeaker?.id === "self";
  /* Once self has been pinned anywhere on the stage (main or a side tile),
     it is rendered as a real Tile and the floating self-preview would just
     be a duplicate. */
  const selfIsTiled =
    stageIsSelfOnly || others.some((p) => p.id === "self");

  return (
    <div className={c.callRoot}>
      {/* left rail — desktop only */}
      <div className={c.rail}>
        <div className={c.railLogo}>U</div>
      </div>

      <div className={c.main}>
        <div className={c.header}>
          <div className={c.headerText}>
            <div className={c.title}>{call.title}</div>
            <div className={c.subtitle}>{statusLine()}</div>
          </div>

          {isActive && <span className={c.liveBadge}>LIVE</span>}

          {/* Drop back into the chat list — the call keeps running behind a
              small bar until you tap it to come back. */}
          <button
            className={`${c.headerBtn} ${c.minimizeBtn}`}
            onClick={minimizeCall}
            aria-label="Minimize call"
            title="Minimize"
          >
            <i className="ti ti-chevron-down"></i>
          </button>

          {/* mobile: opens the participants / chat sheet */}
          <button
            className={c.headerBtn}
            onClick={() => setSheetOpen(true)}
            aria-label="Participants and messages"
          >
            <i className="ti ti-users"></i>
          </button>
        </div>

        {mediaError && (
          <div className={c.mediaWarning}>
            <i className="ti ti-alert-triangle"></i>
            {mediaError}
          </div>
        )}

        <div className={`${c.stage} ${others.length === 0 ? c.solo : ""}`}>
          {activeSpeaker && (
            <Tile
              participant={activeSpeaker}
              className={c.tileMain}
              muteAudio={!!activeSpeaker.isSelf}
            />
          )}

          <div className={c.stageSide}>
            {others.map((p) => (
              <Tile
                key={p.id}
                participant={p}
                small
                muteAudio={!!p.isSelf}
                onPin={() => setPinnedId(p.id)}
              />
            ))}
          </div>

          {/* self preview — hidden once self is already one of the tiles
              above (main or side); clicking it pins self to the main tile,
              same as clicking any other small tile. */}
          {!selfIsTiled && (
            <div
              className={`${c.selfPip} ${c.tileClickable}`}
              onClick={() => setPinnedId("self")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setPinnedId("self");
              }}
            >
              {localStream && (camOn || sharing) ? (
                <video
                  ref={selfVideoRef}
                  className={c.tileVideo}
                  autoPlay
                  playsInline
                  muted
                />
              ) : (
                <div className={c.tileAvatar}>{getInitials(selfTile.name)}</div>
              )}
              <span className={c.selfLabel}>You</span>
            </div>
          )}
        </div>

        <div className={c.controls}>
          <span className={c.timer}>
            {isActive ? formatDuration(seconds) : statusLine()}
          </span>

          <button
            className={`${c.ctrl} ${!micOn ? c.off : ""}`}
            onClick={toggleMic}
          >
            <span className={c.ctrlIcon}>
              <i className={`ti ${micOn ? "ti-microphone" : "ti-microphone-off"}`}></i>
            </span>
            {micOn ? "Mute" : "Unmute"}
          </button>

          <button
            className={`${c.ctrl} ${camOn ? c.on : c.off}`}
            onClick={toggleCam}
          >
            <span className={c.ctrlIcon}>
              <i className={`ti ${camOn ? "ti-video" : "ti-video-off"}`}></i>
            </span>
            Camera
          </button>

          <button
            className={`${c.ctrl} ${sharing ? c.on : ""}`}
            onClick={toggleShare}
          >
            <span className={c.ctrlIcon}>
              <i className="ti ti-layout-sidebar"></i>
            </span>
            Share
          </button>

          <button className={c.ctrl} onClick={() => setSheetOpen((v) => !v)}>
            <span className={c.ctrlIcon}>
              <i className="ti ti-message-circle"></i>
            </span>
            Chat
          </button>

          <button className={c.ctrl}>
            <span className={c.ctrlIcon}>
              <i className="ti ti-dots"></i>
            </span>
            More
          </button>

          <button className={`${c.ctrl} ${c.leave}`} onClick={leaveCall}>
            <span className={c.ctrlIcon}>
              <i className="ti ti-phone-off"></i>
            </span>
            Leave
          </button>
        </div>
      </div>

      {/* mobile sheet backdrop */}
      <div
        className={`${c.sheetBackdrop} ${sheetOpen ? c.open : ""}`}
        onClick={() => setSheetOpen(false)}
      />

      {/* participants + in-call chat */}
      <aside className={`${c.panel} ${sheetOpen ? c.open : ""}`}>
        <div className={c.panelHead}>
          <div className={c.panelTitle}>Participants</div>
          <div className={c.panelCount}>{roster.length} in this call</div>
        </div>

        <div className={c.participantList}>
          {roster.map((p) => (
            <div className={c.participant} key={p.id}>
              <div className={c.participantAvatar}>
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={p.name} />
                ) : (
                  getInitials(p.name)
                )}
              </div>

              <div className={c.participantBody}>
                <div className={c.participantName}>{p.name}</div>
                <div className={c.participantRole}>{p.role}</div>
              </div>

              <div className={c.participantIcons}>
                {p.cameraOff && <i className="ti ti-video-off"></i>}
                {p.muted && (
                  <i className={`ti ti-microphone-off ${c.muted}`}></i>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className={c.chatHead}>In-call messages</div>

        <div className={c.chatScroll}>
          {(callMessages || []).map((msg) => (
            <div
              key={msg.id}
              className={`${c.chatMsg} ${msg.own ? c.own : ""}`}
            >
              <span className={c.chatAuthor}>{msg.author}</span>
              <div className={c.chatBubble}>{msg.text}</div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form className={c.chatComposer} onSubmit={handleSend}>
          <input
            className={c.composerInput}
            placeholder="Write a message"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />

          <button type="submit" className={c.composerSend} aria-label="Send">
            <i className="ti ti-send"></i>
          </button>
        </form>
      </aside>
    </div>
  );
};

export default CallScreen;
