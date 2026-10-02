import { describe, expect, it } from "vitest";
import { createD5BattleEngine, createD5MemoryEngine } from "../../game-core/battle";
import { ESTATE_CATALOG } from "../../game-runtime/estate-context";
import { D5_FOUNDATION_CATALOG } from "../../game-runtime/d5-foundation";
import { enemyTransitionEvidence, memoryVictoryEvidence } from "./enemy-evidence";
import { initialD5Projection } from "../../game-core/session";

describe("enemy evidence semantics", () => {
  it("completes the manor core only, leaving living released guests at the encounter stage", () => {
    const before = createD5BattleEngine(ESTATE_CATALOG).create({runId: "manor", routeId: "old-manor.first-clear", partyIds: ESTATE_CATALOG.data.initialParty, progress: initialD5Projection(ESTATE_CATALOG).progress, seed: 19});
    const after = structuredClone(before), guest = after.encounter.enemies[0];
    const boss = {...guest, id: "heiress", definitionId: ESTATE_CATALOG.data.manor!.boss.definitionId, hp: 0, disposition: "released" as const};
    after.encounter.enemies.push(boss); guest.disposition = "released";
    const events = [guest, boss].map(enemy => ({id: `release:${enemy.id}`, type: "enemy-released", actorId: null, payload: {targetId: enemy.id, bounty: 0, reason: "core-released"}}));
    const evidence = enemyTransitionEvidence(ESTATE_CATALOG, "fact", before, after, events);
    expect(evidence.filter(e => e.stage === "defeated").map(e => e.definitionId)).toEqual([boss.definitionId]);
    expect(evidence.some(e => e.definitionId === guest.definitionId && e.stage === "defeated")).toBe(false);
  });

  it("waits for a successful historical terminal and does not count dismissed defenders", () => {
    const before = createD5MemoryEngine(D5_FOUNDATION_CATALOG).create({runId: "memory", seed: 19});
    const after = structuredClone(before), boss = after.encounter.enemies.find(e => e.definitionId === D5_FOUNDATION_CATALOG.data.progression.chapter.bossId)!;
    boss.hp = 0;
    const events = [{id: "endurance", type: "memory-endurance-depleted", actorId: "kael", payload: {targetId: boss.id}}];
    expect(enemyTransitionEvidence(D5_FOUNDATION_CATALOG, "action", before, after, events)).toEqual([]);
    after.encounter.phase = "complete"; after.encounter.outcome = "victory";
    expect(memoryVictoryEvidence(D5_FOUNDATION_CATALOG, "terminal", after).map(e => e.definitionId)).toEqual([boss.definitionId]);
    after.encounter.outcome = "wipe";
    expect(memoryVictoryEvidence(D5_FOUNDATION_CATALOG, "terminal", after)).toEqual([]);
  });

  it("records a newly summoned species even when no new encounter begins", () => {
    const before = createD5BattleEngine(ESTATE_CATALOG).create({runId: "manor", routeId: "old-manor.first-clear", partyIds: ESTATE_CATALOG.data.initialParty, progress: initialD5Projection(ESTATE_CATALOG).progress, seed: 19});
    const after = structuredClone(before), enemy = {...after.encounter.enemies[0], id: "summoned", definitionId: "enemy.old-manor.mending-maid"};
    after.encounter.enemies.push(enemy);
    expect(enemyTransitionEvidence(ESTATE_CATALOG, "summon", before, after, [{id: "summon", type: "enemy-summoned", actorId: null, payload: {targetId: enemy.id, definitionId: enemy.definitionId}}])).toMatchObject([{factId: "summon", definitionId: enemy.definitionId, stage: "seen"}]);
  });
});
