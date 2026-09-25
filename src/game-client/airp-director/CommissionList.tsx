import type { CommissionView } from "../../game-runtime/airp-commission-view";
import "./commissions.css";

export function CommissionCard({task, included}: {task: CommissionView; included?: boolean}) {
  return <article className="commission-card" data-commission-state={task.state}>
    <header><h4>{task.title}</h4><span>{included === true ? "本趟随队" : included === false && task.registered && task.matchesRoute ? "未纳入本趟" : task.status}</span></header>
    {task.accepted && task.goal && <p>目标：{task.goal}</p>}
    <p className="commission-card__target">{task.giver}{task.accepted && <> · {task.route}<br/>{task.target}</>}</p>
    <p>{included === false && task.registered && task.matchesRoute ? "请更新出征依据并重新生成安排，再确认出发。" : task.hint}</p>
    {task.unreadAcceptance && <small>{task.registered ? "接单反馈未读完，任务目标已登记。" : "接单反馈未读完。"}</small>}
  </article>;
}

export function CommissionList({tasks, title = "任务委托", includedIds}: {tasks: CommissionView[]; title?: string; includedIds?: readonly string[]}) {
  const active = tasks.filter(t => t.active);
  const count = includedIds ? includedIds.length : active.filter(t => t.accepted && t.matchesRoute && t.registered).length;
  return <section className="commission-list" aria-label={title}>
    <h3>{title}{includedIds && <span> · {count} 项</span>}</h3>
    {includedIds && !count && <p>本趟没有附带委托，按路线目标探索。</p>}
    {!active.length && !includedIds && <p>暂无进行中的委托，按路线目标探索。</p>}
    {active.map(task => <CommissionCard key={task.id} task={task} included={includedIds ? includedIds.includes(task.id) : undefined}/>)}
  </section>;
}
