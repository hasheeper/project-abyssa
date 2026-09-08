import { useEffect, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../shared/loading/startup", () => ({prepareGame:vi.fn(async () => {})}));
vi.mock("./routes", () => ({loadRoute:vi.fn(),routeTitles:{title:"标题",map:"地图",mansion:"洋馆"}}));
import { prepareGame } from "../shared/loading/startup";
import { loadRoute } from "./routes";
import { navigateTo } from "../shared/routing/location";
import { SceneTransitionProvider, useSceneReady } from "../shared/transition/TransitionProvider";
import { GameShell } from "./GameShell";

const advance = (ms = 1500) => act(() => vi.advanceTimersByTimeAsync(ms));
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); history.replaceState(null,"","/abyssa/#/title"); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("prepares once, shares one curtain, and unmounts the old page's live effects", async () => {
  let live = 0, disposed = 0;
  function Title() { useEffect(() => { live++; return () => {live--;disposed++;}; },[]); return <SceneTransitionProvider><p>标题页</p></SceneTransitionProvider>; }
  function Map() { const [ready,setReady] = useState(false); useSceneReady(ready); return <button onClick={() => setReady(true)}>地图准备完成</button>; }
  vi.mocked(loadRoute).mockImplementation(async page => ({default:page === "title" ? Title : Map}));
  const {container} = render(<GameShell/>); await advance();
  expect(live).toBe(1); expect(container.querySelectorAll(".scene-transition")).toHaveLength(1);
  act(() => { navigateTo("#/map?save=test&epoch=one"); }); await advance(9000);
  expect(live).toBe(0); expect(disposed).toBe(1); expect(screen.queryByText("标题页")).toBeNull();
  expect(container.querySelector(".scene-transition")).toHaveAttribute("data-phase","closed");
  fireEvent.click(screen.getByText("地图准备完成")); await advance();
  expect(container.querySelector(".scene-transition")).toHaveAttribute("data-phase","idle");
  expect(location.hash).toBe("#/map?save=test&epoch=one"); expect(prepareGame).toHaveBeenCalledTimes(1);
  act(() => { navigateTo("#/title"); }); await advance();
  expect(live).toBe(1); expect(prepareGame).toHaveBeenCalledTimes(1);
});

it("allows a saved-story redirect under the closed curtain without deadlocking on the old data hold", async () => {
  function Redirect() { useSceneReady(false); useEffect(() => {navigateTo("#/mansion?save=a&epoch=b",{replace:true,cinematic:true});},[]); return null; }
  vi.mocked(loadRoute).mockImplementation(async page => ({default:page === "map" ? Redirect : () => <p>{page}</p>}));
  const {container} = render(<GameShell/>); await advance();
  act(() => {navigateTo("#/map");}); await advance(3000);
  expect(location.hash).toBe("#/mansion?save=a&epoch=b");
  expect(container.querySelector(".scene-transition")).toHaveAttribute("data-phase","idle");
  expect(container.querySelectorAll(".scene-transition")).toHaveLength(1);
});

it("keeps chunk failures behind the same retryable curtain", async () => {
  const warn = vi.spyOn(console,"error").mockImplementation(() => {});
  vi.mocked(loadRoute).mockResolvedValue({default:() => <p>页面</p>});
  const {container} = render(<GameShell/>); await advance();
  vi.mocked(loadRoute).mockRejectedValueOnce(new Error("offline"));
  act(() => {navigateTo("#/map");}); await advance();
  expect(screen.getByRole("alert")).toHaveTextContent("连接未完成");
  expect(location.hash).toBe("#/title");
  fireEvent.click(screen.getByRole("button",{name:"重试"})); await advance();
  expect(location.hash).toBe("#/map"); expect(prepareGame).toHaveBeenCalledTimes(1);
  expect(container.querySelector(".scene-transition")).toHaveAttribute("data-phase","idle");
  warn.mockRestore();
});

it("cancels an in-flight route when back returns to the currently visible page", async () => {
  let finish!: (module: Awaited<ReturnType<typeof loadRoute>>) => void;
  vi.mocked(loadRoute).mockImplementation(page => page === "map" ? new Promise(resolve => {finish=resolve;}) : Promise.resolve({default:() => <p>标题页</p>}));
  const {container} = render(<GameShell/>); await advance();
  // A user-edited hash starts a slow route, then Back returns before its chunk finishes.
  act(() => { history.pushState(null,"","#/map"); window.dispatchEvent(new PopStateEvent("popstate")); }); await advance(600);
  act(() => { history.replaceState(null,"","#/title"); window.dispatchEvent(new PopStateEvent("popstate")); }); await advance();
  await act(async () => finish({default:() => <p>迟到的地图</p>})); await advance();
  expect(screen.queryByText("迟到的地图")).toBeNull();
  expect(location.hash).toBe("#/title"); expect(container.querySelector(".scene-transition")).toHaveAttribute("data-phase","idle");
});
