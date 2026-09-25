import { expect, it } from "vitest";
import { directorRuntime, directorPlan, directorScene } from "./airp-director-playthrough";
import { DIRECTOR_FIXED_CARDS } from "../../content/gameplay/airp-director/content";

it("isolates content19 and replays fixed acceptance, action, feedback, result and next checkpoint", async () => {
  const f = await directorRuntime();
  expect((await f.read()).narrative.instances).toHaveLength(0);
  await directorPlan(f, {kind: "fixed", definitionId: "ripple.elora.watch-note"});
  expect((await f.read()).airpDirector!.events[0].status).toBe("planned");
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  let e = (await f.read()).airpDirector!.events[0]; expect(e.status).toBe("offered");
  await expect(f.send({type: "airp-director-choose", eventId: e.id, choiceId: "participate"})).rejects.toThrow();
  e = await directorScene(f, e.id); expect(e.exposed).toBe(true);
  await f.send({type: "airp-director-choose", eventId: e.id, choiceId: "participate"});
  e = await directorScene(f, e.id); expect(e.status).toBe("waiting-action");
  await directorScene(f, e.id); await f.send({type: "airp-director-choose", eventId: e.id, choiceId: "participate"});
  e = await directorScene(f, e.id); expect(e.status).toBe("ready");
  e = await directorScene(f, e.id); expect(e.status).toBe("resolved");
  expect((await f.read()).airpDirector!.budgets[0].publishedIds).toHaveLength(1);
  await expect(f.send({type: "airp-director-prepare-day"})).rejects.toThrow();
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  await directorPlan(f, null);
  const r = await f.read(); expect(r.airpDirector!.days).toHaveLength(2);
  const reopened = await f.runtime.application.open(r.head.saveId); expect(reopened.ok).toBe(true);
  const exported = await f.runtime.application.exportSave(r.head.saveId); expect(exported.ok).toBe(true);
  if (exported.ok) expect(JSON.stringify(r.airpDirector!.memories)).not.toContain("第一段");
}, 30000);

it("independently reviews a free two-action card and never generates later scenes ahead of choices", async () => {
  const f = await directorRuntime();
  const card = {...structuredClone(DIRECTOR_FIXED_CARDS[1].card), id: "free-window", title: "窗边的小事", themeKey: "window-test", themeDescription: "测试新事", form: "household", actorIds: ["elora"], volatility: "inert", offerPhases: 8, aftermath: null, actions: [
    {id: "first", kind: "do", actorId: "elora", locationId: "plaza", intent: "先商量当场整理方式", choices: [{id: "help", label: "搭把手", intent: "玩家选择帮忙整理"}]},
    {id: "second", kind: "talk", actorId: "elora", locationId: "plaza", intent: "再确认整理结果", choices: [{id: "ask", label: "问问是否妥当", intent: "玩家询问结果"}]},
  ]};
  await directorPlan(f, {kind: "free", card});
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  let e = (await f.read()).airpDirector!.events[0];
  expect(e.card.id).toMatch(/^director-free:/); expect((await f.read()).airpDirector!.jobs).toHaveLength(1);
  await directorScene(f, e.id); await f.send({type: "airp-director-choose", eventId: e.id, choiceId: "participate"});
  await directorScene(f, e.id);
  for (const choiceId of ["help", "ask"]) {
    await directorScene(f, e.id); await f.send({type: "airp-director-choose", eventId: e.id, choiceId}); e = await directorScene(f, e.id);
  }
  expect(e.status).toBe("ready"); e = await directorScene(f, e.id); expect(e.status).toBe("resolved");
  const jobs = (await f.read()).airpDirector!.jobs;
  expect(jobs.filter(j => j.kind === "scene")).toHaveLength(7);
  expect(jobs.at(-1)!.scene!.selected.map(s => s.id)).toEqual(["participate", "help", "ask"]);
}, 30000);

it("unexposed inert offers become reserve without history or cooldown; refusal is terminal and keeps quota", async () => {
  const f = await directorRuntime(); await directorPlan(f, {kind: "fixed", definitionId: "ripple.kororo.quiet-cup"});
  for (let i = 0; i < 10; i++) await f.send({type: "advance-phase"});
  const e = (await f.read()).airpDirector!.events[0]; expect(e.status).toBe("reserve"); expect(e.endedPhase).toBeNull(); expect(e.exposed).toBe(false);
  expect((await f.read()).airpDirector!.memories).toHaveLength(0);
}, 15000);
