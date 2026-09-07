import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ItemDock, type DockItem } from "./ItemDock";
afterEach(cleanup);
const make = (select = vi.fn()): DockItem => ({id:"potion-1", name:"药水",icon:"potion.svg",description:"恢复2点生命",charges:2,targets:[{id:"member:kael",label:"凯尔",onSelect:select}]});
it("七槽含空位；选择不消耗，取消不提交，目标只提交一次", () => {
  const use = vi.fn(); render(<ItemDock items={[make(use)]} busy={false}/>);
  expect(within(screen.getByRole("list",{name:"携带道具"})).getAllByRole("listitem")).toHaveLength(7);
  expect(screen.getByLabelText("空槽 7")).toBeVisible();
  const slot = screen.getByRole("button",{name:"药水，剩余 2 次"});
  fireEvent.click(slot); expect(use).not.toHaveBeenCalled();
  fireEvent.keyDown(slot,{key:"Escape"}); expect(slot).toHaveFocus();
  expect(screen.queryByRole("button",{name:"凯尔"})).toBeNull();
  fireEvent.click(slot); fireEvent.click(screen.getByRole("button",{name:"凯尔"}));
  expect(use).toHaveBeenCalledTimes(1); expect(screen.queryByRole("button",{name:"凯尔"})).toBeNull();
});
it("已打开的目标受最新busy与查询约束；零次数保留槽位和原因", () => {
  const use=vi.fn(), item=make(use);
  const {rerender}=render(<ItemDock items={[item]} busy={false}/>);
  fireEvent.click(screen.getByRole("button",{name:/药水，剩余/}));
  rerender(<ItemDock items={[item]} busy/>);
  expect(screen.getByRole("button",{name:"凯尔"})).toBeDisabled();
  fireEvent.click(screen.getByRole("button",{name:"凯尔"}));expect(use).not.toHaveBeenCalled();
  rerender(<ItemDock items={[{...item,charges:0,targets:[],unavailableReason:"已用尽"}]} busy={false}/>);
  fireEvent.click(screen.getByRole("button",{name:"返回道具"}));
  const slot=screen.getByRole("button",{name:"药水，剩余 0 次"});
  expect(slot).toHaveAttribute("aria-disabled","true");fireEvent.click(slot);
  expect(screen.queryByRole("region",{name:"药水的使用目标"})).toBeNull();
});
