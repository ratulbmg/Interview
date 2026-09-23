import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";

/**
 * Login, Candidates, Sessions, Questions and Session-detail pages, plus
 * routing and the Redux store, are built out in Phase 3 — see the build
 * plan in README.md.
 */
function App() {
  return (
    <div>
      Interview Dashboard — scaffold only, Phase 3 builds the real pages.
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
