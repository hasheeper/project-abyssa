import { useState } from "react";
import type { FacilityCommand } from "../../game-core/contracts/facilities";
import type { FacilitiesView } from "../../game-runtime/facilities-view";
import { RpgNotchedPillButton } from "../../shared/ui/primitives/RpgNotchedPillButton";
import { QuantityStepper } from "../../shared/ui/primitives/QuantityStepper";
import { CurrencyAmount } from "../../shared/ui/primitives/CurrencyAmount";
import "./mansion-facilities.css";

export function MansionFacilityPanel({view, roomId, busy, onCommand, onStock}: {
  view: FacilitiesView; roomId: string; busy: boolean;
  onCommand: (command: FacilityCommand) => void; onStock: () => void;
}) {
  const [requested, setRequested] = useState(1);
  const room = view.rooms.find(r => r.id === roomId);
  if (!room) return null;
  const locked = busy || !!view.blocked, batch = room.batch, order = view.order;
  const recipe = view.recipes[0], quantity = Math.min(requested, Math.max(1, recipe?.maximum ?? 1));
  const build = room.build, project = view.construction?.roomId === roomId ? view.construction : null;
  const action = (label: string, command: FacilityCommand, disabled = false) => <RpgNotchedPillButton variant="teal" label={label} disabled={locked || disabled} onClick={() => onCommand(command)}/>;
  return <section className="mansion-facility" aria-label={`${room.name}设施`}>
    <div className="mansion-facility__line"><small>设施</small><span>{room.level ? `Lv.${room.level} / 3` : build ? "待修缮" : "待启用"}</span></div>
    {!room.level ? !build && <>
      <p>第 {room.availableDay} 日可整理现有设备，启用{room.name}。</p>
      {action("启用", {type: "facility-enable", roomId: room.id}, !room.canEnable)}
    </> : <>
      {batch && <>
        <div className="mansion-facility__line"><strong>{batch.name}</strong><span>×{batch.remaining}</span></div>
        <p>{batch.remainingPhases ? `还需 ${batch.remainingPhases} 个时段` : batch.collectMaximum ? "已备妥，可收入储藏室。" : "储藏室已满，本批保留待收。"} 收完后开始下一批。</p>
        {action(batch.collectMaximum < batch.remaining && batch.collectMaximum > 0 ? `收取 ${batch.collectMaximum} 份` : "收取", {type: "facility-collect", roomId: room.id, batchId: batch.id, quantity: Math.max(1, batch.collectMaximum)}, !batch.collectMaximum)}
      </>}
      {room.id === "greenhouse" && <div className="mansion-facility__crops" role="group" aria-label="下一批种植">
        <small>下一批</small>{view.projects.map(p => <button type="button" key={p.id} aria-pressed={view.state.selectedProject === p.id} disabled={locked || view.state.selectedProject === p.id} onClick={() => onCommand({type: "facility-plant", projectId: p.id})}>{p.name}</button>)}
      </div>}
      {room.id === "workshop" && (project ? <p>工坊施工中，完工后恢复加工。</p> : order ? <>
        <div className="mansion-facility__line"><strong>{order.name}</strong><span>×{order.quantity}</span></div>
        <p>{order.remainingPhases ? `制作中 · 还需 ${order.remainingPhases} 个时段` : "制作完成，储藏室已预留位置。"}</p>
        {action("领取", {type: "facility-claim", orderId: order.id}, !!order.remainingPhases)}
      </> : recipe && <>
        <div className="mansion-facility__line"><strong>{recipe.name}</strong><small>{recipe.phases} 个时段</small></div>
        {recipe.materials.map(m => <div className="mansion-facility__line" key={m.id}><span>{m.name} ×{m.quantity * quantity}</span><small>持有 {m.owned}</small></div>)}
        <div className="mansion-facility__line"><span>辅料费</span><CurrencyAmount value={recipe.fee * quantity}/></div>
        <div className="mansion-facility__line"><QuantityStepper label="加工数量" value={quantity} maximum={recipe.maximum} disabled={locked} onChange={setRequested}/>{action("加工", {type: "facility-craft", recipeId: recipe.id, quantity}, !recipe.maximum)}</div>
        {!recipe.maximum && <p>{recipe.materials.some(m => m.owned < m.quantity) ? "原料不足，请先收取温室药草。" : "辅料费不足或储藏室没有空位。"}</p>}
      </>)}
      {room.id === "storage" && <>
        <p>可携带 {view.itemLimit} 类补给出征；每种数量由行囊上限决定。</p>
        {view.materials.map(m => <div className="mansion-facility__line" key={m.id}><span>{m.name}</span><span>{m.quantity} / {m.capacity}</span></div>)}
        <RpgNotchedPillButton variant="teal" label="查看库存" onClick={onStock}/>
        {view.overflow.map(m => <div className="mansion-facility__return" key={m.id}><span>待入库 · {m.name} ×{m.quantity}</span>{action("入库", {type: "facility-store-return", definitionId: m.id, quantity: Math.max(1, m.maximum)}, !m.maximum)}</div>)}
      </>}
      {room.id === "maid" && <p>修缮与升级费用降低 {view.discount}%，不含女仆工作间自身。</p>}
    </>}
    {build && view.funding && <div className="mansion-facility__construction">
      {project ? <>
        <div className="mansion-facility__line"><strong>{project.fromLevel ? "升级中" : "修缮中"}</strong><span>还需 {project.remainingPhases} 个时段</span></div>
        <progress aria-label="施工进度" value={view.now - project.startedAt} max={project.readyAt - project.startedAt}/>
        <p>完工后 Lv.{project.toLevel}{project.fromLevel && room.id !== "workshop" ? "，期间保留现有功能。" : "。"}</p>
      </> : build.quote ? <>
        <div className="mansion-facility__line"><strong>{room.level ? `升级至 Lv.${build.quote.toLevel}` : "首次修缮"}</strong><small>{build.quote.readyAt - view.now} 个时段</small></div>
        {build.improvements.map(change => <div className="mansion-facility__line" key={change.label}><small>{change.label}</small><span>{change.before} → {change.after}</span></div>)}
        <div className="mansion-facility__line"><span>公款支出{build.discount ? <small> · 已减 {build.discount}%</small> : null}</span><CurrencyAmount value={build.quote.cost}/></div>
        {action(room.level ? "开始升级" : "开始修缮", {type: "facility-build", roomId: room.id, fromLevel: room.level, quotedCost: build.quote.cost}, !!build.reason)}
        {build.reason && <p role="status">{build.reason}</p>}
      </> : <p>{build.reason}</p>}
      <div className="mansion-facility__line mansion-facility__balance"><small>公款结余</small><CurrencyAmount value={view.funding.balance} label="公款结余"/></div>
      <small className="mansion-facility__footnote">仅用于工程 · 下次拨款：第 {view.funding.nextDay} 日（周一）清晨</small>
    </div>}
    {view.blocked && <p role="status">请先完成当前剧情或远征。</p>}
    {!build && <small className="mansion-facility__footnote">此旧档保留原设施规则</small>}
  </section>;
}
