import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { JournalBrowser, type JournalEntry } from "./JournalBrowser";
import { JournalDock } from "./JournalPrimitives";

afterEach(() => {cleanup(); vi.restoreAllMocks();});
const entries: JournalEntry[] = [
  {id:"talk", title:"把剑暂时放下", source:"尤斯缇丝", category:"companion", status:"可交谈", group:"current", actionable:true, lead:"交谈正文"},
  {id:"return", title:"岩窟货物已追回", source:"小队", category:"return", status:"已结算", group:"archive", lead:"归来正文"},
  {id:"locked", title:"停下来的钟声", source:"玛丽埃塔", category:"memory", status:"尚未开放", group:"locked", condition:"家宴落幕后开放"},
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
  result.rerender(<Browser items={[{...entries[0], status:"待继续"}, ...entries.slice(1)]}/>);
  expect(reader.scrollTop).toBe(150);
  expect(writes).not.toHaveBeenCalled();
  // 切到「已归档」页签即选中该组第一条,阅读区回到顶部。
  await user.click(screen.getByRole("tab", {name:/^已归档/}));
  expect(screen.getByRole("article")).toHaveAccessibleName("岩窟货物已追回");
  expect(reader.scrollTop).toBe(0);
  expect(writes).toHaveBeenCalledExactlyOnceWith(0);
});

it("groups entries into tabs, lists one group at a time and lets arrow/Home/End cross groups", async () => {
  const user = userEvent.setup(); render(<Browser/>);
  const index = screen.getByRole("navigation",{name:"日志条目"});
  const tablist = screen.getByRole("tablist",{name:"日志分组"});
  expect(screen.getByRole("article",{name:"把剑暂时放下"})).toHaveTextContent("交谈正文");
  expect(screen.queryByText("归来正文")).toBeNull();
  // 每组一枚页签(组名 + 条数),顺序固定;目录只列当前页签的条目。
  expect(within(tablist).getAllByRole("tab").map(tab => tab.textContent)).toEqual(["当前事项1", "已归档1", "尚未开放1"]);
  expect(within(tablist).getByRole("tab",{selected:true})).toHaveTextContent("当前事项");
  expect(screen.getByRole("tabpanel")).toContainElement(index);
  expect(within(index).getAllByRole("button").map(button => button.dataset.journalEntry)).toEqual(["talk"]);
  expect(index.querySelector("details")).toBeNull();
  // 可处理的条目带标记;副标题统一为「人物 · 状态」。
  expect(within(index).getByRole("button",{name:"查看记录：把剑暂时放下"})).toHaveAccessibleDescription("尤斯缇丝 · 可交谈");
  expect(index.querySelectorAll(".journal-entry__marker")).toHaveLength(1);
  // 上下键越过组界时页签随之切换,焦点落到新列表里的条目上。
  const talk = within(index).getByRole("button",{name:"查看记录：把剑暂时放下"});
  talk.focus(); await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("article",{name:"岩窟货物已追回"})).toHaveTextContent("归来正文");
  expect(within(tablist).getByRole("tab",{selected:true})).toHaveTextContent("已归档");
  expect(screen.getByRole("button",{name:"查看记录：岩窟货物已追回"})).toHaveFocus();
  expect(screen.queryByText("交谈正文")).toBeNull();
  await user.keyboard("{Home}"); expect(screen.getByRole("button",{name:"查看记录：把剑暂时放下"})).toHaveFocus();
  await user.keyboard("{End}");
  expect(screen.getByRole("article",{name:"停下来的钟声"})).toHaveTextContent("家宴落幕后开放");
  expect(screen.getByRole("button",{name:"查看记录：停下来的钟声"})).toHaveAttribute("data-locked","true");
  expect(screen.getByRole("button",{name:"查看记录：停下来的钟声"})).toHaveFocus();
  expect(index.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
  // 页签本身:左右键切换并选中该组第一条。
  within(tablist).getByRole("tab",{selected:true}).focus();
  await user.keyboard("{ArrowLeft}");
  expect(within(tablist).getByRole("tab",{selected:true})).toHaveTextContent("已归档");
  expect(within(tablist).getByRole("tab",{selected:true})).toHaveFocus();
  expect(screen.getByRole("article")).toHaveAccessibleName("岩窟货物已追回");
  await user.click(within(tablist).getByRole("tab",{name:/^当前事项/}));
  expect(screen.getByRole("article")).toHaveAccessibleName("把剑暂时放下");
});

it("retains selection across data updates, falls back if removed and never auto-selects a locked chapter", async () => {
  const user = userEvent.setup(); const result = render(<Browser/>);
  await user.click(screen.getByRole("tab",{name:/^已归档/}));
  await user.click(screen.getByRole("button",{name:"查看记录：岩窟货物已追回"}));
  result.rerender(<Browser items={[{...entries[0],status:"待继续"}, ...entries.slice(1)]}/>);
  expect(screen.getByRole("article")).toHaveAccessibleName("岩窟货物已追回");
  result.rerender(<Browser items={[entries[0],entries[2]]}/>);
  expect(screen.getByRole("article")).toHaveAccessibleName("把剑暂时放下");
  result.rerender(<Browser items={[entries[2]]}/>);
  expect(within(screen.getByRole("navigation")).queryByText("尚无记事")).toBeNull();
  expect(screen.getByRole("button",{name:"查看记录：停下来的钟声"})).toBeVisible();
  expect(screen.getByRole("article")).toHaveTextContent("尚无记事正文");
  expect(screen.queryByText("家宴落幕后开放")).toBeNull();
});

it("keeps full long labels accessible and shows the index empty state only without entries", () => {
  const title = "归来之后与同伴谈起尚未写完的漫长旅程", meta = "玛丽埃塔与尤斯缇丝 · 归来后继续";
  const result = render(<Browser items={[{...entries[0], title, source:"玛丽埃塔与尤斯缇丝", status:"归来后继续"}]}/>);
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

it("draws one record heading from the entry fields, with the same format for every source", () => {
  render(<Browser items={[{...entries[0], place:"公共休息室", detail:<p>最深抵达 第 1 层</p>}]}/>);
  const reader = screen.getByRole("article",{name:"把剑暂时放下"});
  const heading = reader.querySelector("header")!;
  expect(within(heading).getByRole("heading",{level:3})).toHaveTextContent("把剑暂时放下");
  // 语境行只写人物 · 地点;类别在阅读面板的名牌上,状态骑在面板上沿右端。
  expect(heading.querySelector(".journal-record__context")).toHaveTextContent(/^尤斯缇丝 · 公共休息室$/);
  const panel = reader.closest(".manor-panel")!;
  expect(within(panel as HTMLElement).getByRole("heading",{name:"同伴片段"})).toBeInTheDocument();
  expect(within(panel as HTMLElement).getByText("可交谈")).toHaveAttribute("data-tone","action");
  expect(reader).not.toHaveTextContent("可交谈");
  expect(heading).toHaveTextContent("最深抵达 第 1 层");
  expect(reader).toHaveTextContent("交谈正文");
});

it("resolves every category and section icon from the shared item catalogue", async () => {
  const {resolveItemIcon} = await import("../assets/icons/items/catalog");
  const {JOURNAL_CATEGORIES, JOURNAL_GLYPHS} = await import("./journal-format");
  const {MANOR_SECTION_ICONS} = await import("../shared/ui/patterns/manor-icons");
  for (const term of [...Object.values(JOURNAL_CATEGORIES).map(category => category.icon), ...Object.values(JOURNAL_GLYPHS), ...Object.values(MANOR_SECTION_ICONS)])
    expect(resolveItemIcon(term).matchKind, term).not.toBe("fallback");
});

it("draws every record from data: lead, facts and items in the reader, actions docked with the place", async () => {
  const later = vi.fn(), user = userEvent.setup();
  const items: JournalEntry[] = [{id:"loot", title:"待鉴定的收获", source:"缇比", place:"杂货铺", category:"appraisal",
    status:"待鉴定", group:"current", actionable:true, lead:"请缇比看看。", facts:[{label:"期限", value:"第 2 日昼前"}],
    items:{label:"尚未鉴定", rows:[{id:"a", icon:"a.svg", name:"发黑的金属钉", quantity:1}, {id:"b", icon:"b.svg", name:"旧布", quantity:2}]},
    actions:[{label:"前往鉴定", emphasis:"primary", href:"#/shop"}, {label:"稍后再说", onClick:later}]}];
  const {container} = render(<Browser items={items}/>);
  const article = screen.getByRole("article", {name:"待鉴定的收获"});
  // 有操作时地点移到操作栏左端,语境行只写人物。
  expect(article.querySelector(".journal-record__context")).toHaveTextContent(/^缇比$/);
  expect(article.querySelector(".journal-record__lead")).toHaveTextContent("请缇比看看。");
  expect(within(article).getByText("期限").parentElement).toHaveTextContent("期限第 2 日昼前");
  expect(within(article).getByRole("region", {name:"尚未鉴定"})).toHaveTextContent("3 件");
  expect(within(article).queryByRole("link")).toBeNull();
  const dock = container.querySelector<HTMLElement>(".journal-dock")!;
  expect(dock.querySelector(".journal-dock__place")).toHaveTextContent("地点杂货铺");
  // 主操作排在最右。
  expect([...dock.querySelectorAll(".journal-action")].map(action => action.textContent)).toEqual(["稍后再说", "前往鉴定"]);
  expect(within(dock).getByRole("link", {name:"前往鉴定"})).toHaveAttribute("href", "#/shop");
  await user.click(within(dock).getByRole("button", {name:"稍后再说"}));
  expect(later).toHaveBeenCalledOnce();
});

it("lets an embedded tool put its own command into the reader's action bar, beside the place", () => {
  const tool: JournalEntry[] = [{id:"today", title:"今日安排", source:"第 1 日", place:"洋馆", category:"schedule", status:"待安排", group:"current",
    embeddedActions:true, custom:<section aria-label="安排流程"><p>尚未安排</p><JournalDock><button type="button">查看今日安排</button></JournalDock></section>}];
  const {container} = render(<Browser items={tool}/>);
  const article = screen.getByRole("article", {name:"今日安排"});
  expect(within(screen.getByRole("region", {name:"安排流程"})).queryByRole("button")).toBeNull();
  expect(article).toHaveTextContent("尚未安排");
  const dock = container.querySelector<HTMLElement>(".journal-dock")!;
  expect(dock.querySelector(".journal-dock__place")).toHaveTextContent("地点洋馆");
  expect(within(dock).getByRole("button", {name:"查看今日安排"})).toBeInTheDocument();
  expect(article.querySelector(".journal-record__context")).toHaveTextContent(/^第 1 日$/);
});
