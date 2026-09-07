import { DEMO_FIXTURE } from "../../game-runtime/testing/demo-fixtures";
import { LEGACY_VALIDATED_CATALOG } from "../../game-runtime/legacy-context";
import { createVersionedGameRuntime } from "../../game-runtime/versioned-runtime";
import type {
  VersionedGameStore,
  DemoGameRecord,
  DemoCommand,
} from "../versions/demo-contracts";
import { ensure } from "./helpers";

export const versionedApp = (store: VersionedGameStore) =>
  createVersionedGameRuntime(store, [
    { version: 1, catalog: LEGACY_VALIDATED_CATALOG },
    { version: 2, catalog: DEMO_FIXTURE },
  ]);
export const demoCreation = (saveId = "demo", epoch = "epoch-demo") => ({
  contentRef: DEMO_FIXTURE.ref,
  request: {
    protocolVersion: 2,
    saveId,
    epoch,
    clientRequestId: "create",
    profileId: "test.lv3",
  },
});
export const demoStart = {
  type: "start-expedition" as const,
  runId: "kael",
  routeId: "test.route",
  partyIds: DEMO_FIXTURE.data.initialParty,
  seed: 42,
};
export async function demoOpened(
  app: ReturnType<typeof versionedApp>,
  saveId = "demo",
): Promise<DemoGameRecord> {
  const result = await app.open(saveId);
  ensure(result.ok, JSON.stringify(result));
  ensure(result.record.schemaVersion === 2, "expected demo");
  return result.record;
}
export const demoRequest = (
  r: DemoGameRecord,
  command: DemoCommand,
  id = `cmd-${r.head.revision + 1}`,
) => ({
  protocolVersion: 2,
  saveId: r.head.saveId,
  expectedHead: r.head,
  clientRequestId: id,
  command,
});

/** Shared real application contract for memory and native IndexedDB. */
export async function runDemoStoreContract(
  first: VersionedGameStore,
  second: VersionedGameStore,
) {
  const a = versionedApp(first),
    b = versionedApp(second);
  ensure((await a.create(demoCreation())).ok, "demo create");
  ensure(
    (
      await a.create({
        contentRef: LEGACY_VALIDATED_CATALOG.ref,
        request: {
          protocolVersion: 1,
          saveId: "legacy",
          epoch: "legacy-epoch",
          clientRequestId: "create",
        },
      })
    ).ok,
    "legacy create",
  );
  const initial = await demoOpened(a),
    request = demoRequest(initial, demoStart, "start");
  const race = await Promise.all([
    a.dispatch(request),
    b.dispatch({ ...request, clientRequestId: "start-b" }),
  ]);
  ensure(race.filter((r) => r.ok).length === 1, "CAS chooses one writer");
  const winner = race[0].ok
    ? request
    : { ...request, clientRequestId: "start-b" };
  const replay = await b.dispatch(winner);
  ensure(replay.ok && replay.replayed, "retry receipt");
  const before = await demoOpened(a),
    runRef = before.snapshot.campaign.activeRunRef!;
  const invalid = demoRequest(
    before,
    { type: "battle-command", runRef, command: { type: "next-round" } },
    "invalid",
  );
  ensure(!(await a.dispatch(invalid)).ok, "reject wrong phase");
  ensure(
    JSON.stringify(await demoOpened(b)) === JSON.stringify(before),
    "reject changes no state",
  );
  async function send(command: DemoCommand) {
    const r = await a.dispatch(demoRequest(await demoOpened(a), command));
    ensure(r.ok, JSON.stringify(r));
  }
  await send({ type: "battle-command", runRef, command: { type: "roll" } });
  let current = await demoOpened(a);
  // Toggle each valid die so that queries expose all legal choices.
  for (const die of current.snapshot.expedition!.encounter!.dice)
    if (!die.sealed && die.faceIndex !== null)
      await send({
        type: "battle-command",
        runRef,
        command: { type: "toggle-load", actorId: die.ownerId },
      });
  current = await demoOpened(a);
  const view = a.queries.battle(current);
  ensure(view?.version === 2, "demo query");
  const actor = view.party.find((m) =>
    m.actions.options.some((o) => o.choice === "attack"),
  );
  ensure(
    actor,
    `fixture has an attack: ${JSON.stringify(view.party.map((m) => ({ id: m.id, face: m.face, actions: m.actions })))}`,
  );
  const target = actor.actions.options.find((o) => o.choice === "attack")!;
  const checkpoint = current.snapshot.expedition!,
    firstFacts = current.facts.length;
  await send({
    type: "battle-command",
    runRef,
    command: {
      type: "act",
      actorId: actor.id,
      choice: "attack",
      targetId: target.targetId,
    },
  });
  current = await demoOpened(a);
  ensure(current.facts.length > firstFacts, "actual committed damage fact");
  // Export with an active undo checkpoint. Run ID intentionally equals character ID to catch broad string rewriting.
  const exported = await a.exportSave("demo");
  ensure(exported.ok, "export");
  const imported = await b.importSave({
    contentRef: DEMO_FIXTURE.ref,
    request: {
      protocolVersion: 2,
      saveId: "copy",
      epoch: "copy-epoch",
      clientRequestId: "copy",
      archive: exported.archive,
    },
  });
  ensure(imported.ok, JSON.stringify(imported));
  const copy = await demoOpened(b, "copy");
  ensure(copy.snapshot.expedition!.run.id !== runRef.id, "run rebased");
  ensure(
    copy.snapshot.expedition!.run.party[0].id === "kael",
    "definition IDs unchanged",
  );
  ensure(
    copy.facts.every((f) => f.origin === "simulation"),
    "semantic origin retained",
  );
  ensure(
    copy.facts
      .filter((f) => f.kind !== "save-imported")
      .every((f) => f.originRef !== null),
    "import provenance retained",
  );
  const undoneCopy = await b.dispatch(
    demoRequest(copy, {
      type: "undo",
      runRef: copy.snapshot.campaign.activeRunRef!,
    }),
  );
  ensure(undoneCopy.ok, JSON.stringify(undoneCopy));
  await send({ type: "undo", runRef });
  current = await demoOpened(a);
  ensure(
    JSON.stringify(current.snapshot.expedition!.run.rng) ===
      JSON.stringify(checkpoint.run.rng),
    "undo RNG",
  );
  ensure(
    JSON.stringify(current.snapshot.expedition!.encounter) ===
      JSON.stringify(checkpoint.encounter),
    "undo encounter",
  );
  ensure(current.retractedFactIds.length > 0, "undo retracts facts");
  await send({ type: "battle-command", runRef, command: { type: "end-turn" } });
  current = await demoOpened(b);
  const rngAfterClose = JSON.stringify(current.snapshot.expedition!.run.rng);
  const pending = a.queries.continuation(current);
  ensure(pending?.command.type === "resume-run", "versioned continuation");
  const resumed = await a.resume(pending);
  ensure(resumed.ok, JSON.stringify(resumed));
  const saved = await demoOpened(b),
    retried = await b.resume(pending);
  ensure(retried.ok && retried.replayed, "resume idempotent");
  ensure(
    JSON.stringify(await demoOpened(a)) === JSON.stringify(saved),
    "replay changed no RNG/state",
  );
  const list = await a.list();
  ensure(
    list.ok &&
      list.saves.length === 3 &&
      list.saves.every((r) => r.status === "ready"),
    "mixed list",
  );
  const legacy = await a.open("legacy");
  ensure(legacy.ok, "legacy readable");
  ensure(
    a.queries.character(legacy.record, "kael").version === 1 &&
      a.queries.character(saved, "kael").version === 2 &&
      a.queries.character(legacy.record, "kael").version === 1,
    "no global current catalog",
  );
  return {
    revision: saved.head.revision,
    factCount: saved.facts.length,
    cursor: saved.snapshot.expedition!.encounter!.cursor,
    rngAfterClose,
    saveCount: list.saves.length,
  };
}
