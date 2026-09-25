import { useId, useState } from "react";
import type { CSSProperties } from "react";
import characterIcon from "../../assets/icons/menu/roster-scylla.svg";
import medievalVillageIcon from "../../assets/icons/menu/medieval-village-01.svg";
import twoCoinsIcon from "../../assets/icons/items/two-coins.svg";
import mapSwordIcon from "../../assets/icons/menu/map-sword.svg";
import { MenuDialFiligree } from "./MenuDialFiligree";

/* ============ 四角命令盘 ============
 *
 * 构造取自旧战斗界面的 BattleCommandMenu(shared/ui/patterns/BattleScreen.tsx)。
 * 那个组件没有导出、且与战斗语义绑死(attack/skills/items/defend),所以这里
 * 把它的**构造**搬过来,语义换成枢纽的四个去处。
 *
 * 三层叠放,与原版一致:
 *   1. <svg> 全部视觉,pointer-events:none
 *   2. <span> ×4 图标,CSS mask 上色,pointer-events:none
 *   3. <button> ×4 透明命中区,唯一可交互层
 * 美术与热区解耦,是仓库里 RpgDirectionPad 也在用的手法。
 *
 * ============ 等面积改造 ============
 * 原四块面积不等:N/S 各 47410,W/E 各 41883(极差 13%)—— 因为 attack 是
 * 主动作,故意做得更大。枢纽的四个去处权重相当,不该有大小差。
 *
 * 改动刻意**最小**,只动三条边、不重画轮廓:
 *   N 顶边下移 8.22   S 底边上移 9.56   W/E 上下边各外扩 2.28
 * 四块面积因此全部收敛到 44646(原四块的平均值),极差 0.00%。
 * 相邻块间隙从 16 变成 13.7,仍然分得开。
 * 这些数是二分解出来的,不是眼调的;改任何一条边都要重解,别手写。
 */

export type MenuCommandId = "estate" | "roster" | "shop" | "sortie";

interface MenuCommand {
  id: MenuCommandId;
  /** 中文语义名，用于读屏与交互文案。 */
  label: string;
  /** 牌面显示的英文标题。 */
  displayLabel: string;
  /** 副题,读屏用。 */
  caption: string;
}

/** N / W / E / S —— 视觉阅读顺序,不是类型联合的声明顺序。 */
const MENU_COMMANDS: readonly MenuCommand[] = [
  { id: "estate", label: "府邸", displayLabel: "MANOR", caption: "回到守望者之崖洋馆" },
  { id: "roster", label: "角色", displayLabel: "ROSTER", caption: "查看角色档案" },
  { id: "shop", label: "商店", displayLabel: "SHOP", caption: "前往守望者杂货铺" },
  { id: "sortie", label: "出征", displayLabel: "SORTIE", caption: "编队并进入副本" }
];

const commandGeometry: Record<
  MenuCommandId,
  { path: string; insetPath: string }
> = {
  estate: {
    path: "M287.7 86.2 L512.3 86.2 L571 154 L527 225 L464 225 L400 292 L336 225 L273 225 L229 154 Z",
    insetPath:
      "M299.5 96.7 L500.5 96.7 L553 157.3 L513.7 220.9 L457.3 220.9 L400 280.9 L342.7 220.9 L286.3 220.9 L247 157.3 Z"
  },
  roster: {
    path: "M57 236.4 L306 236.4 L370 310 L306 383.6 L57 383.6 L12 310 Z",
    insetPath: "M74.9 246.7 L289 246.7 L344.1 310 L289 373.3 L74.9 373.3 L36.2 310 Z"
  },
  shop: {
    path: "M494 236.4 L743 236.4 L788 310 L743 383.6 L494 383.6 L430 310 Z",
    insetPath: "M511 246.7 L725.1 246.7 L763.8 310 L725.1 373.3 L511 373.3 L455.9 310 Z"
  },
  sortie: {
    path: "M336 395 L400 328 L464 395 L527 395 L571 466 L518 532.4 L282 532.4 L229 466 L273 395 Z",
    insetPath:
      "M342.7 399.1 L400 339.1 L457.3 399.1 L513.7 399.1 L553 462.6 L505.6 522.1 L294.4 522.1 L247 462.6 L286.3 399.1 Z"
  }
};

const commandIcons: Record<MenuCommandId, string> = {
  estate: medievalVillageIcon,
  roster: characterIcon,
  shop: twoCoinsIcon,
  sortie: mapSwordIcon
};

export interface MenuCommandDialProps {
  selectedId: MenuCommandId;
  onSelect: (id: MenuCommandId) => void;
  onActivate: (id: MenuCommandId) => void;
}

export function MenuCommandDial({ selectedId, onSelect, onActivate }: MenuCommandDialProps) {
  const uid = useId().replace(/:/g, "");
  const diamondId = `menu-dial-diamond-${uid}`;
  const sideId = `menu-dial-side-${uid}`;
  const [feedback, setFeedback] = useState<{ id: MenuCommandId; serial: number; kind: "select" | "confirm" } | null>(null);

  return (
    <nav className="menu-dial" aria-label="主菜单">
      <svg className="menu-dial__art" viewBox="0 0 800 620" aria-hidden="true">
        <MenuDialFiligree diamondId={diamondId} sideId={sideId} />

        {/* 三重同心环 + 上下轴饰。 */}
        <g className="menu-dial__rings">
          <circle cx="400" cy="310" r="207" />
          <circle cx="400" cy="310" r="195" />
          <circle cx="400" cy="310" r="184" />
          <path d="M374 99 400 42 426 99M381 95 400 57 419 95M389 92 400 71 411 92M374 521 400 578 426 521M381 525 400 563 419 525M389 528 400 549 411 528M400 44V102M400 518V576" />
        </g>

        {MENU_COMMANDS.map((command) => {
          const geometry = commandGeometry[command.id];
          const selected = command.id === selectedId;
          return (
            <g
              key={command.id}
              className="menu-dial__panel-entry"
              data-command={command.id}
            >
            <g
              className="menu-dial__panel"
              data-command={command.id}
              data-selected={selected || undefined}
            >
              <path className="menu-dial__panel-fill" d={geometry.path} />
              <path className="menu-dial__panel-outer" d={geometry.path} />
              <path className="menu-dial__panel-middle" d={geometry.path} />
              <path className="menu-dial__panel-inner" d={geometry.path} />
              <path className="menu-dial__panel-inset" d={geometry.insetPath} />
              <path className="menu-dial__panel-focus" d={geometry.insetPath} />
              {command.id === "estate" && (
                <>
                  <use className="menu-dial__filigree menu-dial__filigree--wing" href={`#${sideId}`} transform="translate(253 156)" />
                  <use className="menu-dial__filigree menu-dial__filigree--wing" href={`#${sideId}`} transform="translate(547 156) scale(-1 1)" />
                  <use className="menu-dial__filigree" href={`#${diamondId}`} transform="translate(400 246)" />
                </>
              )}
              {command.id === "roster" && (
                <>
                  <use className="menu-dial__filigree menu-dial__filigree--wing" href={`#${sideId}`} transform="translate(35 310)" />
                  <use className="menu-dial__filigree" href={`#${diamondId}`} transform="translate(334 310) rotate(-90) scale(.9)" />
                </>
              )}
              {command.id === "shop" && (
                <>
                  <use className="menu-dial__filigree" href={`#${diamondId}`} transform="translate(466 310) rotate(90) scale(.9)" />
                  <use className="menu-dial__filigree menu-dial__filigree--wing" href={`#${sideId}`} transform="translate(765 310) scale(-1 1)" />
                </>
              )}
              {command.id === "sortie" && (
                <>
                  <use className="menu-dial__filigree" href={`#${diamondId}`} transform="translate(400 374) rotate(180)" />
                  <use className="menu-dial__filigree menu-dial__filigree--wing" href={`#${sideId}`} transform="translate(253 464)" />
                  <use className="menu-dial__filigree menu-dial__filigree--wing" href={`#${sideId}`} transform="translate(547 464) scale(-1 1)" />
                </>
              )}
              {feedback?.id === command.id && (
                <path
                  key={feedback.serial}
                  className="menu-dial__response"
                  data-kind={feedback.kind}
                  d={geometry.insetPath}
                />
              )}
            </g>
            </g>
          );
        })}

        {/* 中心宝石:四块的尖角在此汇聚。 */}
        <path className="menu-dial__jewel" d="M400 294 416 310 400 326 384 310Z" />
        <path className="menu-dial__jewel-line" d="M400 299 411 310 400 321 389 310Z" />
        {feedback && <path key={feedback.serial} className="menu-dial__hub-response" data-kind={feedback.kind} d="M400 294 416 310 400 326 384 310Z" />}
      </svg>

      {MENU_COMMANDS.map((command) => (
        <span key={command.id} className="menu-dial__content-entry" data-command={command.id} aria-hidden="true">
        <span className="menu-dial__content-motion" data-command={command.id} data-selected={command.id === selectedId || undefined}>
        <span
          className="menu-dial__content"
          data-command={command.id}
          data-selected={command.id === selectedId || undefined}
          aria-hidden="true"
        >
          <span className="menu-dial__label">
            <span className="menu-dial__label-reveal"><span className="menu-dial__label-text">{command.displayLabel}</span></span>
            <i className="menu-dial__label-rule" aria-hidden="true" />
          </span>
          <span
            className="menu-dial__icon"
            style={{ "--menu-dial-icon": `url("${commandIcons[command.id]}")` } as CSSProperties}
          />
        </span>
        </span>
        </span>
      ))}

      {/* 命中区:透明按钮盖在美术之上。再点一次已选中的项 = 进入。 */}
      {MENU_COMMANDS.map((command) => (
        <button
          key={command.id}
          type="button"
          className="menu-dial__button"
          data-command={command.id}
          data-selected={command.id === selectedId || undefined}
          aria-label={`${command.label} · ${command.caption}`}
          aria-pressed={command.id === selectedId}
          onClick={() => {
            const kind = command.id === selectedId ? "confirm" : "select";
            setFeedback(previous => ({ id: command.id, serial: (previous?.serial ?? 0) + 1, kind }));
            if (kind === "confirm") onActivate(command.id);
            else onSelect(command.id);
          }}
        />
      ))}
    </nav>
  );
}
