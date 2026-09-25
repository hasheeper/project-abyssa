import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AnyGameRecord } from "../game-application";
import { createBrowserGameRuntime } from "../game-runtime/browser";
import { GameMenu, type GameMenuProps } from "../shared/ui/patterns/game-menu/GameMenu";
import { useTutorialSuspension } from "../shared/tutorial";
import { navigateTo } from "../shared/routing/location";
import { createManualSaveAttempt, type ManualSaveAttempt } from "./manual-save";
import type { ClientRuntime } from "./session";
import { SaveSlotsScene } from "./SaveSlotsScene";
import { SettingsScene } from "./settings/SettingsScene";
import "./game-system-menu.css";

type Scene = { mode: "save"; attempt: ManualSaveAttempt } | { mode: "load" | "settings" };
type Props = Omit<GameMenuProps, "system"> & {
  record?: AnyGameRecord | null;
  runtime?: ClientRuntime;
  saveUnavailableReason?: string;
};

/** One set of real system actions for all in-game navigation rails. */
export function GameSystemMenu({ record, runtime, saveUnavailableReason, ...menu }: Props) {
  const anchor = useRef<HTMLSpanElement>(null), ownedRuntime = useRef<ClientRuntime | null>(null);
  const [scene, setScene] = useState<Scene | null>(null), [open, setOpen] = useState(false);
  useTutorialSuspension(!!scene);
  useEffect(() => () => { ownedRuntime.current?.close(); ownedRuntime.current = null; }, []);
  function show(mode: Scene["mode"]) {
    if (menu.busy || scene || mode === "save" && !record) return;
    if (mode === "save") {
      const writer = runtime ?? (ownedRuntime.current ??= createBrowserGameRuntime());
      setScene({mode, attempt: createManualSaveAttempt(writer, record!)});
    } else setScene({mode});
    setOpen(true);
  }
  function exited() {
    setScene(null);
    ownedRuntime.current?.close(); ownedRuntime.current = null;
  }
  const host = anchor.current?.closest(".abyssa-stage__canvas");
  return <>
    <span ref={anchor} hidden />
    <GameMenu {...menu} system={[
      {id: "save", label: "存档", disabled: !record, detail: !record ? saveUnavailableReason ?? "当前没有可保存的旅程" : undefined, onSelect: () => show("save")},
      {id: "load", label: "读档", onSelect: () => show("load")},
      {id: "settings", label: "设置", onSelect: () => show("settings")},
    ]} />
    {scene && createPortal(<div className="game-system-layer">
      {scene.mode === "settings"
        ? <SettingsScene open={open} onClose={() => setOpen(false)} onExited={exited} />
        : <SaveSlotsScene {...(scene.mode === "save" ? {mode: "save", attempt: scene.attempt, ready: !menu.busy && !!record} : {mode: "load"})}
          open={open} onClose={() => setOpen(false)} onExited={exited}
          navigate={href => navigateTo(href, {destination: "存档进度", channel: "正在读取"})} />}
    </div>, host ?? document.body)}
  </>;
}
