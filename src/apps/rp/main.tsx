import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components.css";
import "../../shared/ui/styles/paper-doll.css";
import "../../shared/ui/styles/rp.css";
import "../../shared/stage/stage.css";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
