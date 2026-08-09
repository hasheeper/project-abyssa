import type { ReactNode } from "react";

export function DiceOuterFrame({ children }: { children: ReactNode }) {
  return (
    <div className="dice-outer-frame">
      <span className="dice-outer-frame__rails" aria-hidden="true">
        <i data-edge="top" />
        <i data-edge="right" />
        <i data-edge="bottom" />
        <i data-edge="left" />
      </span>
      <div className="dice-outer-frame__metal">
        <div className="dice-outer-frame__surface">{children}</div>
      </div>
    </div>
  );
}
