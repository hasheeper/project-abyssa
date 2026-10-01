import type { GameSession } from "./session";
import { AIRP_ACTOR_NAMES } from "../game-runtime/airp-pool-view";
import { JournalDisclosure } from "./JournalPrimitives";
import { journalActions, type JournalEntry } from "./JournalBrowser";
import { JOURNAL_STATUS } from "./journal-format";
import { DirectRecord } from "./airp-generation/DirectControls";

type Narrative = ReturnType<GameSession["runtime"]["queries"]["narrative"]>;
const roles = {offer: "提议", departure: "出发", found: "发现", "return-extracted": "侧门归来", "return-cleared": "巡路归来", retry: "重整", declined: "婉拒", expired: "收起", target: "传话", complete: "收尾", aftermath: "后续", followup: "归来之后"};
const states = {pending: JOURNAL_STATUS.available, offered: JOURNAL_STATUS.resume, accepted: JOURNAL_STATUS.ongoing,
  ready: JOURNAL_STATUS.wrapUp, closed: JOURNAL_STATUS.closed, resolved: JOURNAL_STATUS.done};
const place = "公共休息室";

type Scene = {id: string; role: keyof typeof roles; transcript: readonly {id: string; kind: string; text: string; actorId?: string}[]};
/** 交谈记录按场次分段;场次名是小标题,不再嵌套第二层折叠。 */
function SceneHistory({label, memories, scenes, speaker}: {
  label: string; memories?: readonly {id: string; summary: string}[]; scenes: readonly Scene[]; speaker: (actorId?: string) => string;
}) {
  return <JournalDisclosure label={label}>
    {memories?.map(m => <p key={m.id}>{m.summary}</p>)}
    {scenes.map(scene => <section key={scene.id}><h5>{roles[scene.role]}</h5>
      {scene.transcript.map(f => <p key={f.id}>{f.kind === "dialogue" ? `${speaker(f.actorId)}：` : ""}{f.text}</p>)}
    </section>)}
  </JournalDisclosure>;
}

export function airpJournalEntries(view: Narrative, session: GameSession, busy: boolean): JournalEntry[] {
  if (!view) return [];
  if (view.version === 1) {
    const instance = view.instance;
    if (!instance || instance.status === "closed" && instance.exposedPhase === null) return [];
    return [{id: instance.id, sourceId: instance.id, title: view.title, source: "艾洛拉", category: "commission", place, status: states[instance.status],
      group: ["closed", "resolved"].includes(instance.status) ? "archive" : "current", actionable: view.canOpen,
      lead: view.objective,
      actions: journalActions(view.canOpen && {label: instance.status === "ready" ? "把药箱交给艾洛拉" : instance.status === "offered" ? "继续谈药箱" : "问问艾洛拉",
        emphasis: "primary", disabled: busy, onClick: () => void session.dispatch({type: "airp-open", instanceId: instance.id})}),
      records: !!view.history.length && <SceneHistory label="委托记录" memories={view.memories} scenes={view.history} speaker={() => "艾洛拉"}/>}];
  }
  return view.entries.filter(e => e.instance.reason !== "reserved").map(e => {
    const closed = ["closed", "resolved"].includes(e.instance.status);
    const directTasks = view.direct?.tasks.filter(t => t.instanceId === e.instance.id) ?? [];
    const pendingMemory = directTasks.some(t => t.read && !t.memoryId && t.source === "browser-direct");
    const actionable = e.canOpen || e.canFollowup || e.canDirectFollowup || pendingMemory || e.instance.status === "accepted" && !!e.visitLocation;
    const status = pendingMemory ? JOURNAL_STATUS.organize : e.canFollowup || e.canDirectFollowup ? JOURNAL_STATUS.available : states[e.instance.status];
    const deadline = ["pending", "offered"].includes(e.instance.status)
      ? `第 ${Math.floor(e.instance.offerUntilPhase / 4) + 1} 日${["晨", "昼", "昏", "夜"][e.instance.offerUntilPhase % 4]}前`
      : e.instance.status === "accepted" ? "无履约期限" : null;
    return {id: e.instance.id, sourceId: e.card.id, title: e.title, source: e.giver, category: "commission", place, status,
      group: closed && !actionable ? "archive" : "current", actionable,
      lead: pendingMemory && e.instance.status === "resolved" ? "委托与阅读进度已保存。" : e.objective,
      facts: deadline ? [{label: "期限", value: deadline}] : undefined,
      actions: journalActions(
        e.canOpen && {label: closed ? `看看「${e.title}」的后续` : e.instance.status === "ready" ? `找${e.giver}收尾` : e.instance.status === "offered" ? "继续这段交谈" : `问问${e.giver}`,
          emphasis: "primary", disabled: busy, onClick: () => void session.dispatch({type: "airp-open", instanceId: e.instance.id})},
        e.instance.status === "accepted" && !!e.target && {label: e.visitLocation ? `找${e.targetName}传话` : `${e.targetName}此刻不在约定地点`,
          emphasis: "primary", disabled: busy || !e.visitLocation,
          onClick: () => void session.dispatch({type: "airp-visit", instanceId: e.instance.id, actorId: e.target!, locationId: e.visitLocation!})},
        e.canFollowup && {label: `再和${e.giver}聊聊药箱`, disabled: busy, onClick: () => void session.dispatch({type: "airp-online-followup", instanceId: e.instance.id})},
        e.canDirectFollowup && {label: `再和${e.giver}聊聊药箱`, disabled: busy, onClick: () => void session.dispatch({type: "airp-direct-followup", instanceId: e.instance.id})},
      ),
      records: <>
        {directTasks.filter(t => t.read).map(t => <DirectRecord key={t.id} sceneId={t.sceneId} label={`${t.task === "return" ? "归来" : "后续"} · 生成与记忆记录`}/>)}
        {view.direct?.memories.filter(m => m.instanceId === e.instance.id).map(m => <JournalDisclosure key={m.id} label={`已读对白记忆：${m.summary}`}>
          <p>来源场景：{m.sceneId}</p><p>支持段落：{m.supports.join("、")}</p>
        </JournalDisclosure>)}
        {!!e.history.length && <SceneHistory label="交谈记录" scenes={e.history} speaker={actorId => AIRP_ACTOR_NAMES[actorId ?? ""] ?? ""}/>}
      </>};
  });
}
