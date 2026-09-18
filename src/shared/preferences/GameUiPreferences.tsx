import type { ReactNode } from "react";
import { UiMotionProvider } from "../ui/motion/UiMotionProvider";
import { useUiMotionPreference } from "./ui-motion";

export function GameUiPreferences({ children }: { children: ReactNode }) {
  const { preference } = useUiMotionPreference();
  return <UiMotionProvider preference={preference}>{children}</UiMotionProvider>;
}
