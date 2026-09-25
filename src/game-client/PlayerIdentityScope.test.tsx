import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { newGameFixture } from "./testing/new-game";
import { GameSession } from "./session";
import { ReadGameSession } from "./read-session";
import { GameSessionScope } from "./react";
import { ReadSessionScope } from "./read-react";
import { usePlayerName } from "../shared/domain/PlayerIdentity";
import { presentCharacterArchive } from "./character-presentation";

afterEach(cleanup);

it("scopes display names to read/write sessions without repainting on unchanged refreshes", async () => {
  const {runtime} = newGameFixture();
  const first = {saveId: "first", epoch: "first-epoch"}, second = {saveId: "second", epoch: "second-epoch"};
  for (const [locator, playerName] of [[first, "林恩"], [second, "艾尔"]] as const)
    expect(await runtime.application.createNewGame({...locator, clientRequestId: locator.saveId, startAt: "hub", playerName})).toMatchObject({ok: true});
  const writer = new GameSession(runtime, first, sessionStorage);
  const reader = new ReadGameSession({open: runtime.application.open, queries: runtime.queries,
    exportDiagnostic: runtime.application.exportDiagnostic, close() {}}, second);
  const renders: Record<string, number> = {};
  function Name({id}: {id: string}) {
    renders[id] = (renders[id] ?? 0) + 1;
    return <span data-testid={id}>{usePlayerName()}</span>;
  }
  try {
    render(<><GameSessionScope session={writer}><Name id="write"/></GameSessionScope>
      <ReadSessionScope session={reader}><Name id="read"/></ReadSessionScope><Name id="preview"/></>);
    await act(async () => {await writer.refresh(); await reader.refresh();});
    expect(screen.getByTestId("write")).toHaveTextContent("林恩");
    expect(screen.getByTestId("read")).toHaveTextContent("艾尔");
    expect(screen.getByTestId("preview")).toHaveTextContent("你");
    const before = {...renders};
    await act(async () => {await writer.refresh({background: true}); await reader.refresh();});
    expect(renders).toEqual(before);
    const record = reader.getSnapshot().record!;
    const view = runtime.queries.archive(record);
    expect(presentCharacterArchive(view, "艾尔").find(item => item.profile.id === "kael")?.profile.name).toBe("艾尔");
    expect(presentCharacterArchive(view).find(item => item.profile.id === "kael")?.profile.name).toBe("你");
  } finally { cleanup(); writer.dispose(); reader.dispose(); }
});
