import { useId } from "react";
import type { BattleTurnEntry } from "./types";

export function BattleTurnOrder({
  entries,
  activeActorId
}: {
  entries: BattleTurnEntry[];
  activeActorId?: string;
}) {
  const activeEntryIndex = entries.findIndex(
    (entry) => entry.unitId === activeActorId
  );
  const currentEntry = entries[activeEntryIndex] ?? entries[0];
  const queue = entries.filter((entry) => entry.id !== currentEntry?.id).slice(0, 7);
  const visibleEntries = currentEntry ? [currentEntry, ...queue] : [];
  const uid = useId().replace(/:/g, "");

  return (
    <div className="abyssa-battle-screen__turn-order">
      <svg className="abyssa-battle-screen__turn-art" viewBox="0 0 1500 210" aria-hidden="true">
        <defs>
          <pattern id={`${uid}-track-pattern`} width="84" height="84" patternUnits="userSpaceOnUse" patternTransform="translate(0 -16)">
            <path d="M42 0 84 42 42 84 0 42Z" fill="rgb(129 181 183 / 7.5%)" />
            <path d="M42 17 67 42 42 67 17 42Z" fill="rgb(255 255 255 / 2.5%)" />
          </pattern>
          <linearGradient id={`${uid}-track-light`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#567779" stopOpacity=".72" />
            <stop offset="55%" stopColor="#3b5051" stopOpacity=".5" />
            <stop offset="100%" stopColor="#283b3c" stopOpacity=".65" />
          </linearGradient>
        </defs>
        <g className="abyssa-battle-screen__turn-track">
          <path d="M78 69H1422L1450 105 1422 141H78L50 105Z" fill={`url(#${uid}-track-light)`} />
          <path d="M78 69H1422L1450 105 1422 141H78L50 105Z" fill={`url(#${uid}-track-pattern)`} />
          <path d="M78 69H1422L1450 105 1422 141H78L50 105Z" />
          <path d="M91 79H1416L1437 105 1416 131H91L70 105Z" className="abyssa-battle-screen__turn-track-inset" />
          <path d="M350 78V132M356 78V132" className="abyssa-battle-screen__turn-divider" />
        </g>
        {currentEntry && (
          <BattleTurnToken
            entry={currentEntry}
            x={128}
            y={105}
            radius={60}
            current
            clipId={`${uid}-current`}
          />
        )}
        {queue.map((entry, index) => (
          <BattleTurnToken
            key={entry.id}
            entry={entry}
            x={440 + index * 145}
            y={105}
            radius={42}
            index={index + 1}
            clipId={`${uid}-queue-${index}`}
          />
        ))}
      </svg>
      <ol className="abyssa-battle-screen__turn-list" aria-label="Action order">
        {visibleEntries.map((entry, index) => (
          <li
            key={entry.id}
            className="abyssa-battle-screen__turn-entry"
            data-side={entry.side}
            data-active={index === 0 || undefined}
            aria-current={index === 0 ? "step" : undefined}
          >
            <span className="abyssa-battle-screen__turn-entry-label">{entry.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function BattleTurnToken({
  entry,
  x,
  y,
  radius,
  current = false,
  index,
  clipId
}: {
  entry: BattleTurnEntry;
  x: number;
  y: number;
  radius: number;
  current?: boolean;
  index?: number;
  clipId: string;
}) {
  const isEnemy = entry.side === "enemy";
  const main = isEnemy ? "#c9504e" : "#68b5b9";
  const light = isEnemy ? "#e9807e" : "#a5d8da";
  const dark = isEnemy ? "#5b2423" : "#204e50";
  const innerRadius = radius - 13;
  const spikes = `M ${x} ${y - radius - 11} L ${x + 7} ${y - radius + 4} L ${x} ${y - radius + 1} L ${x - 7} ${y - radius + 4} Z M ${x} ${y + radius + 11} L ${x + 7} ${y + radius - 4} L ${x} ${y + radius - 1} L ${x - 7} ${y + radius - 4} Z M ${x - radius - 11} ${y} L ${x - radius + 4} ${y - 7} L ${x - radius + 1} ${y} L ${x - radius + 4} ${y + 7} Z M ${x + radius + 11} ${y} L ${x + radius - 4} ${y - 7} L ${x + radius - 1} ${y} L ${x + radius - 4} ${y + 7} Z`;

  return (
    <g className="abyssa-battle-screen__turn-token" data-side={entry.side} data-current={current || undefined}>
      <defs>
        <clipPath id={clipId}><circle cx={x} cy={y} r={innerRadius} /></clipPath>
      </defs>
      {current ? (
        <><path d={`M ${x - 11} ${y - radius - 31}H ${x + 11}L ${x} ${y - radius - 14}Z`} fill={light} stroke={dark} strokeWidth="2" /><circle cx={x} cy={y - radius - 9} r="2.7" fill={light} /></>
      ) : (
        <text className="abyssa-battle-screen__turn-number" x={x} y={y - radius - 15}>{index}</text>
      )}
      <path d={spikes} fill={main} stroke={dark} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={x} cy={y} r={radius} fill="#111818" stroke={dark} strokeWidth="8" />
      <circle cx={x} cy={y} r={radius} fill="none" stroke={main} strokeWidth="4.5" />
      <circle cx={x} cy={y} r={radius - 4} fill="none" stroke={light} strokeWidth="1.3" opacity=".82" />
      {entry.portraitUrl ? (
        <image href={entry.portraitUrl} x={x - innerRadius} y={y - innerRadius} width={innerRadius * 2} height={innerRadius * 2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
      ) : (
        <><circle cx={x} cy={y} r={innerRadius} fill="#111515" /><circle cx={x - innerRadius * .25} cy={y - innerRadius * .08} r={innerRadius * .09} fill="#ff4743" /><circle cx={x + innerRadius * .25} cy={y - innerRadius * .08} r={innerRadius * .09} fill="#ff4743" /></>
      )}
      <circle cx={x} cy={y} r={innerRadius} fill="none" stroke="#101717" strokeWidth="4" />
      <circle cx={x} cy={y} r={innerRadius - 2} fill="none" stroke={main} strokeWidth="1.3" opacity=".76" />
      <g fill={light}><circle cx={x - radius + 4} cy={y} r="2" /><circle cx={x + radius - 4} cy={y} r="2" /><circle cx={x} cy={y + radius - 4} r="2" /></g>
      {current && <text className="abyssa-battle-screen__turn-current-label" x={x} y={y + radius + 39}>CURRENT</text>}
    </g>
  );
}
