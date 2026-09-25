import { shopFixture } from "./shop-foundation-fixture";
import { nextD5PlayCommand } from "./d5-playthrough";
import { ORDINARY_DROPS_CATALOG } from "../../game-runtime/ordinary-drops-context";
import type { D5GameRecord } from "../versions/d5-contracts";

export const dropCatalog = ORDINARY_DROPS_CATALOG;
export async function startOrdinaryDrops(routeId: string, record?: D5GameRecord, seed = 19) {
  const f = shopFixture(record);
  if (!record) {
    const created = await f.runtime.application.create({protocolVersion: 4, contentVersion: 21, profileId: "profile.demo.first-run", saveId: f.saveId, epoch: "drops-epoch", clientRequestId: "create-drops"});
    if (!created.ok) throw Error(JSON.stringify(created));
    await f.commit({type: "select-game-start", startAt: "hub"});
  }
  const runId = `drops-${routeId}`, before = f.read();
  await f.commit({type: "start-expedition", runId, routeId, partyIds: dropCatalog.data.initialParty, itemIds: ["item.food", "item.potion"], seed});
  return {...f, before, runId, catalog: dropCatalog};
}
export type DropFixture = Awaited<ReturnType<typeof startOrdinaryDrops>>;
export async function playOrdinaryDrops(f: DropFixture, outcome: "clear" | "extract" | "wipe", observe?: (record: D5GameRecord) => void) {
  for (let i = 0; i < 1000; i++) {
    const record = f.read(), run = record.snapshot.run;
    if (run?.kind !== "expedition") throw Error("No expedition");
    observe?.(record);
    if (run.state.node === "finished") return {record, terminal: run.state.result};
    const state = run.state.run;
    const passive = outcome === "wipe" && state.layer === 2 && (state.routeId === "tide-reef.ordinary" ? state.room >= 1 : true);
    const command = nextD5PlayCommand(f.catalog, record, passive);
    if (command.type === "choose-exit" && outcome === "extract") command.choice = "leave";
    await f.commit(command);
    if (i % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  throw Error("Ordinary route did not finish");
}
export async function settleOrdinaryDrops(f: DropFixture) {
  const run = f.read().snapshot.run;
  if (run?.kind !== "expedition" || run.state.node !== "finished") throw Error("Not finished");
  const settled = await f.commit({type: "settle-expedition", runRef: {kind: "expedition", id: f.runId}, terminalRef: run.state.result.id});
  const story = f.read().snapshot.campaign.manor.story;
  if (story?.status === "pending") await f.commit({type: "acknowledge-story", terminalId: story.terminalId, step: story.step, choice: "skip"});
  return settled;
}
