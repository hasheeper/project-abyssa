import { useEffect, useMemo, useSyncExternalStore } from "react";
import { aiConfiguration, assertNoCredentialInPublicConfig, effectiveAiConfiguration } from "../../game-runtime/airp-configuration";
import { createDirectorDriver, type DirectorDriverPort } from "../../game-runtime/airp-director-driver";
import { activatedDirectorDocuments } from "../../content/presentation/airp/director-documents";
import { directorView, directorHash, type DirectorCommand } from "../../game-runtime/airp-director-view";
import { useGameSession, useGameState } from "../react";
import type { GameSession } from "../session";
import { householdDirectorDocuments } from "../../content/presentation/airp/household-documents";
import { HOUSEHOLD_RESIDENT_CAST } from "../../content/gameplay/airp-director/residents";
import { lowR8Source, householdLowR8Source } from "../../content/presentation/airp/low-r8-source";
import { directorStage } from "../../game-runtime/airp-director-view";
import { dispatchDirector } from "./dispatch";
import { registerBackgroundDriver, serializeTaskCommand, taskSessionFor } from "../airp-generation/background-tasks";

const drivers = new WeakMap<GameSession, ReturnType<typeof createDirectorDriver>>();
export function useDirector() {
  const session = useGameSession(), game = useGameState();
  const taskSession = useMemo(()=>taskSessionFor(session),[session]);
  const driver = useMemo(() => {let d = drivers.get(taskSession); if (!d) {d = createDirectorDriver(); drivers.set(taskSession, d);} registerBackgroundDriver(taskSession,d); return d;}, [taskSession]);
  const progress = useSyncExternalStore(driver.subscribe, driver.getSnapshot), config = useSyncExternalStore(aiConfiguration.subscribe, aiConfiguration.getSnapshot);
  const send = async (command: DirectorCommand) => {
    const batch = await serializeTaskCommand(taskSession,()=>dispatchDirector(taskSession, command));
    if (!batch || batch.after.schemaVersion !== 4 || !batch.after.airpDirector) throw Error("进度尚未保存，请检查存档状态后重试。");
    if(taskSession!==session)await session.refresh({background:true});
    return batch.after;
  };
  const port: DirectorDriverPort = {
    async read() {
      if (taskSession.getSnapshot().status === "disposed") throw Error("disposed");
      const r = await taskSession.runtime.application.open(session.locator.saveId);
      if (!r.ok || r.record.schemaVersion !== 4 || !r.record.airpDirector || r.record.head.epoch !== session.locator.epoch) throw Error("stale-save");
      return {head: r.record.head, ...r.record.airpDirector};
    },
    async commit(command) {
      const before = await this.read();
      if (command.type === "airp-director-result") {
        const attempt = before.jobs.find(j => j.id === command.jobId)?.attempts.find(a => a.id === command.attemptId);
        if (attempt?.output === command.output && attempt.endedAt === command.at) return before;
      }
      const r = await send(command); return {head: r.head, ...r.airpDirector!};
    },
  };
  useEffect(() => () => {queueMicrotask(() => {if (taskSession.getSnapshot().status === "disposed") driver.cancel();});}, [taskSession, driver]);
  useEffect(() => {
    if (!progress.pendingResult) return;
    const warn = (e: BeforeUnloadEvent) => {e.preventDefault(); e.returnValue = "";};
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [progress.pendingResult]);
  const view = useMemo(() => directorView(game.record), [game.record]);
  return {session, taskSession, game, view, driver, progress, port, send,
    async advance(command: DirectorCommand) {
      const after = await send(command), reading = after.airpDirector?.reading;
      const job = after.airpDirector?.jobs.find(j => j.id === reading?.jobId);
      if (!reading || reading.paused || reading.completed || !job || (job.lowContextVersion ?? 0) < 11) return after;
      if (directorStage(job)) {
        await driver.run(port, job.id, effectiveAiConfiguration(config));
        if (driver.getSnapshot().error) throw Error(driver.getSnapshot().error!);
      }
      const current = await port.read();
      // Closing while a paid request is in flight keeps its output, but does not reopen the scene.
      const latest = session.getSnapshot().record;
      const activeReading = latest?.schemaVersion === 4 ? latest.airpDirector?.reading : null;
      if (session.getSnapshot().status !== "disposed" && current.jobs.find(j => j.id === job.id)?.text && !directorStage(current.jobs.find(j => j.id === job.id)!) && activeReading?.jobId === job.id && !activeReading.paused && latest?.schemaVersion === 4 && latest.airpDirector?.cursors[job.id] === undefined)
        return send({type: "airp-director-show", jobId: job.id});
      return after;
    },
    async prepareDay(replan = false) {
      const household = game.record?.contentRef.contentVersion === 28;
      const connection = effectiveAiConfiguration(config), material = {...connection.material, resources: {...connection.material.resources, sources: structuredClone(household ? householdDirectorDocuments : activatedDirectorDocuments)}};
      const secrets = Object.values(connection.keys).map(k => k.trim()).filter(Boolean);
      if (!secrets.length || secrets.some(key => JSON.stringify(material).includes(key))) throw Error("请前往设置填写并保存连接；Key 不能进入资料。");
      const formal = [22, 24, 26, 28].includes(game.record?.contentRef.contentVersion ?? 0);
      if (household && !view?.state.residentCast || view?.state.materialHash !== directorHash(material) || formal && (!view?.state.lowMaterial || view.state.lowReadVersion !== 6 || view.state.lowContextVersion !== 21)) await send({type: "airp-director-configure", material, ...(formal ? { lowMaterial: household ? householdLowR8Source : lowR8Source, lowReadVersion: 6, lowContextVersion: 21, ...(household ? {residentCast: HOUSEHOLD_RESIDENT_CAST} : {}) } : {})});
      const runtime = taskSession.runtime;
      if (household && "airpGame" in runtime) {
        await serializeTaskCommand(taskSession, () => runtime.airpGame.forSave(session.locator.saveId, 28, session.locator.epoch).sync());
        await taskSession.refresh({background: true});
      }
      const r = await send({type: replan ? "airp-director-prepare-replan" : "airp-director-prepare-day"});
      return r.airpDirector!.jobs.at(-1)!;
    },
    async run(jobId: string) {
      if (progress.busy || progress.pendingResult) return;
      const job = (await port.read()).jobs.find(j => j.id === jobId);
      if (job?.lowFrame && !job.text && (job.lowReadVersion ?? 0) < 5 && !job.attempts.some(a => a.status === "running")) await send({ type: "airp-director-revalidate-low", jobId, readerVersion: 5 });
      await driver.run(port, jobId, effectiveAiConfiguration(config));
    },
    async reconnect(jobId: string) {
      if (progress.busy || progress.pendingResult) throw Error("请先保存或结束当前请求。");
      const job = (await port.read()).jobs.find(j => j.id === jobId), stage = job && directorStage(job);
      if (!stage || !["writing", "formatting", "scene-plan", "scene-evaluate"].includes(stage)) throw Error("当前不是可更换连接的场景生成阶段。");
      const connection = effectiveAiConfiguration(config);
      const model = connection.models[stage === "writing" ? "writing" : stage === "formatting" ? "updater" : "planning"];
      assertNoCredentialInPublicConfig(model, Object.values(connection.keys));
      await send({ type: "airp-director-reconnect", jobId, config: model });
    },
  };
}
