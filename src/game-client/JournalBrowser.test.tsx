import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { JournalBrowser, type JournalEntry } from "./JournalBrowser";

afterEach(() => {cleanup(); vi.restoreAllMocks();});
const entries: JournalEntry[] = [
  {id:"talk", title:"把剑暂时放下", meta:"尤斯缇丝 · 可交谈", group:"current", kind:"story", content:<p>交谈正文</p>},
  {id:"return", title:"岩窟货物已追回", meta:"最近归来 · 已结算", group:"archive", kind:"return", content:<p>归来正文</p>},
  {id:"locked", title:"停下来的钟声", meta:"玛丽埃塔 · 尚未开放", group:"locked", kind:"memory", content:<p>开放条件</p>},
];
function Browser({items = entries}: {items?: JournalEntry[]}) {
  const [selected, select] = useState<string | null>(null);
  return <JournalBrowser entries={items} selectedId={selected} onSelect={select} empty={<p>尚无记事正文</p>}/>;
}

it("does not force a scroll layout on mount, but resets the reader on an actual entry change", async () => {
  const writes = vi.spyOn(Element.prototype, "scrollTop", "set");
  const user = userEvent.setup(); const result = render(<Browser/>);
  expect(writes).not.toHaveBeenCalled();
  const reader = screen.getByRole("article");
  reader.scrollTop = 150; writes.mockClear();
  result.rerender(<Browser items={[{...entries[0], meta:"更新说明"}, ...entries.slice(1)]}/>);
  expect(reader.scrollTop).toBe(150);
  expect(writes).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", {name:"查看记录：岩窟货物已追回"}));
  expect(reader.scrollTop).toBe(0);
  expect(writes).toHaveBeenCalledExactlyOnceWith(0);
});

it("reads one entry, keeps locked entries quiet and supports arrow/Home/End navigation", async () => {
  const user = userEvent.setup(); render(<Browser/>);
  const index = screen.getByRole("navigation",{name:"日志条目"});
  expect(screen.getByRole("article",{name:"把剑暂时放下"})).toHaveTextContent("交谈正文");
  expect(screen.queryByText("归来正文")).toBeNull();
  expect(screen.getByRole("button",{name:"查看记录：停下来的钟声"})).toBeVisible();
  expect(screen.getByRole("button",{name:"查看记录：停下来的钟声"})).toHaveAttribute("data-locked","true");
  expect(within(index).getAllByRole("list")).toHaveLength(1);
  expect(within(index).getAllByRole("listitem")).toHaveLength(entries.length);
  expect(within(index).getAllByRole("button").map(button => button.dataset.journalEntry)).toEqual(entries.map(e => e.id));
  expect(within(index).queryByRole("heading")).toBeNull();
  expect(index.querySelector("section")).toBeNull();
  expect(index.querySelector("details")).toBeNull();
  const talk = within(index).getByRole("button",{name:"查看记录：把剑暂时放下"});
  talk.focus(); await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("article",{name:"岩窟货物已追回"})).toHaveTextContent("归来正文");
  expect(screen.queryByText("交谈正文")).toBeNull();
  await user.keyboard("{Home}"); expect(talk).toHaveFocus();
  talk.focus(); await user.keyboard("{End}");
  expect(screen.getByRole("article",{name:"停下来的钟声"})).toHaveTextContent("开放条件");
  expect(index.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
  expect(screen.queryByRole("tablist")).toBeNull();
});

it("retains selection across data updates, falls back if removed and never auto-selects a locked chapter", async () => {
  const user = userEvent.setup(); const result = render(<Browser/>);
  await user.click(screen.getByRole("button",{name:"查看记录：岩窟货物已追回"}));
  result.rerender(<Browser items={[{...entries[0],meta:"尤斯缇丝 · 待继续"}, ...entries.slice(1)]}/>);
  expect(screen.getByRole("article")).toHaveAccessibleName("岩窟货物已追回");
  result.rerender(<Browser items={[entries[0],entries[2]]}/>);
  expect(screen.getByRole("article")).toHaveAccessibleName("把剑暂时放下");
  result.rerender(<Browser items={[entries[2]]}/>);
  expect(within(screen.getByRole("navigation")).queryByText("尚无记事")).toBeNull();
  expect(screen.getByRole("button",{name:"查看记录：停下来的钟声"})).toBeVisible();
  expect(screen.getByRole("article")).toHaveTextContent("尚无记事正文");
  expect(screen.queryByText("开放条件")).toBeNull();
});

it("keeps full long labels accessible and shows the index empty state only without entries", () => {
  const title = "归来之后与同伴谈起尚未写完的漫长旅程", meta = "玛丽埃塔与尤斯缇丝 · 归来后继续";
  const result = render(<Browser items={[{...entries[0], title, meta}]}/>);
  const button = screen.getByRole("button",{name:`查看记录：${title}`});
  expect(button).toHaveAccessibleDescription(meta);
  expect(within(button).getByText(title)).toHaveAttribute("title",title);
  expect(within(button).getByText(meta)).toHaveAttribute("title",meta);
  result.rerender(<Browser items={[]}/>);
  const index = within(screen.getByRole("navigation"));
  expect(index.getByText("尚无记事")).toBeVisible();
  expect(index.queryByRole("list")).toBeNull();
  expect(screen.getByRole("article")).toHaveTextContent("尚无记事正文");
});
