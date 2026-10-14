import React, { useCallback, useEffect, useRef, useState } from "react";
import axiosbase from "../axiosconfig";
import s from "../pages/styling/callsList.module.css";
import { useCall } from "../context/CallContext";

/* -------------------------------------------------------------------------
   Call history — `GET /calls/history`.

   The endpoint has existed since the backend was written and had no caller.
   Rows are tappable: tapping one calls that person back, which is the only
   thing anybody ever wants from a call log.
   ------------------------------------------------------------------------- */

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const formatWhen = (value) => {
  if (!value) return "";
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return "";

  const now = new Date();
  const sameDay = then.toDateString() === now.toDateString();
  if (sameDay) {
    return then.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (then.toDateString() === yesterday.toDateString()) return "Yesterday";

  if (now - then < 7 * 24 * 60 * 60 * 1000) {
    return then.toLocaleDateString([], { weekday: "short" });
  }
  return then.toLocaleDateString([], { day: "numeric", month: "short" });
};

const formatLength = (startedAt, endedAt) => {
  if (!startedAt || !endedAt) return null;
  const ms = new Date(endedAt) - new Date(startedAt);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const total = Math.round(ms / 1000);
  const mm = Math.floor(total / 60);
  const ss = String(total % 60).padStart(2, "0");
  return mm > 0 ? `${mm}m ${ss}s` : `${ss}s`;
};

const CallsList = ({ selfId, variant = "mobile", filter = "all" }) => {
  const { startCall, call } = useCall();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axiosbase.get("/calls/history?limit=50");
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading call history:", err);
      setError("Could not load your call history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* A finished call is a new history row. Only the *transition* back to idle
     is interesting — reloading on every render where the status happens to be
     idle would refetch on mount twice. */
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && call.status === "idle") load();
    wasBusy.current = call.status !== "idle";
  }, [call.status, load]);

  const describe = (row) => {
    const outgoing = String(row.caller_id) === String(selfId);

    if (row.group_id) {
      return {
        name: row.group_name || "Group call",
        avatar: null,
        outgoing,
        peerId: null,
        groupId: row.group_id,
      };
    }

    return {
      name: outgoing
        ? row.receiver_username || "Unknown"
        : row.caller_username || "Unknown",
      avatar: outgoing ? row.receiver_avatar : row.caller_avatar,
      outgoing,
      peerId: outgoing ? row.receiver_id : row.caller_id,
      groupId: null,
    };
  };

  const redial = (row) => {
    const info = describe(row);
    if (call.status !== "idle") return;
    startCall({
      receiverId: info.peerId || undefined,
      groupId: info.groupId || undefined,
      callType: row.call_type === "audio" ? "audio" : "video",
      title: info.name,
      peer: info.peerId
        ? { userid: info.peerId, username: info.name, avatar_url: info.avatar }
        : null,
    });
  };

  if (loading) {
    return (
      <div className={s.state}>
        <div className={s.spinner} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={s.state}>
        <i className="ti ti-alert-circle"></i>
        <p>{error}</p>
        <button className={s.retry} onClick={load}>
          Try again
        </button>
      </div>
    );
  }

  const visible =
    filter === "all" ? rows : rows.filter((r) => r.call_type === filter);

  if (!visible.length) {
    return (
      <div className={s.state}>
        <i className={`ti ${filter === "video" ? "ti-video" : "ti-phone"}`}></i>
        <p>{filter === "video" ? "No video calls yet" : "No recent calls"}</p>
        <span className={s.hint}>
          Start one from the phone or video button in any chat.
        </span>
      </div>
    );
  }

  return (
    <div className={`${s.list} ${variant === "desktop" ? s.desktop : ""}`}>
      {visible.map((row) => {
        const info = describe(row);
        const missed = row.call_status === "missed";
        const length = formatLength(row.started_at, row.ended_at);

        return (
          <button
            key={row.id}
            className={s.row}
            onClick={() => redial(row)}
            title={`Call ${info.name} back`}
          >
            <span className={s.avatar}>
              {info.avatar ? (
                <img src={info.avatar} alt={info.name} />
              ) : (
                getInitials(info.name)
              )}
            </span>

            <span className={s.body}>
              <span className={`${s.name} ${missed ? s.missed : ""}`}>
                {info.name}
              </span>
              <span className={s.meta}>
                <i
                  className={`ti ${
                    missed
                      ? "ti-phone-off"
                      : info.outgoing
                        ? "ti-arrow-up-right"
                        : "ti-arrow-down-left"
                  } ${missed ? s.missedIcon : ""}`}
                ></i>
                {missed
                  ? info.outgoing
                    ? "No answer"
                    : "Missed"
                  : info.outgoing
                    ? "Outgoing"
                    : "Incoming"}
                {length ? ` · ${length}` : ""}
              </span>
            </span>

            <span className={s.right}>
              <span className={s.time}>{formatWhen(row.started_at)}</span>
              <i
                className={`ti ${
                  row.call_type === "audio" ? "ti-phone" : "ti-video"
                } ${s.kindIcon}`}
              ></i>
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default CallsList;
