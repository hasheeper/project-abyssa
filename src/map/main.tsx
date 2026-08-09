import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MapPage } from "./MapPage";
import "../styles/tokens.css";
import "../styles/components.css";
import "./map.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MapPage />
  </StrictMode>
);
