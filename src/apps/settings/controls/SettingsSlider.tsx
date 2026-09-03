import { useId } from "react";
import type { CSSProperties } from "react";
import { cx } from "../../../shared/lib/cx";

export interface SettingsSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  /** 无障碍名称。视觉标签在 SettingsRow 里,这里必须自带一份。 */
  label: string;
  /** 值的显示形式。给 ms 加单位、或把 ms 折算成「字/秒」这类人话。 */
  format?: (value: number) => string;
  /** 轨道两端的锚点文字,如「慢 / 快」。给出方向感,比裸数字易读。 */
  minLabel?: string;
  maxLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * 幽青滑块。
 *
 * ============ 为什么底层是原生 input[type=range] ============
 * 自绘滑块(div + 指针事件)要自己实现:键盘 ←→ / Home / End、
 * 触摸拖拽、role="slider" 与 aria-valuenow/min/max 的同步、以及 RTL。
 * 这些原生全部自带且行为正确。仓库装了 @storybook/addon-a11y,说明
 * 无障碍是在意的,那就没有理由把一个已经正确的控件重做一遍并做差。
 *
 * 复古观感完全由伪元素承担 —— 见 settings.css。原生元素只贡献行为,
 * 外观上一个像素都不留(appearance: none)。
 *
 * ============ 进度填充靠 --fill 而不是背景渐变百分比 ============
 * 已填充段用 CSS 变量传当前百分比,由 settings.css 画。放在这里算是因为
 * (value-min)/(max-min) 是组件自己的事,CSS 拿不到 min/max。
 */
export function SettingsSlider({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  label,
  format,
  minLabel,
  maxLabel,
  disabled,
  className
}: SettingsSliderProps) {
  const uid = useId().replace(/:/g, "");
  const outputId = `settings-slider-value-${uid}`;

  // 分母为 0 时(min === max)退化成 0,不产生 NaN 污染 CSS 变量。
  const ratio = max > min ? (value - min) / (max - min) : 0;

  return (
    <div
      className={cx("settings-slider", className)}
      data-disabled={disabled || undefined}
      style={{ "--fill": `${ratio * 100}%` } as CSSProperties}
    >
      <div className="settings-slider__readout">
        {/* output 而非 span:这是「另一个控件的计算结果」,语义正好对上,
            读屏也会把它与滑块关联起来播报。 */}
        <output id={outputId} className="settings-slider__value">
          {format ? format(value) : String(value)}
        </output>
      </div>

      <div className="settings-slider__track-row">
        {minLabel && (
          <span className="settings-slider__anchor" aria-hidden="true">
            {minLabel}
          </span>
        )}

        <span className="settings-slider__track">
          <input
            type="range"
            className="settings-slider__input"
            value={value}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            aria-label={label}
            // 数值本身已由 aria-valuenow(原生自动给)播报,这里补一个
            // 人话形式的文本值 —— 「77 字/秒」比「13」有意义得多。
            aria-valuetext={format ? format(value) : undefined}
            onChange={(event) => onValueChange(Number(event.currentTarget.value))}
          />
        </span>

        {maxLabel && (
          <span className="settings-slider__anchor" aria-hidden="true">
            {maxLabel}
          </span>
        )}
      </div>
    </div>
  );
}
