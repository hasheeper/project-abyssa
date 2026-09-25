import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_PLAYER_NAME, playerDisplayName } from "./player-identity";

const PlayerName = createContext<string>(DEFAULT_PLAYER_NAME);
/** Scoped to the loaded save; previews and unrelated roots keep their own name. */
export function PlayerIdentityProvider({name, children}: {name?: string; children: ReactNode}) {
  return <PlayerName.Provider value={playerDisplayName(name)}>{children}</PlayerName.Provider>;
}
export function usePlayerName() { return useContext(PlayerName); }
