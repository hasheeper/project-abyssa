import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import "../styles/system-panel.css";

interface SystemPanelProps extends HTMLAttributes<HTMLElement> {
  description: string;
  tabs?: ReactNode;
  heading?: ReactNode;
  footer?: ReactNode;
}

/** Settings and save/load share the same chrome; only their content differs. */
export const SystemPanel = forwardRef<HTMLElement, SystemPanelProps>(function SystemPanel({ description, tabs, heading, footer, children, className, ...props }, ref) {
  return <main ref={ref} className={cx("abyssa-theme", "abyssa-system-panel", "abyssa-system-panel--embedded", className)} aria-label={description} {...props}>
    <div className="abyssa-system-panel__toolbar">{tabs && <div className="abyssa-system-panel__tabs">{tabs}</div>}{heading && <div className="abyssa-system-panel__heading">{heading}</div>}</div>
    <div className="abyssa-system-panel__body">{children}</div>
    {footer && <div className="abyssa-system-panel__footer">{footer}</div>}
  </main>;
});
