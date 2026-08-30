import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MansionPage } from "./MansionPage";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components.css";
import "../../shared/ui/styles/dialogue.css";
import "../../shared/ui/styles/paper-doll.css";
import "../../shared/stage/stage.css";
import "./mansion.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MansionPage />
  </StrictMode>
);
