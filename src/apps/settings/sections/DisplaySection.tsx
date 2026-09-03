import { RpgCheckbox } from "../../../shared/ui/primitives/RpgChoice";
import { Toggle } from "../../../shared/ui/primitives/Toggle";
import { SettingsRow } from "../controls/SettingsRow";
import type { SectionProps } from "./PerformanceSection";

/**
 * 显示 —— 只做两件事:减弱动画、关掉渲染开销大的样式。
 *
 * 刻意没有分辨率、全屏、垂直同步。本项目跑在固定画布上(shared/stage:
 * 外 16:9 贴设备、内容等比缩放),"分辨率"在这个架构里不是可调量;
 * 全屏是浏览器的事,不该由页面内的设置伪装成自己的能力。
 *
 * ============ 「减弱动态效果」是真开关 ============
 * tokens.css 已有一整套 @media (prefers-reduced-motion: reduce) 实现。
 * 这一项把同一套规则挂到 [data-reduced-motion] 上,所以它当场生效
 * (预览会立刻停),不是等待接线的占位。
 */
export function DisplaySection({ state, onChange }: SectionProps) {
  return (
    <div className="settings-grid">
      <div className="settings-list">
        <SettingsRow label="减弱动态效果" caption="REDUCED MOTION">
          <Toggle
            variant="teal"
            onLabel="On"
            offLabel="Off"
            aria-label="减弱动态效果"
            checked={state.reducedMotion}
            onCheckedChange={(reducedMotion) => onChange({ reducedMotion })}
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
            disabled={state.reducedMotion}
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
            disabled={state.reducedMotion}
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
            disabled={state.reducedMotion}
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
            { label: "气泡特效", on: state.bubbleEffects && !state.reducedMotion },
            { label: "漫符表情", on: state.emotes && !state.reducedMotion },
            { label: "立绘过场", on: state.seatTransitions && !state.reducedMotion },
            { label: "背景底纹", on: state.backdropTexture }
          ].map((item) => (
            <li key={item.label} data-on={item.on || undefined}>
              <i aria-hidden="true" />
              {item.label}
              <em>{item.on ? "启用" : "关闭"}</em>
            </li>
          ))}
        </ul>

        {state.reducedMotion && (
          <p className="settings-note" role="status">
            已开启减弱动态效果，动效相关项由其统一接管。
          </p>
        )}
      </aside>
    </div>
  );
}
