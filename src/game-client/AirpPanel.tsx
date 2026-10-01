import { useGameSession, useGameState } from "./react";
import { gameHref, recordLocator } from "./navigation";
import "./airp.css";
import { AirpPoolPanel } from "./AirpPoolPanel";
import { directorCommissions } from "../game-runtime/airp-commission-view";
import { CommissionList } from "./airp-director/CommissionList";

export function AirpPanel() {
  const session = useGameSession(), { record } = useGameState();
  const commissions = directorCommissions(record);
  if (commissions) return <CommissionList tasks={commissions} title={record?.schemaVersion === 4 && record.snapshot.run ? "本趟委托" : "任务委托"}/>;
  const view = record && session.runtime.queries.narrative(record);
  if (view?.version === 2) return <AirpPoolPanel view={view}/>;
  if (!view?.instance || !["accepted", "ready"].includes(view.instance.status)) return null;
  return <section className="airp-panel airp-panel--compact" aria-label="艾洛拉的委托" data-airp-status={view.instance.status}>
    <h3>{view.title}</h3><p>{view.objective}</p>
    {view.cue && <details><summary>{view.carrying ? "已找到空药箱" : "巡守便条"}</summary><p>{view.cue}</p></details>}
    {view.instance.status === "ready" && <a href={gameHref("mansion", recordLocator(record!))}>回洋馆交付</a>}
  </section>;
}
