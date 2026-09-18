import type { HTMLAttributes } from "react";
import { RpgFrame } from "../ui/primitives/RpgFrame";
import "./loading-surface.css";

/** Shared loading material only. Route and in-scene jobs retain their own clocks. */
export function LoadingPlaque({className, children, ...props}: HTMLAttributes<HTMLDivElement>) {
  return <RpgFrame {...props} className={["scene-loading-plaque", className].filter(Boolean).join(" ")}
    variant="dark" padding="none" ornamented
    watermark={{size:38, outerOpacity:.38, innerOpacity:.2, innerInset:9}}>
    {children}
  </RpgFrame>;
}
