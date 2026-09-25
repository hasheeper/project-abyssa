import { StrictMode, useSyncExternalStore } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Stage } from "../shared/stage";
import { UiMotionProvider } from "../shared/ui/motion/UiMotionProvider";
import { GameFeedbackScope, GameOperationFeedback } from "./GameOperationFeedback";
import type { GameSession, SessionState } from "./session";

afterEach(cleanup);
function fixture() {
  let state: SessionState = {status: "ready", error: null, record: null, generation: 0};
  const listeners = new Set<() => void>();
  const refresh = vi.fn(async () => {}), diagnostic = vi.fn(async () => ({ok: false}));
  const session = {locator: {saveId: "feedback-test"}, refresh, runtime: {application: {exportDiagnostic: diagnostic}}} as unknown as GameSession;
  const subscribe = (listener: () => void) => {listeners.add(listener); return () => {listeners.delete(listener);};};
  const fail = () => { state = {...state, status: "error", error: {code: "internal-error", path: "test", message: "Proxy failure Authorization: Bearer secret-test-credential"}}; listeners.forEach(fn => fn()); };
  const recover = () => {state = {...state, status: "ready", error: null}; listeners.forEach(fn => fn());};
  function Page({stage = true}: {stage?: boolean}) {
    const snapshot = useSyncExternalStore(subscribe, () => state);
    const body = <section className="campaign-journal airp-panel abyssa-frame" aria-label="业务窗口"><button onClick={fail}>触发错误</button>
      <GameOperationFeedback session={session} state={snapshot} local/>
      <aside aria-label="右侧栏"><GameOperationFeedback session={session} state={snapshot} local/></aside>
    </section>;
    return <StrictMode><UiMotionProvider preference="reduced"><GameFeedbackScope>
      <div className="game-client-status"><GameOperationFeedback session={session} state={snapshot}/></div>
      {stage ? <Stage>{body}</Stage> : body}
    </GameFeedbackScope></UiMotionProvider></StrictMode>;
  }
  return {Page, refresh, diagnostic, recover};
}

it("presents one Stage-sibling dialog, never inside a frame or sidebar, with aligned shared action slots", async () => {
  const f = fixture(), {container} = render(<f.Page/>);
  expect(document.querySelector('.game-system-layer')).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "触发错误"}));
  const dialogs = screen.getAllByRole("dialog", {name: "操作未完成"});
  expect(dialogs).toHaveLength(1);
  const dialog = dialogs[0], layer = dialog.closest('.game-system-layer');
  expect(layer?.parentElement).toBe(container.querySelector('.abyssa-stage__canvas'));
  expect(dialog.closest('.abyssa-frame, .campaign-journal, .airp-panel, .game-client-status')).toBeNull();
  const actions = dialog.querySelector('.confirmation-dialog__actions')!;
  expect(within(actions as HTMLElement).getAllByRole('button').map(button => button.textContent)).toEqual(['关闭', '重新读取']);
  expect(dialog.querySelectorAll('.confirmation-dialog__action > .scene-feedback__action')).toHaveLength(2);
  expect(dialog.querySelector('details')).not.toHaveAttribute('open');
  expect(screen.getByRole('button', {name: '导出诊断', hidden: true}).closest('details')).not.toHaveAttribute('open');
  expect(f.refresh).not.toHaveBeenCalled();
});

it("closes without retry, releases the overlay and focus, and reopens the same error", async () => {
  const f = fixture(); render(<f.Page/>);
  const trigger = screen.getByRole('button', {name: '触发错误'}); trigger.focus(); fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', {name: '关闭'}));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(document.querySelector('.game-system-layer')).toBeNull();
  await waitFor(() => expect(trigger).toHaveFocus()); expect(f.refresh).not.toHaveBeenCalled();
  expect(screen.getAllByRole('button', {name: '查看错误'})).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', {name: '查看错误'}));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  fireEvent.keyDown(document.activeElement!, {key: 'Escape'});
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog', {name: '操作未完成'})).toBeInTheDocument();
});

it("serializes explicit retries and redacts diagnostics, keeping export out of primary actions", async () => {
  const f = fixture(); let finish!: () => void;
  f.refresh.mockImplementation(() => new Promise<void>(resolve => {finish = resolve;}));
  render(<f.Page/>); fireEvent.click(screen.getByRole('button', {name: '触发错误'}));
  const retry = screen.getByRole('button', {name: '重新读取'});
  fireEvent.click(retry); fireEvent.click(retry);
  expect(f.refresh).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', {name: '关闭'})).toHaveAttribute('aria-disabled', 'true');
  finish(); await waitFor(() => expect(screen.getByRole('button', {name: '关闭'})).toHaveAttribute('aria-disabled', 'false'));
  fireEvent.click(screen.getByText('详细原因'));
  expect(screen.getByRole('region', {name: '原始错误信息'})).not.toHaveTextContent('secret-test-credential');
  const exportButton = screen.getByRole('button', {name: '导出诊断'});
  expect(exportButton.closest('details')).not.toBeNull();
  fireEvent.click(exportButton);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('操作未完成，请稍后重试。'));
  expect(f.diagnostic).toHaveBeenCalledTimes(1);
});

it("uses a standalone Stage only without a page Stage, and can reopen without self-portalling", async () => {
  const f = fixture(); render(<f.Page stage={false}/>);
  const trigger = screen.getByRole('button', {name: '触发错误'}); trigger.focus(); fireEvent.click(trigger);
  expect(document.querySelector('.game-system-layer')?.parentElement).toBe(document.body);
  fireEvent.click(screen.getByRole('button', {name: '关闭'}));
  await waitFor(() => expect(document.querySelector('.game-system-layer')).toBeNull());
  await waitFor(() => expect(trigger).toHaveFocus());
  fireEvent.click(screen.getByRole('button', {name: '查看错误'}));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(document.querySelectorAll('.abyssa-stage__canvas')).toHaveLength(1);
});

it("removes the resolved error and reopening entry after a successful explicit refresh", async () => {
  const f = fixture(); f.refresh.mockImplementation(async () => f.recover());
  render(<f.Page/>); fireEvent.click(screen.getByRole('button', {name: '触发错误'}));
  fireEvent.click(screen.getByRole('button', {name: '重新读取'}));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(document.querySelector('.game-system-layer')).toBeNull();
  expect(screen.queryByRole('button', {name: '查看错误'})).toBeNull();
  expect(f.refresh).toHaveBeenCalledTimes(1);
});
