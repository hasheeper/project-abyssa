import type { HTMLAttributes } from "react";
import { cx } from "../../lib/cx";
import { UiMotionProvider, useUiMotion, type UiMotionPreference } from "../motion/UiMotionProvider";

export interface AbyssaProviderProps extends HTMLAttributes<HTMLDivElement> {
  accent?: "teal" | "silver";
  density?: "comfortable" | "compact";
  motionPreference?: UiMotionPreference;
}

export function AbyssaProvider({
  accent = "teal",
  density = "comfortable",
  motionPreference,
  className,
  children,
  ...props
}: AbyssaProviderProps) {
  const { reduced } = useUiMotion(motionPreference);
  return (
    <UiMotionProvider preference={motionPreference}>
    <div
      className={cx("abyssa-theme", className)}
      data-accent={accent}
      data-density={density}
      data-ui-motion={reduced ? "reduced" : "full"}
      {...props}
    >
      {children}
    </div>
    </UiMotionProvider>
  );
}
