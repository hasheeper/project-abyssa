import type { ReactNode } from "react";
import { CurrencyAmount } from "../../components/CurrencyAmount";
import "./action-dock.css";

interface ActionDockProps {
  active: boolean;
  busy?: boolean;
  balance?: number;
  children?: ReactNode;
}

interface ActionDockSlotProps {
  caption: string;
  label: string;
  value: string;
}

export function ActionDockSlot({ caption, label, value }: ActionDockSlotProps) {
  return (
    <output className="action-dock__slot" aria-label={label}>
      <span>{caption}</span>
      <strong>{value}</strong>
    </output>
  );
}

export function ActionDock({ active, busy = false, balance, children }: ActionDockProps) {
  const hasFunds = balance !== undefined;

  return (
    <section className="action-dock" data-state={busy ? "busy" : active ? "active" : "idle"} aria-label="行动面板" aria-busy={busy || undefined}>
      <span className="action-dock__surface" aria-hidden="true" />
      <svg className="action-dock__upper-frame" viewBox="0 0 1000 76" preserveAspectRatio="none" aria-hidden="true">
        <path d="M20 4 H980 L996 20 M4 20 L20 4" fill="none" stroke="#3d2915" strokeWidth="8" strokeLinejoin="miter" />
        <path d="M996 20 V72 M4 72 V20" fill="none" stroke="#4a321a" strokeWidth="5" opacity=".78" />
        <path d="M20 4 H980 L996 20 M4 20 L20 4" fill="none" stroke="#9b7740" strokeWidth="4" strokeLinejoin="miter" />
        <path d="M996 20 V69 M4 69 V20" fill="none" stroke="#7d6133" strokeWidth="2.6" opacity=".76" />
        <path d="M24 9 H976 L991 24 M9 24 L24 9" fill="none" stroke="#d7bb7c" strokeWidth="1.1" strokeLinejoin="miter" opacity=".78" />
        <path d="M991 24 V64 M9 64 V24" fill="none" stroke="#a17c42" strokeWidth=".8" opacity=".46" />
      </svg>
      <div className="action-dock__content" data-has-accessory={hasFunds || undefined}>
        <div className="action-dock__actions">{children}</div>
        {hasFunds && (
          <>
            <span className="action-dock__divider" aria-hidden="true" />
            <output className="action-dock__funds" aria-label={`资金 ${balance} G`}>
              <span>资金</span>
              <CurrencyAmount value={balance} label={`资金 ${balance}`} />
            </output>
          </>
        )}
      </div>
    </section>
  );
}
