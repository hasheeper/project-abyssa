import type { BattleContext, EnemyDefinition } from "../../contracts";
import type { EnemyArt, EnemyKind, EnemyState, Rng } from "../domain/state";

export type EnemyExtra = Partial<Pick<EnemyState, "attack" | "chargeReady" | "countdown">>;

export function makeEnemy(sequence: () => number, kind: EnemyKind, name: string, art: EnemyArt, hp: number, extra: EnemyExtra = {}): EnemyState {
  return {
    id: `enemy-${sequence()}`, kind, name, art, hp, maxHp: hp,
    attack: extra.attack ?? 0, chargeReady: extra.chargeReady ?? false,
    countdown: extra.countdown ?? 2, intent: null, blocked: 0
  };
}

function instantiate(context: BattleContext, definition: EnemyDefinition, sequence: () => number): EnemyState {
  const enemy = makeEnemy(sequence, definition.kind, definition.name, definition.art, definition.hp, definition);
  if (!context.legacy) enemy.definitionId = definition.id;
  return enemy;
}

export function createLayerEnemies(context: BattleContext, layer: number, sequence: () => number, rng: Rng): EnemyState[] {
  const route = context.catalog.routes[context.routeId];
  // The legacy factory used its final encounter for the switch's default branch.
  const encounterId = route.encounters[layer - 1] ?? (context.legacy ? route.encounters.at(-1)! : "");
  const encounter = context.catalog.encounters[encounterId];
  if (!encounter) throw new Error("Unknown encounter layer");
  return encounter.slots.map((choices) => {
    const id = choices.length === 1 ? choices[0] : choices[Math.floor(rng() * choices.length)];
    return instantiate(context, context.catalog.enemies[id], sequence);
  });
}

export function createSummonedEnemy(context: BattleContext, sequence: () => number): EnemyState {
  return instantiate(context, context.catalog.enemies[context.catalog.summonEnemyId], sequence);
}
