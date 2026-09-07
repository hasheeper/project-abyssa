import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { GameMenuEntry } from "../shared/ui/patterns/game-menu/GameMenu";

type SceneCommands = {commands: readonly GameMenuEntry[]; busy: boolean};
const Context = createContext<{scene: SceneCommands; set: (scene: SceneCommands) => void} | null>(null);
const empty: SceneCommands = {commands: [], busy: false};
export function CampaignMenuScope({children}: {children:ReactNode}) {
  const [scene, set] = useState<SceneCommands>(empty);
  return <Context.Provider value={{scene,set}}>{children}</Context.Provider>;
}
export function useCampaignMenuScene() { return useContext(Context)?.scene ?? empty; }
/** Register scene-authorized commands; callbacks always read the current presentation. */
export function useCampaignMenuCommands(commands: readonly GameMenuEntry[], busy: boolean) {
  const context = useContext(Context), set = context?.set;
  const latest = useRef(commands); latest.current = commands;
  const signature = JSON.stringify(commands.map(({onSelect:_,...entry}) => entry));
  useLayoutEffect(() => {
    set?.({busy, commands: latest.current.map(entry => ({...entry, onSelect: () => latest.current.find(c => c.id === entry.id)?.onSelect?.()}))});
    return () => set?.(empty);
  }, [set, signature, busy]);
}
