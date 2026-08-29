import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MansionRegionEditor } from "./MansionRegionEditor";
import "./editor.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MansionRegionEditor />
  </StrictMode>
);
