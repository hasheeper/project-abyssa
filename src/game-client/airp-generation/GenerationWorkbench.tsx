import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { builtinPresetFile, createGenerationController, defaultSpecification, importPreset, resolveGenerationModels, completionUrl, samples, type GenerationStage, type Specification } from "../../game-runtime/airp-generation";
import { aiConfiguration, effectiveAiConnection } from "../../game-runtime/airp-configuration";
import { AirpReading } from "./AirpReading";
import { ReadingTool } from "../../shared/presentation/adv/ReadingTool";
import { AiSettingsButton } from "../settings/AiSettingsButton";
import type { AuthoredLine } from "../../content/presentation/authored-story";
import { PlayerIdentityProvider } from "../../shared/domain/PlayerIdentity";
import morningBackground from "../../assets/backgrounds/mansion-first-morning.webp";
import "./generation.css";

const slots = [{ id: "planning", name: "大纲" }, { id: "writing", name: "正文" }, { id: "updater", name: "格式化" }] as const;
type Controller = ReturnType<typeof createGenerationController>;
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" })), link = document.createElement("a");
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function GenerationWorkbench({ controller }: { controller: Controller }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [spec, setSpec] = useState<Specification>(() => state.run?.spec ?? defaultSpecification());
  const creative = spec.resources.version === 5 || spec.resources.version === 6;
  const stages = [{id: "planning", name: creative ? "创作" : "大纲"}, {id: "writing", name: creative ? "润色" : "正文"}, {id: "formatting", name: "格式化"}] as const;
  const config = useSyncExternalStore(aiConfiguration.subscribe, aiConfiguration.getSnapshot);
  const [presetText, setPresetText] = useState(builtinPresetFile);
  const [localError, setLocalError] = useState("");
  const [previewStage, setPreviewStage] = useState<GenerationStage>("planning");
  const [reading, setReading] = useState<"generated" | "sample" | null>(null);
  const [sampleCursor, setSampleCursor] = useState(0), [clock, setClock] = useState(Date.now);
  const connection = useMemo(() => effectiveAiConnection(config), [config]);
  const effectiveModels = useMemo(() => resolveGenerationModels(connection.models, spec.preset, spec.resources.version), [connection, spec.preset, spec.resources.version]);
  const effectiveKeys = connection.keys;
  const resume = () => {
    try {
      if (state.run && slots.some(s => completionUrl(state.run!.models[s.id].baseUrl) !== completionUrl(effectiveModels[s.id].baseUrl))) throw Error();
      setLocalError(""); void controller.resume(effectiveKeys);
    } catch { setLocalError("续跑需要原任务的连接，请在设置中恢复；新连接不会替换旧任务。"); }
  };
  useEffect(() => { if (!state.busy) return; const timer = setInterval(() => setClock(Date.now()), 500); return () => clearInterval(timer); }, [state.busy]);
  useEffect(() => () => controller.cancel(), [controller]);
  const preview = useMemo(() => { try { return { value: controller.preview(spec, previewStage), error: null }; } catch (error) { return { value: null, error: error instanceof Error ? error.message : "无法编译" }; } }, [spec, previewStage, state.run, controller]);
  const applyPreset = (source = presetText, name?: string) => {
    try { const preset = importPreset(source, name); setSpec(current => ({ ...current, preset, orderId: preset.orders.length === 1 ? preset.orders[0].id : "" })); setPresetText(source); setLocalError(""); }
    catch (error) { setLocalError(error instanceof Error ? error.message : "预设导入失败"); }
  };
  const activeAttempt = state.run?.attempts.at(-1);
  const generated = state.run?.scene;
  const demoLines: AuthoredLine[] = [
    { id: "sample.0", kind: "action", text: "【手写演出样例】窗边的桌面腾出了一小块空位。" },
    { id: "sample.1", characterId: "elora", emotion: "smile", text: "先放这里吧。我把这条带子收一下。" },
    { id: "sample.2", characterId: "elora", emotion: "serious", text: "搭扣等会儿再看，别让箱底压着它。" },
  ];
  if (reading && (reading === "sample" || generated)) {
    const lines: AuthoredLine[] = reading === "sample" ? demoLines : generated!.lines.map((line, index) => line.speaker === "narrator" ? { id: `${state.run!.id}.${index}`, kind: "action", text: line.text } : { id: `${state.run!.id}.${index}`, characterId: line.speaker, emotion: line.emotion, text: line.text });
    const cursor = reading === "sample" ? sampleCursor : state.run!.cursor;
    const next = () => { if (cursor >= lines.length - 1) setReading(null); else if (reading === "sample") setSampleCursor(cursor + 1); else controller.setCursor(cursor + 1); };
    return <PlayerIdentityProvider name={reading === "sample" ? spec.playerName : state.run!.spec.playerName}>
      <AirpReading sceneId={reading === "sample" ? "handwritten-sample" : state.run!.id} wide title={reading === "sample" ? "手写演出样例" : state.run!.spec.sample.title} location="洋馆 · 公共休息室" background={morningBackground} lines={lines} cursor={cursor} finalLabel="结束试读" onNext={next} controls={<>
        <span className="airp-reader__source">{reading === "sample" ? "手写样例 · 未调用模型" : "模型生成 · 作者情境试读"}</span>
        <ReadingTool label="返回检查" caption="CLOSE" glyph="close" onClick={() => setReading(null)}/>
      </>}/>
    </PlayerIdentityProvider>;
  }
  return <main className="airp-workbench">
    <header className="airp-workbench__header"><div><span className="airp-eyebrow">ABYSSA · NARRATIVE LAB</span><h1>AIRP 静态试读</h1><p>配置模型，编译本场上下文，将一段生成对白带入洋馆。</p></div><span className="airp-badge">作者样例 · 不写入游戏存档</span></header>
    {(localError || state.error) && <div role="alert" className="airp-notice airp-notice--error">{localError || state.error}</div>}
    {state.cacheWarning && <div role="status" className="airp-notice">{state.cacheWarning}</div>}
    <div className="airp-workbench__columns">
      <div className="airp-workbench__setup">
        <section className="airp-card"><h2><span>01</span> 模型连接</h2><p className="airp-muted">与游戏共用设置中的连接。</p>
          <AiSettingsButton disabled={state.busy}/>
          <details><summary>连接测试</summary>{slots.map(slot => <div key={slot.id}>
            <button disabled={state.busy} onClick={() => void controller.probe(slot.id, effectiveModels[slot.id], effectiveKeys[slot.id])}>测试{slot.name}连接</button>
            {state.probes.filter(p => p.slot === slot.id).slice(-3).map(p => <p key={p.id}>{p.status} · {(p.elapsedMs / 1000).toFixed(1)}s · tokens {p.usage.totalTokens ?? "未知"}</p>)}
          </div>)}</details>
        </section>
        <section className="airp-card"><h2><span>02</span> 预设与情境</h2><fieldset disabled={state.busy}>
          <div className="airp-fields"><label>玩家显示名<input maxLength={40} value={spec.playerName} onChange={e => setSpec(current => ({ ...current, playerName: e.target.value }))}/></label><label>样例情境<select value={spec.sample.id} onChange={e => setSpec(current => ({ ...current, sample: structuredClone(samples.find(s => s.id === e.target.value)!) }))}>{samples.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label></div>
          <label>预设执行顺序<select value={spec.orderId} onChange={e => setSpec(current => ({ ...current, orderId: e.target.value }))}><option value="" disabled>请选择顺序</option>{spec.preset.orders.map(o => <option key={o.id} value={o.id}>{o.id} · {o.entries.filter(e => e.enabled).length}个启用模块</option>)}</select></label>
          <p className="airp-muted">当前：{spec.preset.name}。资源 v{spec.resources.version}；新默认为三段式大纲 → 正文与表情 → 中文封装，保留源文，明确阶段适配。</p>
          <details><summary>大纲补充前置提示词（本场可调整）</summary><textarea aria-label="大纲补充前置提示词" rows={8} value={spec.preset.planningPrefix} onChange={e => setSpec(current => ({ ...current, preset: { ...current.preset, planningPrefix: e.target.value } }))}/></details>
          {spec.preset.modules.some(m => m.identifier === "writing-prefix") && <details><summary>正文前置提示词（本场可调整）</summary><textarea aria-label="正文前置提示词" rows={8} value={spec.preset.modules.find(m => m.identifier === "writing-prefix")!.content} onChange={e => setSpec(current => ({ ...current, preset: { ...current.preset, modules: current.preset.modules.map(m => m.identifier === "writing-prefix" ? { ...m, content: e.target.value } : m) } }))}/></details>}
          <label className="airp-file">导入酒馆预设<input type="file" accept=".json,application/json" aria-label="导入酒馆预设" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 2097152) { setLocalError("预设文件超过2 MiB。"); return; } try { applyPreset(await file.text(), file.name); } catch { setLocalError("无法读取所选文件。"); } }}/></label>
          <details><summary>编辑预设 JSON／下载基础样例</summary><textarea aria-label="预设 JSON" rows={10} value={presetText} onChange={e => setPresetText(e.target.value)}/><div className="airp-actions"><button onClick={() => applyPreset()}>应用 JSON</button><button onClick={() => { setPresetText(builtinPresetFile()); applyPreset(builtinPresetFile()); }}>恢复内置预设</button><button onClick={() => download("abyssa-tavern-basic.json", builtinPresetFile())}>下载基础预设</button></div></details>
        </fieldset></section>
      </div>
      <div className="airp-workbench__inspect">
        <section className="airp-card"><h2><span>03</span> 上下文与送模检查</h2><div className="airp-tabs" role="group" aria-label="输入阶段">{stages.map(s => <button key={s.id} aria-pressed={previewStage === s.id} onClick={() => setPreviewStage(s.id)}>{s.name}输入</button>)}</div>
          {preview.error ? <p role="alert">{preview.error}</p> : <><p className="airp-muted">{preview.value!.bytes.toLocaleString()} bytes · 不是token数；以端点实际用量为准 · {preview.value!.selectedMemoryIds.length}条样例已读记忆</p>
            <details><summary>模块诊断与来源</summary><ul>{preview.value!.diagnostics.map((d, i) => <li key={i}>{d}</li>)}</ul><ul>{spec.resources.sources.map(source => <li key={source.id}><details><summary>{source.path} · {source.kind} · {new TextEncoder().encode(source.text).length.toLocaleString()} bytes</summary><p>SHA256 {source.sha256}</p><pre>{source.text}</pre></details></li>)}</ul></details>
            <div className="airp-messages">{preview.value!.messages.map((message, i) => <details key={i} open={i === 0}><summary><span>{i + 1}</span> {message.role}</summary><pre>{message.content}</pre></details>)}</div>
          </>}
        </section>
        <section className="airp-card airp-execution"><h2><span>04</span> 生成与试读</h2><ol className="airp-stages">{stages.map(s => <li key={s.id} data-active={state.run?.stage === s.id && state.busy} data-done={state.run?.attempts.some(a => a.stage === s.id && a.status === "succeeded")}>{s.name}</li>)}</ol>
          <p role="status">{state.busy ? `${activeAttempt?.status === "running" ? `${stages.find(s => s.id === activeAttempt.stage)?.name}生成中 · ${Math.max(0, Math.round((clock - activeAttempt.startedAt) / 1000))}秒` : "连接测试中"}` : state.run?.status === "ready" ? "场景已通过格式与原文保真校验，可以开始阅读。" : state.run?.error ?? "准备就绪后开始。正常一场调用3次，格式修复最多另加1次。"}</p>
          <div className="airp-budget"><span>本标签页已发起 {state.calls} 次调用</span><label>调用上限<input aria-label="调用上限" type="number" min="1" max="100" value={state.limit} disabled={state.busy} onChange={e => controller.setLimit(Number(e.target.value))}/></label></div>
          <div className="airp-actions"><button className="airp-primary" disabled={state.busy || !!preview.error} onClick={() => { setLocalError(""); void controller.start(spec, effectiveModels, effectiveKeys); }}>生成一场对白</button>
            {state.busy && <button onClick={() => controller.cancel()}>取消生成</button>}
            {!state.busy && state.run && state.run.status !== "ready" && <button onClick={resume}>重试／继续原任务</button>}
            {generated && <button className="airp-primary" disabled={state.busy} onClick={() => setReading("generated")}>阅读生成对白</button>}
          </div>
          <p className="airp-muted">重试沿用原任务的模型和输入。网络中断的供应商端结果可能未知，再次调用可能重复计费。新生成会替换当前试读缓存，可先导出记录。</p>
          {state.run && <details open><summary>本次阶段记录 · {state.run.status}</summary>{state.run.attempts.map(a => <details key={a.id} className="airp-attempt"><summary>{stages.find(s => s.id === a.stage)?.name} #{a.ordinal} · {a.status} · {a.endedAt === null ? "进行中" : `${((a.endedAt - a.startedAt) / 1000).toFixed(1)}s`}</summary><p>{a.config.model} · tokens {a.usage.totalTokens ?? "未知"}</p>{a.error && <p>{a.error}</p>}<details><summary>实际请求消息</summary><pre>{JSON.stringify(a.input.messages, null, 2)}</pre></details><pre>{a.output ?? "未获得输出"}</pre></details>)}{generated && <details><summary>可见创作记录</summary><p>{generated.creationRecord}</p></details>}</details>}
          <div className="airp-actions airp-actions--minor"><button onClick={() => download("airp-preview-record.json", controller.exportRecord())}>导出试读记录</button><button disabled={state.busy} onClick={() => controller.clear()}>清理试读缓存</button><button disabled={state.busy} onClick={() => { setSampleCursor(0); setReading("sample"); }}>查看手写演出样例</button></div>
        </section>
      </div>
    </div><footer className="airp-workbench__footer">本阶段只验证生成与阅读。游戏委托、读后记忆和持久变量将在下一阶段接入。</footer>
  </main>;
}
