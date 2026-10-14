import React, { useEffect } from "react";
import s from "../pages/styling/incomingCall.module.css";
import { useCall } from "../context/CallContext";

/* -------------------------------------------------------------------------
   The ringing screen for an inbound call.

   Deliberately separate from CallScreen: at this point no media has been
   acquired and no peer connection exists — answering is what starts all of
   that. Mounting CallScreen here would open the camera before the user has
   agreed to take the call.
   ------------------------------------------------------------------------- */

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const IncomingCall = () => {
  const { call, acceptCall, rejectCall } = useCall();

  const showing = call.status === "ringing" && call.direction === "incoming";

  /* Esc declines. Enter answers. */
  useEffect(() => {
    if (!showing) return;
    const onKey = (e) => {
      if (e.key === "Escape") rejectCall();
      if (e.key === "Enter") acceptCall();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showing, acceptCall, rejectCall]);

  if (!showing) return null;

  const name = call.peer?.username || "Someone";
  const isVideo = call.callType === "video";

  return (
    <div className={s.backdrop} role="dialog" aria-modal="true">
      <div className={s.card}>
        <div className={s.kind}>
          <i className={`ti ${isVideo ? "ti-video" : "ti-phone"}`}></i>
          Incoming {isVideo ? "video" : "voice"} call
        </div>

        <div className={s.avatar}>
          {call.peer?.avatar_url ? (
            <img src={call.peer.avatar_url} alt={name} />
          ) : (
            getInitials(name)
          )}
          <span className={s.pulse} />
        </div>

        <div className={s.name}>{name}</div>
        <div className={s.sub}>
          {call.groupId ? "is calling the group" : "is calling you"}
        </div>

        <div className={s.actions}>
          <button
            className={`${s.action} ${s.decline}`}
            onClick={rejectCall}
            aria-label="Decline"
          >
            <span className={s.actionIcon}>
              <i className="ti ti-phone-off"></i>
            </span>
            Decline
          </button>

          <button
            className={`${s.action} ${s.answer}`}
            onClick={acceptCall}
            aria-label="Answer"
          >
            <span className={s.actionIcon}>
              <i className={`ti ${isVideo ? "ti-video" : "ti-phone"}`}></i>
            </span>
            Answer
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCall;
