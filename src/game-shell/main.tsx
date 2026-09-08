import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GameShell } from "./GameShell";
import "../shared/ui/styles/tokens.css";
import "../shared/ui/styles/components-core.css";
import "../shared/stage/stage.css";

createRoot(document.getElementById("root")!).render(<StrictMode><GameShell/></StrictMode>);
