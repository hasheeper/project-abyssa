import { beforeAll, expect, it } from "vitest";
import { AIRP_CATALOG } from "../../game-runtime/airp-context";
import { firstAirpOffer, airpTestRuntime, readAirpConversation, airpPatrolCommand } from "./airp-playthrough";
import type { FirstAirpRecord as D5GameRecord } from "./airp-playthrough";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import { MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { canonicalJson, sha256, utf8Size } from "../../game-core/contracts";
import { GameStorageError } from "../contracts";

let pending: D5GameRecord;
const checkpoints: Record<string, D5GameRecord> = {};
beforeAll(async () => {
  if (process.env.ABYSSA_AIRP_FIXTURE) {
    Object.assign(checkpoints, JSON.parse(readFileSync(process.env.ABYSSA_AIRP_FIXTURE, "utf8")));
    pending = checkpoints.pending;
    expect((await airpTestRuntime(pending).runtime.application.open("airp")).ok).toBe(true);
    return;
  }
  const f = await firstAirpOffer(); pending = await f.read(); checkpoints.pending = pending;
}, 180000);
beforeAll(async () => {
  if (process.env.ABYSSA_AIRP_FIXTURE) return;
  const f = airpTestRuntime(pending), instanceId = pending.narrative!.instance!.id;
  expect(pending.contentRef).toEqual(AIRP_CATALOG.ref);
  expect(pending.narrative!.instance!.status).toBe("pending");
  expect(pending.narrative!.scenes).toHaveLength(0);
  checkpoints.offered = await f.send({ type: "airp-open", instanceId });
  checkpoints.accepted = await readAirpConversation(f, "C");
  let r = await f.send({ type: "start-expedition", runId: "patrol", routeId: "old-manor.maintenance", partyIds: AIRP_CATALOG.data.initialParty, itemIds: AIRP_CATALOG.data.journey!.defaultItems, seed: 19 });
  expect(r.narrative!.instance).toMatchObject({ status: "accepted", stance: "pragmatic", binding: { runId: "patrol" } });
  checkpoints.departure = r;
  for (let i = 0; r.snapshot.run && i < 600; i++) {
    if (r.narrative!.carryFactId) checkpoints.found ??= r;
    if (r.snapshot.run?.kind === "expedition" && r.snapshot.run.state.node === "exit") checkpoints.exit = r;
    r = await f.send(airpPatrolCommand(r));
  }
  expect(r.narrative!.instance).toMatchObject({ status: "ready", proof: { outcome: "extracted" } });
  checkpoints.ready = r;
  const funds = r.snapshot.campaign.funds;
  checkpoints.returnReading = await f.send({ type: "airp-open", instanceId });
  await readAirpConversation(f);
  checkpoints.turnIn = await f.read();
  r = await f.send({ type: "airp-turn-in", instanceId });
  checkpoints.resolved = r;
  expect(r.narrative!.instance!.status).toBe("resolved");
  expect(r.narrative!.memories).toHaveLength(1);
  expect(r.snapshot.campaign.funds).toEqual(funds);
  expect((await f.runtime.application.open("airp")).ok).toBe(true);
  const duplicate = await f.send({ type: "airp-turn-in", instanceId });
  expect(duplicate.narrative).toEqual(r.narrative);
  expect(utf8Size(JSON.stringify({ archiveVersion: 4, record: r }))).toBeLessThan(8 * 1024 * 1024);
  mkdirSync("dist/reports/airp-2", { recursive: true });
  writeFileSync("dist/reports/airp-2/checkpoints.json", JSON.stringify(checkpoints));
}, 180000);

it("completes the extracted patrol from real commands without granting extra currency", () => {
  expect(checkpoints.resolved.narrative!.instance!.status).toBe("resolved");
  expect(checkpoints.resolved.snapshot.campaign.funds).toEqual(checkpoints.ready.snapshot.campaign.funds);
  expect(checkpoints.resolved.narrative!.memories).toHaveLength(1);
  expect(checkpoints.offered.narrative!.scenes[0].sourceHead).toEqual(checkpoints.offered.head);
  expect(checkpoints.returnReading.narrative!.scenes.at(-1)!.body.presentation.backgroundId).toBe("mansion.night");
});

it("continues the same proven exit to a full clear, with a distinct frozen return script", async () => {
  const f = airpTestRuntime(checkpoints.exit);
  let r = await f.read();
  for (let i = 0; r.snapshot.run && i < 600; i++) r = await f.send(airpPatrolCommand(r, "cleared"));
  expect(r.narrative!.instance).toMatchObject({ status: "ready", proof: { outcome: "cleared" } });
  r = await f.send({ type: "airp-open", instanceId: r.narrative!.instance!.id });
  expect(r.narrative!.scenes.at(-1)?.role).toBe("return-cleared");
  await readAirpConversation(f);
  r = await f.send({ type: "airp-turn-in", instanceId: r.narrative!.instance!.id });
  expect(r.narrative!.memories).toHaveLength(1);
}, 180000);

it("keeps acceptance after a real wipe and binds the retry to a new run", async () => {
  const f = airpTestRuntime(checkpoints.departure);
  let r = await f.read();
  for (let i = 0; r.snapshot.run && i < 300; i++) r = await f.send(airpPatrolCommand(r, "wipe"));
  expect(r.snapshot.campaign.settlements.at(-1)?.outcome).toBe("wipe");
  expect(r.narrative!.instance).toMatchObject({ status: "accepted", binding: null });
  expect(r.narrative!.carryFactId).toBeNull();
  expect(r.narrative!.memories).toHaveLength(0);
  await readAirpConversation(f);
  r = await f.send({ type: "start-expedition", runId: "retry-patrol", routeId: "old-manor.maintenance", partyIds: AIRP_CATALOG.data.initialParty, itemIds: AIRP_CATALOG.data.journey!.defaultItems, seed: 19 });
  expect(r.narrative!.instance).toMatchObject({ status: "accepted", binding: { runId: "retry-patrol" } });
}, 60000);

it("persists defer, refuses choice skipping and does not substitute already exposed text", async () => {
  const f = airpTestRuntime(checkpoints.offered), instanceId = pending.narrative!.instance!.id;
  const original = checkpoints.offered.narrative!.scenes[0];
  const paused = await f.send({ type: "airp-defer", instanceId });
  expect(f.runtime.queries.narrative(paused)?.locked).toBe(false);
  const reopened = await f.send({ type: "airp-open", instanceId });
  expect(reopened.narrative!.reading?.node).toBe(0);
  expect(reopened.narrative!.scenes[0]).toEqual(original);
  for (let i = 0; i < 4; i++) {
    const n = (await f.read()).narrative!;
    await f.send({ type: "airp-read", instanceId, sceneId: n.reading!.sceneId, nodeId: original.body.nodes[n.reading!.node].id });
  }
  const r = await f.read();
  expect(await f.runtime.application.dispatch({ protocolVersion: 4, saveId: "airp", expectedHead: r.head, clientRequestId: "skip-choice", command: { type: "airp-read", instanceId, sceneId: original.id, nodeId: original.body.nodes[4].id } })).toMatchObject({ ok: false });
  expect((await f.read()).narrative!.instance!.status).toBe("offered");
  await f.send({ type: "airp-decline", instanceId });
  const closed = await readAirpConversation(f);
  expect(closed.narrative!.instance).toMatchObject({ status: "closed", reason: "declined" });
  expect(closed.narrative!.cooldowns[0].untilPhase - closed.narrative!.cooldowns[0].fromPhase).toBe(256);
}, 30000);

it.each(["offered", "accepted", "departure", "found", "ready", "returnReading", "resolved"])("restores exact %s archive identity and refuses copy/overwrite or forged evidence", async key => {
  const source = checkpoints[key], f = airpTestRuntime(), archive = JSON.stringify({ archiveVersion: 4, record: source });
  const request = { archive, clientRequestId: "restore-archive" };
  expect(await f.runtime.application.restoreSave(request)).toMatchObject({ ok: true, head: source.head, replayed: false });
  expect(await f.read()).toEqual(source);
  expect(await f.runtime.application.restoreSave(request)).toMatchObject({ ok: true, replayed: true });
  const fresh = createPlayerRuntime(new MemoryGameStore(f.database), { newId: () => "fresh", newSeed: () => 19, close() {} });
  expect((await fresh.application.open("airp")).ok).toBe(true);
  const commit = [...source.commits].reverse().find(c => c.kind === "airp");
  if (commit) {
    const fact = source.facts.find(f => f.id === commit.factIds[0])!;
    if (fact.kind !== "airp") throw Error("Missing intent");
    expect(await fresh.application.dispatch({ protocolVersion: 4, saveId: source.head.saveId, expectedHead: commit.previous, clientRequestId: commit.requestId, command: fact.payload.command })).toMatchObject({ ok: true, replayed: true, receipt: { after: commit.ref } });
  }
  expect(await fresh.application.restoreSave({ archive: JSON.stringify({ archiveVersion: 4, record: pending }), clientRequestId: "overwrite" })).toMatchObject({ ok: false, error: { code: "conflict" } });
  const copy = await fresh.application.importSave({ format: "application", saveId: "copy", epoch: "copy-epoch", clientRequestId: "copy", archive });
  expect(copy.ok).toBe(key === "resolved");
  expect(await f.read()).toEqual(source);
}, 60000);

it.each(["body", "hash", "binding", "memory", "choice"])("rejects tampered %s even with a recomputed body hash", async target => {
  const forged = structuredClone(target === "binding" ? checkpoints.departure : checkpoints.resolved);
  const n = forged.narrative!;
  if (target === "body") { const node = n.scenes[0].body.nodes[0]; if (node.kind === "beat") node.frames[0].text = "伪造对白"; n.scenes[0].bodyHash = sha256(canonicalJson(n.scenes[0].body)); }
  if (target === "hash") n.scenes[0].bodyHash = "0".repeat(64);
  if (target === "binding" && n.instance?.status === "accepted") n.instance.binding!.runId = "old-run";
  if (target === "memory") n.memories[0].summary = "虚假共同经历";
  if (target === "choice" && n.instance?.status === "resolved") n.instance.stance = "iron";
  const f = airpTestRuntime();
  expect(await f.runtime.application.restoreSave({ archive: JSON.stringify({ archiveVersion: 4, record: forged }), clientRequestId: "forged" })).toMatchObject({ ok: false });
  expect(await f.store.listSaveIds()).toEqual([]);
}, 30000);

it("serializes competing turn-ins and replays the winning transaction without a second memory", async () => {
  const f = airpTestRuntime(checkpoints.turnIn), r = await f.read();
  const other = createPlayerRuntime(new MemoryGameStore(f.database), { newId: () => "other", newSeed: () => 19, close() {} });
  const request = { protocolVersion: 4, saveId: "airp", expectedHead: r.head, clientRequestId: "turn-in-race", command: { type: "airp-turn-in", instanceId: r.narrative!.instance!.id } };
  const results = await Promise.all([f.runtime.application.dispatch(request), other.application.dispatch({ ...request, clientRequestId: "other-tab" })]);
  expect(results.filter(r => r.ok)).toHaveLength(1);
  expect(results.find(r => !r.ok)).toMatchObject({ error: { code: "conflict" } });
  const winner = results[0].ok ? request : { ...request, clientRequestId: "other-tab" };
  expect(await other.application.dispatch(winner)).toMatchObject({ ok: true, replayed: true });
  expect(await other.application.dispatch({ ...winner, command: { type: "airp-open", instanceId: request.command.instanceId } })).toMatchObject({ ok: false, error: { code: "request-id-reused" } });
  expect((await f.read()).narrative!.memories).toHaveLength(1);
}, 30000);

it.each(["before", "after", "quota"])("recovers %s-commit failure atomically", async fault => {
  const f = airpTestRuntime(checkpoints.turnIn), source = await f.read(), commit = f.store.commit.bind(f.store);
  let armed = true;
  f.store.commit = async proposal => {
    if (armed && fault !== "after") { armed = false; throw new GameStorageError(fault === "quota" ? "storage-quota" : "storage-aborted", "injected"); }
    const result = await commit(proposal);
    if (armed) { armed = false; throw new GameStorageError("storage-unavailable", "lost response"); }
    return result;
  };
  const request = { protocolVersion: 4, saveId: "airp", expectedHead: source.head, clientRequestId: `fault:${fault}`, command: { type: "airp-turn-in", instanceId: source.narrative!.instance!.id } };
  expect(await f.runtime.application.dispatch(request)).toMatchObject({ ok: false });
  expect((await f.read()).narrative!.memories).toHaveLength(fault === "after" ? 1 : 0);
  expect(await f.runtime.application.dispatch(request)).toMatchObject({ ok: true, replayed: fault === "after" });
  expect((await f.read()).narrative!.memories).toHaveLength(1);
}, 30000);

it("keeps undo evidence retracted and prevents old-run proof or early turn-in", async () => {
  const f = airpTestRuntime(checkpoints.departure), ref = { kind: "expedition" as const, id: "patrol" };
  await f.send({ type: "battle-command", runRef: ref, command: { type: "roll" } });
  const acted = await f.send({ type: "battle-command", runRef: ref, command: { type: "toggle-load", actorId: "kael" } });
  const undone = await f.send({ type: "undo", runRef: ref });
  expect(undone.retractedFactIds).toContain(acted.facts.at(-1)!.id);
  expect(undone.narrative!.carryFactId).toBeNull();
  const request = { protocolVersion: 4, saveId: "airp", expectedHead: undone.head, clientRequestId: "early-turn-in", command: { type: "airp-turn-in", instanceId: undone.narrative!.instance!.id } };
  expect(await f.runtime.application.dispatch(request)).toMatchObject({ ok: false });
  const old = pending.originRef!.source;
  const legacy = airpTestRuntime(old as D5GameRecord);
  expect(await legacy.runtime.application.dispatch({ ...request, saveId: old.head.saveId, expectedHead: old.head })).toMatchObject({ ok: false });
  const forged = structuredClone(old) as D5GameRecord; forged.narrative = structuredClone(undone.narrative);
  const invalid = airpTestRuntime(forged);
  expect(await invalid.runtime.application.open(old.head.saveId)).toMatchObject({ ok: false });
}, 30000);
