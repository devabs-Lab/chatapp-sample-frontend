import React, { useEffect, useRef } from "react";
import s from "../pages/styling/themeMenu.module.css";
import { THEMES } from "../utils/theme";

/** Compact appearance picker, opened from the palette icon in the sidebar footer. */
const ThemeMenu = ({ open, theme, onSelectTheme, onClose }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;

    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };

    /* mousedown, so the click that opened the menu doesn't close it */
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  /* The user card behind this menu opens the profile form on click,
     so swallow clicks that land inside the menu. */
  return (
    <div
      className={s.menu}
      ref={ref}
      role="dialog"
      aria-label="Appearance"
      onClick={(e) => e.stopPropagation()}
    >
      {THEMES.map((t) => (
        <button
          key={t.id}
          className={`${s.option} ${theme === t.id ? s.active : ""}`}
          onClick={() => onSelectTheme(t.id)}
          title={t.description}
        >
          <span className={s.swatch}>
            {t.swatch.map((c) => (
              <span key={c} style={{ background: c }} />
            ))}
          </span>

          <span className={s.label}>{t.label}</span>

          {theme === t.id && (
            <i className={`ti ti-check ${s.check}`} aria-hidden="true"></i>
          )}
        </button>
      ))}
    </div>
  );
};

export default ThemeMenu;
