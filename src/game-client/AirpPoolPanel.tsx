import type { AirpPoolView } from "../game-runtime/airp-pool-view";
import { AIRP_ACTOR_NAMES } from "../game-runtime/airp-pool-view";
import { useGameSession, useGameState } from "./react";
import { gameHref, recordLocator } from "./navigation";
import { AirpOnlineControls } from "./AirpOnlineControls";
import { JournalButton, JournalSurface } from "./JournalPrimitives";
import { DirectControls } from "./airp-generation/DirectControls";
import { AiSettingsButton } from "./settings/AiSettingsButton";

const forms = { sortie: "出击", liaison: "牵线", household: "家务", vignette: "小景" };
const roles = { offer: "提议", departure: "出发", found: "发现", "return-extracted": "侧门归来", "return-cleared": "巡路归来", retry: "重整", declined: "婉拒", expired: "收起", target: "传话", complete: "收尾", aftermath: "后续", followup: "归来之后" };
export function AirpPoolPanel({ view, compact }: { view: AirpPoolView; compact: boolean }) {
  const session = useGameSession(), { record, status } = useGameState(), busy = status !== "ready";
  if (!view.entries.length && !view.capacityStopped) return null;
  if (compact) return view.patrol ? <section className="airp-panel airp-panel--compact" aria-label="巡守委托"><h3>{view.patrol.title}</h3><p>{view.patrol.objective}</p>
    {view.cue && <details><summary>巡守便条</summary><p>{view.cue}</p></details>}
    {view.patrol.instance.status === "ready" && <a href={gameHref("mansion", recordLocator(record!))}>回洋馆交付</a>}
  </section> : null;
  const active = view.entries.filter(e => !["closed", "resolved"].includes(e.instance.status)), history = view.entries.filter(e => ["closed", "resolved"].includes(e.instance.status));
  return <JournalSurface className="airp-panel airp-pool campaign-journal__surface" role="region" aria-label="洋馆涟漪">
    {view.online && <AirpOnlineControls allowConnect/>}
    {view.direct && <AiSettingsButton/>}
    <h3>洋馆涟漪</h3><p className="airp-panel__meta">同伴可在公共休息室碰面 · 按游戏时段流转</p>
    {!active.length && <p>眼下没有新的便条。大家各忙各的，也很好。</p>}
    {active.map(e => <article key={e.instance.id} data-airp-id={e.card.id} data-airp-status={e.instance.status}>
      <h4>{e.title} <small>{forms[e.card.objective.form]}</small></h4><p>{e.objective}</p>
      <p className="airp-panel__meta">{e.giver}{["pending", "offered"].includes(e.instance.status) ? ` · 提供至第 ${Math.floor(e.instance.offerUntilPhase / 4) + 1} 日${["晨", "昼", "昏", "夜"][e.instance.offerUntilPhase % 4]}前` : " · 已接受，无履约期限"}</p>
      {e.canOpen && <JournalButton disabled={busy} onClick={() => void session.dispatch({ type: "airp-open", instanceId: e.instance.id })}>{e.instance.status === "ready" ? `找${e.giver}收尾` : e.instance.status === "offered" ? "继续这段交谈" : `问问${e.giver}`}</JournalButton>}
      {e.instance.status === "accepted" && e.target && <JournalButton disabled={busy || !e.visitLocation} onClick={() => void session.dispatch({ type: "airp-visit", instanceId: e.instance.id, actorId: e.target!, locationId: e.visitLocation! })}>{e.visitLocation ? `找${e.targetName}传话` : `${e.targetName}此刻不在约定地点`}</JournalButton>}
    </article>)}
    {history.some(e => e.instance.reason === "missed" && !e.instance.aftermathRead) && <div className="airp-pool__aftermath"><h4>告示角的近况</h4>
      {history.filter(e => e.instance.reason === "missed" && !e.instance.aftermathRead).map(e => <JournalButton key={e.instance.id} disabled={busy || !e.canOpen} onClick={() => void session.dispatch({ type: "airp-open", instanceId: e.instance.id })}>看看「{e.title}」的后续</JournalButton>)}
    </div>}
    {history.filter(e => e.canFollowup).map(e => <JournalButton key={`followup-${e.instance.id}`} disabled={busy} onClick={() => void session.dispatch({ type: "airp-online-followup", instanceId: e.instance.id })}>再和{e.giver}聊聊药箱</JournalButton>)}
    {history.filter(e => e.canDirectFollowup).map(e => <JournalButton key={`direct-followup-${e.instance.id}`} disabled={busy} onClick={() => void session.dispatch({type: "airp-direct-followup", instanceId: e.instance.id})}>再和{e.giver}聊聊药箱</JournalButton>)}
    {view.direct?.tasks.filter(t => t.source === "browser-direct" && t.read && !t.memoryId).map(t => <DirectControls key={t.id} sceneId={t.sceneId}/>)}
    <details><summary>涟漪记事（{history.length}）</summary>
      {view.memories.map(m => <p key={m.id}>{m.axis === "agenda" ? "近况：" : "记忆："}{m.summary}</p>)}
      {view.direct?.memories.map(m => <details key={m.id}><summary>已读对白记忆：{m.summary}</summary><p>第{Math.floor(m.phase / 4) + 1}日 · 来源场景 {m.sceneId}</p><p>支持段落：{m.supports.join("、")}</p></details>)}
      {history.filter(e => e.history.length).map(e => <details key={e.instance.id}><summary>{e.title}</summary>{e.history.map(s => <details key={s.id}><summary>{roles[s.role]}</summary>{s.transcript.map(f => <p key={f.id}>{f.kind === "dialogue" ? `${AIRP_ACTOR_NAMES[f.actorId]}：` : ""}{f.text}</p>)}</details>)}</details>)}
      <p className="airp-panel__meta">备用便条 {view.reserveCount} 张。记忆与近况不额外授予资金、物品或数值好感。</p>
    </details>
    {view.capacityStopped && <p role="status">叙事档案容量预留已满，暂停补充新事件。已有记录不会删除；导出备份不会重置容量。</p>}
  </JournalSurface>;
}
