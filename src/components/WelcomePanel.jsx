import React from "react";
import w from "../pages/styling/welcome.module.css";

const FEATURES = [
  {
    icon: "ti-message-circle",
    title: "Direct messages",
    text: "Talk one-to-one with classmates and instructors. Messages sync across your devices and show when they have been read.",
  },
  {
    icon: "ti-users",
    title: "Course groups",
    text: "Join a cohort or study group for your course, and keep the discussion in channels so topics stay easy to follow.",
  },
  {
    icon: "ti-paperclip",
    title: "Share your work",
    text: "Send assignments, notes, images, audio and video straight into a conversation — no need for a separate upload link.",
  },
];

/**
 * Fills the chat column when no conversation is open, so the middle of
 * the screen explains what the forum is instead of sitting empty.
 */
const WelcomePanel = ({ username }) => (
  <div className={w.welcome}>
    <div className={w.inner}>
      <div className={w.logo}>U</div>

      <h1 className={w.title}>
        {username ? `Welcome back, ${username}` : "UoPeople Discussion Forum"}
      </h1>

      <p className={w.lead}>
        The discussion space for University of the People students. Ask about
        assignments, work through a tricky unit together, and stay connected
        with your course mates — wherever in the world you are studying from.
      </p>

      <div className={w.features}>
        {FEATURES.map((f) => (
          <div className={w.feature} key={f.title}>
            <span className={w.featureIcon}>
              <i className={`ti ${f.icon}`}></i>
            </span>
            <div className={w.featureBody}>
              <span className={w.featureTitle}>{f.title}</span>
              <span className={w.featureText}>{f.text}</span>
            </div>
          </div>
        ))}
      </div>

      <span className={w.hint}>
        <i className="ti ti-arrow-left"></i>
        Pick a conversation on the left to start chatting
      </span>
    </div>
  </div>
);

export default WelcomePanel;
