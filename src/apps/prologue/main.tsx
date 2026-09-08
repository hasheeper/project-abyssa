import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ProloguePage } from "./ProloguePlayer";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/logo.css";
import "../../shared/stage/stage.css";
import "./prologue.css";
createRoot(document.getElementById("root")!).render(<StrictMode><ProloguePage/></StrictMode>);
