import type { GameSession } from "./session";
import { AIRP_ACTOR_NAMES } from "../game-runtime/airp-pool-view";
import { JournalButton } from "./JournalPrimitives";
import { JournalRecordHeading, type JournalEntry } from "./JournalBrowser";

type Narrative = ReturnType<GameSession["runtime"]["queries"]["narrative"]>;
const roles = {offer: "提议", departure: "出发", found: "发现", "return-extracted": "侧门归来", "return-cleared": "巡路归来", retry: "重整", declined: "婉拒", expired: "收起", target: "传话", complete: "收尾", aftermath: "后续", followup: "归来之后"};
const states = {pending: "待交谈", offered: "交谈中", accepted: "进行中", ready: "待交付", closed: "已结束", resolved: "已完成"};

export function airpJournalEntries(view: Narrative, session: GameSession, busy: boolean): JournalEntry[] {
  if (!view) return [];
  if (view.version === 1) {
    const instance = view.instance;
    if (!instance || instance.status === "closed" && instance.exposedPhase === null) return [];
    return [{id: instance.id, sourceId: instance.id, title: view.title, meta: `艾洛拉 · ${states[instance.status]}`, kind: "quest",
      group: ["closed", "resolved"].includes(instance.status) ? "archive" : "current", actionable: view.canOpen,
      content: <section data-airp-status={instance.status}>
        <JournalRecordHeading title={view.title} meta={`艾洛拉 · 公共休息室 · ${states[instance.status]}`}/>
        <p>{view.objective}</p>
        {view.canOpen && <div className="journal-record__actions"><JournalButton emphasis="primary" disabled={busy} onClick={() => void session.dispatch({type: "airp-open", instanceId: instance.id})}>{instance.status === "ready" ? "把药箱交给艾洛拉" : instance.status === "offered" ? "继续谈药箱" : "问问艾洛拉"}</JournalButton></div>}
        {!!view.history.length && <details className="journal-record__history"><summary>委托记录</summary>
          {view.memories.map(m => <p key={m.id}>{m.summary}</p>)}
          {view.history.map(scene => <details key={scene.id}><summary>{roles[scene.role]}</summary>{scene.transcript.map(f => <p key={f.id}>{f.kind === "dialogue" ? "艾洛拉：" : ""}{f.text}</p>)}</details>)}
        </details>}
      </section>}];
  }
  return view.entries.filter(e => e.instance.reason !== "reserved").map(e => {
    const closed = ["closed", "resolved"].includes(e.instance.status);
    const actionable = e.canOpen || e.canFollowup || e.instance.status === "accepted" && !!e.visitLocation;
    return {id: e.instance.id, sourceId: e.card.id, title: e.title, meta: `${e.giver} · ${e.canFollowup ? "可交谈" : states[e.instance.status]}`,
      kind: "quest", group: closed && !actionable ? "archive" : "current", actionable,
      content: <section data-airp-id={e.card.id} data-airp-status={e.instance.status}>
        <JournalRecordHeading title={e.title} meta={`${e.giver} · 公共休息室 · ${states[e.instance.status]}`}/>
        <p>{e.objective}</p>
        {["pending", "offered"].includes(e.instance.status) && <p className="campaign-journal__note">提供至第 {Math.floor(e.instance.offerUntilPhase / 4) + 1} 日{["晨", "昼", "昏", "夜"][e.instance.offerUntilPhase % 4]}前</p>}
        {e.instance.status === "accepted" && <p className="campaign-journal__note">已接受 · 无履约期限</p>}
        {(e.canOpen || e.canFollowup || e.instance.status === "accepted" && e.target) && <div className="journal-record__actions">
          {e.canOpen && <JournalButton emphasis="primary" disabled={busy} onClick={() => void session.dispatch({type: "airp-open", instanceId: e.instance.id})}>{closed ? `看看「${e.title}」的后续` : e.instance.status === "ready" ? `找${e.giver}收尾` : e.instance.status === "offered" ? "继续这段交谈" : `问问${e.giver}`}</JournalButton>}
          {e.instance.status === "accepted" && e.target && <JournalButton emphasis="primary" disabled={busy || !e.visitLocation} onClick={() => void session.dispatch({type: "airp-visit", instanceId: e.instance.id, actorId: e.target!, locationId: e.visitLocation!})}>{e.visitLocation ? `找${e.targetName}传话` : `${e.targetName}此刻不在约定地点`}</JournalButton>}
          {e.canFollowup && <JournalButton disabled={busy} onClick={() => void session.dispatch({type: "airp-online-followup", instanceId: e.instance.id})}>再和{e.giver}聊聊药箱</JournalButton>}
        </div>}
        {!!e.history.length && <details className="journal-record__history"><summary>交谈记录</summary>
          {e.history.map(scene => <details key={scene.id}><summary>{roles[scene.role]}</summary>{scene.transcript.map(f => <p key={f.id}>{f.kind === "dialogue" ? `${AIRP_ACTOR_NAMES[f.actorId]}：` : ""}{f.text}</p>)}</details>)}
        </details>}
      </section>};
  });
}
