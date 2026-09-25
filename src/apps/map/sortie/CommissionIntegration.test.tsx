import {cleanup, render, screen, within} from "@testing-library/react";
import {afterEach, expect, it, vi} from "vitest";
import {commissionFixture} from "../../../game-application/testing/airp-commission-fixture";
import {directorCommissions} from "../../../game-runtime/airp-commission-view";
import {GameSession} from "../../../game-client/session";
import {GameSessionScope} from "../../../game-client/react";
import {AirpPanel} from "../../../game-client/AirpPanel";
import {AirpGameGate} from "../../../game-client/airp-game/AirpGameGate";
import {directorJournalEntries} from "../../../game-client/airp-director/DirectorJournal";
import {CommissionList} from "../../../game-client/airp-director/CommissionList";
import {dispatchDirector} from "../../../game-client/airp-director/dispatch";
import {SortieQuestPanel} from "./SortieQuestPanel";
import {sortieLeader, sortieRoster} from "./sortie-roster";
import {cloneMapLocations} from "../types";

afterEach(() => {cleanup(); vi.restoreAllMocks();});

it("uses the same accepted task in the journal, route panel, saved confirmation and battle panel", async () => {
  const f = await commissionFixture();
  const session = new GameSession(f.runtime, {saveId: "formal-airp", epoch: "epoch:1"}, {getItem: () => null, setItem() {}, removeItem() {}}, () => {});
  const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected provider call"));
  try {
    await session.refresh();
    expect(await dispatchDirector(session, {type: "airp-director-choose", eventId: f.eventId, choiceId: "participate"})).toBeTruthy();
    expect(f.event()).toMatchObject({status: "accepted", actionPhase: 2});
    const tasks = directorCommissions(f.raw(), f.departure.routeId)!;
    const panel = render(<SortieQuestPanel location={cloneMapLocations().find(l => l.id === "tower")!} side="left" roster={sortieRoster} leader={sortieLeader}
      party={{memberIds: [], command: "personal"}} rejection={null} onEditParty={() => {}} onDepart={() => {}} onClose={() => {}}
      commissions={<CommissionList tasks={tasks} title="路线委托"/>}/>);
    expect(within(screen.getByRole("region", {name: "路线委托"})).getByText(f.event().card.title)).toBeInTheDocument();
    expect(screen.getByText(/接单反馈未读完，任务目标已登记/)).toBeInTheDocument();
    expect(screen.getByText("目标：取回空药箱")).toBeInTheDocument();
    expect(screen.getByRole("button", {name: "出发"}).closest(".abyssa-sortie-quest__scroll")).toBeNull();
    panel.unmount();
    await f.readScene();
    const journal = directorJournalEntries(f.raw(), session, false, () => {}).find(e => e.id === f.eventId)!;
    expect(journal).toMatchObject({ongoing: true, actionable: false, meta: "可随队"});
    const {id} = await f.preparePlan(); await session.refresh();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {configurable: true, value: vi.fn()});
    const gate = render(<GameSessionScope session={session}><AirpGameGate><p>地图</p></AirpGameGate></GameSessionScope>);
    const confirmation = within(screen.getByRole("region", {name: "本趟委托"}));
    expect(confirmation.getByText(f.event().card.title)).toBeInTheDocument();
    expect(confirmation.getByText("本趟随队")).toBeInTheDocument();
    expect(confirmation.getByText(/第3层/)).toBeInTheDocument();
    expect(screen.getByRole("button", {name: "确认出征"})).toBeEnabled(); gate.unmount();
    const permit = await f.flow.gm.departurePermit(id); await f.send({type: "start-expedition", ...permit.departure}); await session.refresh();
    render(<GameSessionScope session={session}><AirpPanel compact/></GameSessionScope>);
    expect(screen.getByText("已随队 · 探索中")).toBeInTheDocument();
    expect(screen.getByText(f.event().card.title)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  } finally {session.dispose();}
}, 60000);

it("explains an empty or omitted departure instead of presenting it as a carried commission", async () => {
  const f = await commissionFixture(); await f.accept();
  const tasks = directorCommissions(f.raw(), "tide-reef.ordinary")!;
  const view = render(<CommissionList tasks={tasks} title="本趟委托" includedIds={[]}/>);
  expect(screen.getByText("本路线不推进")).toBeInTheDocument();
  expect(screen.getByText("本趟没有附带委托，按路线目标探索。")).toBeInTheDocument();
  view.rerender(<CommissionList tasks={directorCommissions(f.raw(), f.departure.routeId)!} title="本趟委托" includedIds={[]}/>);
  expect(screen.getByText("未纳入本趟")).toBeInTheDocument();
  expect(screen.getByText(/请更新出征依据/)).toBeInTheDocument();
}, 60000);
