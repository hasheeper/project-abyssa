import { expect, it } from "vitest";
import { nextD5PlayCommand } from "./d5-playthrough";
import { ordinaryLootFixture } from "./ordinary-loot-fixture";
import { d5VisibleEvents } from "../../game-runtime/d5-views";
import { lootPockets, retainHalfLoot } from "../../game-core/session/expedition-loot";
import { readD5Archive, validateD5Record } from "../versions/d5-validate";
import { D5_RUN_READERS } from "../../game-core/session/d5-run-readers";
import { deriveD5Baseline } from "../versions/d5-lineage";

it.each(["cleared", "extracted", "wipe"] as const)("settles ordinary room loot through %s, with replayable losses and exactly one inventory grant", async outcome => {
  const f = await ordinaryLootFixture(outcome === "wipe"), catalog = f.catalog;
  const startingInventory = f.read().snapshot.campaign.loot!.length;
  let sawUnbanked = false, sawBanked = false;
  for (let i = 0; i < 850; i++) {
    const record = f.read(), run = record.snapshot.run;
    if (run?.kind !== "expedition") throw Error("Expected expedition");
    if (run.state.node === "finished") break;
    const bags = lootPockets(run.state.run.carriedLoot ?? [], run.state.run.roomIds, run.state.run.settledLayers);
    sawUnbanked ||= bags.unbanked.length > 0;
    sawBanked ||= bags.banked.length > 0;
    const command = nextD5PlayCommand(catalog, record, outcome === "wipe" && run.state.run.layer >= 2 && run.state.run.room >= 1);
    if (command.type === "choose-exit" && outcome === "extracted") command.choice = "leave";
    await f.send(command);
    if (i % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  const record = f.read(), run = record.snapshot.run;
  if (run?.kind !== "expedition" || run.state.node !== "finished") throw Error("Run did not finish");
  const terminal = run.state.result, ledger = terminal.lootLedger!;
  expect(terminal.outcome).toBe(outcome);
  expect(sawUnbanked && sawBanked).toBe(true);
  const found = d5VisibleEvents(record, {kind: "expedition", id: f.runId}).filter(f => f.kind === "loot-found");
  expect(found).toHaveLength(run.state.run.carriedLoot!.length);
  expect(new Set(found.map(f => (f.payload as {instanceId: string}).instanceId)).size).toBe(found.length);
  expect(terminal.returnedLoot).toEqual(outcome === "wipe" ? retainHalfLoot(ledger.banked) : ledger.banked);
  expect(terminal.returnedLoot?.some(item => ledger.unbanked.some(lost => lost.instanceId === item.instanceId))).toBe(false);
  if (outcome === "wipe") {
    expect(terminal.returnedLoot).toHaveLength(Math.floor(ledger.banked.length / 2));
    expect(ledger.unbanked).toHaveLength(1);
  }
  expect(f.read().snapshot.campaign.loot).toHaveLength(startingInventory);
  const claimed = await f.send({type: "settle-expedition", runRef: {kind: "expedition", id: f.runId}, terminalRef: terminal.id});
  expect((await f.app.dispatch(claimed.request)).ok).toBe(true);
  const after = f.read();
  expect(after.snapshot.campaign.loot).toHaveLength(startingInventory + terminal.returnedLoot!.length);
  expect(after.snapshot.campaign.settlements).toHaveLength(1);
  const restored = readD5Archive(JSON.stringify({archiveVersion: 4, record: after}), catalog, D5_RUN_READERS);
  expect(restored).toEqual(after);
  // First clear schedules an AIRP errand which deliberately blocks save copies.
  if (outcome !== "cleared") expect(deriveD5Baseline(catalog, restored, "copy").campaign.settlements[0].lootLedger).toEqual(ledger);
  const forged = structuredClone(after);
  forged.snapshot.campaign.settlements[0].lootLedger!.unbanked = [{...run.state.run.carriedLoot![0], instanceId: "forged"}];
  expect(() => validateD5Record(forged, catalog, D5_RUN_READERS)).toThrow();
}, 120_000);
