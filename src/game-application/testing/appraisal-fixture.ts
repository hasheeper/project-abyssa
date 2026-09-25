import {formalAirpFixture} from "./airp-game-fixture";
import {clcProposal} from "./airp-expedition-gm-fixture";
import {emptyUsage} from "../airp-generation/contracts";
import {nextD5PlayCommand} from "./d5-playthrough";
import {SHOP_AIRP_CATALOG as catalog} from "../../game-runtime/shop-wave-context";

/** One mocked GM response; acquisition and all subsequent trades use real application commands. */
export async function earnedAppraisalFixture() {
  const f = await formalAirpFixture("tide-reef.ordinary", 24);
  const id = await f.flow.prepare(f.departure), packet = await f.flow.gm.read(), proposal = clcProposal(packet);
  proposal.nodes = [{...proposal.nodes[0], stop: "scene-end", actionIds: []}];
  await f.flow.gm.begin(id, {id: "appraisal-plan", stage: "plan", model: "test-mock", connectionHash: "1".repeat(64), at: 1});
  await f.flow.gm.result(id, "appraisal-plan", JSON.stringify(proposal), emptyUsage(), 2);
  await f.flow.gm.accept(id);
  const permit = await f.flow.gm.departurePermit(id);
  await f.send({type: "start-expedition", ...permit.departure}); await f.flow.sync();
  const node = (await f.flow.nodes.read()).ledger.jobs[0];
  await f.flow.nodes.skip(node.id);
  for (let step = 0; step < 900; step++) {
    if (step % 8 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    const r = f.raw();
    if (!r.snapshot.run) break;
    await f.send(nextD5PlayCommand(catalog, r));
  }
  if (f.raw().snapshot.run) throw Error("Appraisal fixture did not settle its expedition");
  await f.flow.sync();
  return {...f, planId: id, packet, proposal, catalog};
}
