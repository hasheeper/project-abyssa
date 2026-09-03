import { useCallback, useMemo, useReducer, useState } from "react";
import type { CSSProperties } from "react";
import { RpgFrame } from "../../shared/ui/primitives/RpgFrame";
import { RpgHeader } from "../../shared/ui/primitives/RpgHeader";
import { RpgHexButton } from "../../shared/ui/primitives/RpgHexButton";
import { RpgNotchButton } from "../../shared/ui/primitives/RpgNotchButton";
import { RpgStatusNode } from "../../shared/ui/primitives/RpgStatusNode";
import { RpgTab } from "../../shared/ui/primitives/RpgTab";
import { Stage } from "../../shared/stage";
import { AboutSection } from "./sections/AboutSection";
import { AiServiceSection } from "./sections/AiServiceSection";
import { DisplaySection } from "./sections/DisplaySection";
import { PerformanceSection } from "./sections/PerformanceSection";
import {
  DEFAULT_SETTINGS,
  isPristine,
  settingsReducer,
  toCssVariables
} from "./settings-state";
import type { SettingsState } from "./settings-state";

type TabId = "performance" | "display" | "ai" | "about";

/**
 * 分类。label 用短的西文缩写 —— RpgTab 的字号是 30px/letter-spacing 2px,
 * viewBox 只有 180x78,中文标题排进去会挤。中文标题放在下方的 heading 里,
 * 与 SystemConfigExample 的 General/Audio/Display + 中文标题同则。
 */
const TABS: {
  id: TabId;
  label: string;
  title: string;
  description: string;
}[] = [
  {
    id: "performance",
    label: "Scene",
    title: "演出节奏",
    description: "文本推进、版式与立绘取景"
  },
  {
    id: "display",
    label: "Display",
    title: "视觉显示",
    description: "动效强度与渲染开销"
  },
  {
    id: "ai",
    label: "Model",
    title: "AI 服务",
    description: "运行时接口与模型绑定（待接入）"
  },
  {
    id: "about",
    label: "About",
    title: "关于",
    description: "版本与说明"
  }
];

export function SettingsPage() {
  const [state, dispatch] = useReducer(settingsReducer, DEFAULT_SETTINGS);
  const [tab, setTab] = useState<TabId>("performance");

  const onChange = useCallback((patch: Partial<SettingsState>) => {
    dispatch({ type: "set", patch });
  }, []);

  const pristine = isPristine(state);
  const cssVariables = useMemo(() => toCssVariables(state), [state]);

  /* 底纹挂在画布上而不是 body —— 这样它随界面缩放并止于画布边界
     (见 Stage.tsx 的 background 说明)。 */
  const background = state.backdropTexture
    ? "var(--settings-backdrop)"
    : "var(--settings-backdrop-plain)";

  const current = TABS.find((item) => item.id === tab) ?? TABS[0];

  return (
    <Stage background={background}>
      <main
        className="settings-app"
        /* 减弱动态效果:settings.css 把 tokens.css 里那套
           prefers-reduced-motion 规则复用到这个属性上,手动开关与系统偏好同源。 */
        data-reduced-motion={state.reducedMotion || undefined}
        style={cssVariables as CSSProperties}
      >
        <RpgHeader label="SETTINGS" description="系统设置" variant="teal" />

        {/* ============ 分类栏在上,骑在画框顶边上 ============
            RpgTab 的形状(viewBox 180x78,上圆角、下平口)本来就是
            「坐在面板顶上」的页签:下沿是平的,靠 margin-bottom:-1px 与
            画框顶边接缝,底部那条 5px 深色线把未选中页签压回背后。
            竖着排会让平口朝左、圆角朝右,形状语义整个错位。 */}
        <div className="settings-app__tabs" role="tablist" aria-label="设置分类">
          {TABS.map((item) => (
            <RpgTab
              key={item.id}
              label={item.label}
              role="tab"
              id={`settings-tab-${item.id}`}
              aria-controls={`settings-panel-${item.id}`}
              aria-selected={tab === item.id}
              tabIndex={tab === item.id ? 0 : -1}
              variant={tab === item.id ? "teal" : "dark"}
              selected={tab === item.id}
              onClick={() => setTab(item.id)}
            />
          ))}
        </div>

        <RpgFrame className="settings-app__frame" padding="lg">
          <div className="settings-app__heading">
            <div>
              <span>{current.label.toUpperCase()}</span>
              <h3>{current.title}</h3>
              <p>{current.description}</p>
            </div>
            {/* 未改动时显示「默认配置」,改过则提示尚未套用 —— 状态灯要说
                当前事实,不是永远亮一个「有效」。 */}
            <RpgStatusNode
              label={pristine ? "默认配置" : "已修改"}
              variant={pristine ? "teal" : "disabled"}
              icon="check"
            />
          </div>

          <section
            className="settings-app__panel"
            role="tabpanel"
            id={`settings-panel-${tab}`}
            aria-labelledby={`settings-tab-${tab}`}
            tabIndex={0}
          >
            {tab === "performance" && (
              <PerformanceSection state={state} onChange={onChange} />
            )}
            {tab === "display" && (
              <DisplaySection state={state} onChange={onChange} />
            )}
            {tab === "ai" && <AiServiceSection />}
            {tab === "about" && <AboutSection />}
          </section>

          <div className="settings-app__save">
            <RpgNotchButton
              label="恢复默认设置"
              disabled={pristine}
              onClick={() => dispatch({ type: "reset" })}
            />
            <RpgHexButton variant="teal" size="sm" fullWidth>
              返回
            </RpgHexButton>
          </div>
        </RpgFrame>
      </main>
    </Stage>
  );
}
