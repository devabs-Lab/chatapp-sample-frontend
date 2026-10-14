import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axiosbase from "../axiosconfig";
import InitialsAvatar from "../components/InitialsAvatar";

/* ---------------------------------------------------------------------------
   The landing page for a shared group invite link (/invite/:token).

   It previews the group before committing rather than joining on sight —
   a link can be pasted anywhere, and silently adding someone to a group
   because they clicked a URL is not a decision to make on their behalf.
   --------------------------------------------------------------------------- */

const JoinGroup = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    /* No token in sessionStorage means nobody is signed in — the invite is
       only usable as a logged-in user, so send them to sign in first. The
       link stays in the address bar, so coming back to it after signing in
       lands here again. */
    if (!sessionStorage.getItem("token")) {
      navigate("/login");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await axiosbase.get(`/groups/invite/${token}`);
        if (!cancelled) setPreview(data);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || "This invite link is not valid");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      await axiosbase.post(`/groups/invite/${token}/join`);
      navigate("/chat");
    } catch (err) {
      setError(err.response?.data?.error || "Could not join this group");
      setJoining(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--lav, #f4eef6)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--wh, #fff)",
          borderRadius: 16,
          padding: "32px 28px",
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        {loading ? (
          <p style={{ color: "var(--plum-lt)" }}>Checking this invite…</p>
        ) : error ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔗</div>
            <h2 style={{ margin: "0 0 8px", color: "var(--plum)" }}>
              Invite unavailable
            </h2>
            <p style={{ color: "var(--plum-lt)", fontSize: 14, margin: "0 0 20px" }}>
              {error}
            </p>
            <button onClick={() => navigate("/chat")} style={buttonStyle}>
              Back to chat
            </button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <InitialsAvatar name={preview.name} size="lg" status="none" />
            </div>
            <h2 style={{ margin: "0 0 4px", color: "var(--plum)" }}>{preview.name}</h2>
            {preview.username && (
              <p style={{ color: "var(--m)", fontSize: 13, fontWeight: 600, margin: "0 0 6px" }}>
                @{preview.username}
              </p>
            )}
            <p style={{ color: "var(--plum-lt)", fontSize: 13, margin: "0 0 4px" }}>
              {preview.member_count}{" "}
              {preview.member_count === 1 ? "member" : "members"}
            </p>
            {preview.description && (
              <p style={{ color: "var(--plum-lt)", fontSize: 13, margin: "10px 0 0" }}>
                {preview.description}
              </p>
            )}

            <div style={{ marginTop: 24 }}>
              {preview.already_member ? (
                <button onClick={() => navigate("/chat")} style={buttonStyle}>
                  Open group
                </button>
              ) : (
                <button onClick={handleJoin} disabled={joining} style={buttonStyle}>
                  {joining ? "Joining…" : "Join group"}
                </button>
              )}
              <button
                onClick={() => navigate("/chat")}
                style={{
                  ...buttonStyle,
                  background: "transparent",
                  color: "var(--plum-lt)",
                  marginTop: 8,
                }}
              >
                Not now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const buttonStyle = {
  width: "100%",
  padding: "11px 16px",
  borderRadius: 10,
  border: "none",
  background: "var(--m, #91006c)",
  color: "#fff",
  fontSize: 14,
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
};

export default JoinGroup;
