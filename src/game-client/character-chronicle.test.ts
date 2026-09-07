import { describe, expect, it } from "vitest";
import type { CharacterHistoryEntry } from "../game-application";
import { growthStories } from "../content/presentation/growth-stories";
import { presentCharacterChronicle } from "./character-chronicle";

function event(kind: string, id = kind, extra: Partial<CharacterHistoryEntry> = {}): CharacterHistoryEntry {
  return { id, kind, sourceFactIds: [id], runId: "run", encounterId: null,
    worldTime: { day: 1, phase: "dawn" }, count: 1, amount: 0, ...extra };
}

describe("character journal highlights", () => {
  it("keeps a first clear instead of its departure, floors, combat and return, without deleting source history", () => {
    const history = [
      event("expedition-started"),
      ...[1, 2, 3, 4, 5].map(layer => event("layer-cleared", `floor-${layer}`, { layer })),
      event("enemy-defeated"), event("healing-applied"), event("covenant-triggered"),
      event("unit-downed"), event("expedition-result"), event("manor-takeover-completed"),
    ];
    const before = structuredClone(history);
    expect(presentCharacterChronicle("norma", history).blocks).toEqual([
      expect.objectContaining({ title: "家宴落幕", marker: "milestone", tone: "accent" }),
    ]);
    expect(history).toEqual(before);
  });

  it("records each story and memory once, while keeping distinct authored growth moments", () => {
    const lv2 = "event.growth.norma.lv2", lv3 = "event.growth.norma.lv3";
    const history = [
      event("growth-completed", "growth2", { eventId: lv2 }),
      event("growth-completed", "replay2", { eventId: lv2 }),
      event("growth-completed", "growth3", { eventId: lv3 }),
      event("memory-completed", "memory1", { origin: "memory", memoryTemplate: "clockwork" }),
      event("memory-completed", "memory2", { origin: "memory", memoryTemplate: "clockwork" }),
      event("story-completed", "unknown", { eventId: "event.not-authored" }),
    ];
    expect(presentCharacterChronicle("norma", history).blocks).toEqual([
      expect.objectContaining({ title: growthStories[lv2].title, body: growthStories[lv2].chronicleText }),
      expect.objectContaining({ title: growthStories[lv3].title, body: growthStories[lv3].chronicleText }),
      expect.objectContaining({ title: "钟声停歇", stamp: "回忆" }),
    ]);
  });

  it("does not turn repeated maintenance or a routine defeat into invented milestones", () => {
    expect(presentCharacterChronicle("norma", [
      event("expedition-result", "maintenance1"),
      event("expedition-result", "maintenance2"),
      event("expedition-result", "wipe", { wiped: true }),
    ]).blocks).toEqual([]);
    expect(presentCharacterChronicle("marietta", [event("marietta-sortie-unlocked")]).blocks)
      .toEqual([expect.objectContaining({ title: "名单上的一行", categories: ["bond"], marker: "milestone" })]);
  });
});
