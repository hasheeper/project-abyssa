import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MansionPage } from "./MansionPage";
import "../styles/tokens.css";
import "../styles/components.css";
import "../styles/dialogue.css";
import "../styles/paper-doll.css";
import "../stage/stage.css";
import "../rp/app.css";
import "./mansion.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MansionPage />
  </StrictMode>
);
