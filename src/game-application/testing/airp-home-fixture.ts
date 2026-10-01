import { formalAirpFixture } from "./airp-game-fixture";
import { directorOutput, directorPlan } from "./airp-director-playthrough";
import { pendingHomeBoundary } from "../airp-game/home";
import { directorTestMaterial } from "./airp-director-fixture";
import { directorConfiguration } from "../../game-runtime/airp-director-configuration";

/** Synthetic completed mansion dialogue, committed through the formal AIRP commands. */
export async function formalHomeFixture(kind: "event" | "action" = "event") {
  const f = await formalAirpFixture(undefined, 28);
  await f.flow.sync();
  await f.send(directorConfiguration(28, directorTestMaterial(8)));
  const workflow = { read: async () => f.raw(), send: f.send };
  await directorPlan(workflow, { kind: "fixed", definitionId: kind === "action" ? "ripple.elora.watch-note" : "ripple.kororo.quiet-cup" });
  await f.send({ type: "advance-phase" });
  await f.send({ type: "advance-phase" });
  const eventId = f.raw().airpDirector!.events[0].id;
  const job = () => f.raw().airpDirector!.jobs.find(j => j.id === f.raw().airpDirector!.reading!.jobId)!;
  async function finishScene() {
    await f.send({ type: "airp-director-open", eventId });
    for (let turn = 0; turn < 3; turn++) {
      const speaker = job().scene!.actorIds[0];
      await directorOutput(workflow, job(), "writing", `${speaker}：这段记录已经核对。`);
      await directorOutput(workflow, job(), "formatting", JSON.stringify({
        lines: [{ speaker, emotion: "neutral", text: "这段记录已经核对。" }],
        choices: ["认真回应", "轻松回应", "暂且保留"],
      }));
      await directorOutput(workflow, job(), "scene-evaluate", JSON.stringify({
        complete: true, reason: "测试阶段已结束", unresolved: [], next: null,
      }));
      const ready = job();
      await f.send({ type: "airp-director-show", jobId: ready.id });
      if (ready.lowChoices?.length) await f.send({ type: "airp-director-respond", jobId: ready.id, index: 0 });
      await f.send({ type: "airp-director-read", jobId: ready.id, cursor: 0 });
      if (ready.lowPhase!.complete) return;
    }
    throw Error("Fixture dialogue did not finish");
  }
  await finishScene();
  await f.send({ type: "airp-director-choose", eventId, choiceId: "participate" });
  await finishScene();
  if (kind === "action") {
    await finishScene();
    const event = f.raw().airpDirector!.events[0];
    await f.send({ type: "airp-director-choose", eventId, choiceId: event.card.actions[event.actionIndex].choices[0].id });
  }
  await finishScene();
  if (!pendingHomeBoundary(f.raw()) || !f.raw().airpDirector!.reading?.completed)
    throw Error("Expected a completed dialogue awaiting settlement");
  return { ...f, eventId };
}
