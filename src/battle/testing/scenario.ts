import {
  CHARACTERS,
  createExpedition,
  mulberry32,
  rollDice,
  toggleLoad,
  type CharacterId,
  type EnemyState,
  type ExpeditionState,
  type FaceDef,
  type PartyMemberState,
  type Rng
} from "../engine";

export type FaceMatcher =
  | Partial<Pick<FaceDef, "verb" | "power" | "pip" | "wildPip" | "label" | "quality">>
  | ((face: FaceDef, index: number) => boolean);

export type ExpeditionScenarioOptions = {
  seed?: number;
  rolled?: boolean;
  location?: string;
};

function matchesFace(face: FaceDef, index: number, matcher: FaceMatcher): boolean {
  if (typeof matcher === "function") return matcher(face, index);
  return Object.entries(matcher).every(
    ([key, value]) => face[key as keyof FaceDef] === value
  );
}

/**
 * Test-only builder for explicit battle arrangements.
 *
 * Production transitions remain immutable. The builder clones before every direct
 * fixture edit so a scenario cannot mutate a previously built state by accident.
 */
export class ExpeditionScenarioBuilder {
  readonly rng: Rng;
  private value: ExpeditionState;

  constructor({ seed = 7, rolled = true, location }: ExpeditionScenarioOptions = {}) {
    this.rng = mulberry32(seed);
    const initial = createExpedition(this.rng, location);
    this.value = rolled ? rollDice(initial, this.rng) : initial;
  }

  static act(seed = 7): ExpeditionScenarioBuilder {
    return new ExpeditionScenarioBuilder({ seed, rolled: true });
  }

  static roll(seed = 7): ExpeditionScenarioBuilder {
    return new ExpeditionScenarioBuilder({ seed, rolled: false });
  }

  /** Apply a production transition while retaining the builder chain. */
  transition(transform: (state: ExpeditionState) => ExpeditionState): this {
    this.value = transform(this.value);
    return this;
  }

  /**
   * Explicit escape hatch for arrangements that public commands cannot create.
   * The recipe always receives a fresh clone and is never used by production code.
   */
  patch(recipe: (draft: ExpeditionState) => void): this {
    const draft = structuredClone(this.value);
    recipe(draft);
    this.value = draft;
    return this;
  }

  face(ownerId: CharacterId, matcher: FaceMatcher, load = false): this {
    const faces = CHARACTERS[ownerId].faces;
    const faceIndex = faces.findIndex((candidate, index) =>
      matchesFace(candidate, index, matcher)
    );
    if (faceIndex < 0) {
      throw new Error(`No face matched ${ownerId}: ${JSON.stringify(matcher)}`);
    }

    const dieIndex = this.value.dice.findIndex((die) => die.ownerId === ownerId);
    if (dieIndex < 0) throw new Error(`No die belongs to ${ownerId}`);

    this.patch((draft) => {
      draft.dice[dieIndex]!.faceIndex = faceIndex;
    });

    if (load && !this.value.dice[dieIndex]!.loaded) {
      const loaded = toggleLoad(this.value, dieIndex);
      if (loaded === this.value) {
        throw new Error(`Could not load ${ownerId}'s die in the current scenario`);
      }
      this.value = loaded;
    }
    return this;
  }

  load(ownerId: CharacterId): this {
    const dieIndex = this.dieIndex(ownerId);
    if (!this.value.dice[dieIndex]!.loaded) {
      const loaded = toggleLoad(this.value, dieIndex);
      if (loaded === this.value) {
        throw new Error(`Could not load ${ownerId}'s die in the current scenario`);
      }
      this.value = loaded;
    }
    return this;
  }

  unload(ownerId: CharacterId): this {
    const dieIndex = this.dieIndex(ownerId);
    if (this.value.dice[dieIndex]!.loaded) {
      const unloaded = toggleLoad(this.value, dieIndex);
      if (unloaded === this.value) {
        throw new Error(`Could not unload ${ownerId}'s die in the current scenario`);
      }
      this.value = unloaded;
    }
    return this;
  }

  party(ownerId: CharacterId, patch: Partial<PartyMemberState>): this {
    return this.patch((draft) => {
      const member = draft.party.find((candidate) => candidate.id === ownerId);
      if (!member) throw new Error(`No party member has id ${ownerId}`);
      Object.assign(member, patch);
    });
  }

  enemy(enemyIdOrIndex: string | number, patch: Partial<EnemyState>): this {
    return this.patch((draft) => {
      const enemy =
        typeof enemyIdOrIndex === "number"
          ? draft.enemies[enemyIdOrIndex]
          : draft.enemies.find((candidate) => candidate.id === enemyIdOrIndex);
      if (!enemy) throw new Error(`No enemy matched ${String(enemyIdOrIndex)}`);
      Object.assign(enemy, patch);
    });
  }

  state(patch: Partial<ExpeditionState>): this {
    return this.patch((draft) => {
      Object.assign(draft, patch);
    });
  }

  dieIndex(ownerId: CharacterId): number {
    const index = this.value.dice.findIndex((die) => die.ownerId === ownerId);
    if (index < 0) throw new Error(`No die belongs to ${ownerId}`);
    return index;
  }

  enemyId(index = 0): string {
    const enemy = this.value.enemies[index];
    if (!enemy) throw new Error(`No enemy exists at index ${index}`);
    return enemy.id;
  }

  build(): ExpeditionState {
    return structuredClone(this.value);
  }
}

export function actScenario(seed = 7): ExpeditionScenarioBuilder {
  return ExpeditionScenarioBuilder.act(seed);
}
