import { RpgModal } from "../shared/ui/primitives/RpgModal";
import { DiceActionButton } from "../shared/ui/patterns/action-dock/DiceActionButton";
import type { GameSession, SessionState } from "./session";
import type { d5ProgressionView } from "../game-runtime/d5-views";
import { archiveIdentities } from "../content/characters/identities";
import { gameErrorText } from "./game-errors";
import { equipmentNames } from "./character-presentation";

type Props = {open:boolean; onClose:()=>void; ownerId:string; progression:ReturnType<typeof d5ProgressionView>; writer:GameSession|null; state:SessionState};
const name = (id:string) => archiveIdentities.find(c=>c.id===id)?.selectorLabel ?? id;
export function EquipmentEditor({open,onClose,ownerId,progression,writer,state}:Props) {
  const busy = state.status !== "ready", frozen = !progression.canMove;
  const equipped = progression.inventory.find(i=>i.location.kind !== "inventory" && i.location.ownerId===ownerId);
  const applicable = progression.applicableOwners.includes(ownerId);
  if(!applicable) return null;
  return <RpgModal open={open} onClose={onClose} title={`${name(ownerId)} · 通用装备`}>
    <div style={{width:600,maxHeight:680,overflowY:"auto"}}>
      <p>备用短刃与应急药囊各一件；改写全部原生空面，保留点数、品质、花色与苏醒状态。</p>
      {state.error && <p role="alert">{gameErrorText(state.error.code)} <button onClick={()=>void writer?.refresh()}>重新读取 / 重试</button></p>}
      {frozen && <p>当前有活动远征或回忆，归来后可调整。</p>}
      {!progression.inventory.length && <p>尚未取得装备。合法归来后，在洋馆完成整备赠物。</p>}
      <div style={{display:"grid",gap:16}}>
        {progression.inventory.map(item => {
          const location = item.location, owner = location.kind === "inventory" ? null : location.ownerId;
          return <section key={item.instanceId} aria-label={equipmentNames[item.definitionId]}>
            <h3>{equipmentNames[item.definitionId]}</h3><p>{owner ? `由${name(owner)}携带` : "馆内库存 · 未装备"} · 原生空面→{item.definition.replacement === "attack" ? "攻击" : "治疗"} {item.definition.power}</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
            {owner === ownerId ? <>
              <DiceActionButton label={`卸下${equipmentNames[item.definitionId]}`} disabled={busy || frozen} onClick={()=>void writer?.dispatch({type:"unequip-equipment",instanceId:item.instanceId,ownerId})}/>
              {progression.equipTargets.map(target=><DiceActionButton key={target} label={`转交${name(target)}`} disabled={busy || frozen} onClick={()=>void writer?.dispatch({type:"transfer-equipment",instanceId:item.instanceId,fromOwnerId:ownerId,toOwnerId:target})}/>)}
            </> : <DiceActionButton label={owner ? `从${name(owner)}转交给${name(ownerId)}` : `装备${equipmentNames[item.definitionId]}`} disabled={busy || frozen || !!equipped || !progression.equipTargets.includes(ownerId)} onClick={()=>void writer?.dispatch(owner ? {type:"transfer-equipment",instanceId:item.instanceId,fromOwnerId:owner,toOwnerId:ownerId} : {type:"equip-equipment",instanceId:item.instanceId,ownerId})}/>}
            </div>
          </section>;
        })}
      </div>
      {equipped && <p>此角色的通用槽已占用；更换前请先卸下。</p>}
    </div>
    </RpgModal>;
}
