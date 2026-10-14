import { useCallback, useEffect, useRef, useState } from "react";
import { buildIceServers } from "../utils/iceConfig";

/* ---------------------------------------------------------------------------
   useWebRTC — mesh WebRTC over the existing Socket.IO relay.

   The backend (socket/callHandler.js) relays whatever we put in `signal`
   verbatim, either to one user (`to`) or to everyone else in `call-<callId>`
   (`callId` only). It does not understand WebRTC, so the whole protocol below
   lives on the client and both directions use the same envelope:

     { kind: "peer-join"   }            broadcast — "I am here, who else is?"
     { kind: "peer-here"   }            direct    — "I was already here"
     { kind: "peer-leave"  }            broadcast — "I am hanging up"
     { kind: "description", description }
     { kind: "candidate",   candidate  }
     { kind: "media-state", micOn, camOn }

   Discovery is deliberately roster-free: a newcomer broadcasts `peer-join`,
   everyone already in the room answers `peer-here`, and both sides create a
   RTCPeerConnection on first contact. The same code therefore drives 1:1 and
   group calls — the only difference is how many peers answer.

   Negotiation uses the "perfect negotiation" pattern. Both sides create their
   connection at roughly the same moment, so both can fire negotiationneeded
   and glare is a question of when, not if. The polite peer (lower user id)
   rolls back its own offer on collision; the impolite one ignores the
   incoming offer. Without this, two people joining a group call in the same
   second wedge each other in `have-local-offer` forever.
   --------------------------------------------------------------------------- */

const audioVideoConstraints = (wantVideo) => ({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: wantVideo
    ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
    : false,
});

const useWebRTC = ({ socket, selfId, callId, callType = "video", active }) => {
  const [localStream, setLocalStream] = useState(null);
  /* peerId -> MediaStream */
  const [remoteStreams, setRemoteStreams] = useState({});
  /* peerId -> { micOn, camOn, connection } */
  const [peerStates, setPeerStates] = useState({});
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(callType === "video");
  const [sharing, setSharing] = useState(false);
  const [mediaError, setMediaError] = useState(null);

  /* Handlers fire outside React's render cycle, so everything they touch is
     mirrored into a ref. Reading state there would close over a stale value. */
  const peersRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const callIdRef = useRef(null);
  const selfStateRef = useRef({ micOn: true, camOn: callType === "video" });

  callIdRef.current = callId;

  /* ------------------------------------------------------------------ send */

  const sendSignal = useCallback(
    (signal, to) => {
      if (!socket || !callIdRef.current) return;
      socket.emit("webrtc-signal", {
        to: to || undefined,
        callId: callIdRef.current,
        signal,
      });
    },
    [socket],
  );

  const broadcastMediaState = useCallback(() => {
    sendSignal({
      kind: "media-state",
      micOn: selfStateRef.current.micOn,
      camOn: selfStateRef.current.camOn,
    });
  }, [sendSignal]);

  /* ------------------------------------------------------- peer connections */

  const closePeer = useCallback((peerId) => {
    const entry = peersRef.current.get(peerId);
    if (!entry) return;
    try {
      entry.pc.ontrack = null;
      entry.pc.onicecandidate = null;
      entry.pc.onnegotiationneeded = null;
      entry.pc.onconnectionstatechange = null;
      entry.pc.close();
    } catch {
      /* already closed */
    }
    peersRef.current.delete(peerId);
    setRemoteStreams((prev) => {
      if (!(peerId in prev)) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
    setPeerStates((prev) => {
      if (!(peerId in prev)) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  }, []);

  const ensurePeer = useCallback(
    (peerId) => {
      if (!peerId || peerId === selfId) return null;
      const existing = peersRef.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: buildIceServers() });

      const entry = {
        pc,
        /* Deterministic and symmetric: both sides compute the same answer
           from the two ids, so exactly one of them is polite. */
        polite: String(selfId) < String(peerId),
        makingOffer: false,
        ignoreOffer: false,
        settingRemoteAnswer: false,
        stream: new MediaStream(),
        pendingCandidates: [],
      };
      peersRef.current.set(peerId, entry);

      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach((track) => pc.addTrack(track, localStreamRef.current));
      } else {
        /* No mic or camera (denied, or none present). Still negotiate, but
           receive-only — otherwise there is nothing to offer and the peer
           never sends us its media either. */
        pc.addTransceiver("audio", { direction: "recvonly" });
        if (callType === "video") {
          pc.addTransceiver("video", { direction: "recvonly" });
        }
      }

      pc.ontrack = (event) => {
        const [incoming] = event.streams;
        const stream = incoming || entry.stream;
        if (!incoming) entry.stream.addTrack(event.track);
        setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({ kind: "candidate", candidate: event.candidate }, peerId);
        }
      };

      pc.onnegotiationneeded = async () => {
        try {
          entry.makingOffer = true;
          await pc.setLocalDescription();
          sendSignal(
            { kind: "description", description: pc.localDescription },
            peerId,
          );
        } catch (err) {
          console.error("[webrtc] negotiation failed for", peerId, err);
        } finally {
          entry.makingOffer = false;
        }
      };

      pc.onconnectionstatechange = () => {
        setPeerStates((prev) => ({
          ...prev,
          [peerId]: { ...(prev[peerId] || {}), connection: pc.connectionState },
        }));
        if (pc.connectionState === "failed") {
          /* One restart attempt; a mesh leg can lose its candidate pair when
             a phone flips from wifi to cellular. */
          try {
            pc.restartIce();
          } catch {
            /* not supported — the leg stays down */
          }
        }
      };

      setPeerStates((prev) => ({
        ...prev,
        [peerId]: {
          micOn: true,
          camOn: callType === "video",
          connection: "new",
        },
      }));

      return entry;
    },
    [selfId, callType, sendSignal],
  );

  /* ---------------------------------------------------------- signal inbox */

  const handleSignal = useCallback(
    async ({ from, signal, callId: incomingCallId }) => {
      if (!signal || !from || from === String(selfId)) return;
      if (
        incomingCallId &&
        callIdRef.current &&
        String(incomingCallId) !== String(callIdRef.current)
      ) {
        return;
      }

      if (signal.kind === "peer-join") {
        /* Someone new arrived. Announce ourselves back so they open a
           connection to us, and open ours to them. */
        sendSignal({ kind: "peer-here" }, from);
        ensurePeer(from);
        broadcastMediaState();
        return;
      }

      if (signal.kind === "peer-here") {
        ensurePeer(from);
        broadcastMediaState();
        return;
      }

      if (signal.kind === "peer-leave") {
        closePeer(from);
        return;
      }

      if (signal.kind === "media-state") {
        setPeerStates((prev) => ({
          ...prev,
          [from]: {
            ...(prev[from] || {}),
            micOn: signal.micOn,
            camOn: signal.camOn,
          },
        }));
        return;
      }

      const entry = ensurePeer(from);
      if (!entry) return;
      const { pc } = entry;

      try {
        if (signal.kind === "description") {
          const description = signal.description;
          const readyForOffer =
            !entry.makingOffer &&
            (pc.signalingState === "stable" || entry.settingRemoteAnswer);
          const offerCollision = description.type === "offer" && !readyForOffer;

          entry.ignoreOffer = !entry.polite && offerCollision;
          if (entry.ignoreOffer) return;

          entry.settingRemoteAnswer = description.type === "answer";
          await pc.setRemoteDescription(description);
          entry.settingRemoteAnswer = false;

          /* Candidates that beat the remote description here. */
          for (const candidate of entry.pendingCandidates.splice(0)) {
            await pc.addIceCandidate(candidate).catch(() => {});
          }

          if (description.type === "offer") {
            await pc.setLocalDescription();
            sendSignal(
              { kind: "description", description: pc.localDescription },
              from,
            );
          }
          return;
        }

        if (signal.kind === "candidate") {
          if (!pc.remoteDescription || !pc.remoteDescription.type) {
            entry.pendingCandidates.push(signal.candidate);
            return;
          }
          await pc.addIceCandidate(signal.candidate);
        }
      } catch (err) {
        if (!entry.ignoreOffer) {
          console.error("[webrtc] signal handling failed for", from, err);
        }
      }
    },
    [selfId, ensurePeer, sendSignal, closePeer, broadcastMediaState],
  );

  /* --------------------------------------------------------- session set-up */

  useEffect(() => {
    if (!active || !socket || !callId) return;

    let cancelled = false;
    /* Captured for the cleanup: the Map instance itself never changes, but
       reading a ref in a cleanup function is the kind of thing that bites
       later if that ever stops being true. */
    const peers = peersRef.current;

    const start = async () => {
      const wantVideo = callType === "video";
      let stream = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia(
          audioVideoConstraints(wantVideo),
        );
      } catch (err) {
        /* A missing camera should not cost us the audio call. */
        if (wantVideo) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(
              audioVideoConstraints(false),
            );
            setMediaError("Camera unavailable — joined with audio only.");
          } catch (audioErr) {
            setMediaError(
              audioErr?.name === "NotAllowedError"
                ? "Microphone and camera blocked. Allow access in your browser to be heard."
                : "No microphone or camera available. You can still hear the call.",
            );
          }
        } else {
          setMediaError(
            err?.name === "NotAllowedError"
              ? "Microphone blocked. Allow access in your browser to be heard."
              : "No microphone available. You can still hear the call.",
          );
        }
      }

      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      if (stream) {
        localStreamRef.current = stream;
        cameraTrackRef.current = stream.getVideoTracks()[0] || null;
        setLocalStream(stream);
        const hasVideo = !!cameraTrackRef.current;
        selfStateRef.current = { micOn: true, camOn: hasVideo && wantVideo };
        setCamOn(hasVideo && wantVideo);
        setMicOn(true);
      } else {
        selfStateRef.current = { micOn: false, camOn: false };
        setMicOn(false);
        setCamOn(false);
      }

      socket.emit("join-call-room", { callId });
      sendSignal({ kind: "peer-join" });
      broadcastMediaState();
    };

    start();

    return () => {
      cancelled = true;
      /* Tell the room before the socket room membership goes away. */
      sendSignal({ kind: "peer-leave" });
      socket.emit("leave-call-room", { callId });

      peers.forEach((_, peerId) => closePeer(peerId));
      peers.clear();

      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      screenStreamRef.current = null;
      cameraTrackRef.current = null;

      setLocalStream(null);
      setRemoteStreams({});
      setPeerStates({});
      setSharing(false);
      setMediaError(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, socket, callId, callType]);

  /* ------------------------------------------------------- socket listeners */

  useEffect(() => {
    if (!socket || !active) return;

    const onLeft = ({ callId: id, userId }) => {
      if (callIdRef.current && id && String(id) !== String(callIdRef.current)) {
        return;
      }
      closePeer(userId);
    };

    socket.on("webrtc-signal", handleSignal);
    socket.on("user-left-call", onLeft);

    return () => {
      socket.off("webrtc-signal", handleSignal);
      socket.off("user-left-call", onLeft);
    };
  }, [socket, active, handleSignal, closePeer]);

  /* -------------------------------------------------------------- controls */

  const toggleMic = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    if (!tracks.length) return;
    const next = !selfStateRef.current.micOn;
    tracks.forEach((t) => {
      t.enabled = next;
    });
    selfStateRef.current.micOn = next;
    setMicOn(next);
    broadcastMediaState();
  }, [broadcastMediaState]);

  const replaceVideoTrackOnPeers = useCallback(async (track) => {
    const jobs = [];
    peersRef.current.forEach(({ pc }) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        jobs.push(sender.replaceTrack(track).catch(() => {}));
      } else if (track && localStreamRef.current) {
        /* Audio call upgrading to video: a brand new sender means a
           renegotiation, which onnegotiationneeded picks up. */
        pc.addTrack(track, localStreamRef.current);
      }
    });
    await Promise.all(jobs);
  }, []);

  const toggleCam = useCallback(async () => {
    const next = !selfStateRef.current.camOn;

    if (next && !cameraTrackRef.current) {
      /* Nothing to re-enable — acquire a camera now (audio call → video). */
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        const track = camStream.getVideoTracks()[0];
        cameraTrackRef.current = track;
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(track);
        } else {
          localStreamRef.current = camStream;
          setLocalStream(camStream);
        }
        await replaceVideoTrackOnPeers(track);
      } catch {
        setMediaError("Could not turn the camera on.");
        return;
      }
    }

    const track = cameraTrackRef.current;
    if (track && !sharing) track.enabled = next;

    selfStateRef.current.camOn = next;
    setCamOn(next);
    broadcastMediaState();
  }, [sharing, replaceVideoTrackOnPeers, broadcastMediaState]);

  const stopSharing = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    const camTrack = cameraTrackRef.current;
    if (camTrack) camTrack.enabled = selfStateRef.current.camOn;
    await replaceVideoTrackOnPeers(camTrack || null);
    setSharing(false);
  }, [replaceVideoTrackOnPeers]);

  const toggleShare = useCallback(async () => {
    if (sharing) {
      await stopSharing();
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const track = display.getVideoTracks()[0];
      screenStreamRef.current = display;
      /* The browser's own "Stop sharing" bar bypasses our button. */
      track.addEventListener("ended", () => {
        stopSharing();
      });
      await replaceVideoTrackOnPeers(track);
      setSharing(true);
    } catch {
      /* User dismissed the picker — not an error worth surfacing. */
    }
  }, [sharing, stopSharing, replaceVideoTrackOnPeers]);

  return {
    localStream,
    remoteStreams,
    peerStates,
    micOn,
    camOn,
    sharing,
    mediaError,
    toggleMic,
    toggleCam,
    toggleShare,
  };
};

export default useWebRTC;
