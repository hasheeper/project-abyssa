import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DiceApp } from "./DiceApp";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components.css";
import "../../shared/stage/stage.css";
import "./dice.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DiceApp />
  </StrictMode>
);
