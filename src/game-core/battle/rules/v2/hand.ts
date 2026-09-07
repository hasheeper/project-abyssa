import type { RuleBattleState as DemoBattleState } from "../../domain/rule-state";
import type { DemoContent, DemoFace } from "../../../contracts/demo";
import type {
  DemoDie,
  DemoHand,
  DemoHandDie,
} from "../../domain/demo-state";
import { rankHand } from "../hand";

const qualityValue = { plain: 0, gild: 1, rust: -1 };
export function demoFace(
  state: Pick<DemoBattleState, "run">,
  die: DemoDie,
): DemoFace | null {
  const member = state.run.party.find((m) => m.id === die.ownerId);
  if (!member || die.faceIndex === null) return null;
  const face = member.config.faces[die.faceIndex];
  return member.temporaryRust.includes(face.id)
    ? { ...face, quality: "rust" }
    : face;
}
export function evaluateDemoHand(
  content: DemoContent,
  state: DemoBattleState,
): DemoHand {
  const living = state.encounter.dice.filter(
    (d) =>
      !d.sealed && state.run.party.some((m) => m.id === d.ownerId && m.hp > 0),
  );
  const awake = living.filter((d) => demoFace(state, d)?.fate === "awake");
  const hasWild = awake.some((d) => demoFace(state, d)!.pip.kind === "wild");
  const candidates: DemoHand[] = [];
  for (const value of hasWild ? [1, 2, 3, 4, 5, 6] : [0]) {
    const dice: DemoHandDie[] = awake.map((d) => {
      const f = demoFace(state, d)!;
      return {
        ownerId: d.ownerId,
        faceId: f.id,
        value: f.pip.kind === "wild" ? value : f.pip.value,
        suit: f.suit,
        quality: f.quality,
      };
    });
    const counts = new Map<number, number>();
    dice.forEach((d) => counts.set(d.value, (counts.get(d.value) ?? 0) + 1));
    const frequencies = [...counts.values()];
    const flushGroups = (["earth", "light", "abyss", "beyond"] as const)
      .map((s) => dice.filter((d) => d.suit === s))
      .filter((g) => g.length >= 4);
    const patterns = {
      flush: flushGroups.length > 0,
      triple: frequencies.some((n) => n >= 3),
      twoPair:
        frequencies.filter((n) => n >= 2).length >= 2 ||
        frequencies.some((n) => n >= 4),
      straight: [1, 2, 3].some((n) =>
        [0, 1, 2, 3].every((i) => counts.has(n + i)),
      ),
      fullHouse: frequencies.includes(3) && frequencies.includes(2),
    };
    const ranked = rankHand(dice.map((d) => d.value));
    const order = (a: DemoHandDie, b: DemoHandDie) =>
      qualityValue[b.quality] - qualityValue[a.quality] ||
      dice.indexOf(a) - dice.indexOf(b);
    const used: DemoHandDie[] = [];
    for (const pip of new Set(ranked.used))
      used.push(
        ...dice
          .filter((d) => d.value === pip)
          .sort(order)
          .slice(0, ranked.used.filter((v) => v === pip).length),
      );
    const options = [
      { name: ranked.name, bonus: ranked.bonus, used },
      ...flushGroups.map((group) => ({
        name: "同花",
        bonus: 0.6,
        used: [...group].sort(order).slice(0, 4),
      })),
    ];
    for (const option of options) {
      const modifier =
        option.used.reduce((sum, d) => sum + qualityValue[d.quality], 0) / 10;
      candidates.push({
        name: option.name,
        bonus: option.bonus,
        qualityModifier: modifier,
        adjustedBonus: option.bonus
          ? Math.max(0, Math.round((option.bonus + modifier) * 100) / 100)
          : 0,
        dice,
        contributors: option.used.map((d) => d.ownerId),
        wildValue: hasWild ? value : null,
        patterns,
        hasBlank: living.some((d) => {
          const f = demoFace(state, d);
          return !!f && content.actions[f.actionId].kind === "blank";
        }),
        covenantOwnerIds: living
          .filter(
            (d) =>
              state.run.party.find((m) => m.id === d.ownerId)!.config
                .covenantId !== null,
          )
          .map((d) => d.ownerId),
      });
    }
  }
  const pipKey = (h: DemoHand) =>
    h.dice
      .map((d) => d.value)
      .sort((a, b) => b - a)
      .reduce((sum, n) => sum * 10 + n, 0);
  candidates.sort(
    (a, b) =>
      b.bonus - a.bonus ||
      b.qualityModifier - a.qualityModifier ||
      pipKey(b) - pipKey(a) ||
      (b.wildValue ?? 0) - (a.wildValue ?? 0),
  );
  return candidates[0];
}
