import { SaveSlotsPanel } from "../../game-client/SaveSlotsPanel";
import type { SaveSlotSceneMotion } from "../../game-client/save-slots-motion";

/** Mount only when opened, so listing every save does not delay the hub. */
export function MenuLoadPanel({ navigate, onClose, onBusyChange, sceneMotion }: {
  navigate: (href: string) => void; onClose: () => void; onBusyChange: (busy: boolean) => void;
  sceneMotion?: SaveSlotSceneMotion;
}) {
  return <SaveSlotsPanel mode="load" navigate={navigate} onClose={onClose} onBusyChange={onBusyChange} sceneMotion={sceneMotion} />;
}
