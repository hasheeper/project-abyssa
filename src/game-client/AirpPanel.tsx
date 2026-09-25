import { useGameSession, useGameState } from "./react";
import { gameHref, recordLocator } from "./navigation";
import "./airp.css";
import { AirpPoolPanel } from "./AirpPoolPanel";
import { JournalButton, JournalSurface } from "./JournalPrimitives";
import { directorCommissions } from "../game-runtime/airp-commission-view";
import { CommissionList } from "./airp-director/CommissionList";

export function AirpPanel({ compact = false }: { compact?: boolean }) {
  const session = useGameSession(), { record, status } = useGameState();
  const commissions = directorCommissions(record);
  if (commissions) return <CommissionList tasks={commissions} title={record?.schemaVersion === 4 && record.snapshot.run ? "本趟委托" : "任务委托"}/>;
  const view = record && session.runtime.queries.narrative(record);
  if (view?.version === 2) return <AirpPoolPanel view={view} compact={compact}/>;
  if (!view?.instance || compact && !["accepted", "ready"].includes(view.instance.status)) return null;
  const Surface = compact ? "section" : JournalSurface;
  return <Surface className={`airp-panel${compact ? " airp-panel--compact" : " campaign-journal__surface"}`} aria-label="艾洛拉的委托" data-airp-status={view.instance.status}
    {...(!compact ? {role:"region"} : {})}>
    <h3>{view.title}</h3><p>{view.objective}</p>
    {!compact && <p className="airp-panel__meta">艾洛拉 · 公共休息室 · 接受前保留 8 个时段</p>}
    {view.canOpen && !compact && <JournalButton disabled={status !== "ready"} onClick={() => void session.dispatch({ type: "airp-open", instanceId: view.instance!.id })}>{view.instance.status === "ready" ? "把药箱交给艾洛拉" : view.instance.status === "offered" ? "继续谈药箱" : "问问艾洛拉"}</JournalButton>}
    {compact && view.cue && <details><summary>{view.carrying ? "已找到空药箱" : "巡守便条"}</summary><p>{view.cue}</p></details>}
    {view.instance.status === "ready" && compact && <a href={gameHref("mansion", recordLocator(record!))}>回洋馆交付</a>}
    {!compact && view.history.length > 0 && <details><summary>委托记录</summary>
      {view.memories.map(m => <p key={m.id}>{m.summary}</p>)}
      {view.history.map(scene => <details key={scene.id}><summary>{({ offer: "接取", departure: "出发", found: "找到药箱", "return-extracted": "侧门归来", "return-cleared": "巡守归来", retry: "重整", declined: "婉拒", expired: "便条收起" })[scene.role]}</summary>
        {scene.transcript.map(f => <p key={f.id}>{f.kind === "dialogue" ? "艾洛拉：" : ""}{f.text}</p>)}
      </details>)}
      <p>仅留下共同记忆；不额外发放资金、道具或数值好感。</p>
    </details>}
  </Surface>;
}
