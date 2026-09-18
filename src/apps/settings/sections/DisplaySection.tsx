import { RpgCheckbox } from "../../../shared/ui/primitives/RpgChoice";
import { Toggle } from "../../../shared/ui/primitives/Toggle";
import { SettingsRow } from "../controls/SettingsRow";
import type { SectionProps } from "./PerformanceSection";
import { setUiMotionPreference, useUiMotionPreference } from "../../../shared/preferences/ui-motion";
import { useUiMotion } from "../../../shared/ui/motion/UiMotionProvider";

/**
 * 显示 —— 只做两件事:减弱动画、关掉渲染开销大的样式。
 *
 * 刻意没有分辨率、全屏、垂直同步。本项目跑在固定画布上(shared/stage:
 * 外 16:9 贴设备、内容等比缩放),"分辨率"在这个架构里不是可调量;
 * 全屏是浏览器的事,不该由页面内的设置伪装成自己的能力。
 *
 * 界面动效偏好由产品入口持久化；共享 UI 同时响应系统偏好。
 * 其他演出开关仍为本页预览设置，不扩展到 Logo 或玩法存档。
 */
export function DisplaySection({ state, onChange }: SectionProps) {
  const { preference } = useUiMotionPreference();
  const { reduced } = useUiMotion();
  return (
    <div className="settings-grid">
      <div className="settings-list">
        <SettingsRow label="界面动效" caption="UI MOTION">
          <Toggle
            variant="teal"
            onLabel="减弱"
            offLabel="跟随系统"
            aria-label="减弱界面动效（关闭时跟随系统）"
            checked={preference === "reduced"}
            onCheckedChange={(enabled) => setUiMotionPreference(enabled ? "reduced" : "system")}
          />
        </SettingsRow>

        <SettingsRow label="气泡特效" caption="BUBBLE FX">
          <Toggle
            variant="teal"
            onLabel="On"
            offLabel="Off"
            aria-label="气泡特效"
            checked={state.bubbleEffects}
            onCheckedChange={(bubbleEffects) => onChange({ bubbleEffects })}
            disabled={reduced}
          />
        </SettingsRow>

        <SettingsRow label="漫符与动态表情" caption="EMOTES">
          <Toggle
            variant="teal"
            onLabel="On"
            offLabel="Off"
            aria-label="漫符与动态表情"
            checked={state.emotes}
            onCheckedChange={(emotes) => onChange({ emotes })}
            disabled={reduced}
          />
        </SettingsRow>

        <SettingsRow label="立绘入退场动画" caption="SEAT TRANSITION">
          <Toggle
            variant="teal"
            onLabel="On"
            offLabel="Off"
            aria-label="立绘入退场动画"
            checked={state.seatTransitions}
            onCheckedChange={(seatTransitions) => onChange({ seatTransitions })}
            disabled={reduced}
          />
        </SettingsRow>

        <SettingsRow label="背景底纹" caption="BACKDROP">
          <RpgCheckbox
            label="背景底纹"
            variant="teal"
            checked={state.backdropTexture}
            onCheckedChange={(backdropTexture) => onChange({ backdropTexture })}
          />
        </SettingsRow>
      </div>

      <aside className="settings-side">
        <span className="settings-side__label">RENDER LOAD</span>

        {/* 关掉的项越多,渲染负载越低。这是把四个开关汇总成一个可读的量 ——
            比逐项说明「这个开销大」更直观。 */}
        <ul className="settings-load">
          {[
            { label: "气泡特效", on: state.bubbleEffects && !reduced },
            { label: "漫符表情", on: state.emotes && !reduced },
            { label: "立绘过场", on: state.seatTransitions && !reduced },
            { label: "背景底纹", on: state.backdropTexture }
          ].map((item) => (
            <li key={item.label} data-on={item.on || undefined}>
              <i aria-hidden="true" />
              {item.label}
              <em>{item.on ? "启用" : "关闭"}</em>
            </li>
          ))}
        </ul>

        {reduced && (
          <p className="settings-note" role="status">
            已减弱共享按钮、窗口和内容切换动效，并暂停本页演出预览。Logo 与专用演出保持各自策略。
          </p>
        )}
      </aside>
    </div>
  );
}
