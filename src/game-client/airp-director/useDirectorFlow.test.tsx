import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useDirectorFlow } from "./useDirectorFlow";

afterEach(cleanup);
function fixture() {
  const job = {id:"scene:1",kind:"scene",lowFrame:{},lowContextVersion:16,attempts:[] as any[],text:null as any};
  const d: any = {
    session:{locator:{saveId:"save",epoch:"epoch"}}, game:{status:"ready",error:null},
    progress:{busy:false,pendingResult:false,error:null,jobId:job.id,stage:"writing",phase:"idle"},
    view:{context:{budget:{day:1}},state:{jobs:[job],days:[],events:[],cursors:{}}},
    driver:{retryCommit:vi.fn(),exportPending:vi.fn(),cancel:vi.fn()}, run:vi.fn(), send:vi.fn(),
  };
  return {d,job};
}
function finish(job: ReturnType<typeof fixture>["job"]) {
  job.text={lines:[]};
  job.attempts=[{id:"w",stage:"writing",status:"succeeded"},{id:"f",stage:"formatting",status:"succeeded"}];
  Object.assign(job,{sceneGMEvaluation:{complete:true}});
}
it("keeps pending output and request errors on the job that owns them", () => {
  const {d,job}=fixture(); finish(job);
  Object.assign(d.progress,{jobId:"other-scene",pendingResult:true,error:"另一幕保存失败"});
  const hook=renderHook(()=>useDirectorFlow(d,job.id));
  expect(hook.result.current.task.phase).toBe("readable");
  expect(hook.result.current.task.primary?.id).toBe("read");
  expect(hook.result.current.error).toBeFalsy();
  expect(hook.result.current.task.utilities?.some(a=>a.id==="export")).toBeFalsy();
});
it("presents an in-flight save as normal progress until saving actually stops", () => {
  const {d,job}=fixture();
  Object.assign(d.progress,{busy:true,pendingResult:true,phase:"saving"});
  const hook=renderHook(()=>useDirectorFlow(d,job.id));
  expect(hook.result.current.task.phase).toBe("running");
  expect(hook.result.current.task.status).toBe("正在保存这一幕…");
  expect(hook.result.current.task.primary?.id).toBe("minimize");
  expect(hook.result.current.task.utilities?.some(a=>a.id==="export")).toBe(false);
  Object.assign(d.progress,{busy:false,phase:"failed",error:"保存失败"}); hook.rerender();
  expect(hook.result.current.task.phase).toBe("unsaved");
  expect(hook.result.current.task.primary?.id).toBe("save");
  expect(hook.result.current.task.utilities?.some(a=>a.id==="export")).toBe(true);
});
it("clears a local failure when the same scene is completed elsewhere", async () => {
  const {d,job}=fixture(),hook=renderHook(()=>useDirectorFlow(d,job.id));
  await act(async()=>{await expect(hook.result.current.work(async()=>{throw Error("旧操作失败");})).rejects.toThrow();});
  expect(hook.result.current.task.phase).toBe("failed");
  finish(job); hook.rerender();
  expect(hook.result.current.task.phase).toBe("readable");
  expect(hook.result.current.error).toBeFalsy();
});
it("does not attach a late rejection from the previous scene to the next scene", async () => {
  const {d,job}=fixture(),hook=renderHook(()=>useDirectorFlow(d,job.id));
  let reject!: (error:Error)=>void;
  let pending!:Promise<unknown>;
  act(()=>{pending=hook.result.current.work(()=>new Promise((_resolve,r)=>{reject=r;}));});
  job.id="scene:2"; finish(job); hook.rerender();
  await act(async()=>{reject(Error("上一幕失败"));await expect(pending).rejects.toThrow();});
  expect(hook.result.current.task.phase).toBe("readable");
  expect(hook.result.current.error).toBeFalsy();
});
it("retires a recovered stage error but preserves actual GM and storage failures", () => {
  const {d,job}=fixture();
  Object.assign(d.progress,{phase:"failed",error:"正文旧失败"});
  const hook=renderHook(()=>useDirectorFlow(d,job.id));
  expect(hook.result.current.task.phase).toBe("failed");
  job.attempts=[{id:"w",stage:"writing",status:"succeeded"}]; hook.rerender();
  expect(hook.result.current.task.phase).toBe("waiting");
  finish(job); delete (job as any).sceneGMEvaluation;
  Object.assign(d.progress,{stage:"scene-evaluate",error:"GM评估失败"}); hook.rerender();
  expect(hook.result.current.task.phase).toBe("failed");
  expect(hook.result.current.task.primary?.id).toBe("generate");
  finish(job); Object.assign(d.progress,{pendingResult:true,error:"保存未确认"}); hook.rerender();
  expect(hook.result.current.task.phase).toBe("unsaved");
  expect(hook.result.current.task.primary?.id).toBe("save");
  d.progress.pendingResult=false; d.game.error={message:"无法读取进度"}; hook.rerender();
  expect(hook.result.current.task.phase).toBe("failed");
  expect(hook.result.current.task.primary?.id).toBe("reload");
});
it("distinguishes requesting another draft from processing or saving the existing one", async () => {
  const {d,job}=fixture();
  job.attempts=[{id:"w",stage:"writing",status:"failed",error:"provider-error",output:null}];
  Object.assign(d.progress,{phase:"failed",error:"接口没有返回正文"});
  const hook=renderHook(()=>useDirectorFlow(d,job.id));
  expect(hook.result.current.task.primary?.label).toBe("重新请求正文");
  expect(hook.result.current.task.detail).toContain("再次调用模型");
  expect(d.run).not.toHaveBeenCalled();
  job.attempts=[{id:"w",stage:"writing",status:"succeeded",output:"保留原稿"}]; hook.rerender();
  expect(hook.result.current.task.primary?.label).toBe("继续后处理");
  expect(hook.result.current.task.detail).toContain("原稿已保存");
  Object.assign(d.progress,{pendingResult:true,error:"保存失败",stage:"formatting"}); hook.rerender();
  expect(hook.result.current.task.primary?.label).toBe("重试保存");
  await act(async()=>{await hook.result.current.actions.find(action=>action.id==="save")!.run();});
  expect(d.driver.retryCommit).toHaveBeenCalledTimes(1);
  expect(d.run).not.toHaveBeenCalled();
});
