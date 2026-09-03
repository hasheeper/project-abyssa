import { Progress } from "../../../shared/ui/primitives/Progress";
import { RpgDiamondNodeTrack } from "../../../shared/ui/primitives/RpgDiamondNodeTrack";
import { RpgRadio } from "../../../shared/ui/primitives/RpgChoice";
import { SettingsRow } from "../controls/SettingsRow";
import { SettingsSlider } from "../controls/SettingsSlider";
import { TypingPreview } from "../controls/TypingPreview";
import { CROP_OPTIONS, LAYOUT_OPTIONS } from "../settings-state";
import type { SettingsState } from "../settings-state";

export interface SectionProps {
  state: SettingsState;
  onChange: (patch: Partial<SettingsState>) => void;
}

/**
 * 演出 —— 本设置页的核心,对应 rp.html 的实际旋钮。
 *
 * 布局沿用 SystemConfigExample:左侧设置清单 + 右侧竖栏(节点轨 + 读数 +
 * 预览)。打字机预览放右栏而不是塞进左侧清单里 —— 它是这两条滑块的
 * 「结果显示」,与 Progress 在参考里的角色一致。
 */
export function PerformanceSection({ state, onChange }: SectionProps) {
  return (
    <div className="settings-grid">
      <div className="settings-list">
        <SettingsRow label="默认版式" caption="LAYOUT">
          <div className="settings-choice-group" role="radiogroup" aria-label="默认版式">
            {LAYOUT_OPTIONS.map((option) => (
              <label key={option.value} className="settings-choice">
                <RpgRadio
                  name="settings-layout"
                  variant="teal"
                  label={option.label}
                  checked={state.layout === option.value}
                  onCheckedChange={(checked) => {
                    if (checked) onChange({ layout: option.value });
                  }}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </SettingsRow>

        {/* ============ 打字速度与柔和度必须分成两项 ============
            见 settings-state.ts 与 rp-typing.css:两者正交,
            dur/step = 波宽,「更快且更柔和」需要它们反向调。
            合并成单一「文本速度」就调不出来了。 */}
        <SettingsRow label="打字速度" caption="TYPE STEP">
          <SettingsSlider
            label="打字速度"
            value={state.typeStep}
            min={4}
            max={40}
            step={1}
            minLabel="快"
            maxLabel="慢"
            onValueChange={(typeStep) => onChange({ typeStep })}
            format={(value) => `${value}ms · ${Math.round(1000 / value)} 字/秒`}
          />
        </SettingsRow>

        <SettingsRow label="渐变柔和度" caption="TYPE DURATION">
          <SettingsSlider
            label="渐变柔和度"
            value={state.typeDur}
            min={80}
            max={800}
            step={20}
            minLabel="锐利"
            maxLabel="柔和"
            onValueChange={(typeDur) => onChange({ typeDur })}
            format={(value) => `${value}ms · 波宽 ${Math.round(value / state.typeStep)} 字`}
          />
        </SettingsRow>

        <SettingsRow label="自动播放停留" caption="AUTO ADVANCE">
          <SettingsSlider
            label="自动播放停留"
            value={state.autoMs}
            min={800}
            max={6000}
            step={100}
            minLabel="短"
            maxLabel="长"
            onValueChange={(autoMs) => onChange({ autoMs })}
            format={(value) => `${(value / 1000).toFixed(1)} 秒`}
          />
        </SettingsRow>

        <SettingsRow label="版式过场时长" caption="MORPH">
          <SettingsSlider
            label="版式过场时长"
            value={state.morphMs}
            min={0}
            max={1200}
            step={40}
            minLabel="即时"
            maxLabel="舒缓"
            onValueChange={(morphMs) => onChange({ morphMs })}
            format={(value) => (value === 0 ? "即时切换" : `${value}ms`)}
          />
        </SettingsRow>
      </div>

      <aside className="settings-side">
        <span className="settings-side__label">PORTRAIT CROP</span>
        {/* 取景是三档有序枚举 —— 正是 RpgDiamondNodeTrack 的用途
            (参考里的 RESPONSE LEVEL 同构),比三个单选钮更贴合。 */}
        <RpgDiamondNodeTrack
          label="立绘取景"
          items={CROP_OPTIONS.map((option) => ({
            id: option.value,
            label: option.label
          }))}
          value={state.crop}
          selectedVariant="teal"
          onValueChange={(value) => onChange({ crop: value as SettingsState["crop"] })}
        />

        <Progress
          label="Type speed"
          value={Math.round(1000 / state.typeStep)}
          max={250}
          showValue
        />

        <TypingPreview
          step={state.typeStep}
          dur={state.typeDur}
          reducedMotion={state.reducedMotion}
        />
      </aside>
    </div>
  );
}
