import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import { RpgFrame } from "../primitives/RpgFrame";
import { RpgHeader } from "../primitives/RpgHeader";
import "../styles/system-panel.css";

interface SystemPanelProps extends HTMLAttributes<HTMLElement> {
  label: string;
  description: string;
  tabs?: ReactNode;
  heading?: ReactNode;
  footer?: ReactNode;
  frameClassName?: string;
  embedded?: boolean;
}

/** Settings and save/load share the same chrome; only their content differs. */
export const SystemPanel = forwardRef<HTMLElement, SystemPanelProps>(function SystemPanel({ label, description, tabs, heading, footer, children, className, frameClassName, embedded = false, ...props }, ref) {
  if (embedded) return <main ref={ref} className={cx("abyssa-theme", "abyssa-system-panel", "abyssa-system-panel--embedded", className)} aria-label={description} {...props}>
    <div className="abyssa-system-panel__toolbar">{tabs && <div className="abyssa-system-panel__tabs">{tabs}</div>}{heading && <div className="abyssa-system-panel__heading">{heading}</div>}</div>
    <div className="abyssa-system-panel__body">{children}</div>
    {footer && <div className="abyssa-system-panel__footer">{footer}</div>}
  </main>;
  return <main ref={ref} className={cx("abyssa-theme", "abyssa-system-panel", className)} {...props}>
    <RpgHeader label={label} description={description} variant="teal" />
    {tabs}
    <RpgFrame className={cx("abyssa-system-panel__frame", frameClassName)} padding="lg">
      {heading && <div className="abyssa-system-panel__heading">{heading}</div>}
      <div className="abyssa-system-panel__body">{children}</div>
      {footer && <div className="abyssa-system-panel__footer">{footer}</div>}
    </RpgFrame>
  </main>;
});
