import type { Ref } from "react";
import chestGlyph from "../../assets/icons/items/chest.svg";
import journalGlyph from "../../assets/icons/items/notebook.svg";
import preparationGlyph from "../../assets/icons/items/backpack.svg";

type Entry = "stock" | "journal" | "preparation";
export interface MansionUtilityRailProps {
  active: Entry | null;
  stockTotal: number;
  actionable: number;
  inert?: boolean;
  onOpen: (entry: Entry) => void;
  buttonRefs: Record<Entry, Ref<HTMLButtonElement>>;
}

/** The original warehouse seal, shared unchanged by the three manor tools. */
function UtilitySeal() {
  return <svg className="mansion-utility-rail__plate" viewBox="0 0 56 56" aria-hidden="true">
    <circle cx="28" cy="28" r="24" fill="#070c0d" opacity=".6" transform="translate(0 2.5)" />
    <circle cx="28" cy="28" r="24" fill="var(--mansion-plate-fill)" />
    <path d="M4 28 A24 24 0 0 1 52 28 Z" fill="#4a5a52" opacity=".42" />
    <path d="M4 28 A24 24 0 0 0 52 28 Z" fill="#070c0d" opacity=".46" />
    <circle cx="28" cy="28" r="24" fill="none" stroke="var(--abyssa-frame-dark)" strokeWidth="5" />
    <circle cx="28" cy="28" r="24" fill="none" stroke="var(--mansion-plate-edge)" strokeWidth="2.4" />
    <circle cx="28" cy="28" r="24" fill="none" stroke="var(--abyssa-frame-deep)" strokeWidth="1" />
    <path d="M12 18 A24 24 0 0 1 44 18" fill="none" stroke="#c3d0d0" strokeWidth="1.2" strokeLinecap="round" opacity=".5" />
  </svg>;
}

export function MansionUtilityRail({active, stockTotal, actionable, inert, onOpen, buttonRefs}: MansionUtilityRailProps) {
  const entries = [
    {id: "stock", label: "仓库", icon: chestGlyph, count: stockTotal, description: `领地库存，共 ${stockTotal} 件`},
    {id: "journal", label: "日志", icon: journalGlyph, count: actionable, description: actionable ? `${actionable} 项可交谈` : "归来记录与同伴近况"},
    {id: "preparation", label: "整备", icon: preparationGlyph, count: 0, description: "出征行囊与补给"}
  ] as const;
  return <nav className="mansion-utility-rail" aria-label="洋馆功能" data-no-pan inert={inert} aria-hidden={inert}>
    {entries.map(entry => <div className="mansion-utility-rail__entry" key={entry.id}>
      <button ref={buttonRefs[entry.id]} type="button" className="mansion-utility-rail__button"
        aria-label={entry.label} aria-description={entry.description} aria-haspopup="dialog"
        aria-expanded={active === entry.id} onClick={() => onOpen(entry.id)}>
        <UtilitySeal/>
        <img src={entry.icon} alt=""/>
        {entry.count > 0 && <b aria-hidden="true">{entry.count}</b>}
      </button>
      <span className="mansion-utility-rail__label" aria-hidden="true">{entry.label}</span>
    </div>)}
  </nav>;
}
