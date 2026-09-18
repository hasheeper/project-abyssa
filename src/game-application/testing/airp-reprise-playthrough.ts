import type { D5Command, D5GameRecord } from "../index";
import { LOOP_CATALOG } from "../../game-runtime/loop-context";
import { nextD5PlayCommand } from "./d5-playthrough";
import { poolTestRuntime } from "./airp-pool-playthrough";

/** Real old first-clear return followed by a validated upgrade; no fabricated terminal or unlock. */
export async function repriseFixture(outcome: "wipe" | "extracted") {
  const f = poolTestRuntime(); let seq = 0;
  const result = await f.runtime.application.create({ protocolVersion: 4, contentVersion: 3,
    profileId: LOOP_CATALOG.data.journey!.defaultProfileId, saveId: "before-reprise", epoch: "origin", clientRequestId: "create" });
  if (!result.ok) throw Error(JSON.stringify(result));
  const read = async () => (await f.store.read("before-reprise")) as D5GameRecord;
  const send = async (command: D5Command) => {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    const r = await read();
    const result = await (command.type === "resume-run" ? f.runtime.application.resume : f.runtime.application.dispatch)({ protocolVersion: 4,
      saveId: r.head.saveId, expectedHead: r.head, clientRequestId: `reprise:${++seq}`, command });
    if (!result.ok) throw Error(JSON.stringify({ command, result }));
    return read();
  };
  // A solo failed run also tests that the next party cannot claim to have witnessed it.
  let r = await send({ type: "start-expedition", runId: "unfinished", routeId: "old-manor.first-clear",
    partyIds: outcome === "wipe" ? ["kael"] : LOOP_CATALOG.data.initialParty,
    itemIds: LOOP_CATALOG.data.journey!.defaultItems, seed: 19 });
  const firstDeparture = structuredClone(r);
  for (let step = 0; r.snapshot.run && step < 700; step++) {
    const next = nextD5PlayCommand(LOOP_CATALOG, r, outcome === "wipe");
    r = await send(next.type === "choose-exit" ? { ...next, choice: "leave" } : next);
  }
  if (r.snapshot.run || r.snapshot.campaign.settlements.at(-1)?.outcome !== outcome || r.snapshot.campaign.manor.takeover) throw Error("Wrong first-clear return");
  const source = structuredClone(r);
  const upgrade = await f.runtime.application.continueSave({ sourceSaveId: r.head.saveId, expectedSourceHead: r.head,
    saveId: "pool", epoch: `reprise-${outcome}`, clientRequestId: "upgrade", kind: "upgrade" });
  if (!upgrade.ok) throw Error(JSON.stringify(upgrade));
  return { ...f, source, firstDeparture };
}
