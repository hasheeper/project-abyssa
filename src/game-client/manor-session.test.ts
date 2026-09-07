import { expect, it } from "vitest";
import { manorClientFixture } from "./testing/manor";
import { MANOR_CATALOG } from "../game-runtime/manor-context";
import { manorBattlePlan } from "../game-core/testing/manor-policy";
import { asDemoBattle } from "../game-core/session";
import type { DemoGameRecord } from "../game-application";

it("completes the real manor through normal commands, restores event windows, settles once and starts a clean second run", async () => {
  const f = await manorClientFixture();
  const read = () => f.session.getSnapshot().record as DemoGameRecord;
  const visited = new Set<string>();
  const verifyImport = async (label: string) => {
    const exported = await f.runtime.application.exportSave("manor-save");
    if (!exported.ok) throw new Error(exported.error.message);
    const imported = await f.runtime.application.importSave({protocolVersion: 2, saveId: `copy-${label}`, epoch: `epoch-${label}`, clientRequestId: `import-${label}`, format: "application", archive: exported.archive});
    expect(imported.ok, JSON.stringify(imported)).toBe(true);
    const opened = await f.runtime.application.open(`copy-${label}`);
    if (!opened.ok || opened.record.schemaVersion !== 2) throw new Error("Imported manor required");
    expect(opened.record.snapshot.expedition?.node).toBe(read().snapshot.expedition?.node);
    expect(opened.record.snapshot.campaign.funds).toEqual(read().snapshot.campaign.funds);
    if (opened.record.snapshot.expedition) expect(opened.record.snapshot.expedition.run.id).not.toBe(read().snapshot.expedition!.run.id);
  };
  try {
    for (let n = 0; n < 400; n++) {
      const record = read(),
        e = record.snapshot.expedition!;
      const v = f.runtime.queries.journey(record)!,
        runRef = { kind: "expedition" as const, id: e.run.id };
      visited.add(`${e.node}:${e.run.layer}`);
      if (e.node === "finished") break;
      if (e.node === "event") {
        const head = record.head;
        await f.session.refresh();
        expect(read().head).toEqual(head);
        await verifyImport(`event-${e.run.layer}`);
        await f.session.dispatch({
          type: "choose-event",
          runRef,
          roomId: v.roomId!,
          choiceId: e.run.layer === 1 ? "read" : "attempt",
          actorId: e.run.layer === 1 ? null : "elora",
        });
      } else if (e.node === "room-complete")
        await f.session.dispatch({
          type: "advance-room",
          runRef,
          roomId: v.roomId!,
        });
      else if (e.node === "exit")
        await f.session.dispatch({
          type: "choose-exit",
          runRef,
          roomId: v.roomId!,
          choice: "leave",
        });
      else {
        const supply = v.supplies.find(
          (s) =>
            ["food", "potion", "holy-water"].includes(s.definition.kind) &&
            s.targets.some(
              (t) =>
                t.kind === "member" &&
                (s.definition.kind === "holy-water" ||
                  v.party.find((p) => p.id === t.id)!.hp <= 1),
            ),
        );
        if (supply) {
          const target = supply.targets.find(
            (t) =>
              t.kind === "member" &&
              (supply.definition.kind === "holy-water" ||
                v.party.find((p) => p.id === t.id)!.hp <= 1),
          )!;
          await f.session.dispatch({
            type: "use-item",
            runRef,
            instanceId: supply.instanceId,
            target,
          });
        } else {
          const plan = manorBattlePlan(
            MANOR_CATALOG,
            asDemoBattle(e)!,
            "survival",
          );
          expect(plan.length).toBeGreaterThan(0);
          for (const command of plan)
            await f.session.dispatch({
              type: "battle-command",
              runRef,
              command,
            });
        }
      }
      expect(f.session.getSnapshot().status).toBe("ready");
    }
    const before = read(),
      e = before.snapshot.expedition!;
    expect(e.node).toBe("finished");
    expect(e.result!.outcome).toBe("extracted");
    await verifyImport("terminal");
    expect([...visited]).toEqual(
      expect.arrayContaining([
        "battle:1",
        "event:1",
        "battle:2",
        "event:2",
        "battle:3",
        "exit:3",
      ]),
    );
    const request = {
      protocolVersion: 2,
      saveId: before.head.saveId,
      expectedHead: before.head,
      clientRequestId: "settle-once",
      command: {
        type: "settle-expedition",
        runRef: { kind: "expedition", id: e.run.id },
        terminalRef: e.result!.id,
      },
    };
    const first = await f.runtime.application.dispatch(request),
      replay = await f.runtime.application.dispatch(request);
    expect(first.ok).toBe(true);
    expect(replay.ok).toBe(true);
    if (first.ok && replay.ok) {
      expect(replay.receipt).toEqual(first.receipt);
      expect(replay.replayed).toBe(true);
    }
    await f.session.refresh();
    expect(read().snapshot.campaign.settlements).toHaveLength(1);
    expect(read().snapshot.campaign.funds.party).toBe(e.result!.totalGold);
    await verifyImport("settled");
    await f.session.dispatch({
      type: "start-expedition",
      runId: "second",
      routeId: vRoute(),
      partyIds: MANOR_CATALOG.data.initialParty,
      seed: 20,
      itemIds: [],
    });
    expect(
      read().snapshot.expedition!.run.party.every(
        (m) => m.hp === m.config.maxHp && !m.temporaryRust.length,
      ),
    ).toBe(true);
    expect(read().snapshot.campaign.settlements).toHaveLength(1);
  } finally {
    f.session.dispose();
  }
}, 60000);
const vRoute = () => MANOR_CATALOG.data.journey!.defaultRouteId;
