/**
 * Appearance themes.
 *
 * Both are defined purely as CSS custom properties in index.css, so
 * switching is just setting `data-theme` on <html>. "deep" is the default
 * and carries no attribute; "classic" is the earlier light look.
 */

/* Bumped when the palette changes meaningfully. A stored choice from an
   earlier key is ignored, so everyone lands on the current default once
   instead of being pinned to a theme they picked before the redesign. */
const STORAGE_KEY = "uop-theme-v2";
const LEGACY_KEYS = ["uop-theme"];

export const THEMES = [
  {
    id: "deep",
    label: "Deep",
    description: "Deep magenta sidebar with blush surfaces",
    swatch: ["#4D0239", "#91006C", "#F7F0F6"],
  },
  {
    id: "classic",
    label: "Classic",
    description: "Light sidebar with white surfaces",
    swatch: ["#F7F3F7", "#91006C", "#FFFFFF"],
  },
];

const isValid = (id) => THEMES.some((t) => t.id === id);

export const getStoredTheme = () => {
  try {
    /* drop preferences saved under a previous palette */
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));

    const saved = localStorage.getItem(STORAGE_KEY);
    return isValid(saved) ? saved : "deep";
  } catch {
    /* private mode / storage disabled */
    return "deep";
  }
};

export const applyTheme = (id) => {
  const theme = isValid(id) ? id : "deep";

  /* "deep" is the bare :root definition, so it carries no attribute */
  if (theme === "deep") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* not fatal — the theme still applies for this session */
  }

  return theme;
};
