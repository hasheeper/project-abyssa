// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createBattlePreviewSession } from "../../../game-client/battle-preview";
import { PLAYER_CATALOGS } from "../../../game-runtime/player-runtime";
import { d5VisibleEvents } from "../../../game-runtime/d5-views";
import { nextD5PlayCommand } from "../../../game-application/testing/d5-playthrough";
import { deriveLoot, previewDropItem } from "./derive-loot";
import { itemCount } from "./loot-model";

async function fixture() {
  const session = await createBattlePreviewSession();
  const record = session.getSnapshot().record!;
  const entry = PLAYER_CATALOGS.find(c => c.version === 4 && c.catalog.ref.digest === record.contentRef.digest);
  if (!entry || entry.version !== 4 || record.schemaVersion !== 4) throw Error("Preview must use the current ordinary expedition");
  const read = () => {
    const record = session.getSnapshot().record!;
    if (record.schemaVersion !== 4) throw Error("Invalid preview record");
    const view = session.runtime.queries.journey(record)!;
    return { record, view, loot: deriveLoot(record, view) };
  };
  return { session, catalog: entry.catalog, read };
}

describe("ordinary battle loot projection", () => {
  it.each(["cleared", "retreated", "failed"] as const)("follows real commands through %s without tutorial drops", async expected => {
    const f = await fixture();
    try {
      expect(f.read().view.tutorial?.runRef).toBeFalsy();
      expect(itemCount(f.read().loot.banked) + itemCount(f.read().loot.unbanked)).toBe(0);
      let steps = 0;
      while (!f.read().loot.settlement && steps++ < 550) {
        await new Promise(resolve => setTimeout(resolve, 0));
        const { record } = f.read();
        const command = nextD5PlayCommand(f.catalog, record, expected === "failed");
        if (command.type === "resume-run") throw Error("Session should automatically resume the engine");
        if (command.type === "choose-exit" && expected === "retreated") command.choice = "leave";
        const result = await f.session.dispatch(command);
        expect(result, JSON.stringify(f.session.getSnapshot().error)).toBeTruthy();
        const { view, loot, record: current } = f.read();
        const events = d5VisibleEvents(current, {kind: "expedition", id: view.expedition?.run.id ?? view.lastSettlement!.runId});
        const totalItems = events.reduce((sum, event) => {
          const payload = event.payload as Record<string, unknown>;
          return ["enemy-defeated", "enemy-released"].includes(event.kind) && Number(payload.bounty) > 0
            ? sum + (previewDropItem(String(payload.targetId)) === "rune" ? 2 : 1) : sum;
        }, 0);
        expect(itemCount(loot.banked) + itemCount(loot.unbanked)).toBe(totalItems);
        expect(loot.banked.copper).toBe(view.expedition?.run.bankedGold ?? view.lastSettlement!.bankedGold);
      }
      const { loot, view } = f.read();
      expect(loot.settlement?.outcome).toBe(expected);
      const terminal = view.expedition?.node === "finished" ? view.expedition.result : view.lastSettlement!;
      expect(loot.settlement!.returned.copper).toBe(terminal.totalGold);
      expect(loot.settlement!.lostUnbanked.copper).toBe(terminal.lostLooseGold);
      expect(loot.settlement!.lostBanked.copper).toBe(terminal.lostBankedGold);
    } finally { f.session.dispose(); }
  }, 120000);

  it("retracts a defeated enemy's drops on undo", async () => {
    const f = await fixture();
    try {
      for (let step = 0; step < 80; step++) {
        const before = f.read();
        const command = nextD5PlayCommand(f.catalog, before.record);
        if (command.type === "resume-run") throw Error("Unexpected continuation");
        await f.session.dispatch(command);
        const after = f.read();
        if (after.loot.claimed.length > before.loot.claimed.length && after.view.battle?.canUndo) {
          await f.session.dispatch({type: "undo", runRef: {kind:"expedition",id:after.view.expedition!.run.id}});
          expect(f.read().loot.unbanked).toEqual(before.loot.unbanked);
          expect(f.read().loot.banked).toEqual(before.loot.banked);
          return;
        }
      }
      throw Error("No reversible drop reached");
    } finally { f.session.dispose(); }
  });
});
