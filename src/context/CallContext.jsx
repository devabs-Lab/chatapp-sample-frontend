import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Appstate } from "../App";
import axiosbase from "../axiosconfig";
import { useSocket } from "../Socketprovider";
import useWebRTC from "../hooks/useWebRTC";
import { startRingtone, stopRingtone } from "../utils/ringtone";
import toast from "../pages/styling/callToast.module.css";

/* ---------------------------------------------------------------------------
   CallContext — the call state machine.

   One call at a time, and it owns every transition:

     idle ──startCall──▶ outgoing/ringing ──call-accepted──▶ active ──▶ idle
     idle ──incoming-call──▶ incoming/ringing ──accept──▶ active ──▶ idle
                                              └─reject──▶ idle

   The REST endpoints (route/callroutes.js) own the *record* — who called whom,
   when it ended, what shows up in history. The socket events own the *live*
   state. Both already existed; this provider is the missing client half.

   The media itself is useWebRTC's job. It is mounted here, once, so that a
   call survives the user navigating between chats — CallScreen is only a view
   over this state and can unmount and remount without dropping the peers.
   --------------------------------------------------------------------------- */

const CallContext = createContext(null);

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) {
    throw new Error("useCall must be used inside <CallProvider>");
  }
  return ctx;
};

const IDLE = { status: "idle" };

export const CallProvider = ({ children }) => {
  const socket = useSocket();
  const { user } = useContext(Appstate);
  const selfId = user?.userid;

  /* status: idle | ringing | connecting | active | ended */
  const [call, setCall] = useState(IDLE);
  const [notice, setNotice] = useState(null);
  /* Lets the user drop back into the chat list while a call keeps running —
     CallScreen unmounts, a small bar takes its place. The peer connections
     live in useWebRTC below, not in CallScreen, so nothing about the call
     itself is affected by which view is showing. */
  const [minimized, setMinimized] = useState(false);
  /* In-call chat is ephemeral by design — it is relayed through the call room
     and dropped when the call ends. It lives here rather than in CallScreen so
     the log survives the screen unmounting. */
  const [callMessages, setCallMessages] = useState([]);

  /* userid -> { username, avatar_url } so remote tiles can show a name
     instead of a uuid. Chat.jsx feeds this from its `allUsers` fetch. */
  const directoryRef = useRef(new Map());
  const callRef = useRef(IDLE);
  callRef.current = call;
  /* Set when the user hangs up before startCall's POST /calls/initiate has
     resolved — there is no callId yet to send an /end for. Consumed the
     moment that response does arrive (see startCall), which fires /end
     immediately with the id that just became known. Without this, ending a
     call fast left the callee ringing forever: the backend still emits
     incoming-call independently of whatever the caller's client does next,
     but nothing ever told it the call was cancelled. */
  const pendingLeaveRef = useRef(false);

  const setDirectory = useCallback((users = []) => {
    const map = new Map(directoryRef.current);
    users.forEach((u) => {
      if (u?.userid) map.set(String(u.userid), u);
    });
    directoryRef.current = map;
  }, []);

  const lookup = useCallback(
    (userId) => directoryRef.current.get(String(userId)) || null,
    [],
  );

  /* Ringing on the *receiving* end must not open the camera — the user has
     not answered yet. The caller is different: they asked for this, and they
     expect to see their own preview while it rings. */
  const mediaActive =
    call.status === "connecting" ||
    call.status === "active" ||
    (call.status === "ringing" && call.direction === "outgoing");

  const rtc = useWebRTC({
    socket,
    selfId,
    callId: mediaActive ? call.callId : null,
    callType: call.callType || "video",
    active: mediaActive,
  });

  /* ------------------------------------------------------------- ringtone */

  useEffect(() => {
    if (call.status === "ringing") {
      startRingtone(call.direction === "incoming" ? "incoming" : "outgoing");
    } else {
      stopRingtone();
    }
    return () => stopRingtone();
  }, [call.status, call.direction]);

  /* ---------------------------------------------------------------- helpers */

  /* A resolved 1:1 call's "missed / declined / ended · duration" entry in
     the chat thread is written server-side (callcontroller.js, on
     reject/end) as a real message — it arrives here like any other message,
     through the normal `receive-private-message` socket flow in
     ChatContext.jsx, so it reliably reaches both people and survives
     reopening the thread later. Nothing needs to happen on this side. */
  const clearCall = useCallback((message) => {
    setCall(IDLE);
    setCallMessages([]);
    setMinimized(false);
    pendingLeaveRef.current = false;
    if (message) {
      setNotice(message);
      setTimeout(() => setNotice(null), 4000);
    }
  }, []);

  /* --------------------------------------------------------------- actions */

  const startCall = useCallback(
    async ({ receiverId, groupId, callType = "video", title, peer }) => {
      if (callRef.current.status !== "idle") return;
      if (!receiverId && !groupId) return;

      setCall({
        status: "ringing",
        direction: "outgoing",
        callId: null,
        callType,
        title: title || peer?.username || "Call",
        groupId: groupId || null,
        peer: peer || null,
        startedAt: Date.now(),
      });

      try {
        const { data } = await axiosbase.post("/calls/initiate", {
          receiver_id: receiverId || undefined,
          group_id: groupId || undefined,
          call_type: callType,
        });

        const callId = data?.call?.id;
        if (!callId) throw new Error("No call id returned");

        if (pendingLeaveRef.current) {
          /* Already asked to leave before we had an id to leave with.
             clearCall already reset local state — just tell the server,
             now that it's finally possible to. */
          pendingLeaveRef.current = false;
          axiosbase
            .post(`/calls/${callId}/end`)
            .catch((err) => console.error("Error ending call:", err));
          return;
        }

        setCall((prev) =>
          prev.status === "idle" ? prev : { ...prev, callId },
        );

        /* A group call has nobody to wait for — you are in it the moment it
           exists. A 1:1 call waits for `call-accepted`. */
        if (groupId) {
          setCall((prev) =>
            prev.status === "idle" ? prev : { ...prev, status: "active" },
          );
        }
      } catch (error) {
        console.error("Error starting call:", error);
        clearCall("Could not start the call.");
      }
    },
    [clearCall],
  );

  const acceptCall = useCallback(async () => {
    const current = callRef.current;
    if (current.status !== "ringing" || current.direction !== "incoming") return;

    setCall((prev) => ({ ...prev, status: "connecting" }));

    try {
      await axiosbase.post(`/calls/${current.callId}/accept`);
      setCall((prev) =>
        prev.status === "idle"
          ? prev
          : { ...prev, status: "active", startedAt: Date.now() },
      );
    } catch (error) {
      console.error("Error accepting call:", error);
      clearCall("Could not join the call.");
    }
  }, [clearCall]);

  const rejectCall = useCallback(async () => {
    const current = callRef.current;
    if (current.status === "idle" || !current.callId) {
      clearCall();
      return;
    }
    clearCall();
    try {
      await axiosbase.post(`/calls/${current.callId}/reject`);
    } catch (error) {
      console.error("Error rejecting call:", error);
    }
  }, [clearCall]);

  const leaveCall = useCallback(async () => {
    const current = callRef.current;
    clearCall();
    if (!current.callId) {
      /* startCall's POST hasn't resolved yet — nothing to tell the server
         about this call yet. Flag it so the id gets an /end the moment it
         does arrive, instead of the callee ringing forever. */
      if (current.status !== "idle") pendingLeaveRef.current = true;
      return;
    }
    try {
      await axiosbase.post(`/calls/${current.callId}/end`);
    } catch (error) {
      console.error("Error ending call:", error);
    }
  }, [clearCall]);

  /* ------------------------------------------------------- in-call chat */

  const sendCallMessage = useCallback(
    (text) => {
      const current = callRef.current;
      if (!socket || !current.callId || !text?.trim()) return;

      const author = user?.username || "You";
      socket.emit("call-message", {
        callId: current.callId,
        text: text.trim(),
        author,
      });

      /* The relay only reaches the *other* sockets in the room, exactly like
         `receive-private-message` — the sender never gets an echo, so append
         our own copy here. */
      setCallMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-self`,
          author: "You",
          text: text.trim(),
          own: true,
        },
      ]);
    },
    [socket, user?.username],
  );

  /* -------------------------------------------------------- socket events */

  useEffect(() => {
    if (!socket) return;

    const onIncoming = (payload) => {
      /* Already busy — decline straight away so the caller is not left
         listening to a ring nobody will ever pick up. */
      if (callRef.current.status !== "idle") {
        axiosbase
          .post(`/calls/${payload.callId}/reject`)
          .catch(() => {});
        return;
      }

      setCall({
        status: "ringing",
        direction: "incoming",
        callId: payload.callId,
        callType: payload.callType || "video",
        groupId: payload.groupId || null,
        title: payload.callerUsername || "Incoming call",
        peer: {
          userid: payload.callerId,
          username: payload.callerUsername,
          avatar_url: payload.callerAvatar,
        },
        startedAt: null,
      });

      /* Let the caller's UI move from "Calling…" to "Ringing…". */
      socket.emit("call-status-update", {
        callId: payload.callId,
        status: "ringing",
        targetUserId: payload.callerId,
      });
    };

    const onAccepted = ({ callId }) => {
      setCall((prev) => {
        if (prev.status === "idle" || String(prev.callId) !== String(callId)) {
          return prev;
        }
        /* The timer counts talk time, so it starts when the call is picked
           up — not when the caller pressed the button. */
        return {
          ...prev,
          status: "active",
          startedAt: prev.status === "active" ? prev.startedAt : Date.now(),
        };
      });
    };

    const onRejected = ({ callId }) => {
      if (String(callRef.current.callId) !== String(callId)) return;
      clearCall("Call declined.");
    };

    const onEnded = ({ callId }) => {
      if (String(callRef.current.callId) !== String(callId)) return;
      clearCall("Call ended.");
    };

    const onLeft = ({ callId, userId }) => {
      const current = callRef.current;
      if (String(current.callId) !== String(callId)) return;
      if (String(userId) === String(selfId)) return;
      /* In a 1:1 call the other person leaving *is* the end of the call.
         In a group call the mesh just loses one leg. */
      if (!current.groupId) clearCall("Call ended.");
    };

    const onStatus = ({ callId, status }) => {
      if (String(callRef.current.callId) !== String(callId)) return;
      if (status === "ringing") {
        setCall((prev) =>
          prev.status === "ringing" ? { ...prev, remoteRinging: true } : prev,
        );
      }
    };

    const onCallMessage = (payload) => {
      if (String(callRef.current.callId) !== String(payload.callId)) return;
      setCallMessages((prev) => [
        ...prev,
        {
          id: `${payload.at}-${payload.from}`,
          author: payload.author || lookup(payload.from)?.username || "Participant",
          text: payload.text,
          own: false,
        },
      ]);
    };

    socket.on("incoming-call", onIncoming);
    socket.on("call-message", onCallMessage);
    socket.on("call-accepted", onAccepted);
    socket.on("call-rejected", onRejected);
    socket.on("call-ended", onEnded);
    socket.on("user-left-call", onLeft);
    socket.on("call-status-update", onStatus);


    return () => {
      socket.off("incoming-call", onIncoming);
      socket.off("call-message", onCallMessage);
      socket.off("call-accepted", onAccepted);
      socket.off("call-rejected", onRejected);
      socket.off("call-ended", onEnded);
      socket.off("user-left-call", onLeft);
      socket.off("call-status-update", onStatus);
    };
  }, [socket, selfId, clearCall, lookup]);

  /* Hanging up by closing the tab still has to reach the other side. */
  useEffect(() => {
    const onUnload = () => {
      const current = callRef.current;
      if (current.status === "idle" || !current.callId) return;
      const token = sessionStorage.getItem("token");
      const url = `${import.meta.env.VITE_API_URL}/api/calls/${current.callId}/end`;
      /* sendBeacon cannot set an Authorization header, so fall back to a
         keepalive fetch, which can. */
      fetch(url, {
        method: "POST",
        keepalive: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).catch(() => {});
    };
    window.addEventListener("pagehide", onUnload);
    return () => window.removeEventListener("pagehide", onUnload);
  }, []);

  /* -------------------------------------------------------------- roster */

  const participants = useMemo(() => {
    if (call.status === "idle") return [];

    const ids = new Set([
      ...Object.keys(rtc.remoteStreams),
      ...Object.keys(rtc.peerStates),
    ]);

    /* Before anyone has connected, show who we are calling so the screen is
       not empty while it rings. */
    if (!ids.size && call.peer?.userid && !call.groupId) {
      ids.add(String(call.peer.userid));
    }

    return [...ids].map((id) => {
      const known = lookup(id) || (String(call.peer?.userid) === id ? call.peer : null);
      const state = rtc.peerStates[id] || {};
      return {
        id,
        name: known?.username || "Participant",
        avatar_url: known?.avatar_url,
        role: state.connection === "connected" ? "Connected" : "Connecting…",
        stream: rtc.remoteStreams[id] || null,
        muted: state.micOn === false,
        cameraOff: state.camOn === false,
        connection: state.connection,
      };
    });
  }, [call, rtc.remoteStreams, rtc.peerStates, lookup]);

  const value = {
    call,
    notice,
    participants,
    self: user,
    callMessages,
    sendCallMessage,
    /* media */
    localStream: rtc.localStream,
    micOn: rtc.micOn,
    camOn: rtc.camOn,
    sharing: rtc.sharing,
    mediaError: rtc.mediaError,
    toggleMic: rtc.toggleMic,
    toggleCam: rtc.toggleCam,
    toggleShare: rtc.toggleShare,
    /* actions */
    startCall,
    acceptCall,
    rejectCall,
    leaveCall,
    setDirectory,
    /* minimize — drop back into the chat list without ending the call */
    minimized,
    minimizeCall: () => setMinimized(true),
    restoreCall: () => setMinimized(false),
  };

  return (
    <CallContext.Provider value={value}>
      {children}
      {notice && <div className={toast.toast}>{notice}</div>}
    </CallContext.Provider>
  );
};

export default CallContext;
