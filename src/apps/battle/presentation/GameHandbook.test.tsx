import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import copy from "../../../content/presentation/tutorial/handbook.json";
import guidedCopy from "../../../content/presentation/tutorial/guided-tide.json";
import basicCopy from "../../../content/presentation/tutorial/battle-basics.json";
import tideCopy from "../../../content/presentation/tutorial/tide-cave.json";
import { GUIDED_TIDE_CATALOG_DATA as catalog } from "../../../content/gameplay/demo-v11/content";
import { TIDE_GUIDE } from "../../../content/gameplay/demo-v11/guide";
import { HAND_BONUSES } from "../../../game-core/battle/rules/hand";
import { eventFaceMethod } from "../../../game-core/battle/rules/v2/event-face";
import { tideClientFixture, tideCommand, tideOperation } from "../../../game-client/testing/tide-cave";
import { ExpeditionFlatDieFrame, EXPEDITION_DIE_STAMP_ICONS } from "../../../shared/ui/dice-face/ExpeditionFlatDieFrame";
import blankCrossIcon from "../../../assets/icons/blank-cross.svg";
import { supplyArt } from "../../../content/presentation/supply-icons";
import { HandbookReader, type HandbookPage } from "./GameHandbook";

afterEach(cleanup);
const section = (chapter: string, id: string) => {
  const found = copy.chapters.find(c => c.id === chapter)?.sections.find(s => s.id === id);
  if (!found) throw Error(`${chapter}/${id}`);
  return found;
};
function Reader() {
  const [page, setPage] = useState<HandbookPage>({chapter: 0, section: 0});
  return <HandbookReader page={page} onPage={setPage}/>;
}

it("uses teaching copy without welcome or reassurance fields", () => {
  expect(copy.title).toBe("战斗与探索规则总览");
  expect(copy.intro).toBe("本手册汇总战斗界面、操作流程与战斗探索的核心机制。");
  expect(copy.scope).toBe("DEMO 阶段规则");
  expect(copy.ui.more).toBe("向下查阅 ↓");
  expect(copy).not.toHaveProperty("welcome");
  expect(copy.ui).not.toHaveProperty("readOnly");
  expect(copy.ui).not.toHaveProperty("startHint");
  expect(JSON.stringify(copy)).not.toMatch(/欢迎来到|不必一口气|不要混淆|先看看|先读懂|别只看|以当前[^"。]*为准|不是当前存档|不代表当前队伍|查阅不会|向下阅读本节规则与算例/);
  expect(copy.chapters.reduce((count, chapter) => count + chapter.sections.length, 0)).toBe(13);
});

it("has five navigable chapters with unique sections, rectangular tables and a practice location", async () => {
  expect(copy.chapters.map(c => c.id)).toEqual(["battle", "dice", "rewards", "other", "characters"]);
  for (const chapter of copy.chapters) {
    expect(new Set(chapter.sections.map(s => s.id)).size).toBe(chapter.sections.length);
    for (const s of chapter.sections) {
      expect(s.practice).toBeTruthy();
      if ("rows" in s && "columns" in s) for (const row of s.rows!) expect(row).toHaveLength(s.columns!.length);
      if ("figure" in s) expect(copy.figures).toHaveProperty(s.figure!);
      if ("explanation" in s) expect(copy.figures).toHaveProperty(s.explanation!.figure);
      if ("topics" in s) for (const topic of s.topics!) {
        if ("figure" in topic) expect(copy.figures).toHaveProperty(topic.figure!);
        if ("rows" in topic && "columns" in topic) for (const row of topic.rows!) expect(row).toHaveLength(topic.columns!.length);
      }
      if ("rowIcons" in s) {
        expect(s.rowIcons).toHaveLength(s.rows!.length);
        for (const icon of s.rowIcons!) expect(EXPEDITION_DIE_STAMP_ICONS).toHaveProperty(icon);
      }
      if ("itemIcons" in s) {
        expect(s.itemIcons).toHaveLength(s.rows!.length);
        for (const icon of s.itemIcons!) expect(supplyArt).toHaveProperty(icon);
      }
      if ("table" in s) expect(copy.tables).toHaveProperty(s.table!);
      if ("links" in s) for (const link of s.links!) expect(section(link.chapter, link.section)).toBeTruthy();
      if ("readingGroups" in s) {
        expect(s.readingGroups!.flatMap(group => group.items.map(item => item.mark))).toEqual([2, 3, 1, 4]);
        expect(s).not.toHaveProperty("rows");
      }
    }
  }
  for (const table of Object.values(copy.tables)) {
    expect(new Set(table.rows.map(row => row[0])).size).toBe(table.rows.length);
    for (const row of table.rows) expect(row).toHaveLength(table.columns.length);
  }
  render(<Reader/>);
  const user = userEvent.setup();
  for (const chapter of copy.chapters) {
    await user.click(screen.getByRole("button", {name: chapter.title}));
    for (const s of chapter.sections) {
      await user.click(screen.getByRole("button", {name: s.title}));
      expect(screen.getByRole("article", {name: s.title})).toBeVisible();
      expect(screen.getByText(s.practice)).toBeVisible();
    }
  }
  expect(screen.getByRole("button", {name: copy.ui.next})).toBeDisabled();
});

it("starts with the interface, then battle foundations and dice in the same order as the contents", async () => {
  render(<Reader/>);
  const user = userEvent.setup();
  expect(copy.chapters[0].sections.map(s => s.id)).toEqual(["interface", "dungeon", "round", "survival"]);
  expect(screen.queryByRole("button", {name: "敌方意图与单条格挡"})).toBeNull();
  expect(screen.getByRole("article", {name: "界面与操作"})).toBeVisible();
  expect(screen.getByRole("button", {name: "战斗与地牢"})).toHaveAttribute("aria-current", "true");
  expect(screen.getByRole("button", {name: copy.ui.previous})).toBeDisabled();
  for (const s of copy.chapters[0].sections.slice(1)) {
    await user.click(screen.getByRole("button", {name: copy.ui.next}));
    expect(screen.getByRole("article", {name: s.title})).toBeVisible();
  }
  await user.click(screen.getByRole("button", {name: copy.ui.next}));
  expect(screen.getByRole("article", {name: "战面与命数"})).toBeVisible();
  expect(screen.getByRole("button", {name: "骰子"})).toHaveAttribute("aria-current", "true");
  await user.click(screen.getByRole("button", {name: copy.ui.previous}));
  expect(screen.getByRole("article", {name: "生命与力竭"})).toBeVisible();
});

it("locates the UI and teaches a complete round with control and target details", () => {
  render(<Reader/>);
  const article = screen.getByRole("article", {name: "界面与操作"});
  const regions = within(article).getByRole("list", {name: "界面区域说明"});
  expect([...regions.querySelectorAll("[data-region]")].map(node => node.getAttribute("data-region")))
    .toEqual(["enemies", "party", "dice", "controls", "sidebar", "menu"]);
  expect(within(regions).getAllByRole("heading").map(node => node.textContent))
    .toEqual(["敌人与意图", "队员卡", "行动骰", "回合操作栏", "进度与反馈", "菜单与帮助"]);
  expect(article.querySelectorAll(".handbook__interface-map .handbook__mark")).toHaveLength(6);
  expect(article.querySelectorAll(".handbook__interface-map rect")).toHaveLength(6);
  const map = within(article).getByRole("img", {name: "战斗界面 · 区域位置"});
  expect(map).toHaveAttribute("src", expect.stringContaining("intents.jpg"));
  const controls = article.querySelector(".handbook__interface-controls svg")!;
  expect(controls).toHaveAttribute("viewBox", "325 784 680 68");
  expect(controls.querySelector("image")).toHaveAttribute("href", map.getAttribute("src")!);
  expect(controls).toHaveAccessibleName("撤回；投掷／重掷；剩余重掷；牌型预览；结束回合；道具");
  const flow = within(article).getByRole("list", {name: "怎样完成一轮操作 · 操作顺序"});
  expect(within(flow).getAllByRole("heading")).toHaveLength(5);
  expect(flow).toHaveTextContent("攻击图标旁的数字是伤害");
  expect(flow).toHaveTextContent("掷骰只决定可用动作，不会自动发动攻击");
  expect(flow).toHaveTextContent("ROLL 按钮会切换为 REROLL");
  expect(flow).toHaveTextContent("固定骰子之后，点击它上方的队员卡");
  expect(flow).toHaveTextContent("盾面点要拦截的那条攻击意图");
  expect(flow).toHaveTextContent("治疗面点受伤队员");
  expect(flow).toHaveTextContent("对应骰子会变灰");
  expect(flow).toHaveTextContent("仍然存活的敌人执行意图");
  expect(flow).toHaveTextContent("击败最后一个敌人时，系统会自动完成回合收尾");
  expect(within(flow).getByRole("img", {name: "敌人头顶：生命与本轮攻击"})).toBeVisible();
  expect(within(flow).getByRole("img", {name: "队员卡与下方行动骰一一对应"})).toBeVisible();
  expect(article).toHaveTextContent("格挡点对应的攻击意图");
  expect(article).toHaveTextContent("左侧菜单可展开名称");
  expect(within(article).queryByRole("table")).toBeNull();
  expect(article).not.toHaveTextContent(/最多|上限|×3|配给|后续开放|金币保留一半/);
});

it("teaches the expedition from departure through fights, rest, layer settlement and return", async () => {
  render(<Reader/>);
  await userEvent.setup().click(screen.getByRole("button", {name: "远征流程"}));
  const article = screen.getByRole("article", {name: "远征流程"});
  expect(screen.getByRole("heading", {name: "远征流程"}).parentElement).toHaveTextContent("带着同一支小队连续探索地牢");
  const steps = article.querySelector(".handbook__steps")!;
  expect(within(steps as HTMLElement).getAllByRole("listitem")).toHaveLength(5);
  expect(steps).toHaveTextContent("房间是一次具体遭遇");
  expect(steps).toHaveTextContent("一场战斗可以持续多轮");
  expect(steps).toHaveTextContent("不会把敌人或队员的生命重置");
  expect(steps).toHaveTextContent("点击「继续前进」");
  expect(steps).toHaveTextContent("消耗过的药水和食物却不会随之补满");
  expect(steps).toHaveTextContent("本层散金 × 当前总倍率");
  expect(steps).toHaveTextContent("已入袋金币继续保留；散金和牌型加成则从起点重新积累");
  expect(steps).toHaveTextContent("到达指定出口时，可以选择撤离");
  expect(steps).toHaveTextContent("领取结算后，本趟带回的金币才会写入长期钱包");
  const table = within(article).getByRole("table", {name: "这些进度分别在什么时候更新 · 规则表"});
  expect(within(table).getAllByRole("rowheader").map(node => node.textContent)).toEqual(["一轮（Turn）", "一场（Room）", "一层（Floor）", "一趟（Run）"]);
  expect(table).toHaveTextContent("重新获得行动资格与重掷机会");
  expect(table).toHaveTextContent("收益转为已入袋金币");
  expect(table).toHaveTextContent("返馆领取本趟结算");
  expect(table).toHaveTextContent("从指定出口撤离");
  expect(article.querySelectorAll(".handbook__key-rules, .handbook__note")).toHaveLength(0);
  expect(article).not.toHaveTextContent(/充能单价|免费配给|退潮岩窟教程可重试/);
});

it("separates all five round phases and preserves undo boundaries without tactical reminders", async () => {
  render(<Reader/>);
  await userEvent.setup().click(screen.getByRole("button", {name: "回合顺序与撤回"}));
  const article = screen.getByRole("article", {name: "回合顺序与撤回"});
  const timeline = screen.getByRole("list", {name: "回合顺序与撤回 · 时序"});
  expect(within(timeline).getAllByRole("listitem").map(node => node.querySelector("span")!.textContent))
    .toEqual(["意图公开", "队伍行动", "牌型结算", "铭约触发", "敌方结算"]);
  const table = screen.getByRole("table", {name: "标准回合五步时序 · 规则表"});
  expect(within(table).getAllByRole("columnheader")).toHaveLength(2);
  expect(within(table).getAllByRole("rowheader")).toHaveLength(5);
  expect(table).toHaveTextContent("自动追击、治疗或发动专属效果");
  expect(table).toHaveTextContent("击败最后一个敌人时会自动执行回合收尾");
  expect(article).toHaveTextContent("敌人在出手前被击败，其本轮意图立即作废");
  const undo = screen.getByRole("region", {name: "撤回范围"});
  expect(within(undo).getAllByRole("listitem")).toHaveLength(3);
  expect(undo).toHaveTextContent("左下角的「撤回」按钮每次撤回一步操作");
  expect(undo).toHaveTextContent("血量、格挡、骰子状态与资源消耗一并恢复");
  expect(undo).toHaveTextContent("ROLL 或 REROLL 成功执行后，清空此前记录");
  expect(undo).toHaveTextContent("之后的操作仍可撤回");
  expect(undo).toHaveTextContent("按下 END TURN 或击败最后一个敌人后，不能撤回");
  expect(article.querySelector(".handbook__note")).toBeNull();
  expect(article).not.toHaveTextContent(/永远是最优|随时可以反悔|推荐顺序|每轮最多|见下方/);
});

it("keeps life and downed recovery together and moves financial outcomes to the rewards page", async () => {
  render(<Reader/>);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", {name: "生命与力竭"}));
  expect(Object.values(catalog.characters).every(character => character.maxHp === 3)).toBe(true);
  const article = screen.getByRole("article", {name: "生命与力竭"});
  expect(screen.getByRole("heading", {name: "生命与力竭"}).parentElement)
    .toHaveTextContent("全员生命上限为 3 点。战斗结束后不自动回血，伤势带入下一场。");
  const rules = within(article).getByRole("list");
  expect(within(rules).getAllByRole("listitem")).toHaveLength(4);
  expect(rules).toHaveTextContent("普通治疗、食物和药水只能恢复存活队员");
  expect(rules).toHaveTextContent("不超过生命上限");
  expect(rules).toHaveTextContent("其骰子不再参与行动与成牌");
  expect(rules).toHaveTextContent("不倒扣此前已累计的倍率");
  expect(rules).toHaveTextContent("下一场战斗以 1 点生命归队");
  expect(within(article).queryByRole("table")).toBeNull();
  expect(article).not.toHaveTextContent(/雨夜之盟|金币|退潮岩窟教程|重试本场|不推进世界时间/);
  await user.click(screen.getByRole("button", {name: "倍率机制"}));
  await user.click(screen.getByRole("button", {name: "总倍率与金币结算"}));
  const payout = screen.getByRole("region", {name: "散金 → 入袋 → 钱包"});
  expect(payout).toHaveTextContent("四舍五入为整数");
  expect(payout).toHaveTextContent("散金归零");
  expect(payout).toHaveTextContent("撤离时不再乘一次倍率");
  expect(payout).toHaveTextContent("入袋金币全额带回");
  expect(payout).toHaveTextContent("本层散金全部丢失");
  expect(payout).toHaveTextContent("入袋金币保留一半并向下取整");
  expect(payout).toHaveTextContent("长期钱包已有存款不受影响");
  expect(within(payout).getAllByRole("rowheader")).toHaveLength(2);
});

it("explains both die layers and links to the multiplier table only in the rewards chapter", async () => {
  render(<Reader/>);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", {name: "骰子"}));
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.getByRole("region", {name: "实战区"})).toHaveTextContent("中央图标决定本轮能执行的动作");
  expect(screen.getByRole("region", {name: "实战区"})).toHaveTextContent("右下刻痕决定动作的基础数值");
  expect(screen.getByRole("region", {name: "结算区"})).toHaveTextContent("左上数字与外框决定成牌组合");
  expect(screen.getByRole("region", {name: "结算区"})).toHaveTextContent("右上印记修正成牌收益");
  expect(screen.getByRole("article")).toHaveTextContent("基础伤害为 1");
  expect(screen.getByRole("article")).toHaveTextContent("命数 2 用于成牌");
  await user.click(screen.getByRole("button", {name: "倍率机制 →"}));
  expect(screen.getByRole("article", {name: "牌型机制：回合末自动凑牌"})).toBeVisible();
  expect(screen.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(10);
  expect(screen.getByRole("table").querySelectorAll("thead th")).toHaveLength(3);
  const rewardsTable = screen.getByRole("table").innerHTML;
  await user.click(screen.getByRole("button", {name: "总倍率与金币结算"}));
  expect(screen.getByRole("article")).toHaveTextContent("×2.97 升至 ×3.30");
  await user.click(screen.getByRole("button", {name: "牌型机制：回合末自动凑牌"}));
  expect(screen.getByRole("table").innerHTML).toBe(rewardsTable);
  expect(copy.chapters.find(c => c.id === "dice")!.sections.some(s => s.id === "patterns")).toBe(false);
  expect(copy.chapters.find(c => c.id === "rewards")!.sections[0].id).toBe("patterns");
  expect(copy.chapters.reduce((count, c) => count + c.sections.filter(s => "table" in s && s.table === "hand-patterns").length, 0)).toBe(1);
  expect(section("rewards", "patterns")).toHaveProperty("table", "hand-patterns");
  expect(JSON.stringify(section("other", "event"))).toContain("判定顺序：先战面，后命数");
});

it("keeps scoring identification basic and pairs it with real enlarged corner details", async () => {
  render(<Reader/>);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", {name: "骰子"}));
  await user.click(screen.getByRole("button", {name: "命数、花色与铭文"}));
  const article = screen.getByRole("article", {name: "命数、花色与铭文"});
  expect(within(article).queryByRole("table")).toBeNull();
  const fates = within(article).getByRole("region", {name: "命数：左上数字"});
  expect(fates).toHaveTextContent("命数取值 1～6");
  expect(fates.querySelectorAll(".handbook__fate-crop")).toHaveLength(2);
  expect(fates.querySelectorAll(".expedition-flat-die-frame__wild-pip")).toHaveLength(1);
  const suits = within(article).getByRole("region", {name: "花色：数字外框"});
  expect(suits).toHaveTextContent("相同花色的骰子可以用来凑「同花」");
  expect([...suits.querySelectorAll(".handbook__fate-crop [data-shape]")].map(node => node.getAttribute("data-shape")))
    .toEqual(["square", "diamond", "triangle", "circle"]);
  for (const label of copy.figures["die-suits"].labels) expect(within(suits).getByRole("img", {name: label})).toBeVisible();
  const seals = within(article).getByRole("region", {name: "铭文品质：右上印记"});
  expect([...seals.querySelectorAll(".handbook__seal-crop [data-seal]")].map(node => node.getAttribute("data-seal")))
    .toEqual(["plain", "gild", "rust"]);
  expect([...seals.querySelectorAll(".handbook__corner-examples strong")].map(node => node.textContent))
    .toEqual(["+0", "+0.10", "−0.10"]);
  expect(seals).toHaveTextContent("素铭无修正，金铭增加，锈铭减少");
  expect(seals).toHaveTextContent("铭文品质修正成牌收益");
  expect(article.querySelectorAll(".handbook__topic--illustrated")).toHaveLength(3);
  expect(article.querySelectorAll("figcaption")).toHaveLength(0);
  expect(article).not.toHaveTextContent(/左上角局部|右上角局部|数字 · 命数|素铭 · 实心圆/);
  expect(article).not.toHaveTextContent(/大地|共鸣|主／副花色|有效骰|散骰|避坑|铭约|沉眠|空面|斜杠/);
  await user.click(within(article).getByRole("button", {name: "倍率机制 →"}));
  expect(screen.getByRole("article", {name: "牌型机制：回合末自动凑牌"})).toBeVisible();
});

it("combines the action procedure and six-state lookup in one navigable section", async () => {
  render(<Reader/>);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", {name: "骰子"}));
  expect(copy.chapters.find(chapter => chapter.id === "dice")!.sections.map(s => s.id)).toEqual(["face", "actions", "marks", "turn"]);
  expect(screen.queryByRole("button", {name: "骰子状态与可用性"})).toBeNull();
  expect(screen.queryByRole("button", {name: "行动流程"})).toBeNull();
  await user.click(screen.getByRole("button", {name: "行动流程与骰子状态"}));
  const article = screen.getByRole("article", {name: "行动流程与骰子状态"});
  expect(screen.getByRole("heading", {name: "行动流程与骰子状态"}).parentElement).toHaveTextContent("固定、重掷与行动可交替进行");
  const steps = article.querySelector<HTMLOListElement>(".handbook__steps")!;
  expect([...steps.querySelectorAll("h3")].map(node => node.textContent)).toEqual([
    "投掷 · ROLL", "固定", "重掷 · REROLL", "选择行动", "结束回合 · END TURN"
  ]);
  expect(within(article).getAllByRole("list", {name: "行动流程与骰子状态 · 时序"})).toHaveLength(1);
  expect(within(article).getByRole("list", {name: "行动流程与骰子状态 · 时序"}).children).toHaveLength(4);
  expect(steps).toHaveTextContent("未使用的骰子再次点击可解除固定");
  expect(steps).toHaveTextContent("基础每轮最多 2 次");
  expect(steps).toHaveTextContent("动作、力度与命数一起改变");
  expect(steps).toHaveTextContent("每枚骰每轮限行动 1 次");
  expect(steps).toHaveTextContent("未用掉的行动不会保留到下一轮");
  expect(within(article).queryByRole("heading", {name: "核心规则"})).toBeNull();
  expect(article).not.toHaveTextContent(/先固定，再行动|用过的骰子仍能凑牌/);
  const table = within(article).getByRole("table", {name: "骰子状态速查 · 规则表"});
  expect(within(table).getAllByRole("columnheader").map(node => node.textContent))
    .toEqual(["骰子状态", "能否行动", "能否成牌", "处理方法"]);
  expect(within(table).getAllByRole("rowheader").map(node => node.textContent))
    .toEqual(["未固定", "已使用（置灰）", "命数沉眠（眠）", "空面（大叉）", "封锁", "力竭（生命 0）"]);
  expect(within(table).getByRole("rowheader", {name: "封锁"}).parentElement).toHaveTextContent("可用圣水解除封锁");
  expect(within(table).getByRole("rowheader", {name: "力竭（生命 0）"}).parentElement).toHaveTextContent("本场不可用");
  expect(steps.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(article).not.toHaveTextContent(/斜杠|锁链|通关或撤离前|带做教程/);
  await user.click(screen.getByRole("button", {name: copy.ui.next}));
  expect(screen.getByRole("article", {name: "牌型机制：回合末自动凑牌"})).toBeVisible();
});

it("combines all seven supplies and conditions in one illustrated table without pricing or allowances", async () => {
  render(<Reader/>);
  const user = userEvent.setup();
  expect(screen.queryByRole("button", {name: "事件机制：专长直通＋点数保底"})).toBeNull();
  await user.click(screen.getByRole("button", {name: "其他机制"}));
  expect(copy.chapters.find(c => c.id === "other")!.sections.map(s => s.id)).toEqual(["event", "use"]);
  expect(screen.getByRole("article", {name: "事件机制：专长直通＋点数保底"})).toHaveTextContent("多人配合");
  expect(screen.getByRole("figure", {name: copy.figures["event-detail"].caption})).toBeVisible();
  await user.click(screen.getByRole("button", {name: copy.ui.next}));
  const article = screen.getByRole("article", {name: "道具与补给"});
  const table = within(article).getByRole("table");
  expect(within(table).getAllByRole("columnheader").map(node => node.textContent)).toEqual(["道具", "效果", "使用条件"]);
  expect(within(table).getAllByRole("rowheader").map(n => n.textContent)).toEqual(["食物", "药水", "护符", "圣水", "保养工具", "幸运符", "卦签"]);
  expect(article.querySelectorAll("h3, .handbook__note, .handbook__supplies")).toHaveLength(0);
  const items = section("other", "use");
  if (!("itemIcons" in items)) throw Error("item icons missing");
  for (const [i, node] of [...table.querySelectorAll("tbody th i")].entries()) {
    expect((node as HTMLElement).style.maskImage).toContain(supplyArt[items.itemIcons![i] as keyof typeof supplyArt].icon);
  }
  expect(table.querySelectorAll("tbody th i")).toHaveLength(7);
  expect(article).toHaveTextContent("可携带种类以行囊槽位为准");
  expect(article).toHaveTextContent("战斗中全队每轮最多 2 次");
  expect(article).toHaveTextContent("使用不消耗骰子行动");
  expect(article).not.toHaveTextContent(/免费|付费|配给|充能|容量|单价|归还|[0-9]+G/);
  expect(article).toHaveTextContent("次数整趟共用");
  expect(table).toHaveTextContent("每人每趟最多吃 2 次");
  expect(table).toHaveTextContent("行动阶段尚无骰面时补掷");
  expect(table).toHaveTextContent("原生／永久锈不适用");
  expect(table).toHaveTextContent("目标信息尚未揭示");
});

it("explains power first and preserves five real power details, six die figures and action targets", async () => {
  render(<Reader/>);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", {name: "骰子"}));
  await user.click(screen.getByRole("button", {name: "力度与战面"}));
  const article = screen.getByRole("article", {name: "力度与战面"});
  const power = screen.getByRole("region", {name: "力度：看右下角刻痕"});
  expect(article.firstElementChild).toBe(power);
  expect(power).toHaveTextContent("1～3 道短刻痕，对应力度 1～3");
  expect(power).toHaveTextContent("一道长刻痕代表力度 4；长刻加一道短刻，代表力度 5");
  expect(power).toHaveTextContent("力度决定攻击、格挡与治疗的基础数值");
  expect([...power.querySelectorAll("[data-power]")].map(node => node.getAttribute("data-power"))).toEqual(["1", "2", "3", "4", "5"]);
  const dice = screen.getByRole("figure", {name: copy.figures["die-actions"].caption});
  expect([...dice.querySelectorAll("[data-action]")].map(node => node.getAttribute("data-action"))).toEqual(["attack", "guard", "heal", "wild", "blank", "art"]);
  const blank = within(dice).getByRole("img", {name: "空面"});
  expect(blank.style.getPropertyValue("--expedition-die-stamp-icon")).toContain(blankCrossIcon);
  expect(blank).not.toHaveAttribute("data-asleep");
  const table = screen.getByRole("table", {name: "战面：六种基础动作 · 规则表"});
  expect(within(table).getAllByRole("columnheader").map(node => node.textContent)).toEqual(["图标", "动作", "目标", "效果"]);
  expect(within(table).getAllByRole("rowheader")).toHaveLength(6);
  expect(within(table).getByRole("rowheader", {name: "格挡"}).parentElement).toHaveTextContent("一条敌方攻击意图");
  expect(within(table).getByRole("rowheader", {name: "格挡"}).parentElement).toHaveTextContent("按力度抵消所选意图的伤害");
  expect(within(table).getByRole("rowheader", {name: "治疗"}).parentElement).toHaveTextContent("按力度恢复生命");
  const blankRow = within(table).getByRole("rowheader", {name: "空面"}).parentElement!;
  expect([...blankRow.children].map(cell => cell.textContent)).toEqual(["大叉", "空面", "无目标", "本轮没有主动动作。"]);
  expect(blankRow.querySelector("i")!.style.maskImage).toContain(blankCrossIcon);
});

it("uses the cross for blank actions independently of sleeping fate or scoring", () => {
  const {rerender} = render(<ExpeditionFlatDieFrame action="blank" fate={2} power={0} scoring label="空面"/>);
  const die = screen.getByRole("img", {name: "空面"});
  expect(die).toHaveAttribute("data-scoring", "true");
  expect(die).not.toHaveAttribute("data-asleep");
  const icon = die.style.getPropertyValue("--expedition-die-stamp-icon");
  expect(EXPEDITION_DIE_STAMP_ICONS.blank).toBe(blankCrossIcon);
  expect(icon).toContain(blankCrossIcon);
  rerender(<ExpeditionFlatDieFrame action="blank" fate={2} power={0} asleep label="空面"/>);
  expect(die).toHaveAttribute("data-asleep", "true");
  expect(die).not.toHaveAttribute("data-scoring");
  expect(die.style.getPropertyValue("--expedition-die-stamp-icon")).toBe(icon);
});

it("limits the pattern section to three rules and a three-column bonus ladder", async () => {
  render(<Reader/>);
  await userEvent.setup().click(screen.getByRole("button", {name: "倍率机制"}));
  const article = screen.getByRole("article", {name: "牌型机制：回合末自动凑牌"});
  const rules = within(article).getByRole("list");
  expect(within(rules).getAllByRole("listitem")).toHaveLength(3);
  expect(rules).toHaveTextContent("自动凑出最高级的一种牌型");
  expect(rules).toHaveTextContent("牌型倍率从 ×1.00 起步");
  expect(rules).toHaveTextContent("本层上限为 ×3.00");
  expect(rules).toHaveTextContent("1 枚金铭 +0.10，每有 1 枚锈铭 −0.10");
  expect(rules).toHaveTextContent("散牌不享受金铭加成");
  const table = within(article).getByRole("table", {name: "牌型与加成天梯表 · 规则表"});
  expect(within(table).getAllByRole("columnheader").map(node => node.textContent)).toEqual(["牌型", "达成条件（举例）", "基础加成"]);
  expect(within(table).getAllByRole("rowheader")).toHaveLength(10);
  expect(within(table).getByRole("rowheader", {name: "同花"}).parentElement).toHaveTextContent("任意四枚骰子的外框花色相同");
  expect(article.querySelectorAll(".handbook__formula, .handbook__note, .handbook__references")).toHaveLength(0);
  expect(screen.getByRole("heading", {name: "牌型机制：回合末自动凑牌"}).parentElement!.querySelector("p")).toBeNull();
  expect(article).not.toHaveTextContent(/从 ×1.00 结算一次|等价成牌|下表按|再出两对|大地|层深/);
});

it("pins the handbook's quantitative reference to the shipped catalog and hand rules", () => {
  const patterns = copy.tables["hand-patterns"];
  expect(patterns.rows.map(row => row[0]).sort()).toEqual([...Object.keys(HAND_BONUSES), "同花"].sort());
  for (const [name, , amount] of patterns.rows) {
    expect(Number(amount)).toBe(name === "同花" ? 0.6 : HAND_BONUSES[name]);
  }
  expect(catalog.journey!.handBonusCapPercent).toBe(200);
  expect(catalog.journey!.depthPercent).toEqual([100, 125, 150, 175, 200]);
  const tactical = section("other", "use");
  if (!("rows" in tactical)) throw Error("rows");
  for (const [name, effect, conditions] of tactical.rows!) {
    const def = Object.values(catalog.journey!.items).find(i => i.name === name)!;
    expect(def).toBeDefined();
    expect(effect).toBeTruthy();
    expect(conditions).toBeTruthy();
  }
  const protagonist = catalog.characters.kael.faces[1];
  expect(protagonist).toMatchObject({pip: {kind: "natural", value: 2}, power: 1, quality: "plain"});
  expect(catalog.actions[protagonist.actionId].kind).toBe("attack");
  expect(catalog.journey!.events["event.tide-cave.cache"]).toMatchObject({cost: 0, reward: 0});
  const eloraSuccesses = catalog.characters.elora.faces.filter(f => eventFaceMethod(catalog, f) !== "failed");
  expect(eloraSuccesses).toHaveLength(4);
  expect(copy.figures["event-detail"].labels).toEqual([]);
});

it("the tutorial's worked two-pair example is the real before/after application result", async () => {
  const f = await tideClientFixture(11);
  try {
    await f.start();
    for (let n = 0; n < 120; n++) {
      const record = f.session.getSnapshot().record!;
      if (record.schemaVersion !== 4 || record.snapshot.run?.kind !== "expedition") throw Error("run");
      const cursor = record.snapshot.run.state.tutorial!.guide!.cursor;
      if (TIDE_GUIDE.steps[cursor]?.id === "T3.R1.end") {
        const before = f.runtime.queries.journey(record)!;
        expect(before.battle!.hand).toMatchObject({name: "两对", bonus: 0.2, qualityModifier: 0.1, adjustedBonus: 0.3, hasBlank: true});
        expect(before.battle!.hand.dice.map(d => d.value)).toEqual([2, 2, 5, 5]);
        expect(before.economy).toMatchObject({handFactor: 2.7, layerFactor: 1, earthFactor: 1.1});
        await f.send(tideCommand(tideOperation(record)!));
        const after = f.runtime.queries.journey(f.session.getSnapshot().record!)!;
        expect(after.economy).toMatchObject({handFactor: 3, layerFactor: 1, earthFactor: 1.1});
        const example = JSON.stringify(section("rewards", "factors"));
        for (const number of ["+0.20", "+0.10", "+0.30", "×2.70", "×3.00", "×2.97", "×3.30"]) expect(example).toContain(number);
        return;
      }
      await f.send(tideCommand(tideOperation(record)!));
    }
    throw Error("Tutorial example was not reached");
  } finally {f.session.dispose();}
}, 60000);

it("gives each detailed rule one home and removes obsolete fragment pages", () => {
  const texts = copy.chapters.flatMap(c => c.sections.map(s => ({id: c.id + "/" + s.id, text: JSON.stringify(s)})));
  for (const [pattern, owner] of [
    [/全队每轮最多 2 次/, "other/use"],
    [/可携带种类以行囊槽位为准/, "other/use"],
    [/下一场战斗以 1 点生命归队/, "battle/survival"],
    [/入袋金币保留一半/, "rewards/factors"],
    [/主／副花色含尘世/, "rewards/factors"],
  ] as const) expect(texts.filter(s => pattern.test(s.text)).map(s => s.id)).toEqual([owner]);
  expect(copy.chapters.every(c => c.summary === "")).toBe(true);
  expect(texts.map(s => s.id)).not.toEqual(expect.arrayContaining(["other/healing", "other/tactical"]));
  expect(copy.chapters.find(c => c.id === "rewards")!.sections.map(s => s.id)).toEqual(["patterns", "factors"]);
  expect(copy.chapters.find(c => c.id === "characters")!.sections.map(s => s.id)).toEqual(["overview"]);
  expect(JSON.stringify(copy)).not.toMatch(/推荐顺序|避坑|温馨提示|关系晶石|淬毒飞刀|教程可重试|共鸣|后续开放|勇者|玛丽埃塔|尤斯缇丝|艾洛拉|柯萝萝|诺玛/);
});

it("keeps only generic character mechanics and delegates character details to their profiles", async () => {
  render(<Reader/>);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", {name: "角色词条"}));
  const article = screen.getByRole("article", {name: "角色能力与配置"});
  expect(within(article).getAllByRole("table")).toHaveLength(1);
  expect(within(article).getAllByRole("rowheader").map(n => n.textContent))
    .toEqual(["骰面动作", "铭约", "编队效果", "装备", "成长"]);
  expect(article).toHaveTextContent("具体骰面、铭约条款与成长效果见角色档案");
  expect(article).toHaveTextContent("进行中的远征沿用出征时配置");
  expect(article).toHaveTextContent("持有者须存活且未封锁");
  expect(article).toHaveTextContent("各条铭约独立判断");
  expect(article).toHaveTextContent("保留命数、花色、品质与醒眠状态");
  expect(article).toHaveTextContent("无需靠本轮骰子成牌");
  expect(article.querySelectorAll("h3, .handbook__topic, .handbook__note")).toHaveLength(0);
  expect(article).not.toHaveTextContent(/共鸣|后续开放|勇者|主角|玛丽埃塔|尤斯缇丝|艾洛拉|柯萝萝|诺玛|雨夜之盟|天王威慑|飞刀|提线|Lv\.[23]/);
});

it("explains specialty matching and fate fallback for selected participants in neutral rule language", async () => {
  render(<Reader/>);
  await userEvent.setup().click(screen.getByRole("button", {name: "其他机制"}));
  const article = screen.getByRole("article", {name: "事件机制：专长直通＋点数保底"});
  const introduction = within(article).getByRole("region", {name: "专属六面，独立判定"});
  expect(introduction).toHaveTextContent("参与人数由事件选项决定");
  expect(introduction).toHaveTextContent("不消耗战斗骰，无法重掷");
  const steps = article.querySelector<HTMLOListElement>(".handbook__steps")!;
  expect(within(steps).getAllByRole("listitem")).toHaveLength(2);
  expect(steps).toHaveTextContent("低命数与沉眠均不影响战面匹配");
  expect(steps).toHaveTextContent("战面条件未满足时，汇总参与队员");
  expect(steps).toHaveTextContent("沉眠计 0");
  expect(steps).toHaveTextContent("万能命数取该事件允许的最大值");
  expect(steps).toHaveTextContent("点数仍不足则失败");
  const table = within(article).getByRole("table", {name: "单人尝试与多人配合 · 规则表"});
  expect(within(table).getAllByRole("rowheader").map(n => n.textContent)).toEqual(["单人处理", "多人配合"]);
  expect(table).toHaveTextContent("每人贡献一枚骰面");
  expect(table).toHaveTextContent("合计参与队员的战面匹配数量，或汇总清醒命数");
  const results = within(article).getByRole("region", {name: "三种最终结果"});
  expect(within(results).getAllByRole("listitem")).toHaveLength(3);
  expect(results).toHaveTextContent("不附加额外代价");
  expect(results).toHaveTextContent("可能减少报酬或附带消耗");
  expect(results).toHaveTextContent("不按战斗团灭处理");
  expect(article).not.toHaveTextContent(/全员|对不对口|够不够大|动作完全对口|过关|暴力破拆|怎么派人/);
  const event = section("other", "event");
  if (!("explanation" in event)) throw Error("Event introduction is missing");
  expect(event.explanation).not.toHaveProperty("closing");
  const figure = within(introduction).getByRole("figure", {name: "个人骰面适配"});
  expect(within(figure).getByRole("img")).toBeVisible();
  expect(figure.querySelectorAll(".handbook__mark, .handbook__legend")).toHaveLength(0);
});

it("keeps situational instructions direct and leaves detailed multiplier arithmetic in the handbook", () => {
  const sources = [guidedCopy, basicCopy, tideCopy];
  const text = JSON.stringify([copy, ...sources]);
  expect(text).not.toMatch(/先看看|去看看|看懂|准备好后|确认好|安排好后|不必强行|对不对口|够不够大|我们再|温馨提示|推荐顺序|你看这里/);
  for (const source of sources) for (const step of Object.values(source.steps)) {
    expect(step.title).toBeTruthy();
    expect(step.text).toMatch(/[。；]/);
    expect([...step.text.replace(/\{\w+\}/g, "1.00")].length).toBeLessThanOrEqual(110);
  }
  expect(guidedCopy.steps.participant.text).toContain("成功判定面");
  expect(guidedCopy.steps.participant.text).not.toMatch(/事件由一名队员尝试|不是全队/);
  expect(guidedCopy.steps.multiplier.text).toContain("两对已成型");
  expect(guidedCopy.steps.multiplier.text).toContain("金币倍率上涨");
  expect(guidedCopy.steps.multiplier.text).toContain("追击");
  expect(JSON.stringify(guidedCopy)).not.toMatch(/稳住|记住|金钟罩|\{\w+\}/);
  expect(JSON.stringify(copy)).toContain("×2.70");
  expect(JSON.stringify(copy)).toContain("×3.00");
  expect(guidedCopy.steps.singleGuard.text).toContain("格挡仅抵消所选的一条意图");
  expect(guidedCopy.steps.firstActor.text).toContain("每名队员每轮限行动 1 次");
});
