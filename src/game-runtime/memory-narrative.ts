import type { AvgFrame, AvgStageCue } from "../content/presentation/narrative-layout";
import type { MemorySource, MemoryStage, MemoryBlock, MemoryEntry } from "./memory-journal-types";

export type NarrativeClock = { day: number; phase: "dawn" | "day" | "dusk" | "night" };
export type NarrativeSnapshot = Omit<MemoryStage, "actorId" | "emotion" | "expression" | "actors"> & {
  actors?: readonly { actorId: string; emotion?: string; expression?: string }[];
};
export type NarrativeFrame = (Omit<AvgFrame, "kind" | "actorId" | "text" | "emotion" | "waitMs"> & {
  source: MemorySource; scene?: NarrativeSnapshot; stage?: AvgStageCue[];
}) & (
  | { kind: "dialogue"; actorId: string; text: string; emotion?: string }
  | { kind: "narration" | "chapter"; text: string }
  | { kind: "direction"; waitMs: number }
);
export type NarrativeReceipt = {
  kind: "receipt"; id: string; operation: "appraise" | "sell" | "purchase" | "battle";
  items?: readonly { instanceId: string; name: string; quantity: number }[];
  moneyDelta?: number; outcome?: string; source: MemorySource;
};
export type NarrativeStep = { kind: "content"; frames: readonly NarrativeFrame[] }
  | { kind: "choice-result"; id: string; choiceId: string; optionId: string; label: string; source: MemorySource }
  | NarrativeReceipt;
export type NarrativeSlice = {
  id: string; definitionId?: string; recordedAt: NarrativeClock | null;
  presentation: { surface: "adv" | "counter" | "text"; opening?: NarrativeSnapshot };
  steps: readonly NarrativeStep[];
};
export type NarrativeAct = {
  id: string; definitionId?: string; title: string; phaseLabel?: string;
  coverage: "partial" | "complete" | "unknown"; replay: "scene" | "text";
  startedAt: NarrativeClock | null; slices: readonly NarrativeSlice[];
};
export type NarrativeEvent = {
  id: string; definitionId?: string; title: string; summary?: string; sequence: number;
  startedAt: NarrativeClock | null; lastRecordedAt: NarrativeClock | null;
  participants: readonly string[]; acts: readonly NarrativeAct[];
};
export type NarrativeRecord = { schemaVersion: 1; kind: "record"; events: readonly NarrativeEvent[] };
export function narrativeRecord(entries: readonly MemoryEntry[]): NarrativeRecord {
  return { schemaVersion: 1, kind: "record", events: entries.flatMap(entry => entry.narrative ? [entry.narrative] : []) };
}

export function narrativeSnapshot(stage: MemoryStage): NarrativeSnapshot {
  const actors = new Map((stage.actors ?? []).map(a => [a.characterId, { actorId: a.characterId, ...(a.emotion ? { emotion: a.emotion } : {}) }]));
  if (stage.actorId) actors.set(stage.actorId, { actorId: stage.actorId, ...(stage.emotion ? { emotion: stage.emotion } : {}), ...(stage.expression ? { expression: stage.expression } : {}) });
  return { background: stage.background, ...(stage.initialSlots ? { initialSlots: stage.initialSlots } : {}),
    ...(stage.offstageActorId ? { offstageActorId: stage.offstageActorId } : {}), ...(stage.portraits ? { portraits: stage.portraits } : {}),
    ...(actors.size ? { actors: [...actors.values()] } : {}) };
}

export function narrativeReceiptText(receipt: NarrativeReceipt) {
  const operation = { appraise: "鉴定", sell: "出售", purchase: "购买", battle: "战斗" }[receipt.operation];
  const items = receipt.items?.map(i => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join("、");
  const money = receipt.moneyDelta === undefined ? "" : receipt.moneyDelta === 0 ? "未支付费用" : `${receipt.moneyDelta > 0 ? "收入" : "支付"} ${Math.abs(receipt.moneyDelta)} 铜币`;
  return [operation + (items ? `：${items}` : ""), money, receipt.outcome].filter(Boolean).join(" · ");
}

/** Compatibility transcript is derived from the same immutable steps consumed by replay. */
export function narrativeActBlocks(act: NarrativeAct, entry: MemoryEntry): MemoryBlock[] {
  const sourceKey = (source: MemorySource | undefined, text: string) => JSON.stringify([source?.factId, source?.lineId, text]);
  const originals = new Map<string, MemoryBlock>();
  for (const block of entry.blocks) {
    const key = sourceKey(block.source, block.text);
    // A duplicate source retains the first recorded speaker, including an absent one.
    if (!originals.has(key)) originals.set(key, block);
  }
  return act.slices.flatMap(slice => {
    let scene = slice.presentation.opening;
    return slice.steps.flatMap((step): MemoryBlock[] => {
      if (step.kind === "content") return step.frames.map(frame => {
        scene = frame.scene ?? scene;
        const actorId = frame.kind === "dialogue" ? frame.actorId : undefined;
        const actor = scene?.actors?.find(a => a.actorId === actorId);
        const stage = scene ? { ...scene, actors: frame.stage?.map(a => ({ characterId: a.actorId, emotion: a.emotion })), actorId,
          emotion: frame.kind === "dialogue" ? frame.emotion : undefined, expression: actor?.expression } : undefined;
        const original = originals.get(sourceKey(frame.source, "text" in frame ? frame.text : ""));
        return { text: "text" in frame ? frame.text : "", speaker: original?.speaker, source: frame.source, stage, frame };
      });
      return [{ text: step.kind === "choice-result" ? step.label : narrativeReceiptText(step),
        kind: step.kind === "choice-result" ? "choice" : "receipt", source: step.source,
        stage: scene ? { ...scene, actors: [] } : undefined }];
    });
  });
}
