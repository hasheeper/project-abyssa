import { useGameSession, useGameState } from "./react";
import { StoryReading } from "./StoryReading";
import { avgPresentation } from "./avg-assets";
import { parseAvgStory } from "../shared/domain/avg/story";
import type { AuthoredLine } from "../content/presentation/authored-story";
import type { AirpFrame } from "../game-core/contracts";
import { airpOnlineBusy, airpOnlineHidden } from "../game-runtime/airp-online-driver";
import { AirpOnlineControls } from "./AirpOnlineControls";
import "./airp.css";

function line(frame: AirpFrame): AuthoredLine {
  return frame.kind === "dialogue" ? { id: frame.id, characterId: frame.actorId, text: frame.text, emotion: frame.emotion } : { id: frame.id, kind: "action", text: frame.text };
}
/** Every acknowledged node and decision is durable; no local-only quest progress. */
export function AirpStory() {
  const session = useGameSession(), { record, status } = useGameState();
  const view = record && session.runtime.queries.narrative(record);
  if (!view?.scene || !view.reading || !view.instance) return null;
  const { scene, reading, instance } = view, node = scene.body.nodes[reading.node];
  if (view.version === 2 && airpOnlineHidden(view.onlineEntry ?? undefined)) return <section className="airp-online-gate" aria-label="选择叙事来源">
    <h2>{view.title}</h2><p>这段交谈尚未展示。可以联网生成，也可以使用已经写好的场景。</p>
    <AirpOnlineControls allowConnect/>
    {view.onlineEntry?.source === "undecided" && <button disabled={status !== "ready" || !view.online?.connection?.binding || airpOnlineBusy(view.online)} onClick={() => void session.dispatch({ type: "airp-online-request", sceneId: scene.id })}>联网生成</button>}
    <button disabled={status !== "ready"} onClick={() => void session.dispatch({ type: "airp-online-handwritten", sceneId: scene.id })}>{view.onlineEntry?.source === "requested" ? "停止等待，使用手写稿" : "使用手写稿"}</button>
    <p className="airp-panel__meta">选定手写稿后，迟到的生成稿不会替换正文；后端候选会单独清理。</p>
  </section>;
  const lines: AuthoredLine[] = scene.body.nodes.slice(0, reading.node + 1).flatMap(n => n.kind === "beat" ? n.frames.map(line)
    : n.kind === "branch" ? n.variants[reading.choice!].map(line)
    : [{ id: n.id, kind: "action", text: reading.choice ? n.options.find(o => o.id === reading.choice)!.label : n.prompt }]);
  const busy = status !== "ready", base = { instanceId: instance.id, sceneId: scene.id, nodeId: node.id };
  const canTurnIn = instance.status === "ready" && reading.completed;
  const homeFinish = view.version === 2 && (view.current?.card.objective.form === "household" || view.current?.card.objective.form === "vignette");
  const canFinish = homeFinish && reading.completed;
  return <StoryReading key={scene.id} wide title={view.title} location={view.location} background={avgPresentation(parseAvgStory(scene.body)).background}
    lines={lines} cursor={lines.length - 1} busy={busy} finalLabel={canFinish ? "完成这件小事" : canTurnIn ? view.version === 1 ? "交付空药箱" : "确认交付" : reading.node === scene.body.nodes.length - 1 ? "完成阅读" : "下一句"}
    choice={node.kind === "choice" ? { prompt: node.prompt, options: node.options } : null}
    onNext={() => void session.dispatch(canFinish ? { type: "airp-finish", instanceId: instance.id } : canTurnIn ? { type: "airp-turn-in", instanceId: instance.id } : { type: "airp-read", ...base })}
    onChoose={optionId => void session.dispatch({ type: "airp-accept", ...base, optionId })} onSkip={() => {}}
    controls={instance.status === "offered" ? <>
      <button className="airp-control" disabled={busy} onClick={() => void session.dispatch({ type: "airp-defer", instanceId: instance.id })}>稍后再说</button>
      <button className="airp-control" disabled={busy} onClick={() => void session.dispatch({ type: "airp-decline", instanceId: instance.id })}>这次不接</button>
    </> : <><span className="airp-saved">阅读进度自动保存</span><AirpOnlineControls docked>
      {view.version === 2 && view.onlineEntry?.accepted && <details className="airp-creation-record"><summary>前置创作记录</summary><p>{view.onlineEntry.accepted.result.text.creationRecord}</p></details>}
      </AirpOnlineControls>
    </>}/>;
}
