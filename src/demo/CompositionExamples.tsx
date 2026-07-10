import { useState } from "react";
import {
  Progress,
  RpgBackButton,
  RpgCheckbox,
  RpgDialogue,
  RpgDiamondNodeTrack,
  RpgFrame,
  RpgHeader,
  RpgHexButton,
  RpgNotchButton,
  RpgNotchedPillButton,
  RpgRadio,
  RpgStatusNode,
  RpgTab,
  Toggle,
  VerticalIndicator
} from "../index";

const dialogueScenes = [
  {
    id: "wake",
    name: "Abyssa",
    text: "……太阳的光，感觉舒服的时候，就醒了。\n这里的阳光，味道最好。"
  },
  {
    id: "warning",
    name: "Kail",
    text: "我们得在天黑前离开这里。\n先沿着旧路前进，我会处理后面的痕迹。"
  },
  {
    id: "answer",
    name: "Abyssa",
    text: "嗯。只要你没有走得太快，我就跟得上。"
  }
];

export function DialogueFlowExample() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const scene = dialogueScenes[sceneIndex];

  function move(step: number) {
    setSceneIndex((current) => Math.min(dialogueScenes.length - 1, Math.max(0, current + step)));
  }

  return (
    <section className="assembled-screen assembled-dialogue" aria-label="对话流程组合示例">
      <RpgHeader label="FIELD DIALOGUE" variant="dark" />

      <RpgFrame className="assembled-screen__frame" padding="none">
        <header className="assembled-screen__meta">
          <div>
            <span>CHAPTER 04</span>
            <strong>守望者之崖 · 午后</strong>
          </div>
          <div className="assembled-screen__status" aria-label="对话进度">
            {dialogueScenes.map((item, index) => (
              <RpgStatusNode
                key={item.id}
                label={`跳转到第 ${index + 1} 段对话`}
                icon={index <= sceneIndex ? "check" : "close"}
                variant={index === sceneIndex ? "teal" : index < sceneIndex ? "dark" : "disabled"}
                onClick={() => setSceneIndex(index)}
              />
            ))}
          </div>
        </header>

        <div className="assembled-dialogue__stage">
          <aside className="assembled-dialogue__rail" aria-label="对话导航">
            <RpgBackButton className="assembled-dialogue__back" label="Back" disabled={sceneIndex === 0} onClick={() => move(-1)} />
            <VerticalIndicator variant="teal" label="当前对话" />
          </aside>

          <div className="assembled-dialogue__main">
            <RpgDialogue name={scene.name} text={scene.text} />

            <footer className="assembled-dialogue__controls">
              <label className="assembled-setting assembled-setting--compact">
                <span><strong>自动播放</strong><small>AUTO ADVANCE</small></span>
                <Toggle checked={autoAdvance} onCheckedChange={setAutoAdvance} variant="teal" size="sm" />
              </label>
              <div className="assembled-dialogue__actions">
                <RpgNotchedPillButton label="Previous" disabled={sceneIndex === 0} onClick={() => move(-1)} />
                <RpgNotchedPillButton label={sceneIndex === dialogueScenes.length - 1 ? "Complete" : "Continue"} variant="teal" onClick={() => move(1)} disabled={sceneIndex === dialogueScenes.length - 1} />
              </div>
            </footer>
          </div>
        </div>
      </RpgFrame>
    </section>
  );
}

const settingsTabs = [
  { id: "general", label: "General", title: "基础体验", description: "自动推进、教程提示与操作节奏" },
  { id: "audio", label: "Audio", title: "声音输出", description: "语音语言、音量与播放行为" },
  { id: "display", label: "Display", title: "视觉显示", description: "界面主题、提示强度与过渡效果" }
] as const;

export function SystemConfigExample() {
  const [activeTab, setActiveTab] = useState<(typeof settingsTabs)[number]["id"]>("general");
  const [enabled, setEnabled] = useState(true);
  const [hints, setHints] = useState(true);
  const [theme, setTheme] = useState("teal");
  const [level, setLevel] = useState("balanced");
  const current = settingsTabs.find((tab) => tab.id === activeTab) ?? settingsTabs[0];

  return (
    <section className="assembled-screen assembled-config" aria-label="系统配置组合示例">
      <RpgHeader label="SYSTEM CONFIG" variant="teal" />

      <div className="assembled-config__tabs" role="tablist" aria-label="设置分类">
        {settingsTabs.map((tab) => (
          <RpgTab
            key={tab.id}
            label={tab.label}
            role="tab"
            variant={activeTab === tab.id ? "teal" : "dark"}
            selected={activeTab === tab.id}
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>

      <RpgFrame className="assembled-screen__frame assembled-config__frame" padding="lg">
        <div className="assembled-config__heading">
          <div><span>{activeTab.toUpperCase()}</span><h3>{current.title}</h3><p>{current.description}</p></div>
          <RpgStatusNode label="配置有效" variant="teal" icon="check" />
        </div>

        <div className="assembled-config__grid">
          <div className="assembled-settings-list">
            <label className="assembled-setting">
              <span><strong>启用当前模块</strong><small>ENABLE MODULE</small></span>
              <Toggle checked={enabled} onCheckedChange={setEnabled} variant="teal" />
            </label>

            <fieldset className="assembled-setting assembled-setting--choice">
              <legend><strong>界面主题</strong><small>INTERFACE THEME</small></legend>
              <div role="radiogroup" aria-label="界面主题">
                {(["gray", "dark", "teal"] as const).map((variant) => (
                  <label key={variant}><RpgRadio name="assembled-theme" variant={variant} label={`${variant} 主题`} checked={theme === variant} onCheckedChange={(next) => next && setTheme(variant)} /><span>{variant}</span></label>
                ))}
              </div>
            </fieldset>

            <label className="assembled-setting">
              <span><strong>显示辅助提示</strong><small>CONTEXT HINTS</small></span>
              <RpgCheckbox label="显示辅助提示" variant="teal" checked={hints} onCheckedChange={setHints} />
            </label>
          </div>

          <aside className="assembled-config__side">
            <span className="assembled-config__side-label">RESPONSE LEVEL</span>
            <RpgDiamondNodeTrack
              items={[{ id: "quiet", label: "安静" }, { id: "balanced", label: "均衡" }, { id: "vivid", label: "鲜明", variant: "teal" }]}
              value={level}
              onValueChange={setLevel}
              label="响应级别"
            />
            <Progress label="Interface response" value={level === "quiet" ? 35 : level === "balanced" ? 68 : 92} showValue />
            <div className="assembled-config__save">
              <RpgNotchButton label="恢复默认设置" />
              <RpgHexButton variant="teal" size="sm" fullWidth onClick={() => setEnabled(true)}>Save</RpgHexButton>
            </div>
          </aside>
        </div>
      </RpgFrame>
    </section>
  );
}
