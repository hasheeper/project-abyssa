import { useCallback, useSyncExternalStore, type ReactNode } from "react";
import type { AnyGameRecord } from "../game-application";
import { PlayerIdentityProvider } from "../shared/domain/PlayerIdentity";
import { MoneyProvider } from "../shared/ui/primitives/Money";

type NameSource = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => {record: AnyGameRecord | null};
};
export function PlayerIdentityScope({session, children}: {session: NameSource; children: ReactNode}) {
  const readName = useCallback(() => {
    const record = session.getSnapshot().record;
    return record?.schemaVersion === 4 ? record.snapshot.campaign.playerName : undefined;
  }, [session]);
  // Only a name change notifies this context, not every roll or history update.
  const name = useSyncExternalStore(session.subscribe, readName);
  const readScale = useCallback(() => {
    const record = session.getSnapshot().record;
    return !record || record.schemaVersion === 4 && record.contentRef.contentVersion >= 17 ? 1 : 100;
  }, [session]);
  const scale = useSyncExternalStore(session.subscribe, readScale);
  return <MoneyProvider scale={scale}><PlayerIdentityProvider name={name}>{children}</PlayerIdentityProvider></MoneyProvider>;
}
