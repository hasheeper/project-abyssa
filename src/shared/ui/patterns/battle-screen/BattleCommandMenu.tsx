import { useId } from "react";
import type { CSSProperties } from "react";
import bookmarkIcon from "../../../../assets/icons/items/bookmark.svg";
import crossedSwordsIcon from "../../../../assets/icons/crossed-swords.svg";
import slashedShieldIcon from "../../../../assets/icons/slashed-shield.svg";
import swapBagIcon from "../../../../assets/icons/items/swap-bag.svg";
import type { BattleCommandId } from "./types";

const battleCommands: ReadonlyArray<{
  id: BattleCommandId;
  label: string;
}> = [
  { id: "skills", label: "SKILLS" },
  { id: "items", label: "ITEMS" },
  { id: "defend", label: "DEFEND" },
  { id: "attack", label: "ATTACK" }
];

const commandHudGeometry: Record<BattleCommandId, {
  path: string;
  insetPath: string;
  labelX: number;
  labelY: number;
}> = {
  skills: {
    path: "M282 78 H518 L571 154 L527 225 H464 L400 292 L336 225 H273 L229 154 Z",
    insetPath: "M293 94 H507 L551 155 L516 209 H454 L400 264 L346 209 H284 L249 155 Z",
    labelX: 400,
    labelY: 132
  },
  items: {
    path: "M57 241 H306 L370 310 L306 379 H57 L12 310 Z",
    insetPath: "M69 258 H296 L344 310 L296 362 H69 L35 310 Z",
    labelX: 186,
    labelY: 350
  },
  defend: {
    path: "M494 241 H743 L788 310 L743 379 H494 L430 310 Z",
    insetPath: "M504 258 H731 L765 310 L731 362 H504 L456 310 Z",
    labelX: 614,
    labelY: 350
  },
  attack: {
    path: "M336 395 L400 328 L464 395 H527 L571 466 L518 542 H282 L229 466 L273 395 Z",
    insetPath: "M346 411 L400 356 L454 411 H516 L551 465 L507 526 H293 L249 465 L284 411 Z",
    labelX: 400,
    labelY: 510
  }
};

const commandHudIcons: Record<BattleCommandId, string> = {
  skills: bookmarkIcon,
  items: swapBagIcon,
  defend: slashedShieldIcon,
  attack: crossedSwordsIcon
};

export function BattleCommandMenu({
  selectedCommandId,
  disabled,
  onSelect
}: {
  selectedCommandId: BattleCommandId;
  disabled: boolean;
  onSelect: (id: BattleCommandId) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const diamondId = `abyssa-command-diamond-${uid}`;
  const sideId = `abyssa-command-side-${uid}`;

  return (
    <nav className="abyssa-battle-screen__commands" aria-label="Battle commands">
      <svg className="abyssa-battle-screen__command-art" viewBox="0 0 800 620" aria-hidden="true">
        <defs>
          <g id={diamondId} className="abyssa-battle-screen__command-filigree">
            <path d="M0-34 8-17 24-9 11 0 24 9 8 17 0 34-8 17-24 9-11 0-24-9-8-17Z" />
            <path d="M0-25C-2-12-10-7-17 0C-10 7-2 12 0 25M0-25C2-12 10-7 17 0C10 7 2 12 0 25M-17 0H17M0-25V25M-9-13 0-4 9-13M-9 13 0 4 9 13" />
            <circle cx="0" cy="0" r="2.6" className="abyssa-battle-screen__command-filigree-fill" />
          </g>
          <g id={sideId} className="abyssa-battle-screen__command-filigree">
            <path d="M-26 0-13-7-4-22 2-9 18-5 7 0 18 5 2 9-4 22-13 7Z" />
            <path d="M-17 0H8M-8-11 0 0-8 11M-14-6-4 0-14 6" />
            <circle cx="-8" cy="0" r="2.2" className="abyssa-battle-screen__command-filigree-fill" />
          </g>
        </defs>
        <g className="abyssa-battle-screen__command-rings">
          <circle cx="400" cy="310" r="207" />
          <circle cx="400" cy="310" r="195" />
          <circle cx="400" cy="310" r="184" />
          <path d="M374 99 400 42 426 99M381 95 400 57 419 95M389 92 400 71 411 92M374 521 400 578 426 521M381 525 400 563 419 525M389 528 400 549 411 528M400 44V102M400 518V576" />
        </g>
        {battleCommands.map((command) => {
          const geometry = commandHudGeometry[command.id];
          const selected = command.id === selectedCommandId;
          return (
            <g
              key={command.id}
              className="abyssa-battle-screen__command-panel"
              data-command={command.id}
              data-selected={selected || undefined}
            >
              <path className="abyssa-battle-screen__command-panel-fill" d={geometry.path} />
              <path className="abyssa-battle-screen__command-panel-outer" d={geometry.path} />
              <path className="abyssa-battle-screen__command-panel-middle" d={geometry.path} />
              <path className="abyssa-battle-screen__command-panel-inner" d={geometry.path} />
              <path className="abyssa-battle-screen__command-panel-inset" d={geometry.insetPath} />
              {command.id === "skills" && <><use href={`#${sideId}`} transform="translate(247 154)" /><use href={`#${sideId}`} transform="translate(553 154) scale(-1 1)" /><use href={`#${diamondId}`} transform="translate(400 257) scale(.85)" /></>}
              {command.id === "items" && <><use href={`#${sideId}`} transform="translate(34 310)" /><use href={`#${diamondId}`} transform="translate(342 310) scale(.88)" /></>}
              {command.id === "defend" && <><use href={`#${diamondId}`} transform="translate(458 310) scale(.88)" /><use href={`#${sideId}`} transform="translate(766 310) scale(-1 1)" /></>}
              {command.id === "attack" && <><use href={`#${diamondId}`} transform="translate(400 363) scale(.85)" /><use href={`#${sideId}`} transform="translate(247 466)" /><use href={`#${sideId}`} transform="translate(553 466) scale(-1 1)" /></>}
              <text className="abyssa-battle-screen__command-panel-label" x={geometry.labelX} y={geometry.labelY}>{command.label}</text>
              <g className="abyssa-battle-screen__command-svg-slot" data-command={command.id} />
            </g>
          );
        })}
        <path className="abyssa-battle-screen__command-jewel" d="M400 294 416 310 400 326 384 310Z" />
        <path className="abyssa-battle-screen__command-jewel-line" d="M400 299 411 310 400 321 389 310Z" />
      </svg>
      {battleCommands.map((command) => (
        <span
          key={command.id}
          className="abyssa-battle-screen__command-icon-slot"
          data-command={command.id}
          data-selected={command.id === selectedCommandId || undefined}
          style={{ "--abyssa-command-icon": `url("${commandHudIcons[command.id]}")` } as CSSProperties}
          aria-hidden="true"
        />
      ))}
      {battleCommands.map((command) => (
        <button
          key={command.id}
          type="button"
          className="abyssa-battle-screen__command-button"
          data-command={command.id}
          data-selected={command.id === selectedCommandId || undefined}
          aria-label={command.label}
          aria-pressed={command.id === selectedCommandId}
          disabled={disabled}
          onClick={() => onSelect(command.id)}
        />
      ))}
    </nav>
  );
}
