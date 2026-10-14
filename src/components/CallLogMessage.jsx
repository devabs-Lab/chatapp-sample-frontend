import React from "react";
import chatAreaClasses from "../pages/styling/chatArea.module.css";
import { formatCallDuration } from "../utils/messagePreview";

/* A resolved call rendered inline in the message thread — a centered pill,
   not a bubble, the way most chat apps log a call. `event` is the parsed
   payload from messagePreview.js's parseCallEvent; `iAmCaller` distinguishes
   "No answer" (my own call went unanswered) from "Missed video call"
   (someone tried to reach me) for the same underlying "missed" status. */
const CallLogMessage = ({ event, iAmCaller, id }) => {
  const isVideo = event.call_type !== "audio";
  const kind = isVideo ? "Video call" : "Voice call";

  let label;
  switch (event.call_status) {
    case "missed":
      label = iAmCaller ? "No answer" : `Missed ${kind.toLowerCase()}`;
      break;
    case "declined":
      label = `${kind} declined`;
      break;
    case "ended":
      label = event.duration
        ? `${kind} · ${formatCallDuration(event.duration)}`
        : `${kind} ended`;
      break;
    default:
      label = kind;
  }

  return (
    <div className={chatAreaClasses.callLogRow} data-id={id}>
      <span className={chatAreaClasses.callLogPill}>
        <i className={`ti ${isVideo ? "ti-video" : "ti-phone"}`}></i>
        {label}
      </span>
    </div>
  );
};

export default CallLogMessage;
