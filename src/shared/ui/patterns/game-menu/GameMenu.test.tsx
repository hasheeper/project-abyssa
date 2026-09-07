import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GameMenu } from "./GameMenu";
afterEach(cleanup);
it("同一栏直接列出操作和导航，展开不产生分类或二级菜单；Escape还焦", () => {
  const command=vi.fn();render(<GameMenu commands={[{id:"end",label:"结束回合",onSelect:command}]} navigation={[{id:"home",label:"洋馆",href:"./mansion.html?save=one"}]}/>);
  const toggle=screen.getByRole("button",{name:"展开菜单"});
  expect(screen.getByRole("button",{name:"结束回合"})).toBeInTheDocument();
  expect(screen.getByRole("link",{name:"洋馆"})).toHaveAttribute("href","./mansion.html?save=one");
  fireEvent.click(toggle);
  const rail=screen.getByRole("complementary",{name:"游戏菜单"});
  expect(rail).toHaveAttribute("data-expanded");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("button",{name:"行动菜单"})).toBeNull();
  toggle.focus();fireEvent.keyDown(toggle,{key:"ArrowDown"});expect(screen.getByRole("button",{name:"结束回合"})).toHaveFocus();
  fireEvent.keyDown(rail,{key:"Escape"});expect(toggle).toHaveFocus();expect(rail).not.toHaveAttribute("data-expanded");
  expect(command).not.toHaveBeenCalled();
  fireEvent.click(toggle);fireEvent.pointerDown(document.body);expect(rail).not.toHaveAttribute("data-expanded");
});
it("收拢和展开状态遵守相同的busy与占位约束，命令只提交一次", () => {
  const end=vi.fn(), retreat=vi.fn();const props={commands:[{id:"end",label:"结束回合",onSelect:end},{id:"retreat",label:"撤退",detail:"尚未开放",disabled:true,onSelect:retreat}],navigation:[]};
  const {rerender}=render(<GameMenu {...props}/>);
  fireEvent.click(screen.getByRole("button",{name:"撤退"}));expect(retreat).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"展开菜单"}));
  rerender(<GameMenu {...props} busy/>);expect(screen.getByRole("button",{name:"结束回合"})).toBeDisabled();
  rerender(<GameMenu {...props}/>);fireEvent.click(screen.getByRole("button",{name:"结束回合"}));
  expect(end).toHaveBeenCalledTimes(1);expect(screen.getByRole("button",{name:"展开菜单"})).toHaveFocus();
});
