import { useState } from "react";
import { SettingsScene } from "./SettingsScene";
import { JournalButton } from "../JournalPrimitives";
import { SceneLayer } from "../SceneLayer";

/** Open the real full-Stage Settings, never an inline credential form or a route reload. */
export function useAiSettingsScene() {
  const [mounted, setMounted] = useState(false), [open, setOpen] = useState(false);
  const content = <SettingsScene open={open} initialTab="ai" onClose={() => setOpen(false)} onExited={() => setMounted(false)}/>;
  return {
    show() { setMounted(true); setOpen(true); },
    scene: <SceneLayer active={mounted}>{content}</SceneLayer>,
  };
}
export function AiSettingsButton({ disabled = false, label = "前往设置" }: { disabled?: boolean; label?: string }) {
  const settings = useAiSettingsScene();
  return <><JournalButton disabled={disabled} onClick={settings.show}>{label}</JournalButton>{settings.scene}</>;
}
