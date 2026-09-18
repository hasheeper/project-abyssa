import { expect, it } from "vitest";
import { tideScene } from "./tide-scene";
import { tideBattleStage, tideStory, tideCaveBackground, tideGrottoBackground, tideBossBackground, tideReturnBackground } from "../../../content/presentation/tide-cave";
import { tideClientFixture, tideCommand, tideOperation } from "../../../game-client/testing/tide-cave";

it.each(["legacy", "guided", "final"] as const)("keeps %s battles at the final location of their preceding story", edition => {
  const expected = [tideCaveBackground, edition === "final" ? tideGrottoBackground : tideCaveBackground, tideGrottoBackground, tideBossBackground];
  for (let encounter = 1; encounter <= 4; encounter++) {
    const story = tideStory(`S3-${encounter}`, edition);
    expect(tideBattleStage(encounter, edition)).toEqual(story.stages.at(-1));
    expect(tideBattleStage(encounter, edition).background).toBe(expected[encounter - 1]);
    expect(tideBattleStage(`room.tide-cave.${encounter}`, edition)).toEqual(tideBattleStage(encounter, edition));
  }
});

it("keeps the real chapter's battles, continue panels, cache and return at the authored location", async () => {
  const f = await tideClientFixture(12), seen = new Set<string>();
  const battleBackgrounds = [tideCaveBackground, tideGrottoBackground, tideGrottoBackground, tideBossBackground];
  const afterStories: Record<string,string> = {"S3-2":tideGrottoBackground,"S3-3":tideGrottoBackground,"S3-4":tideBossBackground};
  try {
    await f.start();
    for (let step = 0; step < 350; step++) {
      // Real command replays can occupy the worker for over a minute. Let the
      // runner receive progress between commands without changing their order.
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      const record = f.session.getSnapshot().record!;
      if (record.schemaVersion !== 4) throw Error("Expected chapter-one record");
      const view = f.runtime.queries.journey(record)!, tutorial = view.tutorial!;
      if (tutorial.canClaim) {
        expect(tideScene(view)?.background).toBe(tideReturnBackground);
        seen.add("home"); break;
      }
      if (!tutorial.story) {
        if (view.battle) {
          expect(tideScene(view)?.background).toBe(battleBackgrounds[tutorial.encounter! - 1]);
          seen.add(`battle-${tutorial.encounter}`);
        } else {
          const last = tutorial.readStoryIds.at(-1)!;
          expect(tideScene(view)?.background).toBe(afterStories[last]);
          // A chapter retry keeps later reading evidence, but must not move this room to the cargo deck.
          expect(tideScene({...view,tutorial:{...tutorial,readStoryIds:[...tutorial.readStoryIds,"S3-4"]}})?.background).toBe(afterStories[last]);
          seen.add(view.expedition!.node === "event" ? "event" : `after-${last}`);
        }
      }
      const operation = tideOperation(record);
      if (!operation || operation.type === "resume") throw Error("Unexpected chapter checkpoint");
      await f.send(tideCommand(operation));
    }
    expect([...seen].sort()).toEqual(["battle-1","battle-2","battle-3","battle-4","event","after-S3-2","after-S3-3","after-S3-4","home"].sort());
  } finally {f.session.dispose();}
}, 180000);
