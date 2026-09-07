import { useCallback, useEffect, useRef, useState } from "react";
import type { BattleCommand, BattleTransition, CharacterId, ExpeditionState } from "../view";
import { useGameSession, useGameState } from "../../../game-client/react";
import { battleState, sameHead } from "../../../game-runtime/views";
import type { CommittedBatch as AnyCommittedBatch } from "../../../game-client/session";

import type { GameRecord, CommandReceipt } from "../../../game-application";
export type LegacyCommittedBatch = Omit<AnyCommittedBatch, "before" | "after" | "receipts"> & {before: GameRecord; after: GameRecord; receipts: CommandReceipt[]};
export function legacyRecord(record: import("../../../game-application").AnyGameRecord): GameRecord { if (record.schemaVersion !== 1) throw new Error("Legacy battle required"); return record; }
export function getPendingLayerClearEventId(result: BattleTransition): string | null {
  return result.error ? null : result.events.find(e => e.type === "layer-cleared" && e.payload.settlement === null)?.id ?? null;
}
/** Holds only a presentation copy. All authoritative transitions go through GameSession. */
export function useExpeditionBattleController() {
  const session = useGameSession(), game = useGameState();
  const [state, setState] = useState(() => battleState(legacyRecord(game.record!)));
  const stateRef = useRef(state), locked = useRef(false), alive = useRef(true);
  const [heldActor, holdActor] = useState<CharacterId | null>(null);
  const [presenting, setPresenting] = useState(false);
  const show = useCallback((next: ExpeditionState) => {
    if (!alive.current) return;
    stateRef.current = next; setState(next);
  }, []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const finish = useCallback(() => {
    locked.current = false;
    if (!alive.current) return;
    const record = session.getSnapshot().record;
    if (record?.schemaVersion === 1 && record.snapshot.expedition?.id === session.locator.expeditionId) show(battleState(record!));
    holdActor(null); setPresenting(false);
  }, [session, show]);
  useEffect(() => {
    if (!locked.current && game.record?.schemaVersion === 1 && game.record.snapshot.expedition) { show(battleState(game.record)); holdActor(null); }
  }, [game.record?.head.revision, game.generation, show]);
  const submit = async (command: BattleCommand): Promise<LegacyCommittedBatch | null> => {
    if (locked.current || session.getSnapshot().status !== "ready") return null;
    const record = legacyRecord(session.getSnapshot().record!);
    if (!record.snapshot.expedition || record.snapshot.expedition.id !== session.locator.expeditionId) return null;
    locked.current = true; setPresenting(true);
    const expeditionId = record.snapshot.expedition.id;
    const result = await session.dispatch(command.type === "undo" ? { type: "undo", expeditionId } : { type: "battle-command", expeditionId, command });
    if (!result || !result.presentable || !alive.current) { finish(); return null; }
    if (result.before.schemaVersion !== 1 || result.after.schemaVersion !== 1) { finish(); return null; }
    return {...result, before: result.before, after: result.after, receipts: result.receipts.filter((r): r is CommandReceipt => r.version === 1)};
  };
  return { state, getState: () => stateRef.current, show, finish, submit, heldActor, holdActor, presenting,
    ready: game.status === "ready" && !presenting, generation: game.generation,
    current: (batch: AnyCommittedBatch) => alive.current && sameHead(session.getSnapshot().record?.head ?? null, batch.after.head),
  };
}
