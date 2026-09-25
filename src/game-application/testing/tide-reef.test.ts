import { expect, it } from "vitest";
import { reefFixture, playReef, REEF_ROUTE, type ReefOutcome } from "./tide-reef-fixture";
import { readD5Archive, validateD5Record } from "../versions/d5-validate";
import { D5_RUN_READERS } from "../../game-core/session/d5-run-readers";
import { deriveD5Baseline } from "../versions/d5-lineage";
import { d5VisibleEvents } from "../../game-runtime/d5-views";
import type { D5GameRecord } from "../versions/d5-contracts";
import { playShopTutorial, shopFixture } from "./shop-foundation-fixture";
import { GameStorageError } from "../index";
import { nextD5PlayCommand } from "./d5-playthrough";

it.each(["clear", "extract", "wipe-first", "wipe-second", "wipe-third"] as ReefOutcome[])("plays reef %s with real rooms, loss evidence, restoration and exactly one settlement", async outcome => {
  const f = await reefFixture(), before = f.before.snapshot.campaign;
  let midway: D5GameRecord | undefined;
  let sawSeal = false;
  const crossbowIntents = new Set<string>();
  const stages = new Set<string>();
  const {record, terminal} = await playReef(f, outcome, record => {
    const view = f.runtime.queries.journey(record)!;
    const run = record.snapshot.run!;
    if (run.kind !== "expedition") return;
    sawSeal ||= !!view.battle?.encounter.dice.some(die => die.sealed);
    view.battle?.enemies.filter(e => e.definition.id === "enemy.tide-reef.crossbow").forEach(e => crossbowIntents.add(e.intent?.kind ?? "none"));
    stages.add(`${run.state.run.layer}:${run.state.run.room}:${run.state.node}:${run.state.run.settledLayers.length}`);
    if (!midway && view.lootBags?.unbanked.length && run.state.run.layer === 1) midway = record;
    expect(view.fullManor).toBe(false);
    expect(view.layerCount).toBe(3);
    expect(view.depthFactors).toEqual([1, 1.25, 1.5]);
    expect(view.log.some(line => /红线牵动|新的宾客/.test(line.text))).toBe(false);
  });
  expect(terminal.routeId).toBe(REEF_ROUTE);
  expect(terminal.outcome).toBe(outcome === "clear" ? "cleared" : outcome === "extract" ? "extracted" : "wipe");
  expect(midway).toBeDefined();
  expect(readD5Archive(JSON.stringify({archiveVersion: 4, record: midway}), f.catalog, D5_RUN_READERS)).toEqual(midway);
  expect(stages.has("1:0:room-complete:0")).toBe(true);
  if (outcome !== "wipe-first") expect(stages.has("1:1:room-complete:1")).toBe(true);
  const counts = (items: typeof terminal.returnedLoot) => (items ?? []).reduce<Record<string, number>>((all, item) => ({...all, [item.definitionId]: (all[item.definitionId] ?? 0) + 1}), {});
  expect(counts(terminal.returnedLoot)).toEqual(outcome === "clear" ? {"loot.salvage.shell": 2, "loot.salvage.crab-shell": 2, "loot.salvage.ship-lamp-ring": 1}
    : outcome === "extract" ? {"loot.salvage.shell": 2, "loot.salvage.crab-shell": 2}
    : outcome === "wipe-third" ? {"loot.salvage.shell": 1, "loot.salvage.crab-shell": 1}
    : outcome === "wipe-second" ? {"loot.salvage.shell": 1} : {});
  if (outcome === "wipe-second" || outcome === "wipe-first") expect(terminal.lootLedger!.unbanked.map(item => item.definitionId)).toEqual(["loot.salvage.shell"]);
  if (outcome.startsWith("wipe")) expect(terminal.totalGold).toBe(Math.floor(terminal.bankedGold / 2));
  if (outcome === "extract") expect(terminal.deepestLayer).toBe(2);
  if (outcome === "wipe-second") expect(sawSeal).toBe(true);
  if (outcome === "wipe-third") expect([...crossbowIntents]).toEqual(expect.arrayContaining(["charge", "attack"]));
  const events = d5VisibleEvents(record, {kind: "expedition", id: f.runId}).filter(f => f.kind === "loot-found");
  expect(new Set(events.map(f => (f.payload as {instanceId: string}).instanceId)).size).toBe(events.length);
  expect(events).toHaveLength(record.snapshot.run?.kind === "expedition" ? record.snapshot.run.state.run.carriedLoot!.length : -1);
  expect(readD5Archive(JSON.stringify({archiveVersion: 4, record}), f.catalog, D5_RUN_READERS)).toEqual(record);

  const settled = await f.commit({type: "settle-expedition", runRef: {kind: "expedition", id: f.runId}, terminalRef: terminal.id});
  expect(await f.runtime.application.dispatch(settled.input)).toMatchObject({ok: true, replayed: true});
  const after = f.read(), campaign = after.snapshot.campaign;
  expect(campaign.funds.party).toBe(before.funds.party + terminal.totalGold);
  expect(campaign.loot).toHaveLength(before.loot!.length + terminal.returnedLoot!.length);
  expect(campaign.manor).toEqual(before.manor);
  expect(campaign.shopIntroduction).toEqual(before.shopIntroduction);
  expect(campaign.clock).toEqual({day: 1, phase: "day"});
  expect(campaign.growthGrants).toEqual([]);
  expect(readD5Archive(JSON.stringify({archiveVersion: 4, record: after}), f.catalog, D5_RUN_READERS)).toEqual(after);
  expect(deriveD5Baseline(f.catalog, validateD5Record(after, f.catalog, D5_RUN_READERS), "copy").campaign.settlements[0].lootLedger).toEqual(terminal.lootLedger);
  const query = f.runtime.queries.journey(after)!;
  expect(query.destinations.filter(d => d.available).map(d => d.nodeId)).toEqual(["tower", "cave"]);
  expect(query.settlementScenes[f.runId]).toBe(`scene.tide-reef.${terminal.deepestLayer === 1 ? "shore" : terminal.deepestLayer === 2 ? "grotto" : "boardwalk"}`);
  expect((await f.send({type: "begin-story", eventId: "event.growth.elora.lv2", basisId: terminal.id})).result).toMatchObject({ok: false, error: {message: expect.stringContaining("No qualifying ordinary return")}});
  const forged = structuredClone(after);
  forged.snapshot.campaign.settlements[0].lootLedger!.unbanked = [{...terminal.returnedLoot?.[0], instanceId: "forged"} as NonNullable<typeof terminal.returnedLoot>[number]];
  expect(() => validateD5Record(forged, f.catalog, D5_RUN_READERS)).toThrow();

  if (outcome === "clear") {
    const ring = campaign.loot!.find(item => item.definitionId === "loot.salvage.ship-lamp-ring")!;
    expect(ring.resultId).toBeNull();
    const base = campaign.funds.party;
    // Alternate transactions start from the same genuinely earned inventory.
    const scrap = shopFixture(after);
    await scrap.commit({type: "sell-loot", shopId: "shop.mansion", instanceId: ring.instanceId, quoteVersion: 2});
    expect(scrap.read().snapshot.campaign.funds.party).toBe(base + 2);
    expect((await scrap.send({type: "appraise-loot", shopId: "shop.mansion", instanceId: ring.instanceId, quoteVersion: 2})).result.ok).toBe(false);
    for (const when of ["before", "after"] as const) {
      const fault = shopFixture(after), original = fault.store.commit.bind(fault.store);
      let armed = true;
      fault.store.commit = async plan => {
        if (armed) { armed = false; if (when === "after") await original(plan); throw new GameStorageError("storage-unavailable", "injected"); }
        return original(plan);
      };
      const sent = await fault.send({type: "appraise-loot", shopId: "shop.mansion", instanceId: ring.instanceId, quoteVersion: 2});
      expect(sent.result.ok).toBe(false);
      expect(await fault.runtime.application.dispatch(sent.input)).toMatchObject({ok: true});
      expect(fault.read().snapshot.campaign.funds.party).toBe(base - 300);
      expect(fault.read().snapshot.campaign.lootTrades).toHaveLength((campaign.lootTrades?.length ?? 0) + 1);
    }
    const appraised = await f.commit({type: "appraise-loot", shopId: "shop.mansion", instanceId: ring.instanceId, quoteVersion: 2});
    expect(await f.runtime.application.dispatch(appraised.input)).toMatchObject({ok: true, replayed: true});
    expect(f.read().snapshot.campaign.funds.party).toBe(base - 300);
    expect((await f.send({type: "appraise-loot", shopId: "shop.mansion", instanceId: ring.instanceId, quoteVersion: 2})).result.ok).toBe(false);
    const sold = await f.commit({type: "sell-loot", shopId: "shop.mansion", instanceId: ring.instanceId, quoteVersion: 2});
    expect(await f.runtime.application.dispatch(sold.input)).toMatchObject({ok: true, replayed: true});
    expect(f.read().snapshot.campaign.funds.party).toBe(base + 300);
    for (const item of terminal.returnedLoot!.filter(item => item.definitionId !== ring.definitionId)) await f.commit({type: "sell-loot", shopId: "shop.mansion", instanceId: item.instanceId, quoteVersion: 2});
    expect(f.read().snapshot.campaign.funds.party).toBe(base + 980);
    expect(f.read().snapshot.campaign.loot).toEqual(before.loot);
    const backup = await f.runtime.application.exportSave(f.saveId);
    if (!backup.ok) throw Error("No archive");
    expect(readD5Archive(backup.archive, f.catalog, D5_RUN_READERS)).toEqual(f.read());
    await f.commit({type: "start-expedition", runId: "reef-repeat", routeId: REEF_ROUTE, partyIds: f.catalog.data.initialParty, itemIds: ["item.food", "item.potion"], seed: 21});
    const repeat = f.read().snapshot.run;
    expect(repeat?.kind === "expedition" && repeat.state.run.carriedLoot).toEqual([]);
    for (let i = 0; i < 100; i++) {
      const repeated = f.read(), run = repeated.snapshot.run;
      if (run?.kind === "expedition" && run.state.run.carriedLoot?.length) {
        expect(run.state.run.carriedLoot[0].instanceId).not.toBe(terminal.returnedLoot![0].instanceId);
        expect(run.state.run.carriedLoot[0].definitionId).toBe("loot.salvage.shell");
        break;
      }
      await f.commit(nextD5PlayCommand(f.catalog, repeated));
      if (i === 99) throw Error("Repeated run did not earn its first drop");
    }
  }
}, 120_000);

it("retains the four-layer tutorial rewards and first SHOP before ordinary reef access", async () => {
  const {f} = await playShopTutorial("tutorial", 20);
  const record = f.read(), campaign = record.snapshot.campaign;
  expect(campaign.funds.party).toBe(4400);
  expect(campaign.tutorial?.status).toBe("completed");
  expect(campaign.loot).toHaveLength(4);
  expect(campaign.loot!.every(item => item.definitionId.startsWith("loot.tutorial."))).toBe(true);
  expect(f.runtime.queries.shop(record)?.introduction).toMatchObject({step: 0});
  expect(f.runtime.queries.journey(record)?.destinations.find(d => d.nodeId === "cave")?.available).toBe(true);
}, 180_000);
