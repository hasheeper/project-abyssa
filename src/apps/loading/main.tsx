import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LoadingPage } from "./LoadingPage";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components.css";
import "./loading.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LoadingPage />
  </StrictMode>
);
