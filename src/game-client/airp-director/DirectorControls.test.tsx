import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DirectorControls } from "./DirectorControls";

const mock = vi.hoisted(() => ({director: {} as any}));
vi.mock("./useDirector", () => ({useDirector: () => mock.director}));
vi.mock("../GameOperationFeedback", () => ({GameOperationFeedback: () => null}));
vi.mock("../settings/AiSettingsButton", () => ({AiSettingsButton: () => null}));
vi.mock("../airp-generation/CallLog", () => ({CallLog: () => null}));
afterEach(cleanup);

it("opens daily preparation through the journal button without starting a request or accepting a day", () => {
  const prepareDay = vi.fn(), run = vi.fn(), send = vi.fn();
  mock.director = {session: {locator: {saveId: "day-save", epoch: "epoch"}}, game: {status: "ready"}, progress: {busy: false, error: null},
    view: {context: {budget: {day: 3}}, state: {jobs: [], days: [], events: [], materials: {}}}, prepareDay, run, send};
  render(<DirectorControls/>);
  expect(screen.getByRole("status")).toHaveTextContent("尚未安排");
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "查看今日安排"}));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByRole("button", {name: "安排今日"})).toBeInTheDocument();
  expect(prepareDay).not.toHaveBeenCalled();
  expect(run).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});

it("new scenes show three existing rail steps while historical four-step jobs retain their status", () => {
  const job = {id: "scene:1", kind: "scene", materialHash: "test", lowContextVersion: 16, lowFrame: {}, attempts: [] as any[], text: null as any};
  mock.director = {session:{locator:{saveId:"save",epoch:"epoch"}},game: {status: "ready"}, progress: {busy: false, error: null}, view: {context: {budget: {day: 1}}, state: {jobs: [job], days: [], events: [], materials: {}}}};
  const view = render(<DirectorControls jobId={job.id}/>);
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  expect(screen.getByText("GM")).toBeInTheDocument();
  expect(screen.queryByText("GM分派")).toBeNull();
  job.attempts = [{id: "w", stage: "writing", status: "succeeded"}, {id: "f", stage: "formatting", status: "succeeded"}, {id: "g", stage: "scene-evaluate", status: "failed"}];
  job.text = {lines: []}; view.rerender(<DirectorControls jobId={job.id}/>);
  expect(screen.getByRole("button", {name: "继续GM评估"})).toBeEnabled();
  expect(screen.queryByRole("button", {name: "生成这场对白"})).toBeNull();
  job.lowContextVersion = 15; view.rerender(<DirectorControls jobId={job.id}/>);
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
  expect(screen.getByText("GM分派")).toBeInTheDocument();
});
