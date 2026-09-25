import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DirectorScene } from "./DirectorScene";
import type { ComponentProps } from "react";
import type { AirpReading } from "../airp-generation/AirpReading";
import { mansionBackgroundForLocation, mansionSceneBackground } from "../mansion-backgrounds";

const mock = vi.hoisted(() => ({ director: {} as any, reader: null as ComponentProps<typeof AirpReading> | null }));
vi.mock("./useDirector", () => ({useDirector: () => mock.director}));
vi.mock("../GameOperationFeedback", () => ({GameOperationFeedback: () => null}));
vi.mock("./DirectorControls", () => ({DirectorControls: (p: {reader?: (close:()=>void)=>React.ReactNode; initialReader?: boolean; onBackground?:()=>void; background?:string}) =>
  p.initialReader ? p.reader?.(() => p.onBackground?.()) : <div className="flow-scene"><img src={p.background}/></div>}));
vi.mock("../airp-generation/AirpReading", () => ({AirpReading: (p: ComponentProps<typeof AirpReading>) => { mock.reader = p; return <div>
  <p>{p.choice?.prompt}</p>{p.choice?.options.map(o => <button key={o.id} onClick={() => p.onChoose?.(o.id)}>{o.label}</button>)}
  <button onClick={p.onNext}>{p.finalLabel}</button>{p.controls}{p.feedback}
</div>; }}));
afterEach(cleanup);
function fixture() {
  const job = {id: "scene:offer", attempts: [], lowContextVersion: 9, lowChoices: ["认真倾听", "轻松回应", "有所保留"], lowResponse: undefined as unknown,
    text: {lines: [{speaker: "elora", emotion: "neutral", text: "能帮我带回空药箱吗？"}]},
    scene: {choices: [{id: "participate", label: "参与这件事", intent: "接受"}]}};
  const reading = {jobId: job.id, eventId: "event:1", cursor: 0, paused: false};
  const event = {id: "event:1", role: "offer", status: "offered", readSceneIds: [], card: {title: "空药箱", form: "sortie"}};
  const send = vi.fn().mockResolvedValue({});
  mock.director = {send, session:{locator:{saveId:"director-ui",epoch:"epoch:1"}}, game: {status: "ready"}, view: {state: {reading, jobs: [job], events: [event], cursors: {[job.id]: 0}}, context: {world: {phase: 2}}}};
  return {job, reading, event, send};
}
it("uses each frozen scene location for the current reading and its history", () => {
  const f = fixture();
  Object.assign(f.job.scene, {locationId: "elora", phase: 1});
  const past = {id: "scene:past", scene: {locationId: "library", phase: 0},
    text: {lines: [{speaker: "elora", emotion: "neutral", text: "上次在书库说过的话。"}]}};
  const state: any = mock.director.view.state;
  state.jobs.push(past);
  state.cursors[past.id] = 1;
  Object.assign(f.event, {readSceneIds: [past.id]});
  render(<DirectorScene/>);
  expect(mock.reader!.background).toBe(mansionBackgroundForLocation("elora"));
  expect(mock.reader!.previousScenes?.[0].background).toBe(mansionBackgroundForLocation("library"));
});
it("retains a legacy backdrop for history with no frozen room instead of borrowing the event location", () => {
  const f = fixture();
  Object.assign(f.job.scene, {locationId: "elora", phase: 1});
  Object.assign(f.event.card, {locationId: "elora"});
  const past = {id: "scene:legacy", scene: {phase: 3}, text: {lines: [{speaker: "narrator", text: "之前的一次交谈。"}]}};
  const state: any = mock.director.view.state;
  state.jobs.push(past); state.cursors[past.id] = 1;
  f.event.readSceneIds = [past.id] as any;
  render(<DirectorScene/>);
  expect(mock.reader!.previousScenes?.[0].background).toBe(mansionSceneBackground(undefined, 3));
  expect(mock.reader!.previousScenes?.[0].background).not.toBe(mock.reader!.background);
});
it("keeps the frozen room during generation and delivery even when the world phase changes", () => {
  const f = fixture();
  Object.assign(f.job.scene, {locationId: "library", phase: 0});
  Object.assign(f.event.card, {locationId: "plaza"});
  const state: any = mock.director.view.state;
  state.cursors = {};
  const view = render(<DirectorScene/>);
  const background = () => document.querySelector(".flow-scene img")?.getAttribute("src");
  expect(background()).toBe(mansionBackgroundForLocation("library"));
  mock.director.view.context.world.phase = 3;
  Object.assign(f.event, {role: "result", delivery: {status: "pending"}});
  view.rerender(<DirectorScene/>);
  expect(background()).toBe(mansionBackgroundForLocation("library"));
});
it("shows generated attitudes, records one without accepting, then offers an explicit program decision", async () => {
  const f = fixture(), view = render(<DirectorScene/>);
  expect(screen.getByText("回应态度 · 不代替任务决定")).toBeInTheDocument();
  expect(screen.queryByRole("button", {name: "接下委托"})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "有所保留"}));
  await waitFor(() => expect(f.send).toHaveBeenCalledTimes(2));
  expect(f.send.mock.calls.map(c => c[0])).toEqual([
    {type: "airp-director-respond", jobId: f.job.id, index: 2},
    {type: "airp-director-read", jobId: f.job.id, cursor: 0},
  ]);
  f.job.lowResponse = {index: 2, text: "有所保留"}; f.reading.cursor = 1; view.rerender(<DirectorScene/>);
  expect(screen.queryByRole("button", {name: "有所保留"})).toBeNull();
  expect(screen.getByRole("button", {name: "这次不接"})).toBeEnabled();
  fireEvent.click(screen.getByRole("button", {name: "接下委托"}));
  await waitFor(() => expect(f.send).toHaveBeenCalledTimes(3));
  expect(f.send.mock.calls[2][0]).toEqual({type: "airp-director-choose", eventId: f.event.id, choiceId: "participate"});
  expect(f.send.mock.calls.some(c => c[0].type === "airp-director-open")).toBe(false);
});
it("an interrupted final read resumes without selecting twice and has no mid-scene exit", async () => {
  const f = fixture(); f.job.lowResponse = {index: 1, text: "轻松回应"}; render(<DirectorScene/>);
  fireEvent.click(screen.getByRole("button", {name: "确认本段已读"}));
  expect(f.send).toHaveBeenLastCalledWith({type: "airp-director-read", jobId: f.job.id, cursor: 0});
  expect(screen.queryByRole("button", {name: "关闭当前场景（保留进度）"})).toBeNull();
  expect(screen.queryByRole("button", {name: "稍后再说"})).toBeNull();
  expect(screen.queryByRole("button", {name: "这次不接"})).toBeNull();
  expect(f.send.mock.calls.some(([command]) => command.type === "airp-director-pause")).toBe(false);
});
it("reports a failed attitude commit to the shared choices and permits retry at the same decision", async () => {
  const f = fixture(); f.send.mockRejectedValueOnce(Error("存档写入失败"));
  render(<DirectorScene/>);
  const decisionId = mock.reader!.choice!.id;
  await act(async () => { await expect(mock.reader!.onChoose!("B")).rejects.toThrow("选择未能保存"); });
  expect(screen.getByText("存档写入失败")).toBeInTheDocument();
  expect(mock.reader!.busy).toBe(false);
  expect(mock.reader!.choice!.id).toBe(decisionId);
  expect(f.send).toHaveBeenCalledTimes(1);
  await act(async () => { await mock.reader!.onChoose!("B"); });
  expect(f.send).toHaveBeenCalledTimes(3);
  expect(f.send.mock.calls[1][0]).toEqual({type: "airp-director-respond", jobId: f.job.id, index: 1});
  expect(screen.queryByText("存档写入失败")).toBeNull();
});
it("does not carry an old action error into a newly generated scene", async () => {
  const f=fixture(); f.send.mockRejectedValueOnce(Error("上一幕写入失败"));
  const view=render(<DirectorScene/>);
  await act(async()=>{await expect(mock.reader!.onChoose!("B")).rejects.toThrow();});
  expect(screen.getByText("上一幕写入失败")).toBeInTheDocument();
  const next={...f.job,id:"scene:next"};
  mock.director.view.state.jobs.push(next);
  mock.director.view.state.cursors[next.id]=0;
  f.reading.jobId=next.id; view.rerender(<DirectorScene/>);
  expect(mock.reader!.sceneId).toBe(next.id);
  expect(mock.reader!.error).toBeFalsy();
  expect(screen.queryByText("上一幕写入失败")).toBeNull();
});
it("an interactive choice advances through continuation, not directly to acceptance or mansion", async () => {
  const f = fixture(); f.job.lowContextVersion = 11;
  const advance = vi.fn().mockResolvedValue({}); mock.director.advance = advance;
  render(<DirectorScene/>); fireEvent.click(screen.getByRole("button", {name: "轻松回应"}));
  await waitFor(() => expect(advance).toHaveBeenCalledWith({type: "airp-director-read", jobId: f.job.id, cursor: 0}));
  expect(f.send).toHaveBeenCalledTimes(1); expect(f.send).toHaveBeenCalledWith({type: "airp-director-respond", jobId: f.job.id, index: 1});
  expect(screen.queryByRole("button", {name: "接下委托"})).toBeNull();
});
it("a concluded acceptance shows concise task guidance and collapses in the resident mansion", async () => {
  const f = fixture(); Object.assign(f.reading, {completed: true});
  Object.assign(f.event, {role: "action", status: "waiting-action", actionIndex: 0, actionPhase: 2});
  Object.assign(f.event.card, {giverId: "elora", locationId: "plaza", actions: [{kind: "patrol", objectiveId: "case"}]});
  mock.director.view.context.capabilities = {objectives: {case: {routeId: "old-manor", layer: 3}}};
  render(<DirectorScene/>);
  expect(screen.getByText("已接下委托")).toBeInTheDocument();
  expect(screen.getByLabelText("任务指引")).toHaveTextContent("完成第 3 层的任务目标房间");
  expect(screen.getByLabelText("任务指引")).toHaveTextContent("到小广场找艾洛拉");
  expect(screen.getByLabelText("任务指引").querySelectorAll("li")).toHaveLength(3);
  expect(screen.getByRole("button", {name: "前往出击"})).toBeInTheDocument();
  expect(screen.queryByRole("button", {name: "返回洋馆"})).toBeNull();
  fireEvent.click(screen.getByRole("button", {name: "收起"}));
  await waitFor(() => expect(f.send).toHaveBeenCalledWith({type:"airp-director-pause"}));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", {name:/空药箱.*查看进度/}));
  expect(screen.getByRole("button", {name:"前往出击"})).toBeInTheDocument();
  expect(f.send).toHaveBeenCalledOnce();
});
it("shows pending settlement, then actual saved memory/affinity, and distinguishes a facts-only exit", () => {
  const f = fixture(); Object.assign(f.reading, {completed: true});
  Object.assign(f.event, {role: "result", status: "resolved"});
  const ledger: any = {memories: [], receipts: [], jobs: []};
  mock.director.game.record = {schemaVersion: 4, airpGame: {settlement: ledger}};
  const view = render(<DirectorScene/>);
  expect(screen.getByText("本次经历待结算，关系变化和记忆尚未写入。")).toBeInTheDocument();
  expect(screen.getAllByRole("button", {name:"收起"})).toHaveLength(1);
  ledger.memories = [{id: "memory:1", scope: {kind: "event", eventId: f.event.id}}];
  ledger.receipts = [{memoryId: "memory:1", taskId: "settlement:1", effects: [{kind: "affinity", actorId: "elora", delta: 1}]}];
  ledger.jobs = [{id: "settlement:1", mode: "model"}]; view.rerender(<DirectorScene/>);
  expect(screen.getByText("本次经历与记忆已保存。")).toBeInTheDocument();
  expect(screen.getByText("艾洛拉好感 +1")).toBeInTheDocument();
  expect(screen.queryByText("本次经历待结算，关系变化和记忆尚未写入。")).toBeNull();
  ledger.jobs[0].mode = "program-only"; ledger.receipts[0].effects = []; view.rerender(<DirectorScene/>);
  expect(screen.getByText("已保存程序事实；本次未评估关系与叙事状态。")).toBeInTheDocument();
  expect(screen.queryByText("艾洛拉好感 +1")).toBeNull();
});

it("v18 makes a task conflict visible at the reading/choice boundary without rewriting prose or advancing", () => {
  const f = fixture(); f.job.lowContextVersion = 18;
  Object.assign(f.job, {sceneGMEvaluation: {complete: true, taskGuideConflict: true}});
  Object.assign(f.job.scene, {dialogue: {taskGuide: ["到达第3层的任务目标房间并完成该房间。", "安全返回后明确交付。"]}});
  f.job.text.lines.push({speaker: "elora", emotion: "neutral", text: "走到第三道回廊。"});
  const view = render(<DirectorScene/>);
  expect(screen.queryByText(/正文中的任务说法/)).toBeNull();
  f.reading.cursor = 1; view.rerender(<DirectorScene/>);
  expect(screen.getByText(/正文中的任务说法/)).toHaveTextContent("到达第3层");
  expect(screen.getByText(/正文中的任务说法/)).toHaveTextContent("明确交付");
  expect(f.job.text.lines[1].text).toBe("走到第三道回廊。");
  expect(f.send).not.toHaveBeenCalled();
  f.job.lowContextVersion = 17; view.rerender(<DirectorScene/>);
  expect(screen.queryByText(/正文中的任务说法/)).toBeNull();
});

it("v18 keeps the task correction and real sortie exit visible after acceptance", () => {
  const f = fixture(); f.job.lowContextVersion = 18;
  Object.assign(f.reading, {completed: true});
  Object.assign(f.job, {sceneGMEvaluation: {complete: true, taskGuideConflict: true}});
  Object.assign(f.job.scene, {dialogue: {taskGuide: ["到达第3层。"]}});
  Object.assign(f.event, {role: "action", status: "waiting-action", actionIndex: 0, actionPhase: 2});
  Object.assign(f.event.card, {giverId: "elora", locationId: "plaza", actions: [{kind: "patrol", objectiveId: "case"}]});
  mock.director.view.context.capabilities = {objectives: {case: {routeId: "old-manor", layer: 3}}};
  render(<DirectorScene/>);
  expect(screen.getByText(/正文中的任务说法/)).toBeInTheDocument();
  expect(screen.getByLabelText("任务指引")).toHaveTextContent("完成第 3 层的任务目标房间");
  expect(screen.getByRole("button", {name: "前往出击"})).toBeInTheDocument();
  expect(f.send).not.toHaveBeenCalled();
});
