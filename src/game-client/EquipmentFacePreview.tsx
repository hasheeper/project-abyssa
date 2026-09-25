import { demoActionPresentation } from "./character-presentation";
import { useState } from "react";
import type { EquipmentPreview } from "../game-runtime/equipment-view";
import { ExpeditionFlatDieFrame } from "../shared/ui/dice-face/ExpeditionFlatDieFrame";
import { usePlayerName } from "../shared/domain/PlayerIdentity";
import { playerDisplayName } from "../shared/domain/player-identity";
import "./equipment-editor.css";

const suits = {light: "diamond", earth: "square", abyss: "triangle", beyond: "circle"} as const;
export function EquipmentFacePreview({preview, ownerId, targetFaceId, onTarget}: {
  preview: EquipmentPreview; ownerId?: string; targetFaceId?: string | null; onTarget?: (id: string | null) => void;
}) {
  const playerName = usePlayerName();
  const [selectedOwner, setOwner] = useState(preview[0]?.ownerId ?? "");
  const [selectedTarget, setTarget] = useState<string | null>(null);
  const owner = preview.find(p => p.ownerId === (ownerId ?? selectedOwner)) ?? (ownerId ? undefined : preview[0]);
  const option = owner?.options.find(o => o.targetFaceId === (targetFaceId ?? selectedTarget)) ?? owner?.options[0];
  const name = (id: string, text: string) => id === "kael" ? playerDisplayName(playerName) : text;
  if (!owner || !option) return <p>该角色没有适用的原生骰面。</p>;
  return <div className="equipment-preview">
    {!ownerId && <label className="equipment-preview__owner">试配角色 <select aria-label="试配角色" value={owner.ownerId} onChange={e => {setOwner(e.target.value); setTarget(null);}}>
      {preview.map(p => <option key={p.ownerId} value={p.ownerId}>{name(p.ownerId, p.name)}</option>)}
    </select></label>}
    <p className="equipment-preview__hint">{option.targetFaceId ? "点选要改写的原生骰面" : "改写全部原生空面"} · 以下为装备后效果</p>
    <div className="equipment-preview__faces" role="group" aria-label="装备后六面预览">
      {option.faces.map(face => {
        const selectable = owner.options.some(o => o.targetFaceId === face.id);
        const description = face.changed ? `${demoActionPresentation[face.beforeAction].label} ${face.beforePower} → ${demoActionPresentation[face.action].label} ${face.power}` : `${demoActionPresentation[face.action].label} ${face.power}`;
        return <button type="button" key={face.id} className="equipment-preview__face" data-changed={face.changed || undefined}
          aria-label={`第 ${face.slot} 面：${description}`} aria-pressed={option.targetFaceId ? face.id === option.targetFaceId : undefined}
          disabled={!selectable} onClick={() => {setTarget(face.id); onTarget?.(face.id);}}>
          <ExpeditionFlatDieFrame action={demoActionPresentation[face.action].icon} fate={face.pip.kind === "natural" ? face.pip.value : 1} wildPip={face.pip.kind === "wild"}
            power={face.power} seal={face.quality} asleep={face.fate === "asleep"} scoring={face.fate === "awake"} suitShape={suits[face.suit]} label={description}/>
          <span>{face.changed ? description : `第 ${face.slot} 面`}</span>
        </button>;
      })}
    </div>
    <p className="equipment-preview__hint">点数、花色、苏醒、品质与锈蚀保留。特殊动作不参与普通面的改写。</p>
  </div>;
}
