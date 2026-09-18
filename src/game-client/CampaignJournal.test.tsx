import { useRef, useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { CampaignJournal, type CampaignReportView } from "./CampaignJournal";
afterEach(cleanup);

function Desk() {
  const [view,setView] = useState<CampaignReportView | null>(null);
  const journal = useRef<HTMLButtonElement>(null), preparation = useRef<HTMLButtonElement>(null);
  return <>
    <button ref={journal} onClick={() => setView("journal")}>日志</button>
    <button ref={preparation} onClick={() => setView("preparation")}>整备</button>
    <CampaignJournal open={view === "journal"} title="日志" onClose={() => setView(null)} returnFocusRef={journal}>
      <p>已入账 36G</p><button>继续交谈</button>
    </CampaignJournal>
    <CampaignJournal open={view === "preparation"} title="整备" onClose={() => setView(null)} returnFocusRef={preparation}>
      <p>基础配给</p><button>加入行囊</button>
    </CampaignJournal>
  </>;
}
it("opens two independent windows, without tabs or an internal cross-purpose switcher", async () => {
  const user = userEvent.setup(); render(<Desk/>);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByText("已入账 36G")).toBeNull();
  await user.click(screen.getByRole("button",{name:"日志"}));
  const dialog = screen.getByRole("dialog",{name:"日志"});
  expect(dialog).toHaveClass("manor-utility__window");
  expect(dialog.parentElement).toHaveClass("manor-utility");
  expect(dialog.querySelector(".abyssa-frame")).toBeTruthy();
  expect(dialog.querySelector(".abyssa-modal__signboard")).toBeTruthy();
  expect(dialog.querySelector(".abyssa-modal__signboard")).toHaveAttribute("data-variant","slim");
  expect(dialog.querySelector(".abyssa-modal__close svg")).toBeTruthy();
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.getByText("已入账 36G")).toBeInTheDocument();
  expect(screen.getByRole("button",{name:"继续交谈"})).toBeInTheDocument();
  expect(screen.queryByText("基础配给")).toBeNull();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await user.click(screen.getByRole("button",{name:"整备"}));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.getByRole("dialog",{name:"整备"})).toHaveTextContent("基础配给");
  expect(screen.getByRole("dialog",{name:"整备"})).toHaveClass("manor-utility__window");
  expect(screen.queryByText("已入账 36G")).toBeNull();
  expect(screen.queryByRole("tablist")).toBeNull();
});
it.each(["日志","整备"])("restores the correct external %s trigger after Escape or backdrop dismissal", async title => {
  const user = userEvent.setup(); render(<Desk/>);
  const trigger = screen.getByRole("button",{name:title});
  for (const method of ["escape","backdrop"]) {
    await user.click(trigger);
    const dialog = screen.getByRole("dialog",{name:title});
    await waitFor(()=>expect(dialog).toContainElement(document.activeElement as HTMLElement));
    if (method === "escape") await user.keyboard("{Escape}");
    else await user.click(dialog.parentElement!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(()=>expect(trigger).toHaveFocus());
  }
});
