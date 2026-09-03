import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SettingsPage } from "./SettingsPage";
/* 显式样式包 —— 不能 import components.css 或 index.css。
   styles/style-entry-boundaries.test.ts 会逐个扫描各 app 的 main.tsx
   并断言这一点,新 app 一建就自动纳入该测试。
   rp-typing.css 是有意引入的:打字机预览复用 rp 的逐字动画,读同一批
   变量与 class,预览才等于实际效果(见 TypingPreview 的说明)。 */
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components-core.css";
import "../../shared/ui/styles/rp-typing.css";
import "../../shared/stage/stage.css";
import "./settings.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SettingsPage />
  </StrictMode>
);
