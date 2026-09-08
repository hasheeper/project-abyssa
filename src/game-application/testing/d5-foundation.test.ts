import { describe, expect, it } from "vitest";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import { createD5FoundationApplication } from "../versions/d5-foundation";
import { parseD5Request } from "../versions/d5-parse";
import { d5EvidenceRunRef, d5FactId, readD5Archive, validateD5Receipt, validateD5Record } from "../versions/d5-validate";
import type { D5Fact, D5GameRecord, D5Receipt } from "../versions/d5-contracts";
import { d5Catalog, d5Scenario } from "../../game-core/session/testing/d5-fixtures";
import { projectD5Progress } from "../../game-core/session/d5-progress";
import { GameStorageError } from "../contracts";
import { requestKey } from "../transaction";

const creation = { protocolVersion: 4, saveId: "d5", epoch: "epoch-d5", clientRequestId: "create", profileId: d5Catalog.data.journey!.defaultProfileId };
function setup() {
  const db = new MemoryGameDatabase<D5GameRecord, D5Receipt>();
  const first = new MemoryGameStore(db), second = new MemoryGameStore(db);
  return { db, first, second, a: createD5FoundationApplication(d5Catalog, first), b: createD5FoundationApplication(d5Catalog, second) };
}
async function initial() {
  const s = setup(); expect((await s.a.create(creation)).ok).toBe(true);
  const raw = await s.first.read("d5"); if (!raw) throw Error("fixture");
  return { ...s, record: raw };
}
async function earnedRecord() {
  const fixture = d5Scenario(); fixture.depart("ordinary"); const t = fixture.settle();
  fixture.claim("event.growth.elora.lv2", t.id);
  const { record } = await initial(), head = record.head;
  const entries = fixture.entries.map(e => ({ ...structuredClone(e), id: d5FactId(head.saveId, head.epoch, e.revision, 0) }));
  let returns = 0;
  for (const entry of entries) {
    const source = { ...head, revision: entry.revision };
    const fact: D5Fact = { version: 4, id: entry.id, source, origin: entry.origin, runRef: d5EvidenceRunRef(entry.event), originRef: null, worldTime: { day: 1 + Math.floor(returns / 4), phase: (["dawn", "day", "dusk", "night"] as const)[returns % 4] }, visibility: "party", kind: "progression", payload: entry.event };
    record.facts.push(fact); record.commits.push({ ref: source, previous: { ...source, revision: source.revision - 1 }, requestId: `command:${entry.revision}`, kind: entry.event.type, factIds: [entry.id] });
    if (entry.event.type === "expedition-settled") returns++;
  }
  record.head = { ...head, revision: entries.length };
  record.snapshot = { campaign: structuredClone(projectD5Progress(d5Catalog, entries, fixture.readers)), run: null };
  return { record, readers: fixture.readers };
}

describe("D5-B v4 record, archive and durable foundation", () => {
  it("creates, reopens and exports a strictly validated v4 baseline", async () => {
    const { a, b } = setup(); expect((await a.create(creation)).ok).toBe(true);
    const opened = await b.open("d5"); expect(opened.ok).toBe(true); if (!opened.ok) throw Error("fixture");
    expect(opened.record.snapshot.campaign.progress).toEqual({ appliedGrowthIds: [], equipment: [] });
    const out = await b.exportSave("d5"); if (!out.ok) throw Error("fixture");
    expect(readD5Archive(out.archive, d5Catalog)).toEqual(opened.record);
    expect(Object.isFrozen(opened.record.snapshot.campaign.inventory)).toBe(true);
    expect(await b.create(creation)).toMatchObject({ ok: true, replayed: true });
  });
  it("CAS permits only one initial writer from two independent connections", async () => {
    const { a, b, db } = setup();
    const r = await Promise.all([a.create(creation), b.create({ ...creation, clientRequestId: "racer" })]);
    expect(r.filter(x => x.ok)).toHaveLength(1); expect(db.records).toHaveLength(1);
    const failed = r.find(x => !x.ok)!; expect(failed).toMatchObject({ error: { code: "conflict" } });
    expect((await a.open("d5")).ok).toBe(true);
  });
  it.each(["storage-aborted", "storage-quota"] as const)("rolls back a %s creation and safely retries", async code => {
    const { a, first, db } = setup(), commit = first.commit.bind(first);
    first.commit = async () => { throw new GameStorageError(code, "injected"); };
    expect(await a.create(creation)).toMatchObject({ ok: false, error: { code } });
    expect(db.records.size).toBe(0); expect(db.receipts.size).toBe(0);
    first.commit = commit; expect((await a.create(creation)).ok).toBe(true);
  });
  it("recovers a committed create after its response is lost without a second write", async () => {
    const { a, first, db } = setup(), commit = first.commit.bind(first);
    first.commit = async proposal => { await commit(proposal); throw new GameStorageError("storage-aborted", "response lost"); };
    expect((await a.create(creation)).ok).toBe(false);
    first.commit = commit; expect(await a.create(creation)).toMatchObject({ ok: true, replayed: true });
    expect(db.records.get("d5")!.commits).toHaveLength(1);
  });
  it("rejects corrupted stored receipts before replay", async () => {
    const { a, db } = await initial(), key = requestKey("d5", "epoch-d5", "create");
    db.receipts.get(key)!.factIds = ["unbound"];
    expect((await a.create(creation)).ok).toBe(false);
  });
  it("refuses unimplemented gameplay with no success receipt or state write", async () => {
    const { a, record, db } = await initial(), before = structuredClone(record);
    expect(await a.dispatch({ protocolVersion: 4, saveId: "d5", expectedHead: record.head, clientRequestId: "begin", command: { type: "begin-memory", chapterId: "chapter.marietta.memory" } })).toMatchObject({ ok: false, error: { code: "content-unavailable" } });
    expect(db.records.get("d5")).toEqual(before); expect(db.receipts.size).toBe(1);
    expect(await a.dispatch({ protocolVersion: 4, saveId: "d5", expectedHead: { ...record.head, revision: 1 }, clientRequestId: "stale", command: { type: "begin-memory", chapterId: "chapter.marietta.memory" } })).toMatchObject({ ok: false, error: { code: "conflict" } });
  });
  it("binds earned growth to the originating commit, return and event cursor", async () => {
    const { record: r, readers } = await earnedRecord(), valid = validateD5Record(r, d5Catalog, readers);
    expect(valid.snapshot.campaign.progress.appliedGrowthIds).toEqual(["growth.elora.lv2"]);
    expect(readD5Archive(JSON.stringify({ archiveVersion: 4, record: r }), d5Catalog, readers)).toEqual(valid);
    expect(() => validateD5Record(r, d5Catalog)).toThrow(/reader is not installed/);
    const missing = structuredClone(r); missing.facts.splice(2, 1); expect(() => validateD5Record(missing, d5Catalog, readers)).toThrow();
  });
  it.each(["origin", "source", "run-kind", "basis", "cursor", "grant", "inventory", "time", "retract", "lineage"])("rejects unexplained record mutation: %s", async kind => {
    const { record: r, readers } = await earnedRecord();
    if (kind === "origin") Object.assign(r.facts[2], { origin: "simulation" });
    if (kind === "source") r.facts[2].source.epoch = "foreign";
    if (kind === "run-kind") r.facts[2].runRef = { kind: "memory", id: "ordinary", attempt: 1 };
    if (kind === "basis" && r.facts[3].kind === "progression") Object.assign(r.facts[3].payload, { basisId: "absent-terminal" });
    if (kind === "cursor" && r.facts[4].kind === "progression") Object.assign(r.facts[4].payload, { step: 5 });
    if (kind === "grant") r.snapshot.campaign.progress.appliedGrowthIds.push("growth.norma.lv3");
    if (kind === "inventory") r.snapshot.campaign.inventory.push({ instanceId: "fake", definitionId: "equipment.spare-blade", grantId: "fake", location: { kind: "inventory" } });
    if (kind === "time") r.facts[3].worldTime.phase = "night";
    if (kind === "retract") Object.assign(r, { retractedFactIds: [r.facts[2].id] });
    if (kind === "lineage") Object.assign(r, { originRef: { saveId: "old", epoch: "old", revision: 10 } });
    expect(() => validateD5Record(r, d5Catalog, readers)).toThrow();
  });
  it("rejects mismatched schema, content digest, archive version and arbitrary initial override", async () => {
    const { a, record } = await initial();
    expect((await a.create({ ...creation, protocolVersion: 3 })).ok).toBe(false);
    expect((await a.create({ ...creation, snapshot: record.snapshot })).ok).toBe(false);
    expect(() => validateD5Record({ ...record, schemaVersion: 3 }, d5Catalog)).toThrow();
    expect(() => validateD5Record({ ...record, contentRef: { ...record.contentRef, digest: "0".repeat(64) } }, d5Catalog)).toThrow();
    expect(() => readD5Archive(JSON.stringify({ archiveVersion: 3, record }), d5Catalog)).toThrow();
  });
  it("strictly separates memory attempts, ordinary references and internal continuations", () => {
    const base = { protocolVersion: 4, saveId: "d5", expectedHead: { saveId: "d5", epoch: "e", revision: 0 }, clientRequestId: "cmd" };
    const memory = { kind: "memory", id: "m", attempt: 1 };
    expect(parseD5Request({ ...base, command: { type: "battle-command", runRef: memory, command: { type: "roll" } } }).command).toMatchObject({ runRef: memory });
    expect(parseD5Request({ ...base, command: { type: "use-item", runRef: memory, instanceId: "memory-supply:potion", target: { kind: "member", id: "kael" } } }).command).toMatchObject({ runRef: memory });
    expect(parseD5Request({ ...base, command: { type: "read-memory", runRef: memory, node: "present-intro", step: 2, choice: "pragmatic" } }).command).toMatchObject({ choice: "pragmatic" });
    expect(parseD5Request({ ...base, command: { type: "advance-story", sessionId: "story", step: 3, choice: "seasoned" } }).command).toMatchObject({ choice: "seasoned" });
    expect(() => parseD5Request({ ...base, command: { type: "advance-story", sessionId: "story", step: 3, choice: "sarcastic" } })).toThrow();
    expect(() => parseD5Request({ ...base, command: { type: "retry-memory", runRef: { kind: "expedition", id: "m" } } })).toThrow();
    expect(() => parseD5Request({ ...base, command: { type: "battle-command", runRef: { kind: "memory", id: "m" }, command: { type: "roll" } } })).toThrow();
    expect(() => parseD5Request({ ...base, command: { type: "resume-run", runRef: memory } })).toThrow();
    expect(parseD5Request({ ...base, command: { type: "resume-run", runRef: memory } }, true).command.type).toBe("resume-run");
    expect(() => parseD5Request({ ...base, command: { type: "battle-command", runRef: memory, command: { type: "resolve-next-enemy" } } })).toThrow();
    expect(() => parseD5Request({ ...base, command: { type: "growth-claimed", growthId: "growth.elora.lv3" } })).toThrow();
  });
  it("checks rejected receipt invariants and rejects committed receipts without matching proof IDs", async () => {
    const { db } = await initial(), receipt = structuredClone([...db.receipts.values()][0]);
    expect(validateD5Receipt(receipt, d5Catalog)).toEqual(receipt);
    expect(() => validateD5Receipt({ ...receipt, status: "rejected", error: { code: "no", path: "p", message: "bad" } }, d5Catalog)).toThrow();
    expect(() => validateD5Receipt({ ...receipt, after: { ...receipt.after!, revision: 1 } }, d5Catalog)).toThrow();
  });
  it("validates nested terminal content even when a receipt is read without a campaign", async () => {
    const { record, readers } = await earnedRecord(), fact = record.facts[2];
    if (fact.kind !== "progression") throw Error("fixture");
    const receipt: D5Receipt = {
      version: 4, contentRef: d5Catalog.ref, saveId: record.head.saveId, epoch: record.head.epoch,
      requestId: "settled", fingerprint: "0".repeat(64), status: "committed", error: null,
      before: { ...record.head, revision: 1 }, after: { ...record.head, revision: 2 },
      factIds: [fact.id], events: [{ id: fact.id, revision: 2, origin: fact.origin, event: structuredClone(fact.payload) }],
    };
    expect(validateD5Receipt(receipt, d5Catalog, readers)).toEqual(receipt);
    expect(() => validateD5Receipt(receipt, d5Catalog)).toThrow(/reader is not installed/);
    const event = receipt.events[0].event;
    if (event.type !== "expedition-settled") throw Error("fixture");
    event.terminal.totalGold++;
    expect(() => validateD5Receipt(receipt, d5Catalog, readers)).toThrow();
  });
});
