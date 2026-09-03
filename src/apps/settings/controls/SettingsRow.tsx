import type { ReactNode } from "react";
import { cx } from "../../../shared/lib/cx";

export interface SettingsRowProps {
  label: string;
  /** 西文小标。与 SystemConfigExample 的 strong + small 同构。 */
  caption?: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * 设置行:左侧中文标签 + 西文小标,右侧控件。
 *
 * ============ 为什么标签用 <span> 而不是 <label> ============
 * 这里的控件既有原生 input(滑块),也有 role="switch" 的 button(Toggle)、
 * 以及整组单选钮。<label for> 只能指向单个表单元件,套在 Toggle 或单选组上
 * 时要么无效、要么把点击语义引向组里第一个钮。
 * 所以文字标签只做视觉,无障碍名称由控件各自的 aria-label 负责
 * (Toggle 与 RpgChoice 本来就都收 aria 属性)。
 */
export function SettingsRow({
  label,
  caption,
  children,
  disabled,
  className
}: SettingsRowProps) {
  return (
    <div
      className={cx("settings-row", className)}
      data-disabled={disabled || undefined}
    >
      <span className="settings-row__text">
        <strong>{label}</strong>
        {caption && <small>{caption}</small>}
      </span>
      <div className="settings-row__control">{children}</div>
    </div>
  );
}
