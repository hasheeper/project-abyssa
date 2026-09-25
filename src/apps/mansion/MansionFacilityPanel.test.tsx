import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { newGameFixture } from "../../game-client/testing/new-game";
import { GameSession } from "../../game-client/session";
import { GameSessionScope } from "../../game-client/react";
import { useMansionEstate } from "./useMansionEstate";
import { MansionFacilityPanel } from "./MansionFacilityPanel";
import { estateFeedback } from "../../game-client/EstateFeedback";
afterEach(cleanup);
it("collects into the real warehouse with one obtained-item notice and no notice on remount", async () => {
  const f = newGameFixture(), locator = {saveId: "facility-ui", epoch: "ui"};
  const created = await f.runtime.application.create({protocolVersion: 4, contentVersion: 25, profileId: "profile.demo.first-run", ...locator, clientRequestId: "create"});
  if (!created.ok) throw Error("create");
  const pending = new Map<string, string>();
  const session = new GameSession(f.runtime, locator, {getItem: key => pending.get(key) ?? null, setItem: (key, value) => {pending.set(key, value);}, removeItem: key => {pending.delete(key);}}); await session.refresh();
  await session.dispatch({type: "select-game-start", startAt: "hub"});
  if (!f.runtime.queries.journey(session.getSnapshot().record!)?.facilities) throw Error(JSON.stringify(session.getSnapshot().error ?? session.getSnapshot().record?.snapshot.campaign));
  function Panel() {
    const estate = useMansionEstate();
    return <><MansionFacilityPanel view={estate.facilities!} roomId="kitchen" busy={estate.busy} onCommand={estate.operateFacility} onStock={estate.toggleStock}/>
      <output aria-label="获得提示数量">{estate.feedback.length}</output><output aria-label="食物库存">{estate.fixedEntries.find(i => i.id === "item.food")!.quantity}</output></>;
  }
  try {
    const user = userEvent.setup(), mounted = render(<GameSessionScope session={session}><Panel/></GameSessionScope>);
    expect(screen.getByRole("button", {name: "收取"})).toBeDisabled();
    expect(screen.getByText(/还需 4 个时段/)).toBeInTheDocument();
    await act(async () => {for (let i = 0; i < 4; i++) await session.dispatch({type: "advance-phase"});});
    await user.click(screen.getByRole("button", {name: "收取"}));
    expect(screen.getByLabelText("食物库存")).toHaveTextContent("5");
    expect(screen.getByLabelText("获得提示数量")).toHaveTextContent("1");
    expect(screen.getByRole("button", {name: "收取"})).toBeDisabled();
    mounted.unmount();
    render(<GameSessionScope session={session}><Panel/></GameSessionScope>);
    expect(screen.getByLabelText("食物库存")).toHaveTextContent("5");
    expect(screen.getByLabelText("获得提示数量")).toHaveTextContent("0");
  } finally {session.dispose();}
});

it("opens a real public-funded project, presents completion once and restores the room without replaying notices", async () => {
  const f = newGameFixture(), locator = {saveId: "construction-ui", epoch: "ui"};
  expect(await f.runtime.application.createNewGame({...locator, clientRequestId: "create", startAt: "hub"})).toMatchObject({ok: true});
  const session = new GameSession(f.runtime, locator, {getItem: () => null, setItem() {}, removeItem() {}});
  await session.refresh();
  const notices: string[] = [];
  const off = session.onCommitted(batch => notices.push(...estateFeedback(batch).map(e => e.kind === "notice" ? e.message : "")));
  function Panel() {
    const estate = useMansionEstate();
    return <MansionFacilityPanel view={estate.facilities!} roomId="kitchen" busy={estate.busy} onCommand={estate.operateFacility} onStock={estate.toggleStock}/>;
  }
  try {
    const user = userEvent.setup(), mounted = render(<GameSessionScope session={session}><Panel/></GameSessionScope>);
    expect(screen.getByLabelText("公款结余 500,000 G")).toBeInTheDocument();
    expect(screen.getByText("2 份 → 3 份")).toBeInTheDocument();
    await user.click(screen.getByRole("button", {name: "开始升级"}));
    expect(screen.getByText("升级中")).toBeInTheDocument();
    expect(screen.queryByRole("button", {name: "开始升级"})).not.toBeInTheDocument();
    expect(screen.getByLabelText("公款结余 300,000 G")).toBeInTheDocument();
    expect(notices).toEqual(["厨房 · 升级开工"]);
    await act(async () => {for (let i = 0; i < 4; i++) await session.dispatch({type: "advance-phase"});});
    expect(screen.getByText("Lv.2 / 3")).toBeInTheDocument();
    expect(screen.getByText("公款不足")).toBeInTheDocument();
    expect(screen.getByRole("button", {name: "开始升级"})).toBeDisabled();
    expect(notices).toEqual(["厨房 · 升级开工", "厨房 · 工程完成 Lv.2"]);
    await act(async () => {await session.refresh();});
    mounted.unmount(); render(<GameSessionScope session={session}><Panel/></GameSessionScope>);
    expect(notices).toHaveLength(2);
    await act(async () => {for (let i = 0; i < 24; i++) await session.dispatch({type: "advance-phase"});});
    expect(notices.filter(n => n.startsWith("公款到账"))).toHaveLength(1);
    expect(screen.getByRole("button", {name: "开始升级"})).toBeEnabled();
  } finally {off(); session.dispose();}
}, 15_000);
