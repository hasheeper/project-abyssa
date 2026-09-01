import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MansionPage } from "./MansionPage";
import { SceneTransitionProvider } from "../../shared/transition";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components.css";
/* 物品格位 / 模态 / 背包网格。各应用是**按需挑选**样式表的(只有
   character-status 走 index.css 全量),所以新增共享样式必须在这里显式引入,
   改 index.css 到不了这儿。 */
import "../../shared/ui/styles/items.css";
import "../../shared/ui/styles/dialogue.css";
import "../../shared/ui/styles/paper-doll.css";
import "../../shared/stage/stage.css";
import "./mansion.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SceneTransitionProvider>
      <MansionPage />
    </SceneTransitionProvider>
  </StrictMode>
);
