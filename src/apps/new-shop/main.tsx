import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components-core.css";
import "../../shared/ui/styles/items.css";
import "../../shared/ui/styles/paper-doll.css";
import "../../shared/ui/styles/scene-feedback.css";
import "../../shared/stage/stage.css";
import "../../game-client/shop/styles.css";
import "./preview.css";

const entranceProfile = new URLSearchParams(window.location.search).get("entry") === "handoff" ? "handoff" : "standard";
createRoot(document.getElementById("root")!).render(<StrictMode><App entranceProfile={entranceProfile} /></StrictMode>);
