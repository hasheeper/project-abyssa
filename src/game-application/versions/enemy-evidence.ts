import type { ValidatedD5Catalog, ValidatedDemoCatalog } from "../../game-core/contracts";
import type { DemoEvent } from "../../game-core/battle";
import type { D5BattleState, D5ExpeditionState, D5MemoryBattleState } from "../../game-core/session";
import type { DemoGameRecord } from "./demo-record";

/** Derived during strict replay. Never serialized or accepted from the client. */
export type EnemyEvidence = {
  factId: string; definitionId: string; stage: "seen" | "defeated";
  encounterId: string; routeId: string; roomId: string | null;
};
type Battle = Pick<D5BattleState | D5MemoryBattleState, "run" | "encounter">;

export function visibleJourneyBattle(state: D5ExpeditionState | null): Battle | null {
  return state?.node === "battle" && (!state.tutorial || state.tutorial.stage === "active") ? state : null;
}

export function enemyTransitionEvidence(catalog: ValidatedD5Catalog, factId: string,
  before: Battle | null, after: Battle | null, events: readonly DemoEvent[], initial = false): EnemyEvidence[] {
  const out: EnemyEvidence[] = [];
  const add = (battle: Battle, definitionId: string, stage: EnemyEvidence["stage"]) => {
    const roomId = catalog.data.routes[battle.run.routeId]?.layers[battle.run.layer - 1]?.[battle.run.room]
      ?? (battle.encounter.memory ? catalog.data.combat.memory.roomId : null);
    if (!out.some(e => e.definitionId === definitionId && e.stage === stage && e.encounterId === battle.encounter.id))
      out.push({ factId, definitionId, stage, encounterId: battle.encounter.id, routeId: battle.run.routeId, roomId });
  };
  if (initial && before) for (const enemy of before.encounter.enemies) add(before, enemy.definitionId, "seen");
  if (after) for (const enemy of after.encounter.enemies) {
    if (!before || before.encounter.id !== after.encounter.id || !before.encounter.enemies.some(e => e.id === enemy.id))
      add(after, enemy.definitionId, "seen");
  }
  for (const event of events) {
    if (!["enemy-summoned", "enemy-defeated", "enemy-released"].includes(event.type)) continue;
    const payload = event.payload as Record<string, unknown>;
    const targetId = payload.targetId;
    const battle = after?.encounter.enemies.some(e => e.id === targetId) ? after : before;
    const enemy = battle?.encounter.enemies.find(e => e.id === targetId);
    if (!battle || !enemy) continue;
    if (event.type === "enemy-summoned") add(battle, enemy.definitionId, "seen");
    if (event.type === "enemy-defeated" || event.type === "enemy-released" &&
      enemy.definitionId === catalog.data.manor?.boss.definitionId && enemy.hp === 0 &&
      payload.reason === "core-released") add(battle, enemy.definitionId, "defeated");
  }
  return out;
}

export function memoryVictoryEvidence(catalog: ValidatedD5Catalog, factId: string, battle: D5MemoryBattleState): EnemyEvidence[] {
  if (battle.encounter.outcome !== "victory") return [];
  const boss = battle.encounter.enemies.find(e => e.definitionId === catalog.data.progression.chapter.bossId);
  if (!boss || boss.hp !== 0) return [];
  return [{ factId, definitionId: boss.definitionId, stage: "defeated", encounterId: battle.encounter.id,
    routeId: battle.run.routeId, roomId: catalog.data.combat.memory.roomId }];
}

/** Published v2/v3 archives already retain structured encounter facts. */
export function demoEnemyEvidence(catalog: ValidatedDemoCatalog, record: DemoGameRecord): EnemyEvidence[] {
  const out: EnemyEvidence[] = [];
  const routes = new Map<string, string>();
  const encounters = new Map<string, { routeId: string; roomId: string; enemies: Map<string, string> }>();
  for (const fact of record.facts) {
    if (fact.origin === "simulation") continue;
    const payload = fact.payload as Record<string, unknown>;
    if (fact.kind === "expedition-started") routes.set(payload.runId as string, payload.routeId as string);
    if (fact.kind === "expedition-started" || fact.kind === "encounter-started") {
      const routeId = routes.get(fact.runRef!.id)!;
      const roomId = catalog.data.routes[routeId].layers[fact.kind === "expedition-started" ? 0 : Number(payload.layer) - 1][fact.kind === "expedition-started" ? 0 : Number(payload.room)];
      const room = catalog.data.journey!.rooms[roomId];
      const encounterId = fact.kind === "expedition-started" ? fact.encounterId! : payload.encounterId as string;
      if (room.kind === "battle") {
        const ids = catalog.data.encounters[room.encounterId].enemyIds;
        encounters.set(encounterId, {routeId, roomId, enemies: new Map(ids.map((id, index) => [`${encounterId}:enemy:${index + 1}`, id]))});
        for (const definitionId of new Set(ids)) out.push({factId: fact.id, definitionId, stage: "seen", encounterId, routeId, roomId});
      }
    }
    const encounter = fact.encounterId ? encounters.get(fact.encounterId) : undefined;
    if (!encounter) continue;
    if (fact.kind === "enemy-summoned") encounter.enemies.set(payload.targetId as string, payload.definitionId as string);
    const definitionId = encounter.enemies.get(payload.targetId as string);
    if (!definitionId) continue;
    if (fact.kind === "enemy-summoned" || fact.kind === "enemy-defeated" || fact.kind === "enemy-released" && definitionId === catalog.data.manor?.boss.definitionId)
      out.push({factId: fact.id, definitionId, stage: fact.kind === "enemy-summoned" ? "seen" : "defeated", encounterId: fact.encounterId!, routeId: encounter.routeId, roomId: encounter.roomId});
  }
  return out;
}
