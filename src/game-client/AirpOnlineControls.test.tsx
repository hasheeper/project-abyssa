import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { airpSessionFixture } from "../game-application/testing/airp-session-fixture";
import { AirpOnlineControls } from "./AirpOnlineControls";

const mocks = vi.hoisted(() => ({ state: {} as any, session: {} as any, step: vi.fn(), release: vi.fn() }));
vi.mock('./react', () => ({ useGameState: () => mocks.state, useGameSession: () => mocks.session }));
vi.mock('../game-runtime/airp-online-driver', async importActual => ({
  ...await importActual<typeof import('../game-runtime/airp-online-driver')>(), runAirpOnlineStep: mocks.step, readAirpRelease: mocks.release,
}));
beforeEach(() => {
  vi.clearAllMocks(); const f = airpSessionFixture();
  mocks.state = { status: 'ready', record: { schemaVersion: 4, airpOnline: { version: 1, entries: [], connection: { key: 'connection-test', baseUrl: 'http://127.0.0.1:8787/api/v1', ticket: f.ticket, binding: null } } } };
  mocks.session = { dispatch: vi.fn() };
  mocks.step.mockImplementation(async () => {});
});
afterEach(cleanup);

it('StrictMode starts one transport attempt and leaving the page aborts it', async () => {
  mocks.step.mockImplementation((_port, signal: AbortSignal) => new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true })));
  const view = render(<StrictMode><AirpOnlineControls/></StrictMode>);
  await waitFor(() => expect(mocks.step).toHaveBeenCalledTimes(1));
  const signal = mocks.step.mock.calls[0][1] as AbortSignal;
  expect(signal.aborted).toBe(false); view.unmount(); expect(signal.aborted).toBe(true);
});
it('failed work has no automatic retry loop; the explicit retry preserves its persisted key', async () => {
  mocks.step.mockRejectedValue(Object.assign(Error('offline'), { code: 'airp-offline' }));
  const view = render(<AirpOnlineControls/>);
  await screen.findByRole('alert'); expect(mocks.step).toHaveBeenCalledTimes(1);
  view.rerender(<AirpOnlineControls/>); await act(async () => {}); expect(mocks.step).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: '重试同一请求' }));
  await waitFor(() => expect(mocks.step).toHaveBeenCalledTimes(2));
  expect(mocks.state.record.airpOnline.connection.key).toBe('connection-test');
});
it('finishing work cancels the prior effect and clears its stale busy indicator', async () => {
  mocks.step.mockImplementation((_port, signal: AbortSignal) => new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true })));
  const view = render(<AirpOnlineControls/>);
  await waitFor(() => expect(mocks.step).toHaveBeenCalledTimes(1));
  mocks.state = { ...mocks.state, record: { ...mocks.state.record, airpOnline: { ...mocks.state.record.airpOnline, connection: { ...mocks.state.record.airpOnline.connection, binding: airpSessionFixture().binding } } } };
  view.rerender(<AirpOnlineControls/>);
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  expect(mocks.step.mock.calls[0][1].aborted).toBe(true);
});
it('an unsuccessful Release lookup retries the connection, not an absent durable job', async () => {
  mocks.state.record.airpOnline.connection = null;
  mocks.release.mockRejectedValue(Error('offline'));
  render(<AirpOnlineControls allowConnect/>);
  fireEvent.change(screen.getByLabelText('AIRP Release ID'), { target: { value: 'release-test' } });
  fireEvent.click(screen.getByRole('button', { name: '绑定独立游玩实例' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: '重试连接' }));
  await waitFor(() => expect(mocks.release).toHaveBeenCalledTimes(2));
  expect(mocks.step).not.toHaveBeenCalled();
});

it('switching active saves aborts the old job even if their pending keys match', async () => {
  mocks.step.mockImplementation((_port, signal: AbortSignal) => new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true })));
  const view = render(<AirpOnlineControls/>);
  await waitFor(() => expect(mocks.step).toHaveBeenCalledTimes(1));
  const oldSignal = mocks.step.mock.calls[0][1] as AbortSignal;
  mocks.session = { dispatch: vi.fn() };
  view.rerender(<AirpOnlineControls/>);
  await waitFor(() => expect(mocks.step).toHaveBeenCalledTimes(2));
  expect(oldSignal.aborted).toBe(true);
  expect(mocks.step.mock.calls[1][1].aborted).toBe(false);
});

it('switching active saves cancels a pending connection lookup and never binds the old save', async () => {
  mocks.state.record.airpOnline.connection = null;
  const oldDispatch = mocks.session.dispatch;
  let finish!: (value: unknown) => void;
  mocks.release.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<AirpOnlineControls allowConnect/>);
  fireEvent.change(screen.getByLabelText('AIRP Release ID'), { target: { value: 'release-test' } });
  fireEvent.click(screen.getByRole('button', { name: '绑定独立游玩实例' }));
  await waitFor(() => expect(mocks.release).toHaveBeenCalledTimes(1));
  const signal = mocks.release.mock.calls[0][2] as AbortSignal;
  mocks.session = { dispatch: vi.fn() };
  view.rerender(<AirpOnlineControls allowConnect/>);
  expect(signal.aborted).toBe(true);
  await act(async () => finish(airpSessionFixture().release));
  expect(oldDispatch).not.toHaveBeenCalled();
  expect(mocks.session.dispatch).not.toHaveBeenCalled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '绑定独立游玩实例' })).toBeEnabled();
});
