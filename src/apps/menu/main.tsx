import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MenuPage } from "./MenuPage";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components-core.css";
/* 各应用按所有权挑选样式表，所以用到的共享样式必须在这里显式引入 ——
   改公共 index.css 到不了这儿。
   dialogue.css 提供 RpgDialogue 的 autoHeight 画框。 */
import "../../shared/ui/styles/dialogue.css";
import "../../shared/stage/stage.css";
import "./menu.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MenuPage />
  </StrictMode>
);
