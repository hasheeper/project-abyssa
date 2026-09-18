import { afterAll, beforeAll, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { D5GameRecord, D5Command } from "../index";
import { firstPoolOffer, poolTestRuntime, readPoolConversation, playPoolPatrol, poolPatrolCommand, type PoolRecord } from "./airp-pool-playthrough";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import { MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { canonicalJson, sha256, utf8Size } from "../../game-core/contracts";
import { GameStorageError } from "../contracts";

let pending: PoolRecord;
const checkpoints: Record<string, PoolRecord> = {};
beforeAll(async () => {
  if (process.env.ABYSSA_AIRP_POOL_FIXTURE) {
    Object.assign(checkpoints, JSON.parse(readFileSync(process.env.ABYSSA_AIRP_POOL_FIXTURE, "utf8")));
    pending = checkpoints.pending;
    expect((await poolTestRuntime(pending).runtime.application.open("pool")).ok).toBe(true);
    return;
  }
  const old: D5GameRecord | undefined = process.env.ABYSSA_AIRP_FIXTURE ? JSON.parse(readFileSync(process.env.ABYSSA_AIRP_FIXTURE, "utf8")).pending : undefined;
  const f = await firstPoolOffer(old); pending = await f.read(); checkpoints.pending = pending;
  expect((await f.runtime.application.open("pool")).ok).toBe(true);
}, 180000);
afterAll(() => { mkdirSync("dist/reports/airp-3", { recursive: true }); writeFileSync("dist/reports/airp-3/checkpoints.json", JSON.stringify(checkpoints)); });
const id = (r: PoolRecord, definition: string) => r.narrative.instances.find(i => i.definition.id === definition && !["closed", "resolved"].includes(i.status))!.id;
const names = { liaison: "ripple.elora.watch-note", household: "ripple.elora.fold-cloths", vignette: "ripple.kororo.quiet-cup", sortie: "ripple.elora.old-medicine-case" };
async function rejected(f: ReturnType<typeof poolTestRuntime>, command: D5Command) {
  const before = await f.read();
  expect(await f.runtime.application.dispatch({ protocolVersion: 4, saveId: "pool", expectedHead: before.head, clientRequestId: `invalid:${sha256(canonicalJson(command)).slice(0, 12)}:${before.head.revision}`, command })).toMatchObject({ ok: false });
  expect(await f.read()).toEqual(before);
}

it("schedules four cards atomically and read-only queries/reloads cannot refill", async () => {
  const f = poolTestRuntime(pending);
  expect(pending.narrative.instances).toHaveLength(4); expect(pending.narrative.daily.offers).toBe(4);
  for (let i = 0; i < 3; i++) { f.runtime.queries.narrative(await f.read()); expect((await f.runtime.application.open("pool")).ok).toBe(true); }
  expect(await f.read()).toEqual(pending);
}, 60000); // Three full legacy-history validations; use the same budget as other archive integration tests.
it("liaison requires the exact target and durable dialogue, then a separate return", async () => {
  const f = poolTestRuntime(pending), instanceId = id(pending, names.liaison);
  await f.send({ type: "airp-open", instanceId }); await readPoolConversation(f);
  checkpoints.liaisonAccepted = await f.read();
  await rejected(f, { type: "airp-turn-in", instanceId });
  await rejected(f, { type: "airp-visit", instanceId, actorId: "norma", locationId: "mansion.common-room" });
  await rejected(f, { type: "airp-visit", instanceId, actorId: "eustice", locationId: "mansion.other-room" });
  checkpoints.targetReading = await f.send({ type: "airp-visit", instanceId, actorId: "eustice", locationId: "mansion.common-room" });
  await rejected(f, { type: "airp-turn-in", instanceId });
  await readPoolConversation(f); const ready = await f.read();
  expect(ready.narrative.instances.find(i => i.id === instanceId)).toMatchObject({ status: "ready", targetSceneId: expect.any(String), returnSceneId: null });
  checkpoints.liaisonReady = ready;
  await f.send({ type: "airp-open", instanceId }); await readPoolConversation(f);
  checkpoints.liaisonTurnIn = await f.read();
  const done = await f.send({ type: "airp-turn-in", instanceId }); checkpoints.liaisonResolved = done;
  expect(done.narrative.memories).toHaveLength(1); expect(done.narrative.memories[0].knowledge).toEqual({ kind: "shared", actorIds: ["kael", "elora", "eustice"] });
  expect(done.snapshot.campaign.funds).toEqual(pending.snapshot.campaign.funds);
  const duplicate = await f.send({ type: "airp-turn-in", instanceId }); expect(duplicate.narrative.memories).toEqual(done.narrative.memories);
}, 60000);
it.each(["household", "vignette"] as const)("%s needs explicit final confirmation, never an animation callback", async form => {
  const f = poolTestRuntime(pending), instanceId = id(pending, names[form]);
  await f.send({ type: "airp-open", instanceId }); await rejected(f, { type: "airp-finish", instanceId });
  await readPoolConversation(f); const before = await f.read();
  checkpoints[`${form}Reading`] = before;
  expect(before.narrative.memories).toHaveLength(0);
  await rejected(f, { type: "airp-turn-in", instanceId });
  const done = await f.send({ type: "airp-finish", instanceId }); checkpoints[`${form}Resolved`] = done;
  expect(done.narrative.memories).toHaveLength(1);
  const again = await f.send({ type: "airp-finish", instanceId }); expect(again.narrative.memories).toEqual(done.narrative.memories);
}, 60000);
it("one reading owns the stage; defer survives refresh and exposes no unchosen branches", async () => {
  const f = poolTestRuntime(pending), instanceId = id(pending, names.sortie);
  const opened = await f.send({ type: "airp-open", instanceId });
  await rejected(f, { type: "airp-open", instanceId: id(pending, names.liaison) });
  await f.send({ type: "airp-defer", instanceId });
  expect((await f.runtime.application.open("pool")).ok).toBe(true);
  const resumed = await f.send({ type: "airp-open", instanceId }); expect(resumed.narrative.scenes).toEqual(opened.narrative.scenes);
  await f.send({ type: "airp-decline", instanceId }); await readPoolConversation(f);
  const view = f.runtime.queries.narrative(await f.read());
  if (view?.version !== 2) throw Error();
  expect(view.entries.find(e => e.instance.id === instanceId)!.history.flatMap(s => s.transcript).some(f => f.text.includes("我先把清洗"))).toBe(false);
}, 60000); // Full archive replay, like the neighboring integration cases; not a 5-second unit test.
it("restores target reading exactly, rebuilds request receipts, and rejects state/text forgery", async () => {
  const f = poolTestRuntime(pending), instanceId = id(pending, names.liaison);
  await f.send({ type: "airp-open", instanceId }); await readPoolConversation(f);
  const source = await f.send({ type: "airp-visit", instanceId, actorId: "eustice", locationId: "mansion.common-room" });
  const fresh = poolTestRuntime(), archive = JSON.stringify({ archiveVersion: 4, record: source });
  expect(await fresh.runtime.application.restoreSave({ archive, clientRequestId: "restore" })).toMatchObject({ ok: true }); expect(await fresh.read()).toEqual(source);
  const commit = source.commits.at(-1)!, fact = source.facts.at(-1)!; if (fact.kind !== "airp") throw Error();
  expect(await fresh.runtime.application.dispatch({ protocolVersion: 4, saveId: "pool", expectedHead: commit.previous, clientRequestId: commit.requestId, command: fact.payload.command })).toMatchObject({ ok: true, replayed: true });
  for (const field of ["text", "state", "reserve", "cooldown", "contract"]) {
    const forged = structuredClone(source), n = forged.narrative;
    if (field === "text") { const node = n.scenes[0].body.nodes[0]; if (node.kind === "beat") node.frames[0].text = "伪造台词"; n.scenes[0].bodyHash = sha256(canonicalJson(n.scenes[0].body)); }
    if (field === "state") n.instances[0].status = "resolved";
    if (field === "reserve") n.reserve.push({ definition: n.instances[0].definition, sourceInstanceId: "foreign", eligiblePhase: 0 });
    if (field === "cooldown") n.cooldowns.push({ themeKey: "made-up", sourceFactId: "foreign", fromPhase: 0, untilPhase: 256 });
    if (field === "contract") Object.assign(n, { version: 1 });
    expect(await poolTestRuntime().runtime.application.restoreSave({ archive: JSON.stringify({ archiveVersion: 4, record: forged }), clientRequestId: "forged" })).toMatchObject({ ok: false });
  }
}, 60000);
it("CAS permits one completion and faults cannot partially commit memories/cooldowns", async () => {
  const f = poolTestRuntime(pending), instanceId = id(pending, names.household);
  await f.send({ type: "airp-open", instanceId }); await readPoolConversation(f); const source = await f.read();
  const other = createPlayerRuntime(new MemoryGameStore(f.database), { newId: () => "other", newSeed: () => 19, close() {} });
  const request = { protocolVersion: 4, saveId: "pool", expectedHead: source.head, clientRequestId: "race", command: { type: "airp-finish", instanceId } };
  const result = await Promise.all([f.runtime.application.dispatch(request), other.application.dispatch({ ...request, clientRequestId: "other-race" })]);
  expect(result.filter(r => r.ok)).toHaveLength(1); expect((await f.read()).narrative.memories).toHaveLength(1);
  for (const fault of ["before", "after", "quota"]) {
    const f = poolTestRuntime(source), commit = f.store.commit.bind(f.store); let armed = true;
    f.store.commit = async proposal => { if (armed && fault !== "after") { armed = false; throw new GameStorageError(fault === "quota" ? "storage-quota" : "storage-aborted", "injected"); } const r = await commit(proposal); if (armed) { armed = false; throw new GameStorageError("storage-unavailable", "lost response"); } return r; };
    expect(await f.runtime.application.dispatch(request)).toMatchObject({ ok: false });
    expect((await f.read()).narrative.memories).toHaveLength(fault === "after" ? 1 : 0);
    expect(await f.runtime.application.dispatch(request)).toMatchObject({ ok: true }); expect((await f.read()).narrative.memories).toHaveLength(1);
  }
}, 60000);
it("safe copies preserve terminal history/cooldowns without promoting ancestor evidence", async () => {
  const f = poolTestRuntime(pending);
  const archive = (r: D5GameRecord) => JSON.stringify({ archiveVersion: 4, record: r });
  expect(await f.runtime.application.importSave({ format: "application", saveId: "unsafe", epoch: "unsafe-epoch", clientRequestId: "copy", archive: archive(pending) })).toMatchObject({ ok: false });
  for (const form of ["household", "vignette", "sortie", "liaison"] as const) {
    const instanceId = id(await f.read(), names[form]); await f.send({ type: "airp-open", instanceId });
    if (form === "sortie" || form === "liaison") await f.send({ type: "airp-decline", instanceId });
    await readPoolConversation(f);
    if (form === "household" || form === "vignette") await f.send({ type: "airp-finish", instanceId });
  }
  const source = await f.read(); checkpoints.copySafe = source;
  expect(await f.runtime.application.importSave({ format: "application", saveId: "copy", epoch: "copy-epoch", clientRequestId: "copy", archive: archive(source) })).toMatchObject({ ok: true });
  const opened = await f.runtime.application.open("copy"); if (!opened.ok || opened.record.schemaVersion !== 4 || opened.record.narrative?.version !== 2) throw Error();
  const copied = opened.record.narrative;
  expect(copied.memories).toEqual(source.narrative.memories); expect(copied.cooldowns).toEqual(source.narrative.cooldowns);
  expect(copied.instances.every(i => i.status === "resolved" || i.status === "closed")).toBe(true);
  const view = f.runtime.queries.narrative(opened.record); if (view?.version !== 2) throw Error();
  expect(view.entries.flatMap(e => e.history).flatMap(h => h.transcript).length).toBeGreaterThan(4);
}, 60000);
it.skipIf(!process.env.ABYSSA_AIRP_FIXTURE)("upgrades the proven content-8 resolution without reoffering its unique case", async () => {
  const old = JSON.parse(readFileSync(process.env.ABYSSA_AIRP_FIXTURE!, "utf8")).resolved as D5GameRecord;
  const f = await firstPoolOffer(old), r = await f.read();
  expect(r.narrative.instances.filter(i => i.definition.id === names.sortie)).toHaveLength(1);
  expect(r.narrative.instances.find(i => i.definition.id === names.sortie)!.status).toBe("resolved");
  expect(r.narrative.memories).toEqual(old.narrative!.memories); expect(r.snapshot.campaign.funds).toEqual(old.snapshot.campaign.funds);
  expect((await f.runtime.application.open("pool")).ok).toBe(true);
}, 60000);
it("executes all three real sortie chains, including a setback variant and unique proof", async () => {
  const f = poolTestRuntime(pending); let r = pending;
  // Other cards remain unseen: their expiry is evaluated by real return boundaries.
  for (const [index, definition] of [names.sortie, "ripple.eustice.route-board", "ripple.norma.canvas-sample"].entries()) {
    if (index === 1) { r = await playPoolPatrol(f, "calendar-one", "wipe"); r = await playPoolPatrol(f, "calendar-two", "wipe"); }
    const instanceId = id(r, definition); await f.send({ type: "airp-open", instanceId }); await readPoolConversation(f);
    if (index === 1) expect((await f.read()).narrative.instances.find(i => i.id === instanceId)!.variant).toBe("setback");
    r = await playPoolPatrol(f, `quest-${index}`, "extracted", state => { if (state.narrative.instances.find(i => i.id === instanceId)?.carryFactId) checkpoints[`sortie${index}Found`] ??= state; });
    checkpoints[`sortie${index}Ready`] = r;
    expect(r.narrative.instances.find(i => i.id === instanceId)).toMatchObject({ status: "ready", proof: { runId: `quest-${index}`, outcome: "extracted" } });
    await f.send({ type: "airp-open", instanceId }); await readPoolConversation(f); r = await f.send({ type: "airp-turn-in", instanceId });
    checkpoints[`sortie${index}Resolved`] = r;
  }
  expect(r.narrative.instances.filter(i => i.status === "resolved")).toHaveLength(3);
  expect(r.narrative.memories.filter(m => m.axis === "bond")).toHaveLength(3);
  expect(r.narrative.memories.filter(m => m.axis === "agenda")).toHaveLength(1);
  expect((await f.runtime.application.open("pool")).ok).toBe(true);
  expect(utf8Size(JSON.stringify({ archiveVersion: 4, record: r }))).toBeLessThan(8 * 1024 * 1024);
}, 240000);
it.skipIf(!process.env.ABYSSA_AIRP_POOL_FIXTURE)("real returns create two unique aftermaths and reoffer an unseen reserve under a new identity", async () => {
  const f = poolTestRuntime(checkpoints.sortie2Resolved);
  const cloth = id(await f.read(), names.household);
  await f.send({ type: "airp-open", instanceId: cloth }); await f.send({ type: "airp-decline", instanceId: cloth }); await readPoolConversation(f);
  const before = await f.read(), oldVignette = before.narrative.instances.find(i => i.definition.id === names.vignette)!;
  for (let p = 0; p < 6; p++) await playPoolPatrol(f, `aftermath-calendar-${p}`, "wipe");
  let r = await f.read(); checkpoints.twoAftermaths = r;
  const missed = r.narrative.instances.filter(i => i.reason === "missed"); expect(missed).toHaveLength(2);
  expect(r.narrative.memories.filter(m => m.axis === "agenda")).toHaveLength(2);
  const reoffer = r.narrative.instances.find(i => i.definition.id === names.vignette && i.id !== oldVignette.id)!;
  expect(reoffer.variant).toBe("reserve"); expect(reoffer.createdPhase).toBeGreaterThanOrEqual(12);
  expect(oldVignette.id).not.toBe(reoffer.id);
  const memories = r.narrative.memories;
  for (const i of missed) { await f.send({ type: "airp-open", instanceId: i.id }); await readPoolConversation(f); }
  r = await f.read(); expect(r.narrative.memories).toEqual(memories);
  expect(r.narrative.instances.filter(i => i.aftermathRead)).toHaveLength(2);
  expect((await f.runtime.application.open("pool")).ok).toBe(true);
  const restored = poolTestRuntime(); expect(await restored.runtime.application.restoreSave({ archive: JSON.stringify({ archiveVersion: 4, record: r }), clientRequestId: "restore-aftermath" })).toMatchObject({ ok: true });
  expect(await restored.read()).toEqual(r);
}, 240000);
it.skipIf(!process.env.ABYSSA_AIRP_POOL_FIXTURE)("a real wipe after collecting the target clears carrying and rebinds the same promise", async () => {
  const f = poolTestRuntime(checkpoints.sortie0Found); let r = await f.read();
  const instanceId = id(r, names.sortie);
  for (let step = 0; r.snapshot.run && step < 600; step++) r = await f.send(poolPatrolCommand(r, "wipe"));
  expect(r.snapshot.campaign.settlements.at(-1)?.outcome).toBe("wipe");
  expect(r.narrative.instances.find(i => i.id === instanceId)).toMatchObject({ status: "accepted", binding: null, carryFactId: null, proof: null });
  expect(r.narrative.scenes.find(s => s.id === r.narrative.reading?.sceneId)?.role).toBe("retry");
  await readPoolConversation(f);
  r = await f.send({ type: "start-expedition", runId: "rebound", routeId: "old-manor.maintenance", partyIds: r.snapshot.campaign.availableCharacterIds.filter(id => ["kael", "elora", "eustice", "norma", "kororo"].includes(id)), itemIds: ["item.food", "item.potion"], seed: 19 });
  expect(r.narrative.instances.find(i => i.id === instanceId)?.binding?.runId).toBe("rebound");
  expect((await f.runtime.application.open("pool")).ok).toBe(true);
}, 120000);
it.skipIf(!process.env.ABYSSA_AIRP_POOL_FIXTURE)("the second sortie can fully clear and freeze its own full-return script", async () => {
  const f = poolTestRuntime(checkpoints.sortie1Found); let r = await f.read();
  const instanceId = id(r, "ripple.eustice.route-board");
  for (let step = 0; r.snapshot.run && step < 700; step++) r = await f.send(poolPatrolCommand(r, "cleared"));
  expect(r.narrative.instances.find(i => i.id === instanceId)?.proof?.outcome).toBe("cleared");
  r = await f.send({ type: "airp-open", instanceId });
  expect(r.narrative.scenes.find(s => s.id === r.narrative.reading?.sceneId)?.role).toBe("return-cleared");
  await readPoolConversation(f); checkpoints.sortie1Cleared = await f.send({ type: "airp-turn-in", instanceId });
  expect((await f.runtime.application.open("pool")).ok).toBe(true);
}, 180000);
it.skipIf(!process.env.ABYSSA_AIRP_POOL_FIXTURE)("awaiting a patrol return exposes its button instead of replaying the old offer", async () => {
  const f = poolTestRuntime(checkpoints.sortie0Ready), source = await f.read();
  expect((await f.runtime.application.open("pool")).ok).toBe(true);
  const view = f.runtime.queries.narrative(source);
  expect(view).toMatchObject({ version: 2, locked: false, canOpen: true });
  const instanceId = id(source, names.sortie);
  await rejected(f, { type: "airp-turn-in", instanceId });
  const opened = await f.send({ type: "airp-open", instanceId });
  expect(f.runtime.queries.narrative(opened)).toMatchObject({ locked: true, scene: { role: "return-extracted" } });
  await readPoolConversation(f); const done = await f.send({ type: "airp-turn-in", instanceId });
  expect(done.narrative.memories.filter(m => m.axis === "bond")).toHaveLength(1);
}, 60000);
