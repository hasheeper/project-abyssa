import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ShopPage } from "./ShopPage";
import { SceneTransitionProvider } from "../../shared/transition";
import "../../shared/ui/styles/index.css";
import "../../shared/stage/stage.css";
import "./shop.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SceneTransitionProvider reveal="panel-drop">
      <ShopPage />
    </SceneTransitionProvider>
  </StrictMode>
);
