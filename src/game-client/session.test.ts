import { describe, it, expect, vi } from "vitest";
import { clientFixture } from "./testing/helpers";
import { GameSession } from "./session";
import { battleState } from "../game-runtime/views";
import { terminal } from "../game-application/testing/helpers";

describe("persisted game client", () => {
  it("uses persisted random streams rather than Math.random for a command", async () => {
    const f = await clientFixture(); const random = vi.spyOn(Math, "random");
    try {
      await f.session.dispatch({ type: "battle-command", expeditionId: "run", command: { type: "roll-dice" } });
      expect(random).not.toHaveBeenCalled();
    } finally { random.mockRestore(); f.session.dispose(); }
  });
  it("serializes double clicks and only returns committed, matching snapshots", async () => {
    const f = await clientFixture();
    const command = { type: "battle-command" as const, expeditionId: "run", command: { type: "roll-dice" as const } };
    const first = f.session.dispatch(command), second = f.session.dispatch(command);
    expect(second).toBe(first);
    const batch = await first;
    expect(batch?.receipts).toHaveLength(1); expect(batch?.presentable).toBe(true);
    expect(f.session.getSnapshot().record?.head.revision).toBe(2); expect(f.values.size).toBe(0);
    f.session.dispose();
  });
  it("end-turn persists the complete batch and next-round before presentation", async () => {
    const f = await clientFixture();
    await f.session.dispatch({ type: "battle-command", expeditionId: "run", command: { type: "roll-dice" } });
    const batch = await f.session.dispatch({ type: "battle-command", expeditionId: "run", command: { type: "end-turn" } });
    expect(batch?.receipts).toHaveLength(2);
    expect(batch?.receipts[0].events.filter(e => "type" in e && e.type === "enemy-intent-resolved")).toHaveLength(2);
    expect(battleState(f.session.getSnapshot().record!).mode.type).toBe("awaiting-roll");
    f.session.dispose();
  });
  it("recovers a lost response by replaying the same request after recreation", async () => {
    const f = await clientFixture();
    const dispatch = f.runtime.application.dispatch;
    vi.spyOn(f.runtime.application, "dispatch").mockImplementationOnce(async request => { await dispatch(request); throw new Error("response lost"); });
    await f.session.dispatch({ type: "battle-command", expeditionId: "run", command: { type: "roll-dice" } });
    expect(f.values.size).toBe(1);
    const fresh = new GameSession(f.runtime, f.session.locator, f.storage); await fresh.refresh();
    expect(fresh.getSnapshot().status).toBe("ready"); expect(fresh.getSnapshot().record?.head.revision).toBe(2); expect(f.values.size).toBe(0);
    fresh.dispose();
  });
  it("does not submit when request metadata cannot be saved", async () => {
    const f = await clientFixture(); const dispatch = vi.spyOn(f.runtime.application, "dispatch");
    f.storage.setItem = () => { throw new Error("quota"); };
    await f.session.dispatch({ type: "battle-command", expeditionId: "run", command: { type: "roll-dice" } });
    expect(dispatch).not.toHaveBeenCalled(); expect(f.session.getSnapshot().status).toBe("error");
    f.session.dispose();
  });
  it("rejects a stale manual action, rather than reapplying it to a newer head", async () => {
    const f = await clientFixture();
    const other = new GameSession(f.runtime, f.session.locator, { ...f.storage }); await other.refresh();
    await other.dispatch({ type: "battle-command", expeditionId: "run", command: { type: "roll-dice" } });
    const result = await f.session.dispatch({ type: "battle-command", expeditionId: "run", command: { type: "roll-dice" } });
    expect(result).toBeNull(); expect(f.session.getSnapshot().error?.code).toBe("conflict");
    expect(f.session.getSnapshot().record?.head.revision).toBe(2);
    other.dispose(); f.session.dispose();
  });
  it("returns already settled history without adding funds twice", async () => {
    const f = await clientFixture(); const end = await terminal(f.runtime.application); await f.session.refresh();
    const command = { type: "settle-expedition" as const, expeditionId: "run", terminalRef: end.pendingSettlement!.terminalRef };
    await f.session.dispatch(command);
    const funds = f.session.getSnapshot().record!.snapshot.campaign.funds;
    await f.session.dispatch(command);
    expect(f.session.getSnapshot().error?.code).toBe("already-settled");
    expect(f.session.getSnapshot().record!.snapshot.campaign.funds).toEqual(funds);
    expect((f.session.getSnapshot().record as import("../game-application").GameRecord).snapshot.campaign.appliedSettlements).toHaveLength(1);
    f.session.dispose();
  });
  it("does not publish a delayed load after disposal", async () => {
    const f = await clientFixture();
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    const open = f.runtime.application.open;
    vi.spyOn(f.runtime.application, "open").mockImplementation(async id => { await gate; return open(id); });
    const pending = f.session.refresh(); f.session.dispose(); release(); await pending;
    expect(f.session.getSnapshot().status).toBe("disposed");
  });
});

describe('session invalidation', () => {
  it('retains the current scene after revalidating an unchanged save, but invalidates a newer head', async () => {
    const f = await clientFixture();
    const before = f.session.getSnapshot();
    await f.session.refresh({background:true});
    expect(f.session.getSnapshot().record).toBe(before.record);
    expect(f.session.getSnapshot().generation).toBe(before.generation);
    await f.runtime.application.dispatch({protocolVersion:1, saveId:'save', expectedHead:before.record!.head, clientRequestId:'external-roll', command:{type:'battle-command',expeditionId:'run',command:{type:'roll-dice'}}});
    await f.session.refresh({background:true});
    expect(f.session.getSnapshot().record?.head.revision).toBe(before.record!.head.revision + 1);
    expect(f.session.getSnapshot().generation).toBe(before.generation + 1);
    f.session.dispose();
  });
  it('suppresses a receipt presentation when the post-commit read already has a higher head', async () => {
    const f = await clientFixture(); const original = f.runtime.application.dispatch;
    vi.spyOn(f.runtime.application, 'dispatch').mockImplementationOnce(async request => {
      const result = await original(request);
      const latest = await f.runtime.application.open('save');
      if (!latest.ok) throw new Error('open');
      await original({ protocolVersion: 1, saveId: 'save', clientRequestId: 'other-tab', expectedHead: latest.record.head, command: { type: 'battle-command', expeditionId: 'run', command: { type: 'toggle-load', dieIndex: 0 } } });
      return result;
    });
    const batch = await f.session.dispatch({ type: 'battle-command', expeditionId: 'run', command: { type: 'roll-dice' } });
    expect(batch?.presentable).toBe(false);
    expect(batch?.after.head.revision).toBe(3);
    expect(battleState(f.session.getSnapshot().record!).dice[0].loaded).toBe(true);
    f.session.dispose();
  });
  it('does not automatically advance a battle while merely opening the campaign menu', async () => {
    const f = await clientFixture();
    await f.session.dispatch({ type: 'battle-command', expeditionId: 'run', command: { type: 'roll-dice' } });
    const before = f.session.getSnapshot().record!;
    await f.runtime.application.dispatch({ protocolVersion: 1, saveId: 'save', expectedHead: before.head, clientRequestId: 'end', command: { type: 'battle-command', expeditionId: 'run', command: { type: 'end-turn' } } });
    const menu = new GameSession(f.runtime, { saveId: 'save', epoch: 'epoch' }, f.storage);
    await menu.refresh();
    expect(battleState(menu.getSnapshot().record!).mode.type).toBe('enemy-turn');
    menu.dispose(); f.session.dispose();
  });
});
