import type { CSSProperties } from "react";
import { Progress } from "../../primitives/Progress";
import type { BattleAlly } from "./types";

export function BattlePartyStatus({
  allies,
  activeActorId
}: {
  allies: BattleAlly[];
  activeActorId?: string;
}) {
  return (
    <div className="abyssa-battle-screen__party-panel">
      <ul
        className="abyssa-battle-screen__party-list"
        aria-label="Party status"
        data-party-size={allies.length}
      >
        {allies.map((ally) => (
          <li
            key={ally.id}
            className="abyssa-battle-screen__status-card"
            data-active={ally.id === activeActorId || undefined}
            data-disabled={ally.disabled || undefined}
            data-defeated={ally.hp <= 0 || undefined}
            style={{
              "--abyssa-battle-party-slot-x": `${(ally.placement.x / 72) * 100}%`
            } as CSSProperties}
          >
            <div className="abyssa-battle-screen__status-art">
              {ally.portraitUrl ? (
                <img
                  src={ally.portraitUrl}
                  alt={ally.portraitAlt ?? `${ally.name} standing portrait`}
                />
              ) : (
                <span aria-hidden="true">{ally.name.slice(0, 1)}</span>
              )}
            </div>
            <div className="abyssa-battle-screen__status-card-content">
              <strong className="abyssa-battle-screen__status-name">
                {ally.name}
              </strong>
              <div className="abyssa-battle-screen__status-resource" data-resource="hp">
                <span className="abyssa-battle-screen__status-resource-label">HP</span>
                <Progress
                  className="abyssa-battle-screen__status-hp"
                  value={ally.hp}
                  max={ally.maxHp}
                  size="sm"
                  label={`${ally.name} HP`}
                />
                <span className="abyssa-battle-screen__status-value">
                  {ally.hp}/{ally.maxHp}
                </span>
              </div>
              <div className="abyssa-battle-screen__status-resource" data-resource="mp">
                <span className="abyssa-battle-screen__status-resource-label">MP</span>
                <Progress
                  className="abyssa-battle-screen__status-mp"
                  value={ally.mp}
                  max={ally.maxMp}
                  size="sm"
                  label={`${ally.name} MP`}
                />
                <span className="abyssa-battle-screen__status-value">
                  {ally.mp}/{ally.maxMp}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {allies.length === 0 && (
        <p className="abyssa-battle-screen__empty-party">NO PARTY MEMBERS</p>
      )}
    </div>
  );
}
