/** Playwright-only harness. No production HTML or runtime registers this Catalog. */
import { createRoot, type Root } from "react-dom/client";
import { CharacterPage } from "../App";
import {
  ReadGameProvider,
  ReadGameGate,
} from "../../../game-client/read-react";
import type { DemoCommand } from "../../../game-application";
import { observeCommits } from "../../../game-client/observe-commits";

import {
  runtime,
  factory,
  catalog,
} from "../../../game-runtime/testing/archive-browser";

let root: Root | undefined;
let currentId = "";
export async function inspect() {
  const r = await runtime.open(currentId);
  if (!r.ok || r.record.schemaVersion !== 2) throw new Error(JSON.stringify(r));
  return { record: r.record, view: runtime.queries.archive(r.record) };
}
export async function mount(level: 1 | 2 | 3) {
  currentId = `level-${level}`;
  const existing = await runtime.open(currentId);
  if (!existing.ok) {
    const created = await runtime.create({
      contentRef: catalog.ref,
      request: {
        protocolVersion: 2,
        saveId: currentId,
        epoch: currentId,
        clientRequestId: "create",
        profileId: `test.lv${level}`,
      },
    });
    if (!created.ok) throw new Error(JSON.stringify(created));
  }
  window.history.replaceState(
    null,
    "",
    `/d2-test.html?save=${currentId}&epoch=${currentId}`,
  );
  root?.unmount();
  root = createRoot(document.getElementById("root")!);
  root.render(
    <ReadGameProvider factory={factory}>
      <ReadGameGate>
        <CharacterPage />
      </ReadGameGate>
    </ReadGameProvider>,
  );
  return inspect();
}
export async function command(command: DemoCommand) {
  const { record } = await inspect();
  const request = {
    protocolVersion: 2,
    saveId: currentId,
    expectedHead: record.head,
    clientRequestId: `request-${record.head.revision}`,
    command,
  };
  const r =
    command.type === "resume-run"
      ? await runtime.resume(request)
      : await runtime.dispatch(request);
  if (!r.ok) throw new Error(JSON.stringify(r));
  const next = await inspect();
  const observer = observeCommits(
    { saveId: currentId, epoch: currentId },
    async () => {},
  );
  observer.notify(next.record.head);
  observer.close();
  return next;
}
export async function rustParty() {
  const runRef = { kind: "expedition" as const, id: "run" };
  await command({
    type: "start-expedition",
    runId: "run",
    routeId: "test.route",
    partyIds: catalog.data.initialParty,
    seed: 42,
  });
  for (let n = 0; n < 5; n++) {
    await command({
      type: "battle-command",
      runRef,
      command: { type: "roll" },
    });
    await command({
      type: "battle-command",
      runRef,
      command: { type: "end-turn" },
    });
    let next = await inspect();
    while (next.record.snapshot.expedition!.encounter!.phase === "enemy") {
      const e = next.record.snapshot.expedition!.encounter!;
      next = await command(
        e.cursor < e.enemyOrder.length
          ? { type: "resume-run", runRef }
          : { type: "battle-command", runRef, command: { type: "next-round" } },
      );
    }
    if (
      next.record.snapshot.expedition!.run.party.some((p) => p.temporaryRust.length)
    )
      return next;
  }
  throw new Error("Expected rust after real enemy commands");
}
