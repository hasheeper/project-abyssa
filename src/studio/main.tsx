import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "../styles/tokens.css";
import "../styles/components.css";
import "../styles/paper-doll.css";
// rp.css 必须引入:工作台的舞台直接复用 .abyssa-rp / .abyssa-rp__seat /
// .abyssa-rp__actor 这套类,几何、取景、明暗全部走 rp 的同一份规则。
// 不这么做的话调出来的参数与 rp 里的实际观感不等价,那这个工具就没意义了。
import "../styles/rp.css";
// 必须在 rp.css 之后 —— 漫符层要覆盖 .actor-beat 的定位上下文。
import "../styles/emote.css";
import "./studio.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
