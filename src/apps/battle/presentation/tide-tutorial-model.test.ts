import { afterAll, beforeAll, expect, it } from "vitest";
import { tideClientFixture } from "../../../game-client/testing/tide-cave";
import { tideTutorialModel } from "./tide-tutorial-model";
import { tideBattleBackground, tideBossBackground, tideCaveBackground, tideGrottoBackground, tideStory, TIDE_STORY, tideEnemyArt } from "../../../content/presentation/tide-cave";
import { TIDE_CAVE_CATALOG } from "../../../game-runtime/tide-cave-context";
import { battleMemberName, manorBattleModel } from "./manor-battle-model";
import { resolvePlayerText } from "../../../shared/domain/player-identity";
let f: Awaited<ReturnType<typeof tideClientFixture>>;
beforeAll(async () => {f = await tideClientFixture(); await f.start();}, 30000);
afterAll(() => f?.session.dispose());
const runRef = {kind: "expedition" as const, id: "tide-run"};
const view = () => f.runtime.queries.journey(f.session.getSnapshot().record!)!;

it("uses the shared AVG schema, all durable story slots and final tide-reef art", () => {
  expect(f.session.getSnapshot().record!.contentRef.contentVersion).toBe(7);
  expect(TIDE_STORY.player).toMatchObject({nameToken: "{{user}}", authoredSpeech: false});
  for (const id of Object.keys(TIDE_CAVE_CATALOG.data.tutorial!.stories)) expect(tideStory(id).lines.length).toBeGreaterThan(0);
  expect(tideStory("S3-4").choice?.options.map(o => o.id)).toEqual(["A", "B", "C"]);
  expect(tideStory("S4-1").lines.map(l => l.characterId)).toEqual(["elora", "kororo", "marietta"]);
  expect(Object.keys(tideEnemyArt)).toHaveLength(5);
  expect(Object.values(tideEnemyArt).every(art => art.url.includes(".png"))).toBe(true);
  expect(Object.fromEntries(Object.entries(tideEnemyArt).map(([id, art]) => [id, art.height]))).toEqual({
    "enemy.intro.tide-slime": 145,
    "enemy.intro.lookout": 216,
    "enemy.intro.crossbowman": 180,
    "enemy.intro.hauler": 280,
    "enemy.intro.reef-hook-chief": 266,
  });
  expect(tideBattleBackground("room.tide-cave.1")).toBe(tideCaveBackground);
  expect(tideBattleBackground("room.tide-cave.2")).toBe(tideGrottoBackground);
  expect(tideBattleBackground("room.tide-cave.3")).toBe(tideGrottoBackground);
  expect(tideBattleBackground("room.tide-cave.4")).toBe(tideBossBackground);
  expect(tideBattleBackground(1)).toBe(tideCaveBackground);
  expect(tideBattleBackground(2)).toBe(tideGrottoBackground);
  expect(tideBattleBackground(3)).toBe(tideGrottoBackground);
  expect(tideBattleBackground(4)).toBe(tideBossBackground);
  expect(tideBattleBackground(2, "legacy")).toBe(tideCaveBackground);
  expect(tideBattleBackground(2, "guided")).toBe(tideCaveBackground);
  const enemies = manorBattleModel(view(), null).enemies;
  expect(enemies).toHaveLength(2);
  expect(enemies.every(e => !!e.artUrl && typeof e.artStyle?.height === "number" && e.artStyle.maxWidth === "none")).toBe(true);
  expect(view().fullManor).toBe(false);
  expect(battleMemberName(view().party.find(m => m.id === "kael"))).toBe("你");
  expect(view().party.find(m => m.id === "kael")!.name).toBe(TIDE_CAVE_CATALOG.data.characters.kael.name);
  expect(tideTutorialModel(view(), null, () => 0)).toBeNull();
});

it("follows real roll/fix/action evidence, undo and saved hint preference", async () => {
  await f.send({type: "tutorial-read", runRef, storyId: "S3-1", step: 0, choice: "continue"});
  expect(tideTutorialModel(view(), null, () => 0)?.targets).toEqual(["battle.roll"]);
  await f.send({type: "battle-command", runRef, command: {type: "roll"}});
  expect(view().party.map(m => m.die!.faceIndex! + 1)).toEqual([2, 2, 1, 1, 3]);
  expect(tideTutorialModel(view(), null, () => 0)?.targets).toEqual(["battle.die:kael"]);
  await f.send({type: "battle-command", runRef, command: {type: "toggle-load", actorId: "kael"}});
  expect(tideTutorialModel(view(), null, () => 0)?.targets).toEqual(["battle.member:kael"]);
  const enemyId = view().battle!.enemies[0].id;
  await f.send({type: "battle-command", runRef, command: {type: "act", actorId: "kael", choice: "attack", targetId: enemyId}});
  expect(view().log.some(line => line.text.startsWith("{{user}} →"))).toBe(true);
  expect(view().log.map(line => resolvePlayerText(line.text)).join("\n")).not.toContain("凯尔");
  expect(tideTutorialModel(view(), null, () => 0)?.targets).toEqual(["battle.end-turn"]);
  await f.send({type: "undo", runRef});
  expect(view().tutorial!.lessons.some(l => l.kind === "action")).toBe(false);
  expect(tideTutorialModel(view(), null, () => 0)?.targets).toEqual(["battle.member:kael"]);
  await f.send({type: "tutorial-hints", runRef, enabled: false});
  await f.session.refresh();
  expect(tideTutorialModel(view(), null, () => 0)).toBeNull();
});
