import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within, renderHook, act } from "@testing-library/react";
import { ExpeditionBattleSidebar, type ExpeditionBattleSidebarProps } from "./ExpeditionBattleSidebar";
import { demoBattleReaction, legacyBattleReaction, makeBattleReaction, useBattleReaction } from "./battle-reactions";
import type { DemoEvent } from "../../../game-core/battle";
import type { BattleEvent } from "../view";

afterEach(cleanup);
function Subject(props: ExpeditionBattleSidebarProps) { return <ExpeditionBattleSidebar {...props}/>; }
const base: ExpeditionBattleSidebarProps = {
  partyIds: ["kael", "eustice", "elora", "kororo", "norma"], reaction: null,
  engine: {location: "克雷格旧庄园", layer: 2, round: 3, gold: 12, bagGold: 83, deepestLayer: 2, log: [{layer: 2, round: 3, text: "已入袋", tone: "gold"}]},
  handFactor: 1.3, layerFactor: 1.4, projected: 24, earthFactor: 1.1, layerClearPending: false,
};
it("右栏仪表保留机械读数，下拉账簿；点击记录后Escape仍归还焦点、外部点击关闭", () => {
  render(<Subject {...base}/>);
  const toggle = screen.getByRole("button", {name: "远征账本"});
  expect(screen.getAllByLabelText("当前总倍率 2.00").filter(el => !el.closest('[aria-hidden="true"]'))).toHaveLength(1);
  expect(screen.getAllByLabelText("包裹 83 枚金币").filter(el => !el.closest('[aria-hidden="true"]'))).toHaveLength(1);
  expect(screen.queryByRole("region", {name: "账本详情"})).toBeNull();
  fireEvent.click(toggle);
  const panel = screen.getByRole("region", {name: "账本详情"});
  expect(screen.getByLabelText("包裹 83 枚金币").querySelectorAll(".abyssa-expedition-odometer__reel")).toHaveLength(6);
  expect(screen.getByLabelText("0 枚远古晶石").closest(".abyssa-expedition-purse")).not.toBeNull();
  expect(panel.querySelector(".abyssa-expedition-odometer")).toBeNull();
  expect(within(panel).queryByText("CUMULATIVE MULTIPLIER")).toBeNull();
  expect(within(panel).queryByText("BAG & MATERIALS")).toBeNull();
  expect(within(panel).getByText("已入袋")).toBeVisible();
  fireEvent.pointerDown(within(panel).getByText("已入袋"));
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  // Non-focusable record text can leave browser focus on the document body.
  fireEvent.keyDown(document.body, {key: "Escape"});
  expect(toggle).toHaveFocus();
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(toggle);
  fireEvent.pointerDown(document.body);
  expect(toggle).toHaveAttribute("aria-expanded", "false");
});
it("回忆摘要不冒充远征收益，保留护域、实伤和原暂离命令", () => {
  const leave = vi.fn();
  const {rerender} = render(<Subject {...base} memory={{protection: 2, preview: "本次实伤：1", busy: true, onLeave: leave}}/>);
  expect(screen.getByLabelText("侍偶护域 · 2")).toBeVisible();
  expect(within(screen.getByRole("complementary", {name: "同行伙伴"})).getByText("本次实伤：1")).toBeVisible();
  const toggle = screen.getByRole("button", {name: "回忆战记录"});
  expect(toggle).not.toHaveTextContent("83");
  fireEvent.click(toggle);
  expect(screen.getByRole("button", {name: "暂离回忆"})).toBeDisabled();
  rerender(<Subject {...base} memory={{protection: 1, preview: null, busy: false, onLeave: leave}}/>);
  fireEvent.click(screen.getByRole("button", {name: "暂离回忆"}));
  expect(leave).toHaveBeenCalledTimes(1);
});
it("仅已提交动作/事件判定产生反应，AOE命中不重复发声", () => {
  const action: DemoEvent = {id:"action-1", type:"action-resolved", actorId:"elora", payload:{choice:"guard-all"}};
  const damage: DemoEvent = {id:"hit-1", type:"damage-applied", actorId:"elora", payload:{targetId:"enemy-1",applied:1}};
  expect(demoBattleReaction([damage], "request-1")).toBeNull();
  const response = demoBattleReaction([damage, {...damage,id:"hit-2"}, action],"request-1")!;
  expect(response).toMatchObject({actorId:"elora",kind:"guard"});
  expect(demoBattleReaction([action], "request-1")).toEqual(response);
  expect(demoBattleReaction([{...action,type:"event-resolved",payload:{method:"failed"}}], "request-2")).toMatchObject({kind:"failure"});
  const legacy = {id:"legacy-1",type:"action-resolved",payload:{actorId:"kororo",verb:"blank"}} as BattleEvent;
  expect(legacyBattleReaction([legacy],"request-3")).toMatchObject({actorId:"kororo",kind:"blank"});
  expect(makeBattleReaction("player-action","kael","attack")).toBeNull();
});
it("同一回执重放和空结果不刷新反应；清空不写入存档", () => {
  const {result} = renderHook(useBattleReaction);
  const response = makeBattleReaction("committed-1","norma","attack")!;
  act(() => result.current.observe(response));
  const first = result.current.reaction;
  act(() => {result.current.observe({...response}); result.current.observe(null);});
  expect(result.current.reaction).toBe(first);
  act(() => result.current.clear());
  expect(result.current.reaction).toBeNull();
});
it("敌方或离队角色不能占用同行位，未参战玛不出现在历史队伍中", () => {
  render(<Subject {...base} reaction={makeBattleReaction("enemy-action","marietta","bind")}/>);
  expect(screen.getByRole("region",{name:"尤斯缇丝的战斗反应"})).toBeVisible();
  expect(screen.queryByRole("region",{name:"玛丽埃塔的战斗反应"})).toBeNull();
});
