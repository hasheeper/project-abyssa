import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MenuPage } from "./MenuPage";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components.css";
/* 各应用是**按需挑选**样式表的(只有 character-status 走 index.css 全量),
   所以用到的共享样式必须在这里显式引入 —— 改 index.css 到不了这儿。
   dialogue.css 提供 RpgDialogue 的 autoHeight 画框。 */
import "../../shared/ui/styles/dialogue.css";
import "../../shared/stage/stage.css";
import "../../shared/transition/transition.css";
import "./menu.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MenuPage />
  </StrictMode>
);
