import { describe, it, expect, vi } from "vitest";
import { ReadGameSession } from "./read-session";
import { archiveFixture } from "../game-runtime/testing/archive-fixture";
import { gameHref, parseLocator, parseCharacterLocation } from "./navigation";

describe("read-only game sessions", () => {
  it("never consumes pending commands or advances a saved enemy turn", async () => {
    const f = await archiveFixture({ run: true });
    await f.command({
      type: "battle-command",
      runRef: { kind: "expedition", id: "run" },
      command: { type: "roll" },
    });
    await f.command({
      type: "battle-command",
      runRef: { kind: "expedition", id: "run" },
      command: { type: "end-turn" },
    });
    const before = await f.open(),
      count = f.db.receipts.size;
    const pendingKey = "abyssa:pending:v1:demo:demo-epoch";
    sessionStorage.setItem(pendingKey, "keep");
    const session = new ReadGameSession(f.reader, {
      saveId: "demo",
      epoch: "demo-epoch",
      expeditionId: "run",
    });
    await session.refresh();
    const reference = session.getSnapshot().record;
    await session.refresh();
    expect(session.getSnapshot().record).toBe(reference);
    expect(session.getSnapshot().record).toEqual(before);
    expect(f.db.receipts.size).toBe(count);
    expect(sessionStorage.getItem(pendingKey)).toBe("keep");
    sessionStorage.removeItem(pendingKey);
    expect("dispatch" in session).toBe(false);
    session.dispose();
  });
  it("marks transient reads stale, clears invalid identity, and drops late responses", async () => {
    const f = await archiveFixture();
    const open = vi.fn(f.reader.open);
    const session = new ReadGameSession(
      { ...f.reader, open },
      { saveId: "demo", epoch: "demo-epoch" },
    );
    await session.refresh();
    const previous = session.getSnapshot().record;
    open.mockResolvedValueOnce({
      ok: false,
      error: { code: "storage-unavailable", path: "", message: "test" },
    });
    await session.refresh();
    expect(session.getSnapshot()).toMatchObject({
      status: "error",
      record: previous,
    });
    let finish!: (value: Awaited<ReturnType<typeof open>>) => void;
    open.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const late = session.refresh();
    open.mockResolvedValueOnce({
      ok: false,
      error: { code: "identity-mismatch", path: "", message: "test" },
    });
    await session.refresh();
    finish({ ok: true, record: previous! });
    await late;
    expect(session.getSnapshot()).toMatchObject({
      status: "error",
      record: null,
    });
    session.dispose();
  });
  it("round trips encoded run identities and whitelists page hints", () => {
    const locator = {
      saveId: "save/a",
      epoch: "epoch:a",
      expeditionId: "run/b",
    };
    const url = gameHref("character-status", locator, {
      characterId: "kael",
      tab: "dice",
      from: "battle",
    });
    expect(parseLocator(url.slice(url.indexOf("?")))).toEqual(locator);
    expect(parseCharacterLocation("?from=https://bad&tab=script")).toEqual({
      from: "menu",
      tab: "summary",
    });
  });
});
