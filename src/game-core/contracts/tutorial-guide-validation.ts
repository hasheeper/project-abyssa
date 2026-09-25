import * as v from "./validation";
import type { D5Catalog } from "./d5";

export function validateTutorialGuide(catalog: D5Catalog) {
  const spec = catalog.tutorial!, g = v.record(spec.guide, "tutorial.guide", ["version", "id", "continuationSeed", "nodes", "steps", ...(catalog.contentVersion >= 12 ? ["eventSeed"] : [])]);
  v.choice(g.version, [1], "guide.version"); v.choice(g.id, [catalog.contentVersion >= 14 ? "tide.guide.v3" : catalog.contentVersion >= 12 ? "tide.guide.v2" : "tide.guide.v1"], "guide.id");
  v.choice(g.continuationSeed, [11395852], "guide.seed"); v.choice(spec.firstBattleSeed, [8267], "guide.firstSeed");
  if (catalog.contentVersion >= 12) v.choice(g.eventSeed,[7],"guide.eventSeed");
  v.choice(spec.reward.gold, [catalog.contentVersion >= 17 ? 800 : 8], "guide.reward");
  const expected = [
    {roomId: "room.tide-cave.1", battle: 1, storyAfter: "S3-2"},
    {roomId: "room.tide-cave.2", battle: 2, storyAfter: "S3-3"},
    {roomId: "room.tide-cave.event.intro", battle: null, storyAfter: null},
    {roomId: "room.tide-cave.3", battle: 3, storyAfter: "S3-4"},
    {roomId: "room.tide-cave.4", battle: 4, storyAfter: null},
  ];
  if (v.canonicalJson(g.nodes) !== v.canonicalJson(expected)) v.invalid("guide.nodes", "Stable five-node story/battle mapping required");
  const rows = v.list(g.steps, "guide.steps", 100), ids = new Set<string>();
  if (!rows.length) v.invalid("guide.steps", "Empty guide");
  let previousRoom = 0;
  const actor = (raw: unknown) => { const id = v.id(raw, "guide.actor"); if (!spec.partyIds.includes(id)) v.invalid("guide.actor", "Actor outside party"); return id; };
  for (const raw of rows) {
    const s = v.record(raw, "guide.step", ["id", "roomId", "round", "instructionId", "input", "evidence"]);
    const id = v.id(s.id, "guide.step.id");
    if (ids.has(id)) v.invalid("guide.step.id", "Duplicate step"); ids.add(id);
    v.id(s.instructionId, "instructionId");
    const room = v.reference(catalog.journey!.rooms, s.roomId, "guide.room");
    const roomIndex = expected.findIndex(n => n.roomId === room.id);
    if (roomIndex < previousRoom || roomIndex > 3) v.invalid("guide.room", "Steps must precede Boss and follow the route");
    previousRoom = roomIndex;
    if (s.round !== null) v.number(s.round, "guide.round", 1, 3);
    const i = v.record(s.input, "guide.input"), kind = v.choice(i.kind, ["roll", "reroll", "end-turn", "automatic", "fix", "act", "story", "advance", "item", "event", "observe-result"], "guide.input.kind");
    const fields = kind === "act" ? ["actorId", "choice", "target"] : ["fix", "event"].includes(kind) ? ["actorId"] : kind === "item" ? ["definitionId", "actorId"] : kind === "story" ? ["storyId"] : [];
    v.record(i, "guide.input", ["kind", ...fields]);
    if ("actorId" in i) actor(i.actorId);
    if (["roll", "reroll", "end-turn", "automatic", "fix", "act"].includes(kind)) {
      if (room.kind !== "battle" || s.round === null) v.invalid("guide.round", "Battle step requires a round");
    } else if (s.round !== null) v.invalid("guide.round", "Non-combat step has no round");
    if (kind === "act") {
      v.choice(i.choice, ["attack", "guard", "heal"], "guide.choice");
      const t = v.record(i.target, "guide.target"), target = v.choice(t.kind, ["member", "enemy"], "guide.target.kind");
      v.record(t, "guide.target", target === "member" ? ["kind", "id"] : ["kind", "definitionId", "ordinal"]);
      if (target === "member") actor(t.id);
      else {
        const def = v.reference(catalog.enemies, t.definitionId, "guide.target.enemy"), ordinal = v.number(t.ordinal, "guide.target.ordinal", 0, 4);
        if (room.kind !== "battle" || catalog.encounters[room.encounterId].enemyIds.filter(id => id === def.id).length <= ordinal) v.invalid("guide.target", "Enemy outside encounter");
      }
    }
    if (kind === "story") v.reference(spec.stories, i.storyId, "guide.story");
    if (kind === "item") v.reference(catalog.journey!.items, i.definitionId, "guide.item");
    if (["event", "observe-result"].includes(kind) && room.kind !== "event") v.invalid("guide.event", "Event room required");
    const evidence = v.list(s.evidence, "guide.evidence", 4);
    if (!evidence.length) v.invalid("guide.evidence", "Real evidence required");
    for (const raw of evidence) {
      const e = v.record(raw, "guide.evidence", ["type"], ["actorId", "payload"]);
      v.choice(e.type, ["dice-rolled", "die-fixed", "damage-applied", "guard-applied", "healing-applied", "hand-settled", "covenant-triggered", "tutorial-story-read", "encounter-started", "tutorial-node-entered", "event-resolved", "room-completed", "item-used", "tutorial-observed"], "guide.evidence.type");
      if (e.actorId !== undefined) actor(e.actorId);
      if (e.payload !== undefined) for (const value of Object.values(v.record(e.payload, "guide.evidence.payload"))) {
        if (value !== null && !["string", "number", "boolean"].includes(typeof value)) v.invalid("guide.evidence.payload", "Only scalar equality predicates are supported");
      }
    }
  }
  const first = rows[0] as {input: {kind: string; storyId: string}}, last = rows.at(-1) as {input: {kind: string}; roomId: string; round: number};
  if (first.input.kind !== "story" || first.input.storyId !== spec.arrivalStoryId || last.input.kind !== "end-turn" || last.roomId !== "room.tide-cave.3" || last.round !== 1) v.invalid("guide.steps", "Guide must start at arrival and release after T3 round one");
}
