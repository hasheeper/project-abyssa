import { ESTATE_CATALOG, ESTATE_AIRP_CATALOG } from "../../game-runtime/estate-context";
import { FACILITIES_CATALOG, FACILITIES_AIRP_CATALOG } from "../../game-runtime/facilities-context";
import { COPPER_ECONOMY_CATALOG } from "../../game-runtime/copper-economy-context";
import { TIDE_REEF_CATALOG } from "../../game-runtime/tide-reef-context";
import { ORDINARY_DROPS_CATALOG } from "../../game-runtime/ordinary-drops-context";
import { SHOP_WAVE_CATALOG, SHOP_AIRP_CATALOG } from "../../game-runtime/shop-wave-context";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import { SHOP_FOUNDATION_CATALOG } from "../../game-runtime/shop-foundation-context";
import { SHOP_INTRODUCTION_CATALOG } from "../../game-runtime/shop-introduction-context";
import { STARTER_REWARD_CATALOG } from "../../game-runtime/starter-reward-context";
import { FOUR_LAYER_TUTORIAL_CATALOG } from "../../game-runtime/four-layer-tutorial-context";
import type { AnyGameRecord, AnyReceipt } from "../index";
import type { D5Command, D5GameRecord } from "../versions/d5-contracts";
import { G2Recorder } from "../../game-core/session/testing/tide-guided-g2";
import { g2Command, g2RunRef } from "./tide-guided-g2-playthrough";

export function shopFixture(record?: D5GameRecord) {
  const db = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>();
  const saveId = record?.head.saveId ?? "shop-tutorial";
  if (record) db.records.set(saveId, structuredClone(record));
  const store = new MemoryGameStore(db);
  let request = 0;
  const runtime = createPlayerRuntime(store, {newId: () => `shop-session:${++request}`, newSeed: () => 19, close() {}});
  const read = () => structuredClone(db.records.get(saveId)!) as D5GameRecord;
  async function send(command: D5Command) {
    const input = {protocolVersion: 4, saveId, expectedHead: read().head, clientRequestId: `shop:${read().head.revision}:${++request}`, command};
    const result = await (command.type === "resume-run" ? runtime.application.resume : runtime.application.dispatch)(input);
    return {input, result};
  }
  async function commit(command: D5Command) {
    const sent = await send(command);
    if (!sent.result.ok) throw Error(JSON.stringify(sent.result));
    return sent;
  }
  return {db, store, runtime, saveId, read, send, commit};
}

/** Only executed public commands create these fixtures; no manufactured rewards. */
export async function playShopTutorial(startAt: "tutorial" | "prologue" = "tutorial", contentVersion: 13 | 14 | 15 | 16 | 17 | 20 | 21 | 23 | 24 | 25 | 26 | 27 | 28 = startAt === "prologue" ? 16 : 13) {
  const catalog = contentVersion === 28 ? ESTATE_AIRP_CATALOG : contentVersion === 27 ? ESTATE_CATALOG : contentVersion === 26 ? FACILITIES_AIRP_CATALOG : contentVersion === 25 ? FACILITIES_CATALOG : contentVersion === 24 ? SHOP_AIRP_CATALOG : contentVersion === 23 ? SHOP_WAVE_CATALOG : contentVersion === 21 ? ORDINARY_DROPS_CATALOG : contentVersion === 20 ? TIDE_REEF_CATALOG : contentVersion === 17 ? COPPER_ECONOMY_CATALOG : contentVersion === 16 ? SHOP_INTRODUCTION_CATALOG : contentVersion === 15 ? STARTER_REWARD_CATALOG : contentVersion === 14 ? FOUR_LAYER_TUTORIAL_CATALOG : SHOP_FOUNDATION_CATALOG;
  const f = shopFixture();
  const currentNewGame = Number(contentVersion) === f.runtime.defaultCreation.contentVersion;
  const created = currentNewGame
    ? await f.runtime.application.createNewGame({saveId: f.saveId, epoch: "shop-epoch", clientRequestId: "create", startAt})
    : await f.runtime.application.create({protocolVersion: 4, contentVersion, profileId: catalog.data.journey!.defaultProfileId, saveId: f.saveId, epoch: "shop-epoch", clientRequestId: "create"});
  if (!created.ok) throw Error(JSON.stringify(created));
  if (!currentNewGame) await f.commit({type: "select-game-start", startAt});
  if (startAt === "prologue") {
    for (const shotId of catalog.data.prologue!.shotIds.slice(0, -1)) await f.commit({type: "advance-prologue", shotId});
    await f.commit({type: "complete-prologue", shotId: catalog.data.prologue!.shotIds.at(-1)!, choice: "continue"});
    const opening = catalog.data.opening!;
    for (let step = 0; step <= opening.lastStep; step++) await f.commit({type: "advance-opening", step, choice: opening.choiceSteps.includes(step) ? "A" : "continue"});
  }
  const checkpoints: Record<string, D5GameRecord> = {created: f.read()};
  const spec = catalog.data.tutorial!;
  await f.commit({type: "start-expedition", runId: g2RunRef.id, routeId: spec.routeId, partyIds: spec.partyIds, itemIds: spec.itemIds, seed: 19});
  const tape = new G2Recorder(catalog).until(s => s.tutorial!.stage === "claimable");
  let index = 0;
  let beforeInput = f.read();
  for (const row of tape.trace) {
    if (row.operation.type !== "resume") beforeInput = f.read();
    await f.commit(g2Command(row.operation));
    const record = f.read(), run = record.snapshot.run;
    if (run?.kind === "expedition") {
      if (run.state.node === "room-complete" && run.state.tutorial!.story) checkpoints[`layer${run.state.run.layer}Complete`] ??= record;
      if (run.state.node === "event") checkpoints.event ??= record;
      if (run.state.node === "battle" && run.state.encounter.round === 1 && run.state.encounter.phase === "roll") checkpoints[`layer${run.state.run.layer}Start`] ??= record;
      if (run.state.run.looseGold === 2 && run.state.node === "room-complete") checkpoints.firstGold ??= record;
      if (run.state.run.carriedLoot?.length) {
        checkpoints.bossLoot ??= record;
        checkpoints.beforeBossLoot ??= beforeInput;
      }
    }
    if (++index % 16 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  checkpoints.claimable = f.read();
  await f.commit({type: "settle-expedition", runRef: g2RunRef, terminalRef: tape.state.result!.id});
  checkpoints.claimed = f.read();
  return {f, checkpoints};
}
