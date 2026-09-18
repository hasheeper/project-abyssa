import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { GameMenuEntry } from "../shared/ui/patterns/game-menu/GameMenu";

type SceneCommands = {commands: readonly GameMenuEntry[]; busy: boolean};
const empty: SceneCommands = {commands: [], busy: false};
const Context = createContext<SceneCommands>(empty);
// Registering commands must not subscribe the battle to its own menu updates.
// Otherwise unlocking the scene synchronously renders the whole battle twice.
const RegistrationContext = createContext<((scene: SceneCommands) => void) | null>(null);
export function CampaignMenuScope({children}: {children:ReactNode}) {
  const [scene, set] = useState<SceneCommands>(empty);
  return <RegistrationContext.Provider value={set}><Context.Provider value={scene}>{children}</Context.Provider></RegistrationContext.Provider>;
}
export function useCampaignMenuScene() { return useContext(Context); }
/** Register scene-authorized commands; callbacks always read the current presentation. */
export function useCampaignMenuCommands(commands: readonly GameMenuEntry[], busy: boolean) {
  const set = useContext(RegistrationContext);
  const latest = useRef(commands); latest.current = commands;
  const signature = JSON.stringify(commands.map(({onSelect:_,...entry}) => entry));
  useLayoutEffect(() => {
    set?.({busy, commands: latest.current.map(entry => ({...entry, onSelect: () => latest.current.find(c => c.id === entry.id)?.onSelect?.()}))});
    return () => set?.(empty);
  }, [set, signature, busy]);
}
