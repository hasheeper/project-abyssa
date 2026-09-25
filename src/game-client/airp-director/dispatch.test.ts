import { expect, it } from "vitest";
import { formalAirpFixture } from "../../game-application/testing/airp-game-fixture";
import { directorPlan } from "../../game-application/testing/airp-director-playthrough";
import { directorTestMaterial } from "../../game-application/testing/airp-director-fixture";
import { lowR8Source } from "../../content/presentation/airp/low-r8-source";
import { GameSession } from "../session";
import { dispatchDirector } from "./dispatch";

it("mansion/journal entry upgrades the next frame without changing an existing frozen request", async () => {
  const f = await formalAirpFixture(); await f.flow.sync();
  await f.send({type: "airp-director-configure", material: directorTestMaterial(), lowMaterial: lowR8Source, lowReadVersion: 6, lowContextVersion: 12});
  await directorPlan({read: async () => f.raw(), send: f.send}, {kind: "fixed", definitionId: "ripple.elora.old-medicine-case"});
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  const eventId = f.raw().airpDirector!.events[0].id;
  const session = new GameSession(f.runtime, {saveId: "formal-airp", epoch: "epoch:1"}, {getItem: () => null, setItem() {}, removeItem() {}}, () => {});
  try {
    expect(await dispatchDirector(session, {type: "airp-director-open", eventId})).toBeTruthy();
    const state = f.raw().airpDirector!, job = state.jobs.find(j => j.scene?.eventId === eventId)!;
    expect(state.lowContextVersion).toBe(21); expect(job.lowContextVersion).toBe(21);
    expect(job.lowFrame!.scene.dialogue!.previousRead).toEqual([]);
    await dispatchDirector(session, {type: "airp-director-pause"});
    await dispatchDirector(session, {type: "airp-director-open", eventId});
    expect(f.raw().airpDirector!.jobs.find(j => j.id === job.id)).toEqual(job);
  } finally { session.dispose(); }
}, 30000);
