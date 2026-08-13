import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DiceApp } from "./DiceApp";
import "../styles/tokens.css";
import "../styles/components.css";
import "../stage/stage.css";
import "./dice.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DiceApp />
  </StrictMode>
);
