import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes } from "react";
import { RpgNotchedPillArt } from "../shared/ui/primitives/RpgNotchedPillButton";
import { cx } from "../shared/lib/cx";
import "./journal-primitives.css";

/** Content-level materials, distinct from the modal's window-level RpgFrame. */
export function JournalSurface({ variant = "inset", className, children, ...props }:
  HTMLAttributes<HTMLDivElement> & {variant?: "inset" | "divider" | "plain"}) {
  return <div className={cx("journal-surface", className)} data-surface={variant} {...props}>
    <div className="journal-surface__content">{children}</div>
  </div>;
}

/* Reuse the library artwork; keep HTML labels independent from SVG scaling. */
export function JournalActionArt() {
  return <span className="journal-action__art" aria-hidden="true">
    <RpgNotchedPillArt label="" preserveAspectRatio="none"/>
  </span>;
}

type Emphasis = {emphasis?: "normal" | "primary"};
export function JournalButton({className, children, emphasis = "normal", type = "button", ...props}:
  ButtonHTMLAttributes<HTMLButtonElement> & Emphasis) {
  return <button type={type} className={cx("abyssa-notched-pill", "journal-action", className)} data-variant="dark" data-emphasis={emphasis} {...props}>
    <JournalActionArt/><span className="journal-action__label">{children}</span>
  </button>;
}
export function JournalActionLink({className, children, emphasis = "normal", ...props}:
  AnchorHTMLAttributes<HTMLAnchorElement> & Emphasis) {
  return <a className={cx("abyssa-notched-pill", "journal-action", className)} data-variant="dark" data-emphasis={emphasis} {...props}>
    <JournalActionArt/><span className="journal-action__label">{children}</span>
  </a>;
}
