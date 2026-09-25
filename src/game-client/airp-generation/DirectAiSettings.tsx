import { useState, useSyncExternalStore, type ChangeEvent } from "react";
import { aiConfiguration, effectiveAiConfiguration } from "../../game-runtime/airp-configuration";
import { ModelConnectionFields } from "./ModelConnectionFields";
import { SaveFileIcon } from "../SaveFileIcon";
import { AiConnectionHelp, AiConnectionStorage } from "./AiConnectionStorage";
import "./direct-game.css";
import "./direct-settings.css";

function ImportFile({label, onChange, disabled}: {label: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; disabled?: boolean}) {
  return <label className="airp-settings-import">
    <SaveFileIcon direction="import"/><span>{label === "导入测试配置" ? "导入配置" : "导入预设"}</span>
    <input aria-label={label} type="file" accept=".json,application/json" disabled={disabled} onChange={onChange}/>
  </label>;
}

export function DirectAiSettings({layout = "inline", fixedR8 = false, saveInFooter = false}: {layout?: "panel" | "inline"; fixedR8?: boolean; saveInFooter?: boolean}) {
  const config = useSyncExternalStore(aiConfiguration.subscribe, aiConfiguration.getSnapshot), effective = effectiveAiConfiguration(config);
  const vault = useSyncExternalStore(aiConfiguration.subscribe, aiConfiguration.persistence.getSnapshot);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const connectionProps = {value: config, effectiveModels: effective.models, onChange: aiConfiguration.patch, presentation: "settings" as const, disabled: vault.busy && vault.initialized};
  return <section className={`airp-direct-settings airp-direct-settings--${layout}${fixedR8 ? " airp-direct-settings--game" : ""}`} aria-label="AIRP 浏览器直连设置">
    <div className="airp-settings-main">
      <header className="airp-settings-heading"><h3>服务连接</h3><ImportFile label="导入测试配置" disabled={connectionProps.disabled} onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
        setNotice("");
        try {if (file.size > 32768) throw Error(); aiConfiguration.importConfig(await file.text()); setError(""); setNotice("配置已导入，请保存。");} catch {setError("配置未导入：请检查格式与地址，文件不超过32 KiB。");}
      }}/></header>
      <ModelConnectionFields {...connectionProps} part={fixedR8 ? "shared" : "all"}/>
      <AiConnectionHelp/>
      <div className="airp-settings-feedback" aria-live="polite">{error ? <p role="alert">{error}</p> : notice && <p role="status">{notice}</p>}</div>
    </div>
    <aside className="airp-settings-side" aria-label={fixedR8 ? "模型分工" : "创作预设"}>
      {fixedR8 ? <>
        <header className="airp-settings-heading"><h3>模型分工</h3><span className="airp-settings-baseline">r8 基线</span></header>
        <ModelConnectionFields {...connectionProps} part="models"/>
      </> : <section className="airp-settings-preset">
        <header className="airp-settings-heading"><h3>创作预设</h3><ImportFile label="导入酒馆预设" onChange={async e => {
          const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
          setNotice("");
          try {if (file.size > 2097152) throw Error(); aiConfiguration.importPreset(await file.text(), file.name); setError(""); setNotice("预设已导入，新任务生效。");} catch {setError("预设未导入：请检查格式，文件不超过2 MiB。");}
        }}/></header>
        <p className="airp-settings-preset__name">{config.preset.name}</p>
        <label className="airp-settings-order">执行顺序<select value={config.orderId} onChange={e => aiConfiguration.patch({orderId: e.target.value})}><option value="" disabled>请选择顺序</option>{config.preset.orders.map(o => <option key={o.id} value={o.id}>{o.id} · {o.entries.filter(entry => entry.enabled).length} 项启用</option>)}</select></label>
        <details className="airp-settings-sources"><summary>预设与资料</summary>
          <p className="airp-settings-note">v7：Sol大纲 → Gemini正文与表情 → 中文封装。在场角色卡全文、世界书按场景加载；新配置不改已冻结任务。</p>
          <pre>{config.preset.planningPrefix}</pre>{config.preset.modules.filter(m => m.content).map(m => <details key={m.identifier}><summary>{m.name}</summary><pre>{m.content}</pre></details>)}
          {effective.material.resources.sources.map(s => <p key={s.id}>{s.path}<br/><span>SHA256 {s.sha256}</span></p>)}
        </details>
      </section>}
    </aside>
    {!saveInFooter && <AiConnectionStorage/>}
  </section>;
}
