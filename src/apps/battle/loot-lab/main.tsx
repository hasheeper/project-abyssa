import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "../../../shared/ui/styles/tokens.css";
import "../../../shared/ui/styles/components-core.css";
import "../../../shared/ui/styles/items.css";
import "../../../shared/ui/styles/scene-feedback.css";
import "../../../shared/stage/stage.css";
import "../app.css";
import "../expedition.css";
import "./loot-lab.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App/></StrictMode>);
