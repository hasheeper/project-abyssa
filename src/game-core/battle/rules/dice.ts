import type { BattleContext } from "../../contracts";

import type {
  CharacterId,
  DieState,
  ExpeditionState,
  FaceDef,
  FaceQuality
} from "../domain/state";

function getRustableFaceIndices(context: BattleContext, ownerId: CharacterId): number[] {
  const faces = context.catalog.characters[ownerId].faces;
  return (["plain", "gild"] as const).flatMap((quality) =>
    faces.flatMap((face, index) => face.quality === quality ? [index] : [])
  );
}

/** Number of faces that can be degraded by layer recovery. */
export function getRustableFaceCapacity(context: BattleContext, ownerId: CharacterId): number {
  return getRustableFaceIndices(context, ownerId).length;
}

export function getEffectiveFaceQuality(context: BattleContext,
  ownerId: CharacterId,
  faceIndex: number,
  rustLevel: number
): FaceQuality {
  const base = context.catalog.characters[ownerId].faces[faceIndex];
  if (!base) return "none";
  if (base.quality === "rust") return "rust";
  const degradationIndex = getRustableFaceIndices(context, ownerId).indexOf(faceIndex);
  return degradationIndex >= 0 && degradationIndex < Math.max(0, rustLevel)
    ? "rust"
    : base.quality;
}

export function getRustFaceCount(context: BattleContext, ownerId: CharacterId, rustLevel: number): number {
  return context.catalog.characters[ownerId].faces.reduce(
    (count, _face, index) =>
      count + (getEffectiveFaceQuality(context, ownerId, index, rustLevel) === "rust" ? 1 : 0),
    0
  );
}

/** Effective gilded faces; a gilded face already degraded is not counted twice. */
export function getGildFaceCount(context: BattleContext, ownerId: CharacterId, rustLevel: number): number {
  return context.catalog.characters[ownerId].faces.reduce(
    (count, _face, index) =>
      count + (getEffectiveFaceQuality(context, ownerId, index, rustLevel) === "gild" ? 1 : 0),
    0
  );
}

export function getFace(context: BattleContext, die: DieState, rustLevel = 0): FaceDef | null {
  if (die.faceIndex === null) return null;
  const base = context.catalog.characters[die.ownerId].faces[die.faceIndex];
  if (!base) return null;
  const quality = getEffectiveFaceQuality(context, die.ownerId, die.faceIndex, rustLevel);
  return quality === base.quality ? base : { ...base, quality };
}

/** Resolve a die face against its owner's canonical degradation state. */
export function getStateFace(context: BattleContext, state: ExpeditionState, die: DieState): FaceDef | null {
  const rustLevel =
    state.party.find((member) => member.id === die.ownerId)?.rustLevel ?? 0;
  return getFace(context, die, rustLevel);
}

export function getFaceValue(context: BattleContext, die: DieState, rustLevel = 0): number {
  return getFace(context, die, rustLevel)?.power ?? 0;
}
