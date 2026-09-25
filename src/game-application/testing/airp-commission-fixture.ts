import { formalAirpFixture } from "./airp-game-fixture";
import { directorTestMaterial } from "./airp-director-fixture";
import { directorOutput, directorPlan } from "./airp-director-playthrough";
import { clcProposal } from "./airp-expedition-gm-fixture";
import { lowR8Source } from "../../content/presentation/airp/low-r8-source";
import { emptyUsage } from "../airp-generation/contracts";

/** Isolated formal24 program flow; generated prose/plans are explicitly test doubles. */
export async function commissionFixture() {
  const f = await formalAirpFixture("old-manor.maintenance", 24); await f.flow.sync();
  await f.send({type: "airp-director-configure", material: directorTestMaterial(), lowMaterial: lowR8Source, lowReadVersion: 6, lowContextVersion: 21});
  const wf = {read: async () => f.raw(), send: f.send};
  await directorPlan(wf, {kind: "fixed", definitionId: "ripple.elora.old-medicine-case"});
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  const eventId = f.raw().airpDirector!.events[0].id, event = () => f.raw().airpDirector!.events[0];
  await f.send({type: "airp-director-open", eventId});
  const readScene = async () => {
    const job = () => f.raw().airpDirector!.jobs.find(j => j.id === f.raw().airpDirector!.reading!.jobId)!;
    await directorOutput(wf, job(), "writing", "艾洛拉：我听见了。");
    await directorOutput(wf, job(), "formatting", JSON.stringify({lines: [{speaker: "elora", emotion: "smile", text: "我听见了。"}], choices: ["点头应下", "认真听", "有所保留"]}));
    await directorOutput(wf, job(), "scene-evaluate", JSON.stringify({complete: true, reason: "测试用判断", unresolved: [], next: null}));
    await f.send({type: "airp-director-show", jobId: job().id});
    if (job().lowChoices?.length) await f.send({type: "airp-director-respond", jobId: job().id, index: 0});
    await f.send({type: "airp-director-read", jobId: job().id, cursor: 0});
  };
  await readScene(); await readScene();
  const accept = async (upgrade = true) => {
    if (upgrade) await f.send({type: "airp-director-enable-commissions"});
    await f.send({type: "airp-director-choose", eventId, choiceId: "participate"});
  };
  const preparePlan = async (routeId = f.departure.routeId, runId = f.departure.runId) => {
    await f.send({type: "airp-director-pause"});
    const id = await f.flow.prepare({...f.departure, routeId, runId}), packet = await f.flow.gm.read();
    await f.flow.gm.begin(id, {id: "commission-plan", stage: "plan", model: "test-mock", connectionHash: "1".repeat(64), at: 1});
    await f.flow.gm.result(id, "commission-plan", JSON.stringify(clcProposal(packet)), emptyUsage(), 2); await f.flow.gm.accept(id);
    return {id, packet};
  };
  return {...f, eventId, event, readScene, accept, preparePlan};
}
