import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import { DiceActionButton } from "../../../shared/ui/patterns/action-dock/DiceActionButton";
import book from "../../../assets/icons/items/open-book.svg";
import chest from "../../../assets/icons/items/locked-chest.svg";
import camp from "../../../assets/icons/items/camping-tent.svg";
import type { ManorEventRoll } from "./manor-event-presentation";

type Props = {
  view: DemoJourneyView;
  actorId: string;
  eventRoll?: ManorEventRoll | null;
};
type ActionsProps = Props & {
  busy: boolean;
  onChoice: (id: "read" | "attempt" | "skip") => void;
  onAdvance: () => void;
  onExit: (choice: "leave" | "continue") => void;
};
const scenes: Record<string, string> = {
  "old-manor.welcoming-hall": "迎客门厅",
  "old-manor.service-corridor": "服务走廊",
  "old-manor.banquet-hall": "宴会厅",
};
export function manorJourneyTitle(view: DemoJourneyView) {
  if (view.expedition?.node === "event") return view.event!.name;
  if (view.expedition?.node === "exit") return view.maintenance ? "通路已清理" : "通过落幕管家";
  if (view.lastEvent) return view.lastEvent.method === "skip" ? "绕过此处" : view.lastEvent.method === "read" ? "记录已阅" : "整理结束";
  return "片刻安静";
}
function resultText(view: DemoJourneyView) {
  const result = view.lastEvent;
  if (!result) return "红线松弛下来，前路暂时安静。";
  if (result.method === "skip") return "没有惊动这里的遗物。队伍可以继续前行。";
  if (result.method === "read") return result.eventId === "event.old-manor.seats"
    ? "宾客越少，举杯越轻。主位仍空着，她也是被吊线控制的一员。"
    : "迎宾簿记下了执行者，却没有写下能够取消家宴的人。";
  return result.method === "failed" ? "遗物没能保全。收拾好行装，再往前走吧。" : "遗物已经保全。这里留下的东西，不必再随庄园一起沉下去。";
}
/** Existing single-participant events. Reads committed results, never rolls or pays in the UI. */
export function ManorJourneyPanel({view: v, actorId, eventRoll}: Props) {
  const event = v.expedition?.node === "event" ? v.event : null;
  const exit = v.expedition?.node === "exit";
  const actor = v.party.find(m => m.id === actorId);
  const result = v.lastEvent;
  const resultActor = result?.actorId ? v.party.find(m => m.id === result.actorId) : null;
  const face = resultActor?.faces.find(f => f.id === result?.faceId);
  const rollingActor = eventRoll ? v.party.find(m => m.id === eventRoll.actorId) : null;
  const checkingFace = eventRoll && rollingActor ? rollingActor.faces[eventRoll.faceIndex] : null;
  const text = event ? event.text : exit
    ? v.fullManor ? "第三层通路已打开。可以带宝离场，或继续深入宴会厅；后半段在第五层完成前没有主动出口。" : "屏风门已经打开，三层考核完成。现在可以带宝离场。"
    : resultText(v);
  return <section className="manor-journey" aria-label={manorJourneyTitle(v)} data-kind={event ? "event" : exit ? "exit" : "rest"} data-event-phase={eventRoll?.phase}>
    <div className="manor-journey__reading">
      <header className="manor-journey__heading">
        <i style={{maskImage: `url("${event?.kind === "relic" || face ? chest : event || result ? book : camp}")`}} aria-hidden="true"/>
        <div><small>第 {v.expedition!.run.layer} 层 · {scenes[v.room?.sceneId ?? ""] ?? "克雷格旧庄园"}</small><h2>{manorJourneyTitle(v)}</h2></div>
      </header>
      <div className="manor-journey__text" tabIndex={0}>
        <p>{text}</p>
        {event?.kind === "relic" && <p className="manor-journey__cost">整理需 <b>{event.cost} G</b> 散金；保全成功可获得 <b>{event.reward} G</b>。</p>}
        {v.eventRevealed && event && <p className="manor-journey__revelation">{event.kind === "relic" ? "治疗、昂贵治疗、庇护、守护全体、万能行动可强保全；其余清醒且至少四点或万能命数可弱保全。" : "阅读或略过均免费，不进行随机判定。"}</p>}
        {v.nextLayer && <p className="manor-journey__revelation">前路侦察：{v.nextLayer.map(r => r.enemies.length ? r.enemies.join("、") : r.kind === "event" ? "事件" : "出口").join(" → ")}</p>}
      </div>
    </div>
    {eventRoll && eventRoll.phase !== "outcome" && rollingActor && checkingFace ? <aside className="manor-journey__detail manor-journey__detail--check" aria-label="整理判定" aria-live="polite">
      <small>{rollingActor.name} · 判定骰</small>
      <strong>{eventRoll.phase === "rolling" ? "掷骰中" : checkingFace.name}</strong>
      <p>{eventRoll.phase === "rolling" ? "等待骰子落定……" : `${checkingFace.fate === "awake" ? "清醒" : "沉睡"} · ${checkingFace.pip.kind === "wild" ? "万能命数" : `${checkingFace.pip.value} 点`}`}</p>
      <p className="manor-journey__checking">{eventRoll.phase === "rolling" ? "此刻尚未揭晓" : "核对行动与命数条件……"}</p>
    </aside> : event?.kind === "relic" && actor ? <aside className="manor-journey__detail" aria-label="整理伙伴">
      <small>整理伙伴</small><strong>{actor.name}</strong>
      <span className="manor-journey__faces" aria-label={`可保全面 ${actor.eventSuccessFaces}/6`}>{Array.from({length:6},(_,i)=><i data-ready={i<actor.eventSuccessFaces || undefined} key={i}/>)}</span>
      <p>可保全面 {actor.eventSuccessFaces}/6</p><p>点选伙伴 · 确认后独立掷骰</p><p>持有散金 <b>{v.expedition!.run.looseGold} G</b></p>
    </aside> : face && result ? <aside className="manor-journey__detail manor-journey__detail--check" aria-label="整理结果" aria-live="polite">
      <small>{resultActor!.name} · 此次判定</small><strong>{face.name}</strong>
      <output className="manor-journey__verdict" data-outcome={result.method}>{result.method === "strong" ? "强保全" : result.method === "weak" ? "弱保全" : "未能保全"}</output>
      <div className="manor-journey__checks" aria-label="判定依据">
        <span>行动判定<b>{result.method === "strong" ? "命中" : "未命中"}</b></span>
        <span>命数判定<b>{result.method === "strong" ? "无需判定" : result.method === "weak" ? "通过" : "未通过"}</b></span>
      </div>
      {result.method !== "strong" && <p>{face.fate === "awake" ? "清醒" : "沉睡"} · {face.pip.kind === "wild" ? "万能命数" : `${face.pip.value} 点`}</p>}
      <p>花费 {result.cost} G · 获得 {result.reward} G</p>
    </aside> : null}
  </section>;
}
/** Room decisions occupy the established action dock instead of a second button panel. */
export function ManorJourneyActions({view:v, actorId, busy, eventRoll, onChoice, onAdvance, onExit}: ActionsProps) {
  const node = v.expedition!.node;
  const event = node === "event" ? v.event : null;
  const actor = v.party.find(m => m.id === actorId && m.hp > 0);
  const cannotAttempt = event?.kind === "relic" && (!actor || v.expedition!.run.looseGold < event.cost);
  if (event) return <div className="manor-journey-actions">
    <DiceActionButton label="绕行" disabled={busy} onClick={() => onChoice("skip")}/>
    <span>{eventRoll ? `${actor?.name} · ${eventRoll.phase === "rolling" ? "掷骰中" : "判定中"}` : busy ? "正在整理……" : event.kind === "relic" ? cannotAttempt ? "散金不足或无可用伙伴" : `${actor?.name}整理` : "查阅庄园记录"}</span>
    <DiceActionButton primary label={event.kind === "register" ? "阅读迎宾簿" : event.kind === "seats" ? "核对席位" : "ROLL"} disabled={busy || !!cannotAttempt} onClick={() => onChoice(event.kind === "relic" ? "attempt" : "read")}/>
  </div>;
  if (node === "exit") return <div className="manor-journey-actions">
    <DiceActionButton primary label="带宝离场" disabled={busy} onClick={() => onExit("leave")}/>
    <span>第三层撤离口</span>
    {v.room?.kind === "exit" && v.room.canContinue ? <DiceActionButton label="深入宴会厅" disabled={busy} onClick={() => onExit("continue")}/> : <span/>}
  </div>;
  return <div className="manor-journey-actions">
    <DiceActionButton label="扎营 · 未开放" disabled onClick={() => {}}/>
    <span>{eventRoll?.phase === "outcome" ? "判定揭晓" : busy ? "前行中" : "可使用道具整备"}</span>
    <DiceActionButton primary label="继续前进" disabled={busy} onClick={onAdvance}/>
  </div>;
}
