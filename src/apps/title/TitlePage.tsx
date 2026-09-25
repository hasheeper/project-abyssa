import { readRoute } from "../../shared/routing/location";
import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AbyssaLogo } from "../../shared/ui/branding/AbyssaLogo";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { Stage } from "../../shared/stage";
import { SceneTransitionProvider, useSceneTransition } from "../../shared/transition";
import { TitleBackdrop } from "./TitleBackdrop";
import { TitleCgPanel } from "./TitleCgPanel";
import {
  TITLE_CG_DWELL_MS,
  TITLE_CG_FADE_MS,
  TITLE_CG_INITIAL_DELAY_MS,
  TITLE_CG_RIGHT_OFFSET,
  TITLE_CG_STEP
} from "./titleCg";
import { TITLE_COMMANDS } from "./titleCommands";
import type { TitleCommandId } from "./titleCommands";
import { TITLE_FIELD_CENTRE_X, TITLE_FIELD_CENTRE_Y } from "./titleGeometry";
import { TitleArchive } from "./TitleArchive";
import { SettingsScene } from "../../game-client/settings/SettingsScene";
import { useTitleArchive } from "./useTitleArchive";
import { NewGameDialog } from "./NewGameDialog";
import { TitleCommandMenu } from "./TitleCommandMenu";
import { useTitleParallax } from "./useTitleParallax";

/* ============ 标题画面 ============
 *
 * 进游戏前的第一屏。与 menu(枢纽)的分工:标题只做「开始/读取/设定」这类
 * **档案层**入口,枢纽做档案已载入之后的日常调度。
 *
 * 构图是一条竖向中轴:徽记在上,命令列在下,两侧各一条 CG 轮播。
 * 几何全部来自 titleGeometry.ts(那里有连锁加法链和断言)。
 * 画布内一个视口单位都没有 —— 见 stage/README.md 铁律 1,
 * vw/cqh 会与 Stage 的整体 scale 叠成二次缩放。
 *
 * 标题固定使用猩红配色，颜色令牌与构图尺寸分开维护。
 */

/* SVG 法阵与下层透光区共用同一个原点。放在共同祖先上可避免
   其中一层改了坐标、另一层仍停在画布中心。 */
const TITLE_CANVAS = "#070304";
const TITLE_FIELD_STYLE = {
  "--title-canvas": TITLE_CANVAS,
  "--title-field-origin": `${TITLE_FIELD_CENTRE_X}px ${TITLE_FIELD_CENTRE_Y}px`
} as CSSProperties;

export function TitlePage() {
  return (
    // 标题是满幅世界场景,不是有界面板,所以用 fade 而不是 panel-drop。
    <SceneTransitionProvider reveal="fade">
      <TitlePageContent />
    </SceneTransitionProvider>
  );
}

function TitlePageContent() {
  const { navigate, isTransitioning } = useSceneTransition();
  const [hint, setHint] = useState("");
  const [startOpen, setStartOpen] = useState(false);
  const [startPresented, setStartPresented] = useState(false);
  const [archivePresented, setArchivePresented] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false), [settingsPresented, setSettingsPresented] = useState(false);
  const [startAttempted, setStartAttempted] = useState(false);
  const creating = useRef(false);
  const archive = useTitleArchive(href => { const opening = readRoute(new URL(href, window.location.href))?.page === "prologue"; navigate(href, { destination: opening ? "序幕" : "守望者之崖", channel: "正在载入", cinematic: opening || creating.current }); });
  const modalOpen = startOpen || archive.open || startPresented || archivePresented || settingsOpen || settingsPresented;
  const sceneRef = useTitleParallax(modalOpen || isTransitioning || archive.busy);
  const hasSave = archive.saves.some(save => save.status === "ready" && !archive.archivedIds.has(save.saveId));

  function activate(id: TitleCommandId) {
    setHint("");
    if (id === "begin") { setStartAttempted(false); setStartOpen(true); return; }
    if (id === "continue") { void archive.continueGame(); return; }
    if (id === "archive") { archive.setOpen(true); return; }
    if (id === "settings") { setSettingsOpen(true); return; }
    const command = TITLE_COMMANDS.find((item) => item.id === id);
    if (!command) return;

    setHint(`${command.label}——${command.pending}`);
  }

  return (
    // While a modal is present, focus must not scroll the scaled stage itself.
    <Stage background={startOpen || startPresented ? "#000" : TITLE_CANVAS}
      style={modalOpen ? { background: startOpen || startPresented ? "#000" : TITLE_CANVAS, overflow: "clip" } : undefined} canvasClassName="abyssa-title-screen">
      <div ref={sceneRef} className="title-scene">
      {/*
        AbyssaProvider 提供统一 tokens、color-scheme、正文字族与降低动效设置。
        data-theme 标识固定的猩红配色。
      */}
      <AbyssaProvider className="title-app" data-theme="crimson" style={TITLE_FIELD_STYLE}>
        {/* 层序:CG → 黑幕 → 背景场 → 内容。
            黑幕夹在 CG 与背景场之间,所以它压暗照片但不吃掉描边图案 ——
            反过来会把整屏连同字标一起糊掉。 */}
        <div className="title-cg-layer" data-side="left"><TitleCgPanel
          side="left"
          dwellMs={TITLE_CG_DWELL_MS.left}
          initialDelayMs={TITLE_CG_INITIAL_DELAY_MS.left}
          fadeMs={TITLE_CG_FADE_MS.left}
          step={TITLE_CG_STEP.left}
        /></div>
        <div className="title-cg-layer" data-side="right"><TitleCgPanel
          side="right"
          dwellMs={TITLE_CG_DWELL_MS.right}
          initialIndex={TITLE_CG_RIGHT_OFFSET}
          initialDelayMs={TITLE_CG_INITIAL_DELAY_MS.right}
          fadeMs={TITLE_CG_FADE_MS.right}
          step={TITLE_CG_STEP.right}
        /></div>

        <div className="title-shade" aria-hidden="true" />

        <TitleBackdrop />

        <main className="title-stack" inert={modalOpen}>
          {/*
            background="none" 是必需的,不是可选项:AbyssaLogo 默认画一块不透明
            的近黑底板,直接放上来会盖掉背景场与 CG。
            crop="tight" 把 viewBox 从 1024 收到 800,同宽下字标放大约 1.28 倍。
            外层 div 是做旧层的载体 —— 颗粒与晕影要用伪元素,而伪元素在 SVG
            元素上不可靠,必须包一层 HTML。
          */}
          <div className="title-emblem">
            {/* Logo 原时序不改，菜单沿用其总时长接续逐项入场。 */}
            <AbyssaLogo
              className="title-emblem__art"
              background="none"
              crop="tight"
              intro
            />
          </div>

          <TitleCommandMenu intro defaultCommand={hasSave ? "continue" : "begin"}
            disabled={isTransitioning || archive.busy || modalOpen}
            onActivate={activate} />
        </main>

        <NewGameDialog open={startOpen} busy={archive.busy || isTransitioning} pending={archive.pendingNewGame}
          onPresentChange={setStartPresented}
          message={startAttempted ? archive.message : ""}
          onClose={() => { if (!archive.busy && !isTransitioning) { creating.current = false; setStartOpen(false); } }}
          onStart={({startAt, playerName}) => { creating.current = true; setStartAttempted(true); void archive.newGame(startAt, playerName); }}/>


        {/* 底部信息带与中轴是相邻关系:中轴的 inset-block-end 正好让开这条带子,
            两者不再叠加(上一版提示行压在第四个键上,重叠 36.93px)。 */}
        <footer className="title-footer">
          <p className="title-hint" role={modalOpen ? undefined : "status"}>{modalOpen ? "" : hint || archive.message}</p>
          <p className="title-imprint">裂隙远征 · 本机存档</p>
        </footer>

      </AbyssaProvider>
      <TitleArchive archive={archive} onPresentChange={setArchivePresented}
        onNewGame={() => { archive.setOpen(false); setStartAttempted(false); setStartOpen(true); }} />
      <SettingsScene open={settingsOpen} onClose={() => setSettingsOpen(false)} onPresentChange={setSettingsPresented} />
      </div>
    </Stage>
  );
}
