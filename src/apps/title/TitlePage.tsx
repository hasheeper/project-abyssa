import { useState } from "react";
import type { CSSProperties } from "react";
import { AbyssaLogo } from "../../shared/ui/branding/AbyssaLogo";
import { ABYSSA_LOGO_INTRO_TOTAL_MS } from "../../shared/ui/branding/abyssaLogoIntro";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { RibbonButton } from "../../shared/ui/primitives/RibbonButton";
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
import {
  DEFAULT_TITLE_THEME,
  TITLE_THEMES,
  getNextTitleTheme,
  resolveTitleTheme
} from "./titleThemes";
import type { TitleThemeId } from "./titleThemes";

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
 * 主题(黑金/猩红/青幽)只改 CSS 变量,不碰任何尺寸。
 */

const IDLE_HINT = "尚未有存档。";
const TITLE_COMMAND_INTRO_GAP_MS = 130;
const TITLE_COMMAND_INTRO_START_MS = ABYSSA_LOGO_INTRO_TOTAL_MS + 160;

/* SVG 法阵、自转轴与下层透光区共用同一个原点。放在共同祖先上可避免
   其中一层改了坐标、另一层仍停在画布中心。 */
const TITLE_FIELD_STYLE = {
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
  const [hint, setHint] = useState(IDLE_HINT);
  const [themeId, setThemeId] = useState<TitleThemeId>(DEFAULT_TITLE_THEME);

  const theme = resolveTitleTheme(themeId);

  function activate(id: TitleCommandId) {
    const command = TITLE_COMMANDS.find((item) => item.id === id);
    if (!command) return;

    if (!command.target) {
      setHint(`${command.label}——${command.pending}`);
      return;
    }

    navigate(command.target.href, {
      destination: command.target.destination,
      channel: command.target.channel
    });
  }

  return (
    <Stage background={theme.canvas} canvasClassName="abyssa-title-screen">
      {/*
        AbyssaProvider 不是可选的装饰:tokens.css 的 prefers-reduced-motion
        规则挂在 `.abyssa-theme` 上,少了它背景场的自转会无视系统的降低动效
        设置。它同时提供 color-scheme 与正文字族。
        data-theme 是本屏三套皮肤的唯一开关,只驱动 CSS 变量。
      */}
      <AbyssaProvider className="title-app" data-theme={themeId} style={TITLE_FIELD_STYLE}>
        {/* 层序:CG → 黑幕 → 背景场 → 内容。
            黑幕夹在 CG 与背景场之间,所以它压暗照片但不吃掉描边图案 ——
            反过来会把整屏连同字标一起糊掉。 */}
        <TitleCgPanel
          side="left"
          dwellMs={TITLE_CG_DWELL_MS.left}
          initialDelayMs={TITLE_CG_INITIAL_DELAY_MS.left}
          fadeMs={TITLE_CG_FADE_MS.left}
          step={TITLE_CG_STEP.left}
        />
        <TitleCgPanel
          side="right"
          dwellMs={TITLE_CG_DWELL_MS.right}
          initialIndex={TITLE_CG_RIGHT_OFFSET}
          initialDelayMs={TITLE_CG_INITIAL_DELAY_MS.right}
          fadeMs={TITLE_CG_FADE_MS.right}
          step={TITLE_CG_STEP.right}
        />

        <div className="title-shade" aria-hidden="true" />

        <TitleBackdrop />

        <main className="title-stack">
          {/*
            background="none" 是必需的,不是可选项:AbyssaLogo 默认画一块不透明
            的近黑底板,直接放上来会盖掉背景场与 CG。
            crop="tight" 把 viewBox 从 1024 收到 800,同宽下字标放大约 1.28 倍。
            外层 div 是做旧层的载体 —— 颗粒与晕影要用伪元素,而伪元素在 SVG
            元素上不可靠,必须包一层 HTML。
          */}
          <div className="title-emblem">
            <AbyssaLogo
              className="title-emblem__art"
              background="none"
              crop="tight"
              intro
            />
          </div>

          <nav className="title-commands" aria-label="标题菜单">
            {TITLE_COMMANDS.map((command, index) => (
              <RibbonButton
                key={command.id}
                className="title-commands__item"
                variant={command.variant}
                data-intro-order={index}
                style={{
                  animationDelay: `${TITLE_COMMAND_INTRO_START_MS + index * TITLE_COMMAND_INTRO_GAP_MS}ms`
                }}
                disabled={isTransitioning}
                onClick={() => activate(command.id)}
              >
                {command.label}
              </RibbonButton>
            ))}
          </nav>
        </main>

        {/* 底部信息带与中轴是相邻关系:中轴的 inset-block-end 正好让开这条带子,
            两者不再叠加(上一版提示行压在第四个键上,重叠 36.93px)。 */}
        <footer className="title-footer">
          <p className="title-hint" role="status">{hint}</p>
          <p className="title-imprint">视觉原型 · PROTOTYPE</p>
        </footer>

        {/* 皮肤切换。视觉原型阶段是显式控件,将来应并入设定界面。 */}
        <div className="title-skins" role="group" aria-label="界面主题">
          {TITLE_THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              className="title-skins__item"
              data-selected={item.id === themeId || undefined}
              aria-pressed={item.id === themeId}
              onClick={() => setThemeId(item.id)}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            className="title-skins__cycle"
            onClick={() => setThemeId((current) => getNextTitleTheme(current))}
          >
            下一套
          </button>
        </div>
      </AbyssaProvider>
    </Stage>
  );
}
