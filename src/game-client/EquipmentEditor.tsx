import { useState } from "react";
import { equipmentArt } from "../content/presentation/equipment";
import { ItemSlotStatic } from "../shared/ui/primitives/ItemSlot";
import { EquipmentFacePreview } from "./EquipmentFacePreview";
import { RpgModal } from "../shared/ui/primitives/RpgModal";
import { DiceActionButton } from "../shared/ui/patterns/action-dock/DiceActionButton";
import type { GameSession, SessionState } from "./session";
import type { d5ProgressionView } from "../game-runtime/d5-views";
import { archiveIdentities } from "../content/characters/identities";
import { GameOperationFeedback } from "./GameOperationFeedback";
import { equipmentNames } from "./character-presentation";
import { isPlayerActor, playerDisplayName } from "../shared/domain/player-identity";
import { usePlayerName } from "../shared/domain/PlayerIdentity";

type Props = {open:boolean; onClose:()=>void; ownerId:string; progression:ReturnType<typeof d5ProgressionView>; writer:GameSession|null; state:SessionState};
export function EquipmentEditor({open,onClose,ownerId,progression,writer,state}:Props) {
  const playerName = usePlayerName();
  const name = (id:string) => isPlayerActor(id) ? playerDisplayName(playerName) : archiveIdentities.find(c=>c.id===id)?.selectorLabel ?? id;
  const busy = state.status !== "ready", frozen = !progression.canMove;
  const [selectedId, select] = useState("");
  const [targetId, setTarget] = useState<string | null>(null);
  const equipped = progression.inventory.find(i=>i.location.kind !== "inventory" && i.location.ownerId===ownerId);
  const item = progression.inventory.find(i => i.instanceId === selectedId) ?? equipped ?? progression.inventory[0];
  const preview = item?.preview.find(p => p.ownerId === ownerId);
  const owner = item?.location.kind === "inventory" ? null : item?.location.ownerId;
  const chosen = targetId ?? (owner === ownerId ? item?.targetFaceId : null);
  const targetFaceId = preview?.options.find(o => o.targetFaceId === chosen)?.targetFaceId ?? preview?.options[0]?.targetFaceId;
  const art = item && equipmentArt[item.definitionId];
  function equip() {
    if (!item || !preview || !writer) return;
    const target = targetFaceId ? {targetFaceId} : {};
    void writer.dispatch(owner ? {type: "transfer-equipment", instanceId: item.instanceId, fromOwnerId: owner, toOwnerId: ownerId, ...target}
      : {type: "equip-equipment", instanceId: item.instanceId, ownerId, ...target});
  }
  return <RpgModal open={open} onClose={onClose} title={`${name(ownerId)} · 通用装备`}>
    <div className="equipment-editor">
      <p>每位角色一个通用槽 · 馆内可自由卸下与转交</p>
      {writer && <GameOperationFeedback session={writer} state={state} local/>}
      {frozen && <p>当前有活动远征或回忆，归来后可调整。</p>}
      {!item ? <p>尚未取得装备。可在商店购入，或完成整备赠物。</p> : <>
        <select aria-label="选择装备" value={item.instanceId} onChange={e => {select(e.target.value); setTarget(null);}}>
          {progression.inventory.map(i => <option key={i.instanceId} value={i.instanceId}>{equipmentNames[i.definitionId]} · {i.location.kind === "inventory" ? "未装备" : name(i.location.ownerId)}</option>)}
        </select>
        <div className="equipment-editor__item">
          {art && <ItemSlotStatic icon={art.icon} name={art.name} showRarity={false} size={64}/>}
          <div><strong>{equipmentNames[item.definitionId]}</strong><p>{art?.description}<br/>{owner ? `${name(owner)}正在携带` : "馆内库存"}</p></div>
        </div>
        <EquipmentFacePreview key={`${item.instanceId}:${ownerId}`} preview={item.preview} ownerId={ownerId} targetFaceId={targetFaceId} onTarget={setTarget}/>
        <div className="equipment-editor__actions">
          {owner === ownerId ? <DiceActionButton label={`卸下${equipmentNames[item.definitionId]}`} disabled={busy || frozen} onClick={()=>void writer?.dispatch({type:"unequip-equipment",instanceId:item.instanceId,ownerId})}/>
            : <DiceActionButton label={owner ? `从${name(owner)}转交` : `装备${equipmentNames[item.definitionId]}`} disabled={busy || frozen || !writer || !!equipped || !preview} onClick={equip}/>}
        </div>
        {equipped && owner !== ownerId && <p>通用槽已占用，更换前请先卸下。</p>}
      </>}
    </div>
  </RpgModal>;
}
