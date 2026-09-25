import type { ManualSaveAttempt } from "./manual-save";
import { SaveSlotsPanel } from "./SaveSlotsPanel";
import type { SaveSlotSceneMotion } from "./save-slots-motion";

export function SaveGamePanel(props: {
  attempt: ManualSaveAttempt; ready: boolean; onClose: () => void;
  onBusyChange: (busy: boolean) => void; navigate: (href: string) => void;
  sceneMotion?: SaveSlotSceneMotion;
}) {
  return <SaveSlotsPanel mode="save" {...props} />;
}
