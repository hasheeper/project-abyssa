import {
  MemoryGameDatabase,
  MemoryGameStore,
} from "../../game-infrastructure/storage/memory";
import type {
  AnyGameRecord,
  AnyReceipt,
  DemoCommand,
} from "../../game-application";
import { createVersionedGameRuntime } from "../versioned-runtime";
import { LEGACY_VALIDATED_CATALOG } from "../legacy-context";
import { demoFixture } from "./demo-fixtures";

export async function archiveFixture(
  options: {
    level?: 1 | 2 | 3;
    equipment?: boolean;
    locked?: boolean;
    adventure?: boolean;
    run?: boolean;
  } = {},
) {
  const level = options.level ?? 1;
  const catalog = demoFixture((c) => {
    if (options.adventure) c.catalogId = "abyssa.test.archive-adventure";
    const profile = c.profiles[`test.lv${level}`];
    if (options.locked) profile.availableCharacterIds = c.initialParty;
    if (options.equipment)
      profile.progress.equipment = [
        {
          instanceId: "test.blade",
          definitionId: "equipment.spare-blade",
          ownerId: "kororo",
        },
      ];
  });
  const db = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>(),
    store = new MemoryGameStore(db);
  const runtime = createVersionedGameRuntime(store, [
    { version: 1, catalog: LEGACY_VALIDATED_CATALOG },
    { version: 2, catalog },
  ]);
  const created = await runtime.create({
    contentRef: catalog.ref,
    request: {
      protocolVersion: 2,
      saveId: "demo",
      epoch: "demo-epoch",
      clientRequestId: "create",
      profileId: `test.lv${level}`,
    },
  });
  if (!created.ok) throw new Error(created.error.message);
  const open = async () => {
    const r = await runtime.open("demo");
    if (!r.ok || r.record.schemaVersion !== 2) throw new Error("open failed");
    return r.record;
  };
  const command = async (command: DemoCommand) => {
    const r = await open();
    const request = {
      protocolVersion: 2,
      saveId: "demo",
      expectedHead: r.head,
      clientRequestId: `request-${r.head.revision}`,
      command,
    };
    const result =
      command.type === "resume-run"
        ? await runtime.resume(request)
        : await runtime.dispatch(request);
    if (!result.ok) throw new Error(JSON.stringify(result));
    return open();
  };
  if (options.run)
    await command({
      type: "start-expedition",
      runId: "run",
      routeId: "test.route",
      partyIds: catalog.data.initialParty,
      seed: 42,
    });
  return {
    db,
    store,
    runtime,
    catalog,
    open,
    command,
    reader: {
      open: runtime.open,
      queries: runtime.queries,
      exportDiagnostic: runtime.exportDiagnostic,
      close() {},
    },
  };
}
