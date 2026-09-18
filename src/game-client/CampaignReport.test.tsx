import { useState } from "react";
import type { CampaignReportView } from "./CampaignJournal";
import { cleanup, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { tutorialEntryFixture } from "./testing/new-game";
import { GameSessionScope } from "./react";
import { CampaignPanel } from "./CampaignPanel";
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

it("keeps sparse v12 records quiet, remembers read-only selection and separates preparation", async () => {
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
    expect(within(within(supplies).getByTestId("campaign-funds")).getByRole("img", {name: "小队金币 0"})).toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"查看护符详情"}));
    expect(screen.getByRole("button",{name:"加入行囊"})).toBeDisabled();
    await user.click(screen.getByRole("button",{name:"查看食物详情"}));
    await user.click(screen.getByRole("button",{name:"移出行囊"}));
    expect(screen.queryByRole("button",{name:/行囊第 \d 格：食物/})).toBeNull();
    expect(f.session.getSnapshot().record).toBe(record);
  } finally {cleanup();f.session.dispose();}
});
