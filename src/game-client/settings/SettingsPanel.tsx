import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { SystemPanel } from "../../shared/ui/patterns/SystemPanel";
import { SystemTabs } from "../../shared/ui/patterns/SystemTabs";
import { RpgHexButton } from "../../shared/ui/primitives/RpgHexButton";
import { RpgNotchButton } from "../../shared/ui/primitives/RpgNotchButton";
import { RpgStatusNode } from "../../shared/ui/primitives/RpgStatusNode";
import { RpgTab } from "../../shared/ui/primitives/RpgTab";
import { Stage } from "../../shared/stage";
import { AboutSection } from "./sections/AboutSection";
import { AiServiceSection } from "./sections/AiServiceSection";
import { AiConnectionStorage } from "../airp-generation/AiConnectionStorage";
import { DisplaySection } from "./sections/DisplaySection";
import { PerformanceSection } from "./sections/PerformanceSection";
import { DEFAULT_SETTINGS, isPristine, settingsReducer, toCssVariables, type SettingsState } from "./settings-state";
import { setUiMotionPreference, useUiMotionPreference } from "../../shared/preferences/ui-motion";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";
import type { SystemSceneMotion } from "../system-panel-motion";
import { useSettingsMotion } from "./useSettingsMotion";
import { SystemSceneHeading } from "../SystemSceneFrame";
import "./settings.css";
import "./settings-menu.css";
import "./settings-scene.css";
import "../../shared/ui/styles/rp-typing.css";

const TABS = [
  { id: "performance", label: "Scene", title: "演出节奏", description: "本页预览，尚未应用到游戏" },
  { id: "display", label: "Display", title: "视觉显示", description: "界面动效全局生效，其余为本页预览" },
  { id: "ai", label: "Model", title: "模型设置", description: "浏览器直连" },
  { id: "about", label: "About", title: "关于", description: "版本与说明" }
] as const;
type TabId = typeof TABS[number]["id"];

export function SettingsPanel({ embedded: inline = false, fullScene = false, onBack, sceneMotion, onBackdropTextureChange, initialTab = "performance" }: {
  embedded?: boolean; fullScene?: boolean; onBack: () => void; sceneMotion?: SystemSceneMotion; onBackdropTextureChange?: (enabled: boolean) => void; initialTab?: TabId;
}) {
  const embedded = inline || fullScene;
  const [state, dispatch] = useReducer(settingsReducer, DEFAULT_SETTINGS);
  useEffect(() => { onBackdropTextureChange?.(state.backdropTexture); }, [onBackdropTextureChange, state.backdropTexture]);
  const [tab, setTab] = useState<TabId>(initialTab);
  const { preference, saved } = useUiMotionPreference();
  const { reduced } = useUiMotion();
  const onChange = useCallback((patch: Partial<SettingsState>) => dispatch({ type: "set", patch }), []);
  const pristine = isPristine(state) && preference === "system";
  const cssVariables = useMemo(() => toCssVariables(state), [state]);
  const root = useRef<HTMLElement>(null);
  const localMotion = useSettingsMotion(root, tab, embedded ? sceneMotion : undefined);
  const shownTab = localMotion.displayed;
  const current = TABS.find(item => item.id === shownTab)!;
  const stateLabel = shownTab === "ai" ? "本机配置" : pristine ? "默认配置" : "已修改";

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index + TABS.length - 1) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault(); setTab(TABS[next].id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next].focus({ preventScroll: true });
  }

  const reset = () => { dispatch({ type: "reset" }); setUiMotionPreference("system"); };
  const sectionHeading = <><div><h3>{current.title}</h3><p>{current.description}</p>
    {!saved && <p role="status">动效偏好仅在本次会话生效，浏览器未能保存设置。</p>}
  </div>{embedded ? <span className="settings-config-state" data-modified={shownTab !== "ai" && !pristine || undefined}>{stateLabel}</span>
    : <RpgStatusNode label={stateLabel} variant={pristine ? "teal" : "disabled"} icon="check" />}</>;
  const panel = <SystemPanel ref={root} embedded={embedded} label="SETTINGS" description="系统设置" className={`settings-app${embedded ? " settings-app--embedded" : ""}${fullScene ? " system-scene__layout settings-app--scene" : ""}`} frameClassName="settings-app__frame"
      data-settings-motion={!!sceneMotion || undefined} data-settings-tab-phase={localMotion.phase}
      data-reduced-motion={reduced || undefined} data-ui-motion={reduced ? "reduced" : "full"} style={cssVariables as CSSProperties}
      tabs={embedded ? <div className="abyssa-system-toolbar">{!fullScene && <span className="abyssa-system-toolbar__label">设置分类</span>}
        <SystemTabs label="设置分类" selected={shownTab} onChange={setTab} items={TABS.map(item => ({ id: item.id, label: item.label,
          tabId: `settings-tab-${item.id}`, controls: `settings-panel-${item.id}` }))} />
      </div> : <div className="settings-app__tabs" role="tablist" aria-label="设置分类">
        {TABS.map((item, index) => <RpgTab key={item.id} label={item.label} role="tab" id={`settings-tab-${item.id}`}
          aria-controls={`settings-panel-${item.id}`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1}
          variant={tab === item.id ? "teal" : "dark"} selected={tab === item.id} onClick={() => setTab(item.id)} onKeyDown={event => moveTab(event, index)} />)}
      </div>}
      heading={fullScene ? <SystemSceneHeading label="SETTINGS" description="系统设置" /> : sectionHeading}
      footer={<>{shownTab === "ai" && <AiConnectionStorage/>}{embedded ? <button type="button" className="settings-reset" aria-label="恢复默认设置" hidden={shownTab === "ai"} disabled={pristine} onClick={reset}>恢复默认</button>
        : <RpgNotchButton label="恢复默认设置" hidden={shownTab === "ai"} disabled={pristine} onClick={reset} />}
        <RpgHexButton variant="teal" size="sm" fullWidth onClick={onBack}>返回</RpgHexButton></>}
    >
      {fullScene && <header className="settings-section-heading">{sectionHeading}</header>}
      <section className="settings-app__panel" role="tabpanel" id={`settings-panel-${shownTab}`} aria-labelledby={`settings-tab-${shownTab}`} tabIndex={0}
        inert={localMotion.changing} aria-busy={localMotion.changing}>
        {shownTab === "performance" && <PerformanceSection state={state} onChange={onChange} embedded={embedded} previewActive={localMotion.previewActive} />}
        {shownTab === "display" && <DisplaySection state={state} onChange={onChange} embedded={embedded} />}
        {shownTab === "ai" && <AiServiceSection embedded={embedded} />}
        {shownTab === "about" && <AboutSection embedded={embedded} />}
      </section>
    </SystemPanel>;
  return embedded ? panel : <Stage background={state.backdropTexture ? "var(--abyssa-system-backdrop)" : "var(--abyssa-system-backdrop-plain)"}>{panel}</Stage>;
}
