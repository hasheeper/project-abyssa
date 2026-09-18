import type { D5GameRecord } from "../index";
import { AIRP_ONLINE_CATALOG } from "../../game-runtime/airp-context";
import { firstAirpOffer } from "./airp-playthrough";
import { poolTestRuntime, readPoolConversation } from "./airp-pool-playthrough";
import { nextD5PlayCommand } from "./d5-playthrough";
import { airpOnlineFixture } from "./airp-online-fixture";
import { airpHash, type AirpSceneResult } from "../airp/contracts";
import type { AirpSceneTicket } from "../airp/acceptance";

export async function firstOnlineOffer(source?: D5GameRecord) {
  const old = source ?? (await (await firstAirpOffer()).read()).originRef!.source;
  if (old.schemaVersion !== 4) throw Error("Expected the proven pre-AIRP manor record");
  const f = poolTestRuntime(old);
  const created = await f.runtime.application.continueSave({ sourceSaveId: old.head.saveId, expectedSourceHead: old.head, saveId: "pool", epoch: "pool-online-epoch", clientRequestId: "online-upgrade", kind: "upgrade", contentVersion: 10 });
  if (!created.ok) throw Error(JSON.stringify(created));
  return f;
}
export async function onlineReturnGate(f: ReturnType<typeof poolTestRuntime>) {
  let r = await f.read();
  const instanceId = r.narrative.instances.find(i => i.definition.id === "ripple.elora.old-medicine-case")!.id;
  await f.send({ type: "airp-open", instanceId }); await readPoolConversation(f);
  r = await f.send({ type: "start-expedition", runId: "online-patrol", routeId: "old-manor.maintenance", partyIds: AIRP_ONLINE_CATALOG.data.initialParty, itemIds: AIRP_ONLINE_CATALOG.data.journey!.defaultItems, seed: 19 });
  for (let step = 0; r.snapshot.run && step < 700; step++) {
    const command = nextD5PlayCommand(AIRP_ONLINE_CATALOG, r);
    r = await f.send(command.type === "choose-exit" ? { ...command, choice: "leave" } : command);
  }
  if (r.snapshot.run || r.narrative.instances.find(i => i.id === instanceId)?.status !== "ready") throw Error("Online patrol did not produce actual return evidence");
  return f.send({ type: "airp-open", instanceId });
}

/** Test-only server result. Native provenance validation is tested separately against the rp host. */
export function onlineResultFor(ticket: AirpSceneTicket): AirpSceneResult {
  const { head: _, ...b } = ticket.binding, f = airpOnlineFixture(), tag = airpHash(ticket.request.requestId).slice(0, 12);
  return { version: "airp-scene-result-v1", requestId: ticket.request.requestId, requestHash: ticket.requestHash,
    origin: { ...b, floorId: `floor-${tag}`, checkpointSnapshotId: `checkpoint-${tag}`, checkpointContentHash: "b".repeat(64), inputEntryId: `input-${tag}`, outputEntryId: `output-${tag}`, outputPayloadHash: airpHash(JSON.stringify(f.text)), runId: `run-${tag}`, resultId: `result-${tag}`, resultHash: "c".repeat(64) },
    text: f.text, textHash: airpHash(f.text) };
}
