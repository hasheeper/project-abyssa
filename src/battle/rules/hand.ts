import type {
  CharacterId,
  ExpeditionState,
  FaceQuality,
  HandEvaluation,
  HandRank
} from "../domain/state";
import { isDieDowned } from "../selectors/battle-selectors";
import { getStateFace } from "./dice";

const QUALITY_MODIFIER: Record<FaceQuality, number> = {
  plain: 0,
  rust: -0.1,
  gild: 0.1,
  none: 0
};

function roundTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

export const HAND_BONUSES: Record<string, number> = {
  散牌: 0,
  一对: 0.1,
  两对: 0.2,
  三条: 0.3,
  小顺: 0.5,
  葫芦: 0.8,
  四条: 1.2,
  大顺: 1.6,
  快艇: 2
};

export function rankHand(values: number[]): HandRank {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

  const frequencies = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || b[0] - a[0]
  );

  const findRun = (length: number): number[] | null => {
    for (let start = 6 - length + 1; start >= 1; start -= 1) {
      let valid = true;
      for (let value = start; value < start + length; value += 1) {
        if (!counts.has(value)) {
          valid = false;
          break;
        }
      }
      if (valid) return Array.from({ length }, (_, offset) => start + offset);
    }
    return null;
  };

  const repeat = (value: number, times: number) =>
    Array.from({ length: times }, () => value);

  const top = frequencies[0];
  const second = frequencies[1];

  if (top && top[1] >= 5) {
    return { name: "快艇", bonus: HAND_BONUSES["快艇"]!, used: repeat(top[0], 5) };
  }

  const bigRun = values.length >= 5 ? findRun(5) : null;
  if (bigRun) return { name: "大顺", bonus: HAND_BONUSES["大顺"]!, used: bigRun };

  if (top && top[1] === 4) {
    return { name: "四条", bonus: HAND_BONUSES["四条"]!, used: repeat(top[0], 4) };
  }

  if (top && top[1] === 3 && second && second[1] >= 2) {
    return {
      name: "葫芦",
      bonus: HAND_BONUSES["葫芦"]!,
      used: [...repeat(top[0], 3), ...repeat(second[0], 2)]
    };
  }

  const smallRun = findRun(4);
  if (smallRun) return { name: "小顺", bonus: HAND_BONUSES["小顺"]!, used: smallRun };

  if (top && top[1] === 3) {
    return { name: "三条", bonus: HAND_BONUSES["三条"]!, used: repeat(top[0], 3) };
  }

  if (top && top[1] === 2 && second && second[1] === 2) {
    return {
      name: "两对",
      bonus: HAND_BONUSES["两对"]!,
      used: [...repeat(top[0], 2), ...repeat(second[0], 2)]
    };
  }

  if (top && top[1] === 2) {
    return { name: "一对", bonus: HAND_BONUSES["一对"]!, used: repeat(top[0], 2) };
  }

  return { name: "散牌", bonus: 0, used: [] };
}

/** Read the current dice, enumerate wild pips and return the best adjusted hand. */
export function evaluateHand(state: ExpeditionState): HandEvaluation {
  const activeDice = state.dice.filter(
    (die) => !die.sealed && !isDieDowned(state, die) && die.faceIndex !== null
  );

  const pips: (number | "wild")[] = activeDice.map((die) => {
    const face = getStateFace(state, die)!;
    return face.wildPip ? "wild" : face.pip;
  });

  const wildCount = pips.filter((pip) => pip === "wild").length;
  const fixed = pips.filter((pip): pip is number => pip !== "wild");

  let bestRank: HandRank = { name: "散牌", bonus: 0, used: [] };
  let qualityModifier = 0;
  let contributors: CharacterId[] = [];

  const resolveContributors = (used: number[], assignedWilds: number[]) => {
    let wildIndex = 0;
    const candidates = activeDice.map((die) => {
      const face = getStateFace(state, die)!;
      const pip = face.wildPip ? assignedWilds[wildIndex++] : face.pip;
      return { die, face, pip };
    });

    let modifier = 0;
    const resolved: CharacterId[] = [];
    const remaining = new Map<number, number>();
    for (const pip of used) remaining.set(pip, (remaining.get(pip) ?? 0) + 1);

    for (const [pip, count] of remaining) {
      const matches = candidates
        .filter((candidate) => candidate.pip === pip)
        .sort(
          (left, right) =>
            QUALITY_MODIFIER[right.face.quality] - QUALITY_MODIFIER[left.face.quality]
        )
        .slice(0, count);
      for (const match of matches) {
        modifier += QUALITY_MODIFIER[match.face.quality];
        resolved.push(match.die.ownerId);
      }
    }

    return { modifier: roundTwo(modifier), contributors: resolved };
  };

  const enumerate = (assigned: number[]) => {
    if (assigned.length === wildCount) {
      const candidate = rankHand([...fixed, ...assigned]);
      const resolved = resolveContributors(candidate.used, assigned);
      if (
        candidate.bonus > bestRank.bonus ||
        (candidate.bonus === bestRank.bonus && resolved.modifier > qualityModifier)
      ) {
        bestRank = candidate;
        qualityModifier = resolved.modifier;
        contributors = resolved.contributors;
      }
      return;
    }
    for (let value = 1; value <= 6; value += 1) enumerate([...assigned, value]);
  };
  enumerate([]);

  const adjustedBonus =
    bestRank.bonus > 0 ? Math.max(0, roundTwo(bestRank.bonus + qualityModifier)) : 0;

  return {
    ...bestRank,
    adjustedBonus,
    qualityModifier: roundTwo(qualityModifier),
    pips,
    contributors: bestRank.bonus > 0 ? contributors : []
  };
}
