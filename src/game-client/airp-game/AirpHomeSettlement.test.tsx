import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { formalHomeFixture } from "../../game-application/testing/airp-home-fixture";
import { GameSession } from "../session";
import { GameGate, GameSessionScope } from "../react";
import { DirectorScene } from "../airp-director/DirectorScene";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { disposeBackgroundTasks } from "../airp-generation/background-tasks";
import * as configuration from "../../game-runtime/airp-configuration";
import * as routing from "../../shared/routing/location";
import { pendingHomeBoundary } from "../../game-runtime/airp-game-runtime";

const locks = Object.getOwnPropertyDescriptor(navigator, "locks");
afterEach(() => {
  cleanup(); disposeBackgroundTasks(); vi.restoreAllMocks();
  if (locks) Object.defineProperty(navigator, "locks", locks); else Reflect.deleteProperty(navigator, "locks");
});

it("gives the completed home boundary one input owner and can collapse it without pausing or generating", async () => {
  const f = await formalHomeFixture();
  const session = new GameSession(f.runtime, { saveId: "formal-airp", epoch: "epoch:1" },
    { getItem: () => null, setItem() {}, removeItem() {} });
  await session.refresh();
  const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected model request"));
  const navigate = vi.spyOn(routing, "navigateTo").mockReturnValue(true), exit = vi.fn();
  const before = f.raw();
  render(<UiMotionProvider preference="reduced"><GameSessionScope session={session}>
    <GameGate><p>洋馆页面</p><button onClick={exit}>返回菜单</button><DirectorScene/></GameGate>
  </GameSessionScope></UiMotionProvider>);
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "结算并查看结果" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "收起" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 5000 });
  fireEvent.click(screen.getByRole("button", { name: /杯沿的一点热气.*查看进度/ }));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(f.raw()).toEqual(before);
  expect(fetch).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();

  const original = configuration.effectiveAiConfiguration;
  vi.spyOn(configuration, "effectiveAiConfiguration").mockImplementation(state => {
    const value = original(state);
    return { ...value, keys: { ...value.keys, updater: "fake-settlement-key" }, models: {
      ...value.models, updater: { baseUrl: "https://settlement.invalid/v1", model: "fixture", timeoutMs: 300000 },
    } };
  });
  Object.defineProperty(navigator, "locks", { configurable: true, value: {
    request: async (_key: string, _options: unknown, run: () => Promise<unknown>) => run(),
  } });
  let aborted = false;
  fetch.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init!.signal!.addEventListener("abort", () => { aborted = true; reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  }));
  fireEvent.click(screen.getByRole("button", { name: "结算并查看结果" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1), { timeout: 5000 });
  const attempt = f.raw().airpGame!.settlement.jobs[0].attempts[0];
  expect(attempt.status).toBe("running");
  fireEvent.click(screen.getByRole("button", { name: "收起" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 5000 });
  fireEvent.click(screen.getByRole("button", { name: "返回菜单" }));
  expect(exit).toHaveBeenCalledOnce(); expect(aborted).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: /杯沿的一点热气.*查看进度/ }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "停止请求" })); });
  await waitFor(() => expect(screen.getByRole("button", { name: "仅记程序事实并继续（不评估关系与叙事状态）" })).toBeEnabled(), { timeout: 5000 });
  expect(aborted).toBe(true);
  expect(f.raw().airpGame!.settlement.jobs[0].attempts[0]).toMatchObject({ error: "cancelled", outcomeUnknown: true });
  expect(f.raw().airpGame!.settlement.memories).toEqual([]);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "仅记程序事实并继续（不评估关系与叙事状态）" })); });
  await waitFor(() => expect(pendingHomeBoundary(f.raw())).toBeNull(), { timeout: 5000 });
  await waitFor(() => expect(screen.getByText("已保存程序事实；本次未评估关系与叙事状态。")).toBeInTheDocument(), { timeout: 5000 });
  expect(fetch).toHaveBeenCalledTimes(1);
  await f.send({ type: "advance-phase" });
  expect(f.raw().snapshot.campaign.clock).not.toEqual(before.snapshot.campaign.clock);
  session.dispose();
}, 40000);
