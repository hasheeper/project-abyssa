import { useId, type ReactNode } from "react";
import { RpgCheckbox } from "../../shared/ui/primitives/RpgChoice";
import type { AiConnectionValues } from "../../game-runtime/airp-configuration";
import type { ModelSlot, Models } from "../../game-runtime/airp-generation";
import { completionUrl } from "../../game-runtime/airp-generation";

const slots = [{id: "planning", name: "GM"}, {id: "writing", name: "正文"}, {id: "updater", name: "辅助"}] as const;
const address = (base: string, compact = false) => {try {return completionUrl(base);} catch {return compact ? (base.trim() ? "请输入有效 API 地址" : "") : "填写 Base URL 后显示请求地址";}};
export function ModelConnectionFields({value, onChange, effectiveModels, disabled, onProbe, probeDetails, presentation = "workbench", legacyCreative = false, part = "all"}: {
  value: AiConnectionValues; onChange: (patch: Partial<AiConnectionValues>) => void; effectiveModels: Models; disabled?: boolean;
  onProbe?: (slot: ModelSlot) => void; probeDetails?: (slot: ModelSlot) => ReactNode;
  presentation?: "settings" | "workbench"; legacyCreative?: boolean; part?: "all" | "shared" | "models";
}) {
  const id = useId(), settings = presentation === "settings";
  const patchModel = (slot: ModelSlot, field: string, v: string | number | undefined) => onChange({models: {...value.models, [slot]: {...value.models[slot], [field]: v}}});
  return <fieldset className="airp-connections" disabled={disabled}>
    {part !== "models" && <div className="airp-connection-shared"><div className="airp-fields"><label>公共 API 地址<input aria-label="公共 API 地址" type="url" autoComplete="off" spellCheck={false} placeholder="https://…/v1" value={value.baseUrl} onChange={e => onChange({baseUrl: e.target.value})}/></label>
      <label>公共 API Key<input aria-label="公共 API Key" type="password" autoComplete="off" placeholder="API Key" value={value.commonKey} onChange={e => onChange({commonKey: e.target.value})}/></label></div>
    <p className="airp-endpoint">{address(value.baseUrl, settings)}</p></div>}
    {part !== "shared" && slots.map(s => legacyCreative ? {...s, name: s.id === "planning" ? "创作" : s.id === "writing" ? "润色" : s.name} : s).map((slot, index) => <section className="airp-model" key={slot.id}>
      <div className="airp-model__title"><strong>{settings && <span className="airp-model__index" aria-hidden="true">{["Ⅰ", "Ⅱ", "Ⅲ"][index]}</span>}{slot.name}{settings && <small>{slot.id === "planning" ? (legacyCreative ? "Creation" : "日度 / 副本调度") : slot.id === "writing" ? (legacyCreative ? "Editing" : "场景正文") : "中文封装 / 结算"}</small>}</strong>
        {settings ? <div className="airp-checkbox"><RpgCheckbox id={`${id}-${slot.id}`} label={`${slot.name}独立连接`} variant={value.separate[slot.id] ? "teal" : "dark"} checked={value.separate[slot.id]} onCheckedChange={checked => onChange({separate: {...value.separate, [slot.id]: checked}})}/><label htmlFor={`${id}-${slot.id}`}>独立连接</label></div>
          : <label className="airp-checkbox"><input type="checkbox" checked={value.separate[slot.id]} onChange={e => onChange({separate: {...value.separate, [slot.id]: e.target.checked}})}/>{slot.name}独立连接</label>}</div>
      {value.separate[slot.id] && <div className="airp-fields airp-model__separate"><label>{slot.name} API 地址<input type="url" autoComplete="off" spellCheck={false} value={value.models[slot.id].baseUrl} onChange={e => patchModel(slot.id, "baseUrl", e.target.value)}/></label><label>{slot.name} API Key<input type="password" autoComplete="off" value={value.keys[slot.id]} onChange={e => onChange({keys: {...value.keys, [slot.id]: e.target.value}})}/></label></div>}
      <div className="airp-model__row"><label><span className={settings ? "airp-settings-sr-only" : undefined}>{slot.name}模型 ID</span><input aria-label={`${slot.name}模型 ID`} autoComplete="off" spellCheck={false} value={value.models[slot.id].model} placeholder="填写精确模型标识" onChange={e => patchModel(slot.id, "model", e.target.value)}/></label>{onProbe && <button type="button" onClick={() => onProbe(slot.id)}>测试{slot.name}连接</button>}</div>
      <details className="airp-model__advanced"><summary>{settings ? "高级参数" : "参数与测试结果"}</summary><div className="airp-fields airp-fields--numbers">
        <label>temperature<input aria-label={`${slot.name} temperature`} type="number" min="0" max="2" step="0.1" value={value.models[slot.id].temperature ?? ""} placeholder="端点／预设默认" onChange={e => patchModel(slot.id, "temperature", e.target.value === "" ? undefined : Number(e.target.value))}/></label>
        <label>top_p<input aria-label={`${slot.name} top_p`} type="number" min="0" max="1" step="0.1" value={value.models[slot.id].top_p ?? ""} onChange={e => patchModel(slot.id, "top_p", e.target.value === "" ? undefined : Number(e.target.value))}/></label>
        <label>输出 tokens<input aria-label={`${slot.name} 输出上限`} type="number" min="1" max="65536" value={value.models[slot.id].max_tokens ?? ""} onChange={e => patchModel(slot.id, "max_tokens", e.target.value === "" ? undefined : Number(e.target.value))}/></label>
        <label>等待秒数<input aria-label={`${slot.name} 等待秒数`} type="number" min="1" max="300" value={value.models[slot.id].timeoutMs / 1000} onChange={e => patchModel(slot.id, "timeoutMs", Number(e.target.value) * 1000)}/></label>
      </div><p className="airp-endpoint">{address(effectiveModels[slot.id].baseUrl, settings)}</p>
      <p className="airp-muted">{settings ? "采样参数留空时使用默认值。生效配置不含 Key。" : "显式数值优先；正文参数留空时采用预设值，否则由端点决定。以下为生效配置（不含Key）。"}</p><pre>{JSON.stringify(effectiveModels[slot.id], null, 2)}</pre>{probeDetails?.(slot.id)}</details>
    </section>)}
  </fieldset>;
}
