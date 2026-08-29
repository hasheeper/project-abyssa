import type {
  EnemyArt,
  EnemyKind,
  EnemyState,
  Rng
} from "../domain/state";

export type EnemyExtra = Partial<
  Pick<EnemyState, "attack" | "chargeReady" | "countdown">
>;

export function makeEnemy(
  sequence: () => number,
  kind: EnemyKind,
  name: string,
  art: EnemyArt,
  hp: number,
  extra: EnemyExtra = {}
): EnemyState {
  return {
    id: `enemy-${sequence()}`,
    kind,
    name,
    art,
    hp,
    maxHp: hp,
    attack: extra.attack ?? 0,
    chargeReady: extra.chargeReady ?? false,
    countdown: extra.countdown ?? 2,
    intent: null,
    blocked: 0
  };
}

export function createLayerEnemies(
  layer: number,
  sequence: () => number,
  rng: Rng
): EnemyState[] {
  const make = (
    kind: EnemyKind,
    name: string,
    art: EnemyArt,
    hp: number,
    extra: EnemyExtra = {}
  ) => makeEnemy(sequence, kind, name, art, hp, extra);

  switch (layer) {
    case 1:
      return [
        make("brute", "畸变魔物", "amalgam", 2, { attack: 1 }),
        make("brute", "裂隙爪兽", "sentinel", 3, { attack: 2 })
      ];
    case 2:
      return [
        make("brute", "畸变魔物", "amalgam", 3, { attack: 2 }),
        rng() < 0.5
          ? make("anomaly", "瘴气异象", "amalgam", 2)
          : make("trap", "术式陷阱", "choir", 2, { countdown: 2 })
      ];
    case 3:
      return [
        make("brute", "裂隙爪兽", "sentinel", 3, { attack: 2 }),
        make("summoner", "裂隙之口", "choir", 3),
        make("anomaly", "瘴气异象", "amalgam", 2)
      ];
    case 4:
      return [
        make("charger", "蓄能异兽", "choir", 4, { attack: 3 }),
        make("summoner", "裂隙之口", "choir", 3),
        make("brute", "畸变魔物", "amalgam", 3, { attack: 2 })
      ];
    default:
      return [
        make("brute", "深渊噬兽", "sentinel", 6, { attack: 3 }),
        make("charger", "蓄能异兽", "choir", 4, {
          attack: 4,
          chargeReady: true
        }),
        make("anomaly", "瘴气异象", "amalgam", 3),
        make("trap", "术式陷阱", "choir", 3, { countdown: 1 })
      ];
  }
}
