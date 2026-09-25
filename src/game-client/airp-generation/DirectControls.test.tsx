import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { DirectDriverState } from "../../game-runtime/airp-direct-driver";
import type { PoolRecord } from "../../game-application/testing/airp-pool-playthrough";
import { directReturnGate } from "../../game-application/testing/airp-direct-playthrough";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { aiConfiguration } from "../../game-runtime/airp-configuration";
import { DirectControls } from "./DirectControls";

const mock = vi.hoisted(() => ({
  record: null as PoolRecord | null, state: null as DirectDriverState | null,
  session: {getSnapshot: () => ({status: "ready"}), dispatch: vi.fn(), locator: {saveId: "pool", epoch: "test"}, runtime: {application: {open: vi.fn()}}},
  run: vi.fn(), cancel: vi.fn(), retryCommit: vi.fn(), readView: vi.fn(),
}));
vi.mock("../react", () => ({
  useGameSession: () => mock.session,
  useGameState: () => {mock.readView(); return {record: mock.record, status: "ready"};},
  downloadJson: vi.fn(),
}));
vi.mock("../../game-runtime/airp-direct-driver", async original => ({...await original<object>(), createDirectGameDriver: () => ({
  subscribe: () => () => {}, getSnapshot: () => mock.state, run: mock.run, cancel: mock.cancel, retryCommit: mock.retryCommit,
  exportPending: () => '{"test":true}',
})}));
let fixture: PoolRecord;
beforeAll(async () => {fixture = await (await directReturnGate("extracted")).read();}, 120000);
beforeEach(() => {
  mock.record = fixture; mock.state = {busy: false, error: null, pendingResult: false, operation: null};
  mock.run.mockClear(); mock.cancel.mockClear(); mock.retryCommit.mockClear(); mock.readView.mockClear();
  mock.session.dispatch.mockClear(); mock.session.runtime.application.open.mockClear();
  aiConfiguration.patch({baseUrl: "https://example.invalid/v1", commonKey: ""});
});
afterEach(() => {cleanup(); vi.useRealTimers();});
const mount = () => render(<UiMotionProvider preference="reduced"><DirectControls sceneId={fixture.airpDirect!.tasks[0].sceneId}/></UiMotionProvider>);
const requesting = (): DirectDriverState => ({busy: true, error: null, pendingResult: false, operation: {id: 1, sceneId: fixture.airpDirect!.tasks[0].sceneId,
  saveId: fixture.head.saveId, epoch: fixture.head.epoch, mode: "generate", phase: "requesting", stage: "planning", repair: false, phaseStartedAt: Date.now()}});

it("keeps details folded and opens settings without a model call", async () => {
  const user = userEvent.setup(), {container} = mount();
  expect(container.querySelector('.airp-direct-diagnostics')).not.toHaveAttribute('open');
  await user.click(screen.getByRole('button', {name: '打开AI设置'}));
  expect(screen.getByRole('dialog', {name: '系统设置'})).toBeInTheDocument();
  expect(screen.getByRole('tab', {name: 'Model'})).toHaveAttribute('aria-selected', 'true');
  expect(container.querySelector('.airp-direct-progress .airp-direct-settings')).toBeNull();
  expect(mock.run).not.toHaveBeenCalled(); expect(mock.session.dispatch).not.toHaveBeenCalled();
});

it("ticks only the elapsed leaf, not the save projection or aria-live text", async () => {
  vi.useFakeTimers(); mock.state = requesting();
  const {container} = mount(), renders = mock.readView.mock.calls.length;
  const announcement = container.querySelector('.airp-direct-status')!.textContent;
  await act(async () => {vi.advanceTimersByTime(5000);});
  expect(screen.getByText('已等待 00:05')).toBeInTheDocument();
  expect(mock.readView).toHaveBeenCalledTimes(renders);
  expect(container.querySelector('.airp-direct-status')!.textContent).toBe(announcement);
  expect(container.querySelector('.airp-direct-status .airp-direct-elapsed')).toBeNull();
  expect(mock.run).not.toHaveBeenCalled(); expect(mock.session.runtime.application.open).not.toHaveBeenCalled();
});

it("saving is quiet; a retained failure exposes only save recovery and export", async () => {
  const user = userEvent.setup(); mock.state = {...requesting(), pendingResult: true}; mock.state.operation!.phase = 'saving';
  const view = mount();
  expect(screen.getByText('创作已返回，正在保存')).toBeInTheDocument();
  expect(screen.queryByRole('button', {name: '仅重试保存输出'})).toBeNull();
  expect(screen.queryByRole('button', {name: '取消请求'})).toBeNull();
  mock.state = {...mock.state, busy: false, operation: {...mock.state.operation!, phase: 'save-failed'}};
  view.rerender(<UiMotionProvider preference="reduced"><DirectControls sceneId={fixture.airpDirect!.tasks[0].sceneId}/></UiMotionProvider>);
  expect(screen.getByRole('button', {name: '使用手写稿'})).toBeDisabled();
  await user.click(screen.getByRole('button', {name: '仅重试保存输出'}));
  expect(mock.retryCommit).toHaveBeenCalledTimes(1); expect(mock.run).not.toHaveBeenCalled();
});

it("does not expose another scene's retained output or controls in an old record", () => {
  mock.record = structuredClone(fixture);
  const old = {...mock.record.airpDirect!.tasks[0], id: 'old-task', sceneId: 'old-scene', source: 'browser-direct' as const};
  mock.record.airpDirect!.tasks.push(old);
  mock.state = {...requesting(), busy: false, pendingResult: true, error: 'private scene error'};
  mock.state.operation!.phase = 'save-failed';
  render(<UiMotionProvider preference="reduced"><div data-testid="old"><DirectControls sceneId="old-scene"/></div><div data-testid="current"><DirectControls sceneId={fixture.airpDirect!.tasks[0].sceneId}/></div></UiMotionProvider>);
  expect(screen.getByTestId('old')).not.toHaveTextContent('private scene error');
  expect(screen.getByTestId('old').querySelector('.airp-direct-actions')?.textContent).not.toContain('导出未保存');
  expect(within(screen.getByTestId('current')).getByRole('button', {name: '仅重试保存输出'})).toHaveTextContent('重试保存');
});
