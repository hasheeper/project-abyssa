import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TitlePage } from "./TitlePage";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components.css";
/* 各应用是**按需挑选**样式表的(只有 character-status 走 index.css 全量),
   所以用到的共享样式必须在这里显式引入 —— 改 index.css 到不了这儿。
   logo.css 提供 AbyssaLogo 的中文/问号字族与部件过渡,缺了字标会掉字形。 */
import "../../shared/ui/styles/logo.css";
import "../../shared/stage/stage.css";
import "./title.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TitlePage />
  </StrictMode>
);
