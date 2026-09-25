import { CurrencyAmount } from "../../shared/ui/primitives/CurrencyAmount";
import { RpgFacetDiamond } from "../../shared/ui/primitives/RpgFacetDiamond";
import { MenuHudFrame } from "./MenuHudFrame";
import { motion, type MotionValue } from "motion/react";
import type { MenuView } from "./useMenuView";

const sectionTitles = { save: ["存档", "SAVE", 380], load: ["读档", "LOAD", 380], settings: ["设置", "SETTINGS", 448] } as const;

/* ============ 顶栏 ============
 * 左「天数 + 相位」/ 中留空 / 右「三笔资源」。
 * 中间留空是刻意的:那条带子下面就是立绘的头部,压字会撞脸。
 *
 * 天数牌与相位刻度**没有**复用 apps/mansion —— 模块边界禁止 app 互相 import
 * (scripts/check-module-boundaries.mjs)。而且枢纽只需要**读**当前时刻,
 * 不需要洋馆那套可点击预览 + 推进键,所以这里是精简实现,不是复制粘贴。
 */

export type MenuPhaseId = "dawn" | "day" | "dusk" | "night";

interface MenuPhase {
  id: MenuPhaseId;
  label: string;
}

const MENU_PHASES: readonly MenuPhase[] = [
  { id: "dawn", label: "晨" },
  { id: "day", label: "昼" },
  { id: "dusk", label: "昏" },
  { id: "night", label: "夜" }
];

export interface MenuTopBarProps {
  day: number;
  phase: MenuPhaseId;
  publicFund: number;
  partyFund: number;
  crystals: number;
  view: MenuView;
  opacity: MotionValue<number>;
  titleX: MotionValue<number>;
}

export function MenuTopBar({ day, phase, publicFund, partyFund, crystals, view, opacity, titleX }: MenuTopBarProps) {
  const activeIndex = MENU_PHASES.findIndex((item) => item.id === phase);

  return (
    <header className="menu-topbar">
      <motion.div className="menu-topbar__title-track" style={{ x: titleX, opacity }}>
      <MenuHudFrame
        className={`menu-topbar__hud-frame menu-topbar__hud-frame--time${view !== "home" ? " menu-topbar__hud-frame--section" : ""}`}
        label={view === "home" ? "时间与相位" : `${sectionTitles[view][0]} · ${sectionTitles[view][1]}`}
        side="left"
        compact={view !== "home"}
        compactWidth={view === "home" ? undefined : sectionTitles[view][2]}
      >
        {view !== "home" ? <h1 className="menu-topbar__section-title" aria-label={`${sectionTitles[view][0]} ${sectionTitles[view][1]}`}><span>{sectionTitles[view][0]}</span><strong>{sectionTitles[view][1]}</strong></h1> : <div className="menu-topbar__time">
          <div className="menu-topbar__day" aria-label={`第 ${day} 天`}>
            <small aria-hidden="true">DAY</small>
            <b aria-hidden="true">{day}</b>
          </div>
          {/* 相位刻度:四格菱形串在导轨上,当前格反白。只读,不可点。 */}
          <div
            className="menu-topbar__phase"
            role="img"
            aria-label={`当前相位 ${MENU_PHASES[activeIndex]?.label ?? ""}`}
          >
            <span className="menu-topbar__phase-rail" aria-hidden="true" />
            {MENU_PHASES.map((item, index) => (
              <RpgFacetDiamond
                key={item.id}
                label={item.label}
                appearance="flat"
                data-state={
                  item.id === phase ? "current" : index < activeIndex ? "elapsed" : "coming"
                }
                state={
                  item.id === phase ? "current" : index < activeIndex ? "elapsed" : "coming"
                }
                aria-hidden="true"
              />
            ))}
          </div>
        </div>}
      </MenuHudFrame>
      </motion.div>
      {view === "home" && <div className="menu-topbar__funds-track">
      <MenuHudFrame
        className="menu-topbar__hud-frame menu-topbar__hud-frame--funds"
        label="持有资源"
        side="right"
      >
        <div className="menu-topbar__funds">
          <dl>
            <div>
              <i className="menu-topbar__funds-connector" aria-hidden="true" />
              <i className="menu-topbar__funds-diamond" aria-hidden="true" />
              <i className="menu-topbar__funds-face" aria-hidden="true" />
              <dt>维稳公款</dt>
              <dd>
                <CurrencyAmount value={publicFund} currency="gold" label="维稳公款" />
              </dd>
            </div>
            <div>
              <i className="menu-topbar__funds-connector" aria-hidden="true" />
              <i className="menu-topbar__funds-diamond" aria-hidden="true" />
              <i className="menu-topbar__funds-face" aria-hidden="true" />
              <dt>小队资金</dt>
              <dd>
                <CurrencyAmount value={partyFund} currency="gold" label="小队资金" />
              </dd>
            </div>
            <div>
              <i className="menu-topbar__funds-connector" aria-hidden="true" />
              <i className="menu-topbar__funds-diamond" aria-hidden="true" />
              <i className="menu-topbar__funds-face" aria-hidden="true" />
              <dt>远古晶石</dt>
              <dd>
                <CurrencyAmount
                  value={crystals}
                  currency="crystal"
                  label="远古晶石"
                />
              </dd>
            </div>
          </dl>
        </div>
      </MenuHudFrame>
      </div>}
    </header>
  );
}
