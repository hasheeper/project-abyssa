import type { ReactNode } from "react";
import { UiMotionProvider } from "../ui/motion/UiMotionProvider";
import { useUiMotionPreference } from "./ui-motion";
import { DisplayEnvironment } from "../display/DisplayEnvironment";

export function GameUiPreferences({ children }: { children: ReactNode }) {
  const { preference } = useUiMotionPreference();
  return <UiMotionProvider preference={preference}><DisplayEnvironment>{children}</DisplayEnvironment></UiMotionProvider>;
}
