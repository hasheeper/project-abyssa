import { AIRP_DIRECT_CATALOG } from "../../game-runtime/airp-direct-context";
import { nextD5PlayCommand } from "./d5-playthrough";
import { poolTestRuntime, readPoolConversation } from "./airp-pool-playthrough";

/** Actual deterministic commands; this helper never imports model material or fabricated proof. */
export async function directReturnGate(outcome: "cleared" | "extracted") {
  const f = poolTestRuntime();
  const created = await f.runtime.application.createNewGame({saveId: "pool", epoch: "direct-pool-epoch", clientRequestId: "direct-create", startAt: "airp-demo", playerName: "林恩"});
  if (!created.ok) throw Error(JSON.stringify(created));
  const instanceId = (await f.read()).narrative.instances.find(i => i.definition.id === "ripple.elora.old-medicine-case")!.id;
  await f.send({type: "airp-open", instanceId}); await readPoolConversation(f);
  let r = await f.send({type: "start-expedition", runId: "direct-patrol", routeId: AIRP_DIRECT_CATALOG.data.manor!.maintenanceRouteId,
    partyIds: AIRP_DIRECT_CATALOG.data.initialParty, itemIds: ["item.food", "item.potion"], seed: 19});
  for (let step = 0; r.snapshot.run && step < 700; step++) {
    const command = nextD5PlayCommand(AIRP_DIRECT_CATALOG, r);
    r = await f.send(command.type === "choose-exit" && outcome === "extracted" ? {...command, choice: "leave"} : command);
  }
  if (r.snapshot.run || r.snapshot.campaign.settlements.at(-1)?.outcome !== outcome) throw Error("Patrol did not finish with requested actual outcome");
  await f.send({type: "airp-open", instanceId});
  return f;
}
