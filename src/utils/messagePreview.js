/* ---------------------------------------------------------------------------
   Call-log messages.

   A resolved call is a perfectly normal `message_type: "text"` row — the
   backend (callcontroller.js) can't add a new message_type without an ALTER
   TABLE against the production `messages` CHECK constraint, so instead it
   prefixes `content` with an invisible marker (U+2063) that no real typed or
   pasted text can produce, followed by a small JSON payload. This must match
   CALL_EVENT_PREFIX in callcontroller.js exactly — same character, same
   position.
   --------------------------------------------------------------------------- */
export const CALL_EVENT_PREFIX = "⁣call:";

/** `content` -> `{ call_type, call_status, duration }`, or null if this
    message isn't a call event. */
export const parseCallEvent = (content) => {
  if (typeof content !== "string" || !content.startsWith(CALL_EVENT_PREFIX)) {
    return null;
  }
  try {
    return JSON.parse(content.slice(CALL_EVENT_PREFIX.length));
  } catch {
    return null;
  }
};

/** mm:ss (or h:mm:ss past an hour) for a call's talk time. */
export const formatCallDuration = (totalSeconds) => {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** One line for a call-log entry. `iAmCaller` distinguishes "No answer"
    (my own outgoing call went unanswered) from "Missed video call" (someone
    tried to reach me) — both are the same `call_status: "missed"` row, read
    differently depending on which side of it you're on. */
export const formatCallPreview = (event, iAmCaller) => {
  const kind = event.call_type === "audio" ? "Voice call" : "Video call";

  switch (event.call_status) {
    case "missed":
      return iAmCaller ? `📞 No answer` : `📞 Missed ${kind.toLowerCase()}`;
    case "declined":
      return `📞 ${kind} declined`;
    case "ended":
      return event.duration
        ? `📞 ${kind} · ${formatCallDuration(event.duration)}`
        : `📞 ${kind} ended`;
    default:
      return `📞 ${kind}`;
  }
};

/**
 * One-line summary of a conversation's most recent message, for the inbox list.
 *
 * `entry` is either a row from /messages/conversations or a message object
 * recorded live in ChatContext, so both shapes are accepted.
 */
export const formatMessagePreview = (entry, currentUserId) => {
  if (!entry) return "";

  const type = entry.last_message_type || entry.message_type || "text";
  const content = entry.last_message ?? entry.content ?? "";
  const filename = entry.last_message_filename || entry.filename || "";
  const senderId = entry.last_message_sender_id || entry.sender_id;

  const callEvent = type === "text" ? parseCallEvent(content) : null;
  if (callEvent) {
    /* A call reads fine on its own ("Video call · 5:32") — prefixing it
       with "You:" the way a text/file preview is would just be noise. */
    return formatCallPreview(callEvent, senderId && senderId === currentUserId);
  }

  let body;
  switch (type) {
    case "image":
      body = "Photo";
      break;
    case "video":
      body = "Video";
      break;
    case "audio":
      body = "Voice message";
      break;
    case "file":
      body = filename || "File";
      break;
    default:
      body = (content || "").replace(/\s+/g, " ").trim();
  }

  if (!body) return "";

  /* Mirrors how other chat apps mark your own last message. */
  const mine = currentUserId && senderId && senderId === currentUserId;
  return mine ? `You: ${body}` : body;
};

/** Short relative time for the right-hand column of an inbox row. */
export const formatPreviewTime = (value) => {
  if (!value) return "";
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return "";

  const diffMs = Date.now() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) {
    return then.toLocaleDateString(undefined, { weekday: "short" });
  }
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
