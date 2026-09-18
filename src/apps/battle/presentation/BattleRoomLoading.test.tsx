import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BattleRoomLoading } from "./BattleRoomLoading";
afterEach(()=>{cleanup();vi.useRealTimers();});
it("does not flash a loading plaque on a short resource hold",()=>{
  vi.useFakeTimers();
  const {container,rerender}=render(<BattleRoomLoading state="loading" location="服务走廊" onRetry={()=>{}}/>);
  expect(container.querySelector(".scene-loading-plaque")).toBeNull();
  act(()=>vi.advanceTimersByTime(100));
  rerender(<BattleRoomLoading state="revealing" location="服务走廊" onRetry={()=>{}}/>);
  act(()=>vi.advanceTimersByTime(400));
  expect(container.querySelector(".scene-loading-plaque")).toBeNull();
});
it("shows the shared plaque for longer waits, and an immediately actionable error",()=>{
  vi.useFakeTimers();
  const {container,rerender}=render(<BattleRoomLoading state="loading" location="服务走廊" onRetry={()=>{}}/>);
  act(()=>vi.advanceTimersByTime(300));
  expect(container.querySelector(".scene-loading-plaque")).toBeInTheDocument();
  expect(screen.getByText("服务走廊")).toBeInTheDocument();
  rerender(<BattleRoomLoading state="error" location="服务走廊" onRetry={()=>{}}/>);
  expect(screen.getByRole("alert")).toHaveTextContent("进度已保存");
  expect(screen.getByRole("button",{name:"重新加载画面"})).toBeEnabled();
});
it("keeps the plaque mounted when retrying an immediately failed load",()=>{
  vi.useFakeTimers();
  const {container,rerender}=render(<BattleRoomLoading state="error" location="服务走廊" onRetry={()=>{}}/>);
  const plaque=container.querySelector(".scene-loading-plaque");
  rerender(<BattleRoomLoading state="loading" location="服务走廊" onRetry={()=>{}}/>);
  expect(container.querySelector(".scene-loading-plaque")).toBe(plaque);
  expect(screen.getByRole("status")).toHaveTextContent("正在载入场景");
});
