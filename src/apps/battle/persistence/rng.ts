import type {
  BattleRngState,
  Rng,
  RngStreamState
} from "../domain/state";

const MULBERRY_INCREMENT = 0x6d2b79f5;
const trackedRng = new WeakMap<Rng, RngStreamState>();

function normalizeSeed(seed: number): number {
  return seed >>> 0;
}

function mixSeed(seed: number, salt: number): number {
  let value = normalizeSeed(seed ^ salt);
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

export function createBattleRngState(seed: number): BattleRngState {
  const normalized = normalizeSeed(seed);
  return {
    combat: { algorithm: "mulberry32", seed: normalized, cursor: 0 },
    loot: {
      algorithm: "mulberry32",
      seed: mixSeed(normalized, 0xa511e9b3),
      cursor: 0
    },
    flavor: {
      algorithm: "mulberry32",
      seed: mixSeed(normalized, 0x63d83595),
      cursor: 0
    }
  };
}

export function drawRngValue(stream: RngStreamState): {
  value: number;
  stream: RngStreamState;
} {
  if (stream.algorithm !== "mulberry32") {
    throw new Error(`Unsupported RNG algorithm: ${String(stream.algorithm)}`);
  }
  const cursor = stream.cursor + 1;
  const a = (stream.seed + Math.imul(MULBERRY_INCREMENT, cursor)) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, stream: { ...stream, cursor } };
}

export function createRngCursor(initial: RngStreamState): {
  rng: Rng;
  snapshot: () => RngStreamState;
} {
  let current = { ...initial };
  return {
    rng: () => {
      const draw = drawRngValue(current);
      current = draw.stream;
      return draw.value;
    },
    snapshot: () => ({ ...current })
  };
}

export function advanceRngStream(
  stream: RngStreamState,
  draws: number
): RngStreamState {
  return { ...stream, cursor: stream.cursor + Math.max(0, Math.trunc(draws)) };
}

/** Compatibility closure with readable seed/cursor metadata kept outside state. */
export function mulberry32(seed: number): Rng {
  const initial: RngStreamState = {
    algorithm: "mulberry32",
    seed: normalizeSeed(seed),
    cursor: 0
  };
  const cursor = createRngCursor(initial);
  const rng: Rng = () => {
    const value = cursor.rng();
    trackedRng.set(rng, cursor.snapshot());
    return value;
  };
  trackedRng.set(rng, initial);
  return rng;
}

export function getTrackedRngSnapshot(rng: Rng): RngStreamState | null {
  const snapshot = trackedRng.get(rng);
  return snapshot ? { ...snapshot } : null;
}
