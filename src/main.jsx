import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { applyTheme, getStoredTheme } from "./utils/theme";

/* Set the saved theme before the first paint, otherwise a "classic"
   user briefly sees the deep sidebar. */
applyTheme(getStoredTheme());

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
