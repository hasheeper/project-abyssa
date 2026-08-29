import { CHARACTERS, PARTY_ORDER } from "../content/characters";
import type {
  CharacterId,
  DieState,
  ExpeditionState,
  FaceDef,
  FaceQuality
} from "../domain/state";

/* The degradation order is static content, so compute it once per module. */
const RUSTABLE_FACE_INDICES = Object.fromEntries(
  PARTY_ORDER.map((ownerId) => {
    const faces = CHARACTERS[ownerId].faces;
    const indices = (["plain", "gild"] as const).flatMap((quality) =>
      faces.flatMap((face, index) => (face.quality === quality ? [index] : []))
    );
    return [ownerId, indices];
  })
) as Record<CharacterId, number[]>;

function getRustableFaceIndices(ownerId: CharacterId): number[] {
  return RUSTABLE_FACE_INDICES[ownerId];
}

/** Number of faces that can be degraded by layer recovery. */
export function getRustableFaceCapacity(ownerId: CharacterId): number {
  return getRustableFaceIndices(ownerId).length;
}

export function getEffectiveFaceQuality(
  ownerId: CharacterId,
  faceIndex: number,
  rustLevel: number
): FaceQuality {
  const base = CHARACTERS[ownerId].faces[faceIndex];
  if (!base) return "none";
  if (base.quality === "rust") return "rust";
  const degradationIndex = getRustableFaceIndices(ownerId).indexOf(faceIndex);
  return degradationIndex >= 0 && degradationIndex < Math.max(0, rustLevel)
    ? "rust"
    : base.quality;
}

export function getRustFaceCount(ownerId: CharacterId, rustLevel: number): number {
  return CHARACTERS[ownerId].faces.reduce(
    (count, _face, index) =>
      count + (getEffectiveFaceQuality(ownerId, index, rustLevel) === "rust" ? 1 : 0),
    0
  );
}

/** Effective gilded faces; a gilded face already degraded is not counted twice. */
export function getGildFaceCount(ownerId: CharacterId, rustLevel: number): number {
  return CHARACTERS[ownerId].faces.reduce(
    (count, _face, index) =>
      count + (getEffectiveFaceQuality(ownerId, index, rustLevel) === "gild" ? 1 : 0),
    0
  );
}

export function getFace(die: DieState, rustLevel = 0): FaceDef | null {
  if (die.faceIndex === null) return null;
  const base = CHARACTERS[die.ownerId].faces[die.faceIndex];
  if (!base) return null;
  const quality = getEffectiveFaceQuality(die.ownerId, die.faceIndex, rustLevel);
  return quality === base.quality ? base : { ...base, quality };
}

/** Resolve a die face against its owner's canonical degradation state. */
export function getStateFace(state: ExpeditionState, die: DieState): FaceDef | null {
  const rustLevel =
    state.party.find((member) => member.id === die.ownerId)?.rustLevel ?? 0;
  return getFace(die, rustLevel);
}

export function getFaceValue(die: DieState, rustLevel = 0): number {
  return getFace(die, rustLevel)?.power ?? 0;
}
