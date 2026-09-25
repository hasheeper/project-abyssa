import { forwardRef, useId, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
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
export const JournalButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & Emphasis>(function JournalButton({className, children, emphasis = "normal", type = "button", ...props}, ref) {
  return <button ref={ref} type={type} className={cx("abyssa-notched-pill", "journal-action", className)} data-variant="dark" data-emphasis={emphasis} {...props}>
    <JournalActionArt/><span className="journal-action__label">{children}</span>
  </button>;
});
export function JournalActionLink({className, children, emphasis = "normal", ...props}:
  AnchorHTMLAttributes<HTMLAnchorElement> & Emphasis) {
  return <a className={cx("abyssa-notched-pill", "journal-action", className)} data-variant="dark" data-emphasis={emphasis} {...props}>
    <JournalActionArt/><span className="journal-action__label">{children}</span>
  </a>;
}

export function JournalLedger({label, summary, children}: {label: string; summary?: string; children: ReactNode}) {
  const id = useId();
  return <section className="journal-ledger" aria-labelledby={id}>
    <header className="journal-ledger__head"><h4 id={id}>{label}</h4>{summary && <span>{summary}</span>}</header>
    <ul className="journal-ledger__rows">{children}</ul>
  </section>;
}

export function JournalLedgerRow({icon, name, note, quantity}: {icon: string; name: string; note?: string; quantity: number}) {
  return <li className="journal-ledger__row">
    <span className="journal-ledger__icon" aria-hidden="true"><img src={icon} alt="" draggable={false}/></span>
    <span className="journal-ledger__text"><strong>{name}</strong>{note && <small>{note}</small>}</span>
    <span className="journal-ledger__qty" data-single={quantity === 1 || undefined} aria-label={`${quantity} 件`}>
      <span aria-hidden="true">×</span>{quantity.toLocaleString("en-US")}
    </span>
  </li>;
}

export type JournalStatusTone = "ready" | "pending" | "failed" | "settled";
export function JournalStatus({tone, label, note}: {tone: JournalStatusTone; label: string; note?: ReactNode}) {
  return <div className="journal-status" data-tone={tone} role="status">
    <p className="journal-status__label">{label}</p>
    {note && <p className="journal-status__note">{note}</p>}
  </div>;
}
