import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./styles/tokens.css";
import "./styles/game.css";
import "./styles/ui.css";
import "./styles/reading.css";
import "./styles/badgePanel.css";
import "./styles/journalPanel.css";
import "./styles/presentation.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
