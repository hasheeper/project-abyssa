import { createContext, forwardRef, useContext, useId, useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { manorIcon } from "../shared/ui/patterns/manor-icons";
import { RpgNotchedPillArt } from "../shared/ui/primitives/RpgNotchedPillButton";
import { ManorGlyph, ManorSection } from "../shared/ui/patterns/ManorSection";
import { ItemSlotStatic } from "../shared/ui/primitives/ItemSlot";
import { cx } from "../shared/lib/cx";
import { JOURNAL_GLYPHS, JOURNAL_PLACE_ICONS } from "./journal-format";
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

/* ---- 记事正文的材料 ----
   条目只给数据(见 JournalEntry),版式由 JournalBrowser 的 JournalRecord 统一绘制;
   这里是它用到的几件,以及嵌入件(今日安排)把按钮放进操作栏的通道。 */

/** 带图标名牌的小节;icon 是素材库检索词。 */
export function JournalSection({label, icon, aside, className, children}: {
  label: string; icon?: string; aside?: ReactNode; className?: string; children: ReactNode;
}) {
  return <ManorSection tier="minor" headingLevel={4} label={label} icon={icon ? manorIcon(icon) : undefined}
    aside={aside} className={cx("journal-section", className)}>{children}</ManorSection>;
}

/** 操作栏:左端一段说明(地点、进度或余额),右端按钮。日志与整备的按钮都排在这一种栏里;
 *  给了 label 时按钮组是一个具名导航。 */
export function JournalDockBar({lead, label, children}: {lead?: ReactNode; label?: string; children: ReactNode}) {
  const Actions = label ? "nav" : "div";
  return <div className="journal-dock__bar">
    {lead && <div className="journal-dock__lead">{lead}</div>}
    <Actions className="journal-record__actions" aria-label={label}>{children}</Actions>
  </div>;
}

/** 操作栏左端的地点:图标格 + 地名;图标只取自 JOURNAL_PLACE_ICONS。 */
export function JournalPlace({place}: {place: string}) {
  const icon = JOURNAL_PLACE_ICONS[place];
  return <span className="journal-dock__place">
    <span className="journal-dock__socket">{icon && <ManorGlyph src={manorIcon(icon)}/>}</span>
    <span className="journal-dock__copy"><small>地点</small><strong>{place}</strong></span>
  </span>;
}

/** 阅读面板提供操作栏的位置与所选记事的地点;target 为 null 表示还没挂上。不在日志里时没有这层上下文。 */
export const JournalDockContext = createContext<{target: HTMLElement | null; place?: string} | null>(null);

/** 嵌入件的按钮:在日志里放进阅读面板下沿的操作栏(左端默认写地点),在别处原地排成一行。 */
export function JournalDock({lead, children}: {lead?: ReactNode; children: ReactNode}) {
  const dock = useContext(JournalDockContext);
  if (!dock) return <JournalDockBar lead={lead}>{children}</JournalDockBar>;
  const bar = <JournalDockBar lead={lead ?? (dock.place && <JournalPlace place={dock.place}/>)}>{children}</JournalDockBar>;
  return dock.target ? createPortal(bar, dock.target) : null;
}

/** 折叠的历史记录。与记忆阅读区的「展开原文」同一形态,不用原生 details。 */
export function JournalDisclosure({label, children, defaultOpen = false}: {label: string; children: ReactNode; defaultOpen?: boolean}) {
  const [open, setOpen] = useState(defaultOpen), id = useId();
  return <section className="journal-disclosure" data-open={open || undefined}>
    <button type="button" className="journal-disclosure__toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span>{label}</span><i aria-hidden="true">{open ? "−" : "+"}</i>
    </button>
    <div id={id} className="journal-disclosure__body" hidden={!open}>{children}</div>
  </section>;
}

export function JournalLedger({label, summary, children}: {label: string; summary?: string; children: ReactNode}) {
  return <JournalSection label={label} icon={JOURNAL_GLYPHS.loot} aside={summary} className="journal-ledger">
    <ul className="journal-ledger__rows">{children}</ul>
  </JournalSection>;
}

/** 清单一行:物品格(数量是右下角的徽标,同库存)+ 名称与说明。单件不挂徽标。 */
export function JournalLedgerRow({icon, name, note, quantity}: {icon: string; name: string; note?: string; quantity: number}) {
  return <li className="journal-ledger__row">
    <span className="journal-ledger__art" aria-hidden="true">
      <ItemSlotStatic icon={icon} tone="interface" showRarity={false}/>
      {quantity > 1 && <span className="abyssa-item-count">{quantity.toLocaleString("zh-CN")}</span>}
    </span>
    <span className="journal-ledger__text"><strong>{name}</strong>{note && <small>{note}</small>}</span>
    <span className="journal-ledger__count">{quantity} 件</span>
  </li>;
}

export type JournalStatusTone = "ready" | "pending" | "failed" | "settled";
export function JournalStatus({tone, label, note}: {tone: JournalStatusTone; label: string; note?: ReactNode}) {
  return <div className="journal-status" data-tone={tone} role="status">
    <p className="journal-status__label">{label}</p>
    {note && <p className="journal-status__note">{note}</p>}
  </div>;
}
