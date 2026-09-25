import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GameMenu } from "./GameMenu";
afterEach(cleanup);

it("折叠栏保留直接入口，展开显示英文，方向键与 Escape 正常还焦", () => {
  const command = vi.fn();
  render(<GameMenu commands={[{id:"end",label:"结束回合",onSelect:command}]} navigation={[
    {id:"home",label:"洋馆",href:"./mansion.html?save=one"},
    {id:"menu",label:"返回菜单",shortLabel:"MENU",href:"./menu.html?save=one"},
  ]}/>);
  const end = screen.getByRole("button",{name:"结束回合"});
  const mansion = screen.getByRole("link",{name:"洋馆"});
  const back = screen.getByRole("link",{name:"返回菜单"});
  const toggle = screen.getByRole("button",{name:"展开菜单"});
  const rail = screen.getByRole("complementary",{name:"游戏菜单"});
  expect(toggle).toHaveAttribute("aria-expanded","false");
  expect(rail).not.toHaveAttribute("data-expanded");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded","true");
  expect(rail).toHaveAttribute("data-expanded");
  expect(back.querySelector(".game-menu__label--compact")).toHaveTextContent(/^MENU$/);
  expect(back.querySelector(".game-menu__label--expanded")).toHaveTextContent(/^MENU$/);
  expect(back).toHaveAttribute("title","返回菜单");
  expect(mansion).toHaveAttribute("href","./mansion.html?save=one");
  end.focus();
  fireEvent.keyDown(end,{key:"ArrowDown"}); expect(mansion).toHaveFocus();
  fireEvent.keyDown(mansion,{key:"End"}); expect(back).toHaveFocus();
  fireEvent.keyDown(back,{key:"ArrowDown"}); expect(toggle).toHaveFocus();
  fireEvent.keyDown(toggle,{key:"ArrowUp"}); expect(back).toHaveFocus();
  fireEvent.keyDown(back,{key:"Home"}); expect(toggle).toHaveFocus();
  fireEvent.keyDown(toggle,{key:"ArrowDown"}); expect(end).toHaveFocus();
  fireEvent.keyDown(end,{key:"Escape"});
  expect(rail).not.toHaveAttribute("data-expanded");
  expect(toggle).toHaveFocus();
  fireEvent.click(toggle);
  fireEvent.pointerDown(document.body);
  expect(rail).not.toHaveAttribute("data-expanded");
  expect(command).not.toHaveBeenCalled();
});

it("忙碌时禁止导航和操作，方向键跳过占位，命令只提交一次", () => {
  const end = vi.fn(), retreat = vi.fn();
  const props = {commands:[
    {id:"end",label:"结束回合",onSelect:end},
    {id:"retreat",label:"撤退",detail:"尚未开放",disabled:true,onSelect:retreat},
  ],navigation:[{id:"menu",label:"返回菜单",shortLabel:"MENU",href:"./menu.html"}]};
  const {rerender} = render(<GameMenu {...props}/>);
  fireEvent.click(screen.getByRole("button",{name:"撤退"})); expect(retreat).not.toHaveBeenCalled();
  const action = screen.getByRole("button",{name:"结束回合"});
  action.focus(); fireEvent.keyDown(action,{key:"ArrowDown"});
  expect(screen.getByRole("link",{name:"返回菜单"})).toHaveFocus();
  rerender(<GameMenu {...props} busy/>);
  expect(screen.getByRole("button",{name:"结束回合"})).toBeDisabled();
  expect(screen.getByRole("button",{name:"返回菜单"})).toBeDisabled();
  expect(screen.queryByRole("link")).toBeNull();
  rerender(<GameMenu {...props}/>);
  fireEvent.click(screen.getByRole("button",{name:"展开菜单"}));
  fireEvent.click(screen.getByRole("button",{name:"结束回合"}));
  expect(end).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("complementary",{name:"游戏菜单"})).not.toHaveAttribute("data-expanded");
});
