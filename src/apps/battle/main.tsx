import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { SceneTransitionProvider } from "../../shared/transition";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components.css";
import "../../shared/stage/stage.css";
import "./app.css";
import "./expedition.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SceneTransitionProvider reveal="panel-drop">
      <App />
    </SceneTransitionProvider>
  </StrictMode>
);
