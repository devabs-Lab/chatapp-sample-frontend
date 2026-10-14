/* ---------------------------------------------------------------------------
   ICE configuration for RTCPeerConnection.

   STUN alone only works when at least one side is behind a cone NAT. Behind
   symmetric NAT (most mobile carriers, a lot of university networks) the
   candidate pair never forms and the call connects audio-less or not at all.
   A TURN server is the fix — it is not optional for a real deployment.

   Configure it in `client/.env` (all optional; STUN-only is the fallback):

     VITE_STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
     VITE_TURN_URLS=turn:turn.example.com:3478,turns:turn.example.com:5349
     VITE_TURN_USERNAME=...
     VITE_TURN_CREDENTIAL=...

   Long-lived TURN credentials in a Vite env var ship to the browser in
   plaintext — anyone can read them out of the bundle. For production, have
   the backend mint short-lived HMAC credentials and expose them on an
   authenticated endpoint, then set VITE_TURN_CREDENTIAL_URL to it.
   --------------------------------------------------------------------------- */

const DEFAULT_STUN = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
];

const splitList = (value) =>
  (value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/* Static config, built once from env. */
export const buildIceServers = () => {
  const servers = [];

  const stunUrls = splitList(import.meta.env.VITE_STUN_URLS);
  servers.push({ urls: stunUrls.length ? stunUrls : DEFAULT_STUN });

  const turnUrls = splitList(import.meta.env.VITE_TURN_URLS);
  const username = import.meta.env.VITE_TURN_USERNAME;
  const credential = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrls.length && username && credential) {
    servers.push({ urls: turnUrls, username, credential });
  }

  return servers;
};

/* Optional: fetch short-lived TURN credentials from the backend.
   Falls back to the static config if the endpoint is absent or fails —
   a missing TURN server degrades the call, it should not block it. */
export const fetchIceServers = async (axiosbase) => {
  const path = import.meta.env.VITE_TURN_CREDENTIAL_URL;
  if (!path) return buildIceServers();

  try {
    const { data } = await axiosbase.get(path);
    const dynamic = Array.isArray(data?.iceServers) ? data.iceServers : [];
    if (!dynamic.length) return buildIceServers();
    return [...buildIceServers(), ...dynamic];
  } catch {
    return buildIceServers();
  }
};

export const hasTurnConfigured = () =>
  buildIceServers().some((s) =>
    []
      .concat(s.urls)
      .some((u) => typeof u === "string" && u.startsWith("turn")),
  );
