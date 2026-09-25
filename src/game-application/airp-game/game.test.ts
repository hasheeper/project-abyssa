import { describe, expect, it } from "vitest";
import { formalAirpFixture, formalNodeText, formalRead, formalSettle } from "../testing/airp-game-fixture";
import { AIRP_GAME_CATALOG } from "../../game-runtime/airp-game-context";
import { ORDINARY_DROPS_CATALOG } from "../../game-runtime/ordinary-drops-context";
import { nextD5PlayCommand } from "../testing/d5-playthrough";
import { airpGameView } from "../../game-runtime/airp-game-runtime";
import { readD5Archive } from "../versions/d5-validate";
import { D5_RUN_READERS } from "../../game-core/session";
import { projectGameNode } from "./projection";

describe("formal content22 owning-save wiring", () => {
  it("uses the real player runtime and unchanged ordinary drops, then plans before departure", async () => {
    const f = await formalAirpFixture();
    expect(f.raw().contentRef.contentVersion).toBe(22);
    expect(AIRP_GAME_CATALOG.data.loot).toEqual(ORDINARY_DROPS_CATALOG.data.loot);
    expect(AIRP_GAME_CATALOG.data.expeditions).toEqual(ORDINARY_DROPS_CATALOG.data.expeditions);
    await expect(f.send({ type: "start-expedition", ...f.departure })).rejects.toThrow(/安排/);
    const id = await f.prepare(), ticket = await f.flow.gm.departurePermit(id);
    await f.send({ type: "start-expedition", ...ticket.departure }); await f.flow.sync();
    expect(f.raw().snapshot.run?.id).toBe(f.departure.runId);
    expect(f.raw().airpGame!.gm.jobs[0].status).toBe("started");
    expect(f.raw().airpGame!.nodes[id].jobs).toHaveLength(2);
    expect((await f.runtime.application.open("formal-airp")).ok).toBe(true);
  });
  it.each(["old-manor.maintenance", "tide-reef.ordinary"])("reads, settles and really plays %s with unchanged drops and restore", async route => {
    const f = await formalAirpFixture(route), id = await f.prepare(route === "tide-reef.ordinary"), ticket = await f.flow.gm.departurePermit(id);
    const originalLoot = f.raw().snapshot.campaign.loot!.length;
    await f.send({ type: "start-expedition", ...ticket.departure }); await f.flow.sync();
    const entry = airpGameView(f.raw())!.node!.id;
    expect(f.runtime.queries.continuation(f.raw())).toBeNull();
    await expect(f.send(nextD5PlayCommand(AIRP_GAME_CATALOG, f.raw()))).rejects.toThrow();
    await formalNodeText(f, entry);
    await expect(f.flow.nodes.choose(entry, 0)).rejects.toThrow(/fully read/);
    const originalRun = f.raw().snapshot.run;
    await formalRead(f, entry); expect(f.raw().snapshot.run).toEqual(originalRun);
    const task = await formalSettle(f, entry);
    const saved = f.raw();
    expect(saved.airpGame!.settlement.memories[0].points[0]).toMatchObject({ kind: "record", claims: [{ speakerId: "elora" }] });
    await f.flow.settlement.apply(task); await f.flow.nodes.complete(entry); await f.flow.sync();
    expect(f.raw()).toEqual(saved);
    let sawSecond = false, awarded = 0;
    for (let step = 0; step < 600 && f.raw().snapshot.run; step++) {
      if (step % 8 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      const view = airpGameView(f.raw());
      if (view?.node) {
        expect(view.node.id).not.toBe(entry); sawSecond = true;
        if (!view.node.selected) {
          await formalNodeText(f, view.node.id);
          const frame = (await f.flow.nodes.read()).ledger.jobs.find(j => j.id === view.node!.id)!.frame!;
          expect(frame.scene.userInput).toContain("谨慎确认情况");
          expect(frame.scene.scenario).toContain("队伍抵达当前地点");
          const beforeChoice = f.raw().snapshot.run;
          await formalRead(f, view.node.id); expect(f.raw().snapshot.run).toEqual(beforeChoice);
        }
        if (airpGameView(f.raw())?.boundary) await formalSettle(f, view.node.id);
        else await expect(f.flow.nodes.settlementInput(view.node.id)).rejects.toThrow(/awaits/);
      }
      const r = f.raw(), run = r.snapshot.run;
      if (run?.kind === "expedition" && run.state.node === "finished") awarded = run.state.result.returnedLoot?.length ?? 0;
      const source = JSON.parse(projectGameNode(r, AIRP_GAME_CATALOG).program.sources[0].text);
      for (const item of source.actualLoot) expect(item).not.toHaveProperty("definitionId");
      const command = nextD5PlayCommand(AIRP_GAME_CATALOG, r);
      await f.send(command.type === "choose-exit" ? { ...command, choice: "leave" } : command); await f.flow.sync();
    }
    expect(sawSecond).toBe(true); expect(f.raw().snapshot.run).toBeNull();
    expect(f.raw().snapshot.campaign.loot).toHaveLength(originalLoot + awarded);
    const exported = await f.runtime.application.exportSave("formal-airp"); if (!exported.ok) throw Error("Export failed");
    expect(readD5Archive(exported.archive, AIRP_GAME_CATALOG, D5_RUN_READERS)).toEqual(f.raw());
    const memories = structuredClone(f.raw().airpGame!.settlement.memories);
    f.departure.runId = "formal-run:2";
    const nextId = await f.prepare(); expect(nextId).not.toBe(id);
    const nextTicket = await f.flow.gm.departurePermit(nextId);
    await f.send({ type: "start-expedition", ...nextTicket.departure }); await f.flow.sync();
    expect(Object.keys(f.raw().airpGame!.nodes)).toHaveLength(2);
    expect(f.raw().airpGame!.settlement.memories).toEqual(memories);
    expect((await f.runtime.application.open("formal-airp")).ok).toBe(true);
  }, 120_000);
});
