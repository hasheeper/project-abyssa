import { useState } from "react";
import type { CampaignReportView } from "./CampaignJournal";
import { cleanup, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { newGameFixture, tutorialEntryFixture } from "./testing/new-game";
import { GameSessionScope } from "./react";
import { CampaignPanel } from "./CampaignPanel";
import { GameSession } from "./session";
import { appraisalHref } from "./shop-navigation";
afterEach(() => {cleanup();sessionStorage.clear();});

function Report() {
  const [view,setView] = useState<CampaignReportView | null>(null);
  return <CampaignPanel onReviewGrowth={vi.fn()} report={{view,onViewChange:setView,
    renderEntries: actionable => <nav aria-label="报告入口">
      <button onClick={() => setView("journal")}>日志</button>
      <button onClick={() => setView("preparation")}>整备</button>
      <output>{actionable}</output>
    </nav>}}/>;
}

it("shows the actual pending loot and appraisal route without granting or identifying items on journal selection", async () => {
  const f = newGameFixture(), locator = {saveId: "journal-hub", epoch: "journal-epoch"}, user = userEvent.setup();
  const created = await f.runtime.application.createNewGame({...locator, clientRequestId: "journal-create", startAt: "hub"});
  expect(created.ok).toBe(true);
  const session = new GameSession(f.runtime, locator, {getItem: () => null, setItem() {}, removeItem() {}});
  try {
    await session.refresh();
    const before = session.getSnapshot().record;
    const dispatch = vi.spyOn(session, "dispatch");
    render(<GameSessionScope session={session}><Report/></GameSessionScope>);
    await user.click(screen.getByRole("button", {name: "日志"}));
    await user.click(screen.getByRole("button", {name: "查看记录：待鉴定的收获"}));
    const reader = within(screen.getByRole("article", {name: "待鉴定的收获"}));
    expect(reader.getByText("发黑的金属钉")).toBeInTheDocument();
    expect(reader.queryByText("黯秘银结界钉")).toBeNull();
    expect(reader.getByRole("region", {name: "尚未鉴定"})).toHaveTextContent("1 件");
    expect(reader.getAllByRole("listitem")).toHaveLength(1);
    expect(reader.getByRole("link", {name: "前往鉴定"})).toHaveAttribute("href", appraisalHref(locator));
    expect(dispatch).not.toHaveBeenCalled();
    expect(session.getSnapshot().record).toBe(before);
  } finally {cleanup(); session.dispose();}
});

it("keeps the new tutorial record quiet and does not fabricate pre-tutorial warehouse supplies", async () => {
  const f = await tutorialEntryFixture(), user = userEvent.setup();
  try {
    const record = f.session.getSnapshot().record!;
    const itemLimit = f.runtime.queries.journey(record)!.itemLimit;
    render(<GameSessionScope session={f.session}><Report/></GameSessionScope>);
    expect(screen.queryByRole("dialog",{name:"日志"})).toBeNull();
    expect(screen.queryByTestId("campaign-funds")).toBeNull();
    await user.click(screen.getByRole("button",{name:"日志"}));
    expect(screen.getByText("旅途尚未留下足迹")).toBeInTheDocument();
    expect(screen.queryByText("建设与生产尚未开放")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("region",{name:"出征补给整备"})).toBeNull();
    expect(screen.queryByText("馆内片段")).toBeNull();
    expect(screen.queryByRole("button",{name:"谈起旧日回廊"})).toBeNull();
    const index = within(screen.getByRole("navigation",{name:"日志条目"}));
    expect(index.getAllByRole("list")).toHaveLength(1);
    expect(index.queryByRole("heading")).toBeNull();
    expect(index.queryByText("尚无记事")).toBeNull();
    expect(screen.getByRole("button",{name:"查看记录：停下来的钟声"})).toHaveAttribute("data-locked","true");
    await user.click(screen.getByRole("button",{name:"查看记录：停下来的钟声"}));
    expect(screen.getByRole("article",{name:"停下来的钟声"})).toHaveTextContent("完成庄园首通及家宴落幕后开放。");
    expect(screen.queryByText("旅途尚未留下足迹")).toBeNull();
    expect(f.session.getSnapshot().record).toBe(record);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(screen.getByRole("button",{name:"日志"}));
    expect(screen.getByRole("article")).toHaveAccessibleName("停下来的钟声");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(screen.getByRole("button",{name:"整备"}));
    expect(screen.queryByRole("dialog",{name:"日志"})).toBeNull();
    const supplies = screen.getByRole("region",{name:"出征补给整备"});
    expect(within(screen.getByRole("list",{name:"可选补给"})).getAllByRole("button")).toHaveLength(7);
    expect(within(screen.getByRole("list",{name:"出征携带位"})).getAllByRole("listitem")).toHaveLength(itemLimit);
    expect(within(within(supplies).getByTestId("campaign-funds")).getByRole("img", {name: "小队资金 0 G"})).toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"查看护符详情"}));
    expect(screen.getByRole("button",{name:"加入行囊"})).toBeDisabled();
    await user.click(screen.getByRole("button",{name:"查看食物详情"}));
    expect(screen.getByRole("button",{name:"加入行囊"})).toBeDisabled();
    expect(screen.queryByText("免费配给")).toBeNull();
    expect(screen.queryByRole("button",{name:/行囊第 \d 格：食物/})).toBeNull();
    expect(f.session.getSnapshot().record).toBe(record);
  } finally {cleanup();f.session.dispose();}
});
