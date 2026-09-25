import { useId } from "react";
import bookPileIcon from "../../assets/icons/items/book-pile.svg";
import crystalBallIcon from "../../assets/icons/items/crystal-ball.svg";
import achievementIcon from "../../assets/icons/items/trophy-cup.svg";
import gearIcon from "../../assets/icons/menu/gear-fill.svg";
import saveIcon from "../../assets/icons/menu/save.svg";
import loadIcon from "../../assets/icons/menu/load.svg";
import { DiamondWatermark } from "../../shared/ui/primitives/DiamondWatermark";

/* 查阅、存读档与设置共用六项侧栏，不压缩原有条目。 */

export type MenuSectionId =
  | "codex"
  | "achievements"
  | "settings"
  | "save"
  | "load"
  | "memory";

interface MenuSection {
  id: MenuSectionId;
  label: string;
  icon: string;
}

const MENU_SECTIONS: readonly MenuSection[] = [
  { id: "codex", label: "图鉴", icon: bookPileIcon },
  { id: "achievements", label: "成就", icon: achievementIcon },
  { id: "memory", label: "记忆", icon: crystalBallIcon },
  { id: "save", label: "存档", icon: saveIcon },
  { id: "load", label: "读档", icon: loadIcon },
  { id: "settings", label: "设置", icon: gearIcon }
];

export interface MenuSidebarProps {
  selectedId: MenuSectionId | null;
  onSelect: (id: MenuSectionId) => void;
  archiveDisabled?: boolean;
  disabled?: boolean;
}

export function MenuSidebar({ selectedId, onSelect, archiveDisabled = false, disabled = false }: MenuSidebarProps) {
  const uid = useId().replace(/:/g, "");
  const patternId = `menu-sidebar-pattern-${uid}`;

  return (
    <nav className="menu-sidebar" aria-label="档案与设置">
      <svg className="menu-sidebar__frame menu-sidebar__frame--backdrop" viewBox="0 0 224 528" aria-hidden="true">
        <defs>
          <DiamondWatermark
            as="pattern"
            id={patternId}
            size={42}
            outerFill="rgb(188 218 212 / 7%)"
            innerFill="rgb(210 234 229 / 3%)"
            outerOpacity={0.5}
            innerOpacity={0.34}
            innerInset={10}
          />
        </defs>
        <path className="menu-sidebar__frame-shadow" d="M0 0 H158 L224 34 V486 L194 528 H0 Z" transform="translate(0 6)" />
        <path className="menu-sidebar__frame-surface" d="M0 0 H158 L224 34 V486 L194 528 H0 Z" />
        <path className="menu-sidebar__frame-pattern" d="M0 0 H158 L224 34 V486 L194 528 H0 Z" fill={`url(#${patternId})`} />
      </svg>
      <span className="menu-sidebar__connector" aria-hidden="true" />
      <div className="menu-sidebar__actions">
        {MENU_SECTIONS.map((section) => {
          const active = section.id === selectedId;
          return (
            <button
              key={section.id}
              data-section={section.id}
              type="button"
              className="menu-sidebar__item"
              aria-label={section.label}
              aria-pressed={active}
              disabled={disabled || (archiveDisabled && (section.id === "save" || section.id === "load"))}
              onClick={() => onSelect(section.id)}
            >
              <i
                className="menu-sidebar__icon"
                style={{
                  WebkitMaskImage: `url("${section.icon}")`,
                  maskImage: `url("${section.icon}")`
                }}
                aria-hidden="true"
              />
              <span className="menu-sidebar__label" aria-hidden="true">{section.label}</span>
              <i className="menu-sidebar__chevron" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      {/* 结构线独立置顶：操作槽只能嵌入壳体，不能反过来遮断壳体边缘。 */}
      <svg className="menu-sidebar__frame menu-sidebar__frame--outline" viewBox="0 0 224 528" aria-hidden="true">
        <path className="menu-sidebar__frame-outer" d="M0 0 H158 L224 34 V486 L194 528 H0 Z" />
        <path className="menu-sidebar__frame-middle" d="M0 0 H158 L224 34 V486 L194 528 H0 Z" />
        <path className="menu-sidebar__frame-inner" d="M0 0 H158 L224 34 V486 L194 528 H0 Z" />
        <path className="menu-sidebar__frame-inset" d="M0 15 H151 L208 44 V478 L184 512 H0 Z" />
        <path className="menu-sidebar__frame-ridge" d="M0 15 H151 L208 44 V474" />
      </svg>
    </nav>
  );
}
