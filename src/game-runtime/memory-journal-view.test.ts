import { describe, expect, it, vi } from "vitest";
import type { AnyGameRecord, AnyReceipt, D5Command, D5GameRecord } from "../game-application";
import { MemoryGameDatabase, MemoryGameStore } from "../game-infrastructure/storage/memory";
import { createPlayerRuntime } from "./player-runtime";
import { FIRST_MORNING_ENTRIES, morningPages } from "../content/presentation/first-morning";
import { growthStories } from "../content/presentation/growth-stories";
import { directorRuntime, directorPlan, directorOutput } from "../game-application/testing/airp-director-playthrough";
import { formalAirpFixture, formalNodeText, formalRead } from "../game-application/testing/airp-game-fixture";
import { headKey, journalFacts, createJournalBuilder } from "./memory-journal/common";
import { directorJournal, expeditionJournal } from "./memory-journal/generated";
import { poolJournal } from "./memory-journal/generated";
import { tideStory, tideStoryEdition } from "../content/presentation/tide-cave";
import { nextD5PlayCommand } from "../game-application/testing/d5-playthrough";
import { ESTATE_CATALOG, ESTATE_AIRP_CATALOG } from "./estate-context";
import type { MemoryJournalData } from "./memory-journal-types";
import { createMemoryJournalQuery } from "./memory-journal-view";
import { createCatalogRegistry } from "./catalogs";
import { authoredJournal, tutorialJournal } from "./memory-journal/authored";
import { OPENING_MEMORY_TITLES, OPENING_MEMORY_SUMMARIES } from "../content/presentation/opening-memory";

function ready(data: MemoryJournalData) {
  expect(data.status).toBe("ready");
  if (data.status !== "ready") throw Error("Journal unavailable");
  return data;
}
async function fixture(startAt: "first-morning" | "hub" | "prologue" | "tutorial" = "first-morning", contentVersion?: 6 | 27) {
  const database = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>(), store = new MemoryGameStore(database);
  let serial = 0;
  const runtime = createPlayerRuntime(store, { newId: () => `journal:${++serial}`, newSeed: () => 19, close() {} });
  const created = contentVersion ? await runtime.application.create({ protocolVersion: 4, contentVersion, profileId: "profile.demo.first-run", saveId: "journal", epoch: "epoch", clientRequestId: "create" })
    : await runtime.application.createNewGame({ saveId: "journal", epoch: "epoch", clientRequestId: "create", startAt, playerName: "林恩" });
  if (!created.ok) throw Error(created.error.message);
  const raw = () => database.records.get("journal")! as D5GameRecord;
  const send = async (command: D5Command) => {
    const result = await (command.type === "resume-run" ? runtime.application.resumeEnemyTurn : runtime.application.dispatch)({ protocolVersion: 4, saveId: "journal", expectedHead: raw().head, clientRequestId: `send:${++serial}`, command });
    if (!result.ok) throw Error(result.error.message);
    return raw();
  };
  if (contentVersion === 27) await send({type: "select-game-start", startAt, playerName: "林恩"});
  if (contentVersion === 6 && raw().snapshot.campaign.prologue?.status === "playing") await send({ type: "complete-prologue", shotId: raw().snapshot.campaign.prologue!.shotId, choice: "skip" });
  return { database, store, runtime, raw, send, view: () => ready(runtime.queries.memoryJournal(raw())) };
}

describe("memory journal from committed records", () => {
  it("projects acknowledged opening pages and the selected branch, keeps provenance, and never writes", async () => {
    const f = await fixture();
    expect(f.view().entries).toEqual([]);
    const branchStep = FIRST_MORNING_ENTRIES.findIndex(e => e.kind === "branch");
    for (let step = 0; step <= branchStep; step++) await f.send({ type: "advance-opening", step, choice: FIRST_MORNING_ENTRIES[step].kind === "decision" ? "B" : "continue" });
    const before = JSON.stringify(f.raw()), commit = vi.spyOn(f.store, "commit");
    const view = f.view(), blocks = view.entries.flatMap(e => e.blocks);
    const branch = FIRST_MORNING_ENTRIES[branchStep];
    if (branch.kind !== "branch") throw Error("No branch");
    expect(blocks.map(b => b.text)).toContain(morningPages(branch.variants.B)[0].text.replaceAll("{{user}}", "林恩"));
    expect(blocks.map(b => b.text)).not.toContain(morningPages(branch.variants.A)[0].text.replaceAll("{{user}}", "林恩"));
    expect(blocks.every(b => b.source?.factId && b.source.saveId === "journal")).toBe(true);
    expect(view.entries).toHaveLength(1);
    expect(view.entries[0].title).toBe(OPENING_MEMORY_TITLES.departure);
    expect(view.entries[0].iconKeywords).toEqual(["早餐"]);
    expect(view.entries[0].replay).toBe("scene");
    expect(JSON.stringify(view)).not.toContain("{{user}}");
    expect(view.entries[0].summary).toBe(OPENING_MEMORY_SUMMARIES.departure.ongoing);
    expect(view.entries[0].preview).toBe(view.entries[0].summary);
    expect(view.entries[0].narrative!.acts).toHaveLength(1);
    expect(view.entries[0].summary).not.toContain("班车");
    expect(f.runtime.queries.memoryJournal(f.raw())).toBe(view);
    expect(commit).not.toHaveBeenCalled(); expect(JSON.stringify(f.raw())).toBe(before);
  });

  it("records only acknowledged gift lines, pause resumes the same occurrence, and skip does not reveal intervening prose", async () => {
    const f = await fixture("hub", 27), eventId = "event.demo.preparation-gift";
    await f.send({ type: "start-expedition", runId: "gift-run", routeId: "old-manor.first-clear", partyIds: ESTATE_CATALOG.data.initialParty, itemIds: ["item.food", "item.potion"], supplyQuantities: {"item.food": 1, "item.potion": 1}, seed: 19 });
    for (let step = 0; f.raw().snapshot.run && step < 600; step++) {
      const c = nextD5PlayCommand(ESTATE_CATALOG, f.raw());
      await f.send(c.type === "choose-exit" ? { ...c, choice: "leave" } : c);
    }
    const gift = f.runtime.queries.progression(f.raw())!.events.find(e => e.kind === "gift")!;
    await f.send({ type: "begin-story", eventId, basisId: gift.basisId! });
    const sessionId = f.raw().snapshot.campaign.activeStoryId!;
    await f.send({ type: "advance-story", sessionId, step: 0, choice: "continue" });
    const id = f.view().entries[0].id;
    await f.send({ type: "advance-story", sessionId, step: 1, choice: "later" });
    expect(f.view().entries[0].blocks).toHaveLength(1);
    await f.send({ type: "begin-story", eventId, basisId: gift.basisId! });
    await f.send({ type: "advance-story", sessionId, step: 1, choice: "skip" });
    await f.send({ type: "complete-story", sessionId });
    const entry = f.view().entries[0];
    expect(entry.id).toBe(id); expect(entry.blocks).toHaveLength(2);
    expect(entry.blocks[0].text).toBe(growthStories[eventId].lines[0].text.replaceAll("{{user}}", "林恩"));
    expect(entry.blocks[1].text).toBe(growthStories[eventId].lines.at(-1)!.text.replaceAll("{{user}}", "林恩"));
  }, 60000);

  it("distinguishes early unsupported saves and corrupt/unavailable content from a genuinely empty journal", async () => {
    const f = await fixture("prologue");
    expect(f.view()).toEqual({ status: "ready", entries: [] });
    const created = await f.runtime.application.create({ protocolVersion: 1, saveId: "old", epoch: "old", clientRequestId: "old" });
    expect(created.ok).toBe(true);
    expect(f.runtime.queries.memoryJournal(f.database.records.get("old")!)).toMatchObject({ status: "unavailable", reason: "unsupported-version" });
    const bad = structuredClone(f.raw()); bad.contentRef.digest = "0".repeat(64);
    expect(f.runtime.queries.memoryJournal(bad)).toMatchObject({ status: "unavailable", reason: "source-unavailable" });
  });

  it("keeps original entry identities after a real save copy and extends that same occurrence with new reads", async () => {
    const f = await fixture("first-morning", 6);
    await f.send({ type: "advance-opening", step: 0, choice: "continue" }); await f.send({ type: "advance-opening", step: 1, choice: "continue" });
    const original = f.view().entries[0], exported = await f.runtime.application.exportSave("journal");
    if (!exported.ok) throw Error(exported.error.message);
    const copied = await f.runtime.application.importSave({ protocolVersion: 4, saveId: "copy", epoch: "copy-epoch", clientRequestId: "copy", format: "application", archive: exported.archive });
    if (!copied.ok) throw Error(copied.error.message);
    const readCopy = () => f.database.records.get("copy")!;
    expect(ready(f.runtime.queries.memoryJournal(readCopy())).entries).toEqual([original]);
    const next = await f.runtime.application.dispatch({ protocolVersion: 4, saveId: "copy", expectedHead: readCopy().head, clientRequestId: "copy-read", command: { type: "advance-opening", step: 2, choice: "continue" } });
    expect(next.ok).toBe(true);
    const view = ready(f.runtime.queries.memoryJournal(readCopy()));
    expect(view.entries).toHaveLength(1); expect(view.entries[0].id).toBe(original.id);
    expect(view.entries[0].blocks.map(b => b.source?.saveId)).toEqual(["journal", "copy"]);
    expect(f.view().entries[0]).toEqual(original);
  });

  it("does not mix an ancestor's day one into a new cycle", async () => {
    const f = await fixture();
    await f.send({ type: "advance-opening", step: 0, choice: "continue" }); await f.send({ type: "advance-opening", step: 1, choice: "continue" });
    const source = f.raw(), cycle = structuredClone(source);
    cycle.head = { saveId: "new-cycle", epoch: "new-cycle", revision: 0 };
    cycle.originRef = { kind: "cycle", source }; cycle.facts = []; cycle.commits = [];
    // Isolate lineage projection after the registry boundary; cycle eligibility itself
    // is owned by the application and already tested with a complete memory playthrough.
    const registry = createCatalogRegistry([{ version: 4, catalog: ESTATE_AIRP_CATALOG }]);
    const query = createMemoryJournalQuery({ ...registry, read: raw => raw as AnyGameRecord });
    expect(ready(query(source)).entries).toHaveLength(1);
    expect(ready(query(cycle)).entries).toEqual([]);
  });

  it("treats tutorial confirmation as an entire read act, with no text before confirmation", async () => {
    const f = await fixture("tutorial");
    const spec = ESTATE_CATALOG.data.tutorial!;
    await f.send({ type: "start-expedition", runId: "tutorial", routeId: spec.routeId, partyIds: spec.partyIds, itemIds: spec.itemIds, seed: 19 });
    expect(f.view().entries.map(e => e.title)).toEqual([OPENING_MEMORY_TITLES.departure]);
    const current = f.runtime.queries.tutorial(f.raw())!, storyId = current.story!.id;
    await f.send({ type: "tutorial-read", runRef: current.runRef!, storyId, step: current.story!.step, choice: "continue" });
    const scene = tideStory(storyId, tideStoryEdition(f.raw().contentRef.contentVersion));
    expect(f.view().entries[1].blocks.map(b => b.text)).toEqual(scene.lines.filter(l => l.text.trim()).map(l => l.text.replaceAll("{{user}}", "林恩")));
    expect(f.view().entries[1].title).toBe(OPENING_MEMORY_TITLES.return);
    expect(f.view().entries[1].iconKeywords).toEqual(["毛毯"]);
    expect(f.view().entries[1].replay).toBe("scene");
    expect(f.view().entries[1].summary).toBe(OPENING_MEMORY_SUMMARIES.return.ongoing);
    expect(f.view().entries[1].summary).not.toContain("交还");
  });

  it("keeps the entire opening and tutorial in two episodes across sections, clock changes and retries", async () => {
    const f = await fixture(), owner = { record: f.raw(), catalog: ESTATE_CATALOG }, base = f.raw().facts[0];
    const morning = FIRST_MORNING_ENTRIES.map((line, step) => ({ ...owner, sequence: step,
      fact: { ...base, id: `morning:${step}`, worldTime: { day: 1, phase: "dawn" as const }, kind: "progression" as const,
        payload: { type: "opening-advanced" as const, step, choice: line.kind === "decision" ? "B" as const : "continue" as const } } }));
    const storyIds = Object.keys(ESTATE_CATALOG.data.tutorial!.stories);
    const tide = storyIds.map((storyId, index) => ({ ...owner, sequence: 500 + index,
      fact: { ...base, id: `tutorial:${storyId}`, worldTime: { day: index < 2 ? 1 : 2, phase: index < 2 ? "dawn" as const : "day" as const }, kind: "journey" as const,
        payload: { version: 1 as const, runRef: { kind: "expedition" as const, id: "tutorial" }, operation: { type: "tutorial-read" as const, storyId, step: 0, choice: ESTATE_CATALOG.data.tutorial!.stories[storyId].choiceStep === 0 ? "A" as const : "continue" as const }, events: [], retracts: [], beforeDigest: "before", afterDigest: "after" } } }));
    const out = createJournalBuilder("journey");
    authoredJournal(morning, out);
    tutorialJournal(tide, out);
    const entries = out.entries();
    expect(entries.map(e => e.title)).toEqual([OPENING_MEMORY_TITLES.departure, OPENING_MEMORY_TITLES.return]);
    expect(entries.map(e => e.iconKeywords)).toEqual([["早餐"], ["毛毯"]]);
    expect(entries.every(e => e.day === 1 && e.phase === "清晨" && e.replay === "scene")).toBe(true);
    expect(entries.map(e => e.summary)).toEqual([OPENING_MEMORY_SUMMARIES.departure.complete, OPENING_MEMORY_SUMMARIES.return.complete]);
    expect(new Set(entries[1].blocks.map(b => b.source?.sceneId)).size).toBe(storyIds.length);
    const last = tideStory(storyIds.at(-1)!, "final").lines.at(-1)!;
    expect(entries[1].blocks.map(b => b.text)).toContain(last.text.replaceAll("{{user}}", "林恩"));
    expect(entries[1].blocks.at(-1)?.stage?.background).toEqual({ kind: "asset", url: tideStory(storyIds.at(-1)!, "final").background });
    const retry = { ...tide[0], sequence: 600, fact: { ...tide[0].fact, id: "retry", payload: { ...tide[0].fact.payload, operation: { type: "tutorial-retry" as const, attempt: 1, scope: "encounter" as const } } } };
    const replayed = { ...tide[0], sequence: 601, fact: { ...tide[0].fact, id: "read-again" } };
    const retried = createJournalBuilder("journey");
    authoredJournal(morning, retried); tutorialJournal([...tide, retry, replayed], retried);
    expect(retried.entries()).toHaveLength(2);
    expect(retried.entries()[1].blocks.at(-1)?.source?.sceneId).toBe(`tutorial:2:${storyIds[0]}`);
  });

  it("preserves only the selected frozen Pool branch and separates undated receipts", async () => {
    const f = await fixture(), record = structuredClone(f.raw());
    const base = record.facts[0];
    const scene = { id: "pool-scene", instanceId: "pool-event", role: "offer", body: { title: "真实旧对话", nodes: [
      { id: "choice", kind: "choice", options: [{ id: "A", label: "离开" }, { id: "B", label: "留下" }] },
      { id: "reply", kind: "branch", choiceId: "choice", variants: { A: [{ kind: "narration", text: "未选择的分支" }], B: [{ kind: "narration", text: "选择后的原文" }] } },
      { id: "future", kind: "beat", frames: [{ kind: "narration", text: "尚未阅读" }] },
    ] } };
    // Adapter contract tests use partial persisted sources; the public query separately validates full saves.
    record.narrative = { version: 2, scenes: [scene] } as unknown as NonNullable<D5GameRecord["narrative"]>;
    const owner = { record, catalog: ESTATE_CATALOG }, out = createJournalBuilder("journey");
    poolJournal([owner], [
      { ...owner, sequence: 1, fact: { ...base, kind: "airp", payload: { version: 2, command: { type: "airp-accept", instanceId: "pool-event", sceneId: "pool-scene", nodeId: "choice", optionId: "B" } } } },
      { ...owner, sequence: 2, fact: { ...base, id: "read", worldTime: { day: NaN, phase: "dawn" }, kind: "airp", payload: { version: 2, command: { type: "airp-read", instanceId: "pool-event", sceneId: "pool-scene", nodeId: "reply" } } } },
    ], out);
    expect(out.entries().map(e => e.day)).toEqual([1, null]);
    expect(out.entries().flatMap(e => e.blocks.map(b => b.text))).toEqual(["留下", "选择后的原文"]);
  });

  it("filters retracted, foreign, future and uncommitted facts before projecting any text", async () => {
    const f = await fixture(); await f.send({ type: "advance-opening", step: 0, choice: "continue" });
    const record = structuredClone(f.raw()), good = record.facts.at(-1)!;
    record.facts.push({ ...good, id: "foreign", source: { ...good.source, saveId: "foreign" } }, { ...good, id: "uncommitted" }, { ...good, id: "future", source: { ...good.source, revision: 999 } });
    expect(journalFacts([{ record, catalog: ESTATE_CATALOG }]).map(f => f.fact.id)).toContain(good.id);
    record.retractedFactIds.push(good.id);
    for (const id of [good.id, "foreign", "uncommitted", "future"]) expect(journalFacts([{ record, catalog: ESTATE_CATALOG }]).map(f => f.fact.id)).not.toContain(id);
  });

  it("keeps generated Director scenes private until read and groups dialogue plus real choices without GM material", async () => {
    const f = await directorRuntime();
    await directorPlan(f, { kind: "fixed", definitionId: "ripple.elora.old-medicine-case" });
    await f.send({ type: "advance-phase" }); await f.send({ type: "advance-phase" });
    const eventId = (await f.read()).airpDirector!.events[0].id;
    await f.send({ type: "airp-director-open", eventId });
    let job = (await f.read()).airpDirector!.jobs.at(-1)!;
    job = await directorOutput(f, job, "planning", "第一段：当前场景。第二段：当前互动。第三段：等待选择。");
    job = await directorOutput(f, job, "writing", "<planning>GM-SECRET</planning><prose>旁白：已读原文。\n\n艾洛拉：「どうぞ。（下一句。）」</prose>");
    job = await directorOutput(f, job, "formatting", JSON.stringify({ creationRecord: "GM-SECRET", lines: [{ speaker: "narrator", emotion: "neutral", text: "已读原文。" }, { speaker: "elora", emotion: "neutral", text: "「どうぞ。（下一句。）」" }] }));
    expect(ready(f.runtime.queries.memoryJournal(await f.read())).entries).toEqual([]);
    await f.send({ type: "airp-director-show", jobId: job.id });
    expect(ready(f.runtime.queries.memoryJournal(await f.read())).entries).toEqual([]);
    await f.send({ type: "airp-director-read", jobId: job.id, cursor: 0 });
    let view = ready(f.runtime.queries.memoryJournal(await f.read()));
    expect(view.entries[0].preview).toBe(`小广场里围绕「${job.scene!.card.title}」的交谈。`); expect(JSON.stringify(view)).not.toMatch(/GM-SECRET|下一句/);
    await f.send({ type: "airp-director-read", jobId: job.id, cursor: 1 });
    const event = (await f.read()).airpDirector!.events[0], choice = event.card.choices[0];
    await f.send({ type: "airp-director-choose", eventId, choiceId: choice.id });
    view = ready(f.runtime.queries.memoryJournal(await f.read()));
    expect(view.entries).toHaveLength(1);
    expect(view.entries[0].blocks.map(b => b.text)).toEqual(["已读原文。", "「どうぞ。（下一句。）」", choice.label]);
    expect(view.issues).toBeUndefined();
    const continuation = structuredClone(job); continuation.id = "continued-job"; continuation.scene!.sceneId = continuation.id;
    continuation.text!.lines = [{ speaker: "narrator", emotion: "neutral", text: "另一次生成的续写。" }];
    const original = await f.read(), ownerForContinuation = { record: original, catalog: ESTATE_CATALOG };
    const firstRead = journalFacts([ownerForContinuation]).find(i => i.fact.kind === "airp-director" && i.fact.payload.command.type === "airp-director-read")!;
    const nextRead = structuredClone(firstRead);
    if (nextRead.fact.kind !== "airp-director") throw Error("Missing read");
    nextRead.fact.id = "continued-read"; nextRead.fact.payload.command = { type: "airp-director-read", jobId: continuation.id, cursor: 0 };
    nextRead.fact.worldTime = { day: 2, phase: "day" }; nextRead.sequence++;
    const continued = structuredClone(original); continued.airpDirector!.jobs.push(continuation);
    const oneEvent = createJournalBuilder("journey");
    directorJournal([{ ...ownerForContinuation, record: continued }], [firstRead, nextRead], oneEvent);
    const entries = oneEvent.entries();
    expect(entries).toHaveLength(1); expect(entries[0].narrative!.acts).toHaveLength(1);
    expect(entries[0].narrative!.acts[0].slices).toHaveLength(1);
    expect(entries[0].blocks.map(b => b.source?.sceneId)).toEqual([job.id, continuation.id]);
    expect(entries[0].narrative!.acts[0].replay).toBe("scene");
    expect(entries[0].recordedDays).toEqual([1, 2]);
    const cast = structuredClone(continued);
    cast.airpDirector!.jobs[cast.airpDirector!.jobs.length - 1].scene!.actorIds = ["abyssa", "marietta"];
    const castOut = createJournalBuilder("journey");
    directorJournal([{ record: cast, catalog: ESTATE_CATALOG }], [firstRead, nextRead], castOut);
    expect(castOut.entries()[0].actors).toEqual(expect.arrayContaining(["艾比希斯", "玛丽埃塔"]));
    expect(castOut.entries()[0].narrative!.participants).toEqual(expect.arrayContaining(["abyssa", "marietta"]));
    // A new event instance remains distinct even when its title and text match.
    const raw = await f.read(), owner = { record: raw, catalog: ESTATE_CATALOG };
    const read = journalFacts([owner]).find(i => i.fact.kind === "airp-director" && i.fact.payload.command.type === "airp-director-read")!;
    const other = structuredClone(raw); const copied = structuredClone(job);
    copied.id = "second-occurrence"; copied.scene!.eventId = "another-event"; copied.scene!.sceneId = copied.id;
    other.airpDirector!.jobs.push(copied);
    const second = structuredClone(read);
    if (second.fact.kind !== "airp-director") throw Error("No read");
    second.fact.payload.command = { type: "airp-director-read", jobId: copied.id, cursor: 0 };
    second.fact.id = "second-read"; second.fact.worldTime = { day: 2, phase: "dawn" }; second.sequence++;
    const out = createJournalBuilder("journey"); directorJournal([{ ...owner, record: other }], [read, second], out);
    expect(out.entries()).toHaveLength(2); expect(new Set(out.entries().map(e => e.id)).size).toBe(2);
  }, 30000);

  it("reads the expedition node ledger only with matching committed observation heads", async () => {
    const f = await formalAirpFixture("old-manor.maintenance", 28); const planId = await f.prepare(); const permit = await f.flow.gm.departurePermit(planId); await f.send({ type: "start-expedition", ...permit.departure }); await f.flow.sync();
    const state = await f.flow.nodes.read(), id = state.ledger.jobs[0].id;
    await formalNodeText(f, id);
    expect(ready(f.runtime.queries.memoryJournal(f.raw())).entries).toEqual([]);
    await f.flow.nodes.readLine(id, 0);
    const view = ready(f.runtime.queries.memoryJournal(f.raw()));
    expect(view.entries).toHaveLength(1); expect(view.entries[0].blocks).toHaveLength(1);
    expect(view.entries[0].blocks[0].source?.kind).toBe("expedition");
    expect(view.issues).toBeUndefined();
    const partial = view.entries[0], act = partial.narrative!.acts[0];
    expect(act).toMatchObject({ coverage: "partial", replay: "scene" });
    expect(act.slices.flatMap(slice => slice.steps.flatMap(step => step.kind === "content" ? step.frames : []))).toHaveLength(1);
    const beforeRetry = f.raw();
    await f.flow.nodes.readLine(id, 0);
    expect(f.raw()).toEqual(beforeRetry);
    expect(ready(f.runtime.queries.memoryJournal(f.raw()))).toEqual(view);
    await formalRead(f, id);
    const complete = ready(f.runtime.queries.memoryJournal(f.raw())).entries[0];
    expect(complete.id).toBe(partial.id);
    expect(complete.narrative!.acts[0].coverage).toBe("complete");
    const fullRecord = f.raw(), beforeReplay = JSON.stringify(fullRecord);
    expect(complete.replay).toBe("scene");
    expect(JSON.stringify(f.raw())).toBe(beforeReplay);
    const archive = await f.runtime.application.exportSave(fullRecord.head.saveId);
    if (!archive.ok) throw Error("export failed");
    const db = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>();
    const restored = createPlayerRuntime(new MemoryGameStore(db), { newId: () => "restored", newSeed: () => 19, close() {} });
    expect(await restored.application.restoreSave({ archive: archive.archive, clientRequestId: "restore-journal" })).toMatchObject({ ok: true });
    expect(ready(restored.queries.memoryJournal(db.records.get(fullRecord.head.saveId)!)).entries[0]).toEqual(complete);
    // Projection must stop at a missing acknowledgement, even if later reads and
    // a selected attitude remain in the ledger. Never publish the disconnected tail.
    const owner = { record: fullRecord, catalog: ESTATE_AIRP_CATALOG };
    const facts = journalFacts([owner]);
    const interrupted = createJournalBuilder("test-prefix");
    const firstHead = fullRecord.airpGame!.nodes[planId].jobs[0].reads[0];
    expeditionJournal([owner], facts.filter(fact => headKey(fact.fact.source) !== headKey(firstHead)), interrupted);
    expect(interrupted.entries()).toEqual([]);
    // A second node of the same excursion extends the event with a new act.
    const later = structuredClone(fullRecord), next = structuredClone(later.airpGame!.nodes[planId].jobs[0]);
    next.id = "later-node"; next.node.id = "later"; next.node.slotId = "slot:1:0:cleared";
    next.reads = [next.selected!.head]; next.selected = null;
    later.airpGame!.nodes[planId].jobs.push(next);
    const multiple = createJournalBuilder("test-acts");
    expeditionJournal([{ record: later, catalog: ESTATE_AIRP_CATALOG }], facts, multiple);
    expect(multiple.entries()).toHaveLength(1);
    expect(multiple.entries()[0].narrative!.acts).toHaveLength(2);
    expect(multiple.entries()[0].narrative!.acts.every(act => act.replay === "scene")).toBe(true);
  }, 30000);
});
