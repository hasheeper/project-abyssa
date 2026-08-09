import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "../styles/tokens.css";
import "../styles/components.css";
import "../styles/paper-doll.css";
import "../styles/rp.css";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
