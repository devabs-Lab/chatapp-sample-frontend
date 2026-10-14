import React, { useEffect, useState } from "react";
import c from "../pages/styling/call.module.css";
import { useCall } from "../context/CallContext";

/* ---------------------------------------------------------------------------
   The floating bar shown instead of the full CallScreen once the user
   minimizes it. The call itself (useWebRTC, mounted up in CallProvider) does
   not notice — this is purely a different view over the same state, so
   tapping it back open just swaps the view, nothing reconnects.
   ------------------------------------------------------------------------- */

const formatDuration = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

const MinimizedCallBar = () => {
  const { call, restoreCall, leaveCall, micOn, toggleMic } = useCall();
  const [seconds, setSeconds] = useState(0);

  const isActive = call.status === "active" || call.status === "connecting";

  useEffect(() => {
    if (!isActive || !call.startedAt) return;
    const tick = () =>
      setSeconds(Math.max(0, Math.floor((Date.now() - call.startedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isActive, call.startedAt]);

  const statusLine = () => {
    if (isActive) return formatDuration(seconds);
    if (call.direction === "outgoing") {
      return call.remoteRinging ? "Ringing…" : "Calling…";
    }
    return "Connecting…";
  };

  return (
    <div
      className={c.miniBar}
      onClick={restoreCall}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") restoreCall();
      }}
      aria-label={`Return to call with ${call.title}`}
    >
      <span className={c.miniIcon}>
        <i className={`ti ${call.callType === "audio" ? "ti-phone" : "ti-video"}`}></i>
      </span>

      <div className={c.miniInfo}>
        <span className={c.miniTitle}>{call.title}</span>
        <span className={c.miniSub}>{statusLine()}</span>
      </div>

      <button
        type="button"
        className={c.miniBtn}
        onClick={(e) => {
          e.stopPropagation();
          toggleMic();
        }}
        aria-label={micOn ? "Mute" : "Unmute"}
        title={micOn ? "Mute" : "Unmute"}
      >
        <i className={`ti ${micOn ? "ti-microphone" : "ti-microphone-off"}`}></i>
      </button>

      <button
        type="button"
        className={`${c.miniBtn} ${c.miniLeave}`}
        onClick={(e) => {
          e.stopPropagation();
          leaveCall();
        }}
        aria-label="Leave call"
        title="Leave call"
      >
        <i className="ti ti-phone-off"></i>
      </button>
    </div>
  );
};

export default MinimizedCallBar;
