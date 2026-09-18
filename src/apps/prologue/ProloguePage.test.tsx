import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProloguePage } from "./ProloguePlayer";

vi.mock("../../game-runtime/browser", () => ({createBrowserGameRuntime: () => {throw Error("storage unavailable");}}));
afterEach(() => {cleanup();sessionStorage.clear();history.replaceState(null,"","/");vi.useRealTimers();});

it.each([
  ["/#/prologue", "请先选择档案，再进入游戏。"],
  ["/#/prologue?save=unavailable&epoch=one", "本机存档暂不可用，请重试。"],
])("reveals a recoverable gate instead of deadlocking the CG curtain at %s", async (url, message) => {
  vi.useFakeTimers();
  history.replaceState(null,"",url);
  sessionStorage.setItem("abyssa:scene-handoff:v1",JSON.stringify({target:location.pathname+location.search,issuedAt:Date.now(),destination:"序幕"}));
  await act(async () => {render(<ProloguePage/>);});
  await act(() => vi.advanceTimersByTimeAsync(1500));
  expect(screen.getByRole("alert")).toHaveTextContent(message);
  expect(screen.getByRole("link",{name:"选择档案"})).toBeVisible();
  expect(document.documentElement).not.toHaveAttribute("data-scene-transition");
});
