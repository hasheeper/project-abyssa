import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MapPage } from "./MapPage";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components.css";
import "../../shared/stage/stage.css";
import "./map.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MapPage />
  </StrictMode>
);
