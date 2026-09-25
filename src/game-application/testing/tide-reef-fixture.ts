import { shopFixture } from "./shop-foundation-fixture";
import { nextD5PlayCommand } from "./d5-playthrough";
import { TIDE_REEF_CATALOG } from "../../game-runtime/tide-reef-context";
import type { D5GameRecord } from "../versions/d5-contracts";

export const REEF_ROUTE = "tide-reef.ordinary";
export async function reefFixture(startAt: "hub" | "debug-shop" = "hub", seed = 19) {
  const f = shopFixture();
  const created = await f.runtime.application.create({protocolVersion: 4, contentVersion: 20, profileId: TIDE_REEF_CATALOG.data.journey!.defaultProfileId, saveId: f.saveId, epoch: "reef-epoch", clientRequestId: "create-reef"});
  if (!created.ok) throw Error(JSON.stringify(created));
  await f.commit({type: "select-game-start", startAt});
  const before = f.read(), runId = "reef-run";
  await f.commit({type: "start-expedition", runId, routeId: REEF_ROUTE, partyIds: TIDE_REEF_CATALOG.data.initialParty, itemIds: ["item.food", "item.potion"], seed});
  return {...f, before, runId, catalog: TIDE_REEF_CATALOG};
}
export type ReefFixture = Awaited<ReturnType<typeof reefFixture>>;
export type ReefOutcome = "clear" | "extract" | "wipe-first" | "wipe-second" | "wipe-third";

/** Public commands only: loss cases stop acting, never patch HP, rewards or a receipt. */
export async function playReef(f: ReefFixture, outcome: ReefOutcome, observe?: (record: D5GameRecord) => void) {
  for (let i = 0; i < 800; i++) {
    const record = f.read(), run = record.snapshot.run;
    if (run?.kind !== "expedition") throw Error("No reef expedition");
    observe?.(record);
    if (run.state.node === "finished") return {record, terminal: run.state.result};
    const {layer, room} = run.state.run;
    const passive = outcome === "wipe-first" && room >= 1 || outcome === "wipe-second" && layer === 2 && room >= 1 || outcome === "wipe-third" && layer === 3;
    const command = nextD5PlayCommand(f.catalog, record, passive);
    if (command.type === "choose-exit" && outcome === "extract") command.choice = "leave";
    await f.commit(command);
    if (i % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  throw Error("Reef run did not terminate");
}
