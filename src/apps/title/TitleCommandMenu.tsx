import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { RibbonFrameArt } from "../../shared/ui/primitives/RibbonButton";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";
import { TITLE_COMMANDS } from "./titleCommands";
import type { TitleCommandId } from "./titleCommands";
import { TITLE_COMMAND_GAP, TITLE_RIBBON_H } from "./titleGeometry";
import { ABYSSA_LOGO_INTRO_TOTAL_MS } from "../../shared/ui/branding/abyssaLogoIntro";

interface TitleCommandMenuProps {
  defaultCommand: TitleCommandId;
  disabled: boolean;
  intro?: boolean;
  onActivate: (id: TitleCommandId) => void;
}

export function TitleCommandMenu({ defaultCommand, disabled, intro = false, onActivate }: TitleCommandMenuProps) {
  const { reduced } = useUiMotion();
  const nav = useRef<HTMLElement>(null);
  const buttons = useRef(new Map<TitleCommandId, HTMLButtonElement>());
  const [selection, setSelection] = useState<TitleCommandId | null>(null);
  const [introDismissed, setIntroDismissed] = useState(false);
  useEffect(() => { if (reduced) setIntroDismissed(true); }, [reduced]);
  const dismissIntro = () => {
    // Let the same native keyboard event focus an item, without a second press.
    nav.current?.removeAttribute("data-intro");
    setIntroDismissed(true);
  };
  const selected = selection ?? defaultCommand;
  const index = TITLE_COMMANDS.findIndex(command => command.id === selected);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (disabled || event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      const inside = target instanceof Node && nav.current?.contains(target);
      if (!inside && target instanceof Element && target.closest("button, a, input, select, textarea, [contenteditable], [role='dialog']")) return;
      if (["Tab", "ArrowDown", "ArrowUp", "Home", "End", "Enter"].includes(event.key)) dismissIntro();
      let next = index;
      if (event.key === "ArrowDown") next = inside ? (index + 1) % TITLE_COMMANDS.length : index;
      else if (event.key === "ArrowUp") next = inside ? (index + TITLE_COMMANDS.length - 1) % TITLE_COMMANDS.length : index;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = TITLE_COMMANDS.length - 1;
      else if (event.key === "Enter" && !inside) {
        event.preventDefault();
        const button = buttons.current.get(selected);
        button?.focus({ preventScroll: true });
        button?.click();
        return;
      } else return;
      event.preventDefault();
      const id = TITLE_COMMANDS[next].id;
      setSelection(id);
      buttons.current.get(id)?.focus({ preventScroll: true });
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [disabled, index, selected]);

  return (
    <nav ref={nav} className="title-commands" aria-label="标题菜单" data-disabled={disabled || undefined}
      data-intro={intro && !introDismissed && !reduced || undefined}
      data-ui-motion={reduced ? "reduced" : "full"}
      style={{ "--title-cursor-y": `${index * (TITLE_RIBBON_H + TITLE_COMMAND_GAP)}px`, "--title-menu-start": `${ABYSSA_LOGO_INTRO_TOTAL_MS}ms` } as CSSProperties}>
      {/* Authored title feedback: one selection, paired travelling diamonds. */}
      <div className="title-commands__markers" aria-hidden="true">
        <div className="title-commands__cursor title-commands__cursor--left">
          <span className="title-commands__gem-seat"><i className="title-commands__gem" /></span>
        </div>
        <div className="title-commands__cursor title-commands__cursor--right">
          <span className="title-commands__gem-seat"><i className="title-commands__gem" /></span>
        </div>
      </div>
      {TITLE_COMMANDS.map((command, entryIndex) => (
        <div className="title-commands__entry" key={command.id}
          style={{ "--title-entry-index": entryIndex } as CSSProperties}
          onAnimationEnd={event => { if (entryIndex === TITLE_COMMANDS.length - 1 && event.animationName === "title-command-enter") dismissIntro(); }}>
          <button ref={element => { if (element) buttons.current.set(command.id, element); else buttons.current.delete(command.id); }}
            type="button" className="abyssa-ribbon-button title-commands__item" data-highlighted={selected === command.id || undefined}
            disabled={disabled}
            onPointerEnter={event => {
              if (disabled || event.pointerType === "touch") return;
              setSelection(command.id);
              // When switching input devices, the keyboard action follows the visible cursor.
              if (nav.current?.contains(document.activeElement)) event.currentTarget.focus({ preventScroll: true });
            }}
            onFocus={() => setSelection(command.id)}
            onClick={() => { dismissIntro(); setSelection(command.id); onActivate(command.id); }}>
            <span className="title-commands__surface" aria-hidden="true">
              <RibbonFrameArt sideDiamonds={false} />
              <span className="title-commands__finish" />
              <span className="title-commands__sheen" />
              <svg className="title-commands__edge" viewBox="0 0 820 68" fill="none">
                <path d="M59 10H776M59 58H776" />
                <path className="title-commands__corners" d="M68 10H40L58 34L40 58H68M752 10H780L762 34L780 58H752" />
              </svg>
            </span>
            <span className="abyssa-ribbon-button__label">{command.label}</span>
          </button>
        </div>
      ))}
    </nav>
  );
}
