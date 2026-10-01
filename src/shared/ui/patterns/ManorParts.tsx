import { useId, useRef } from "react";
import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { ArrowButton } from "../primitives/ArrowButton";
import { DiamondWatermark } from "../primitives/DiamondWatermark";
import { ItemSlotStatic } from "../primitives/ItemSlot";
import { ManorGlyph } from "./ManorSection";
import { cx } from "../../lib/cx";

/* 洋馆工具窗(库存、日志、整备)共用的小件。外观全部来自 manor-utility.css,
   调用方只给数据,不再各自画分页和数值行。 */

/** 分页:两枚菱形箭头夹着「当前 / 总数」;放在它所翻的那一组旁边。 */
export function ManorPager({subject, page, count, controls, onPage}: {
  /** 被翻页的内容,例如「物品库存」;同时生成导航名与读屏播报。 */
  subject: string; page: number; count: number; controls?: string; onPage: (page: number) => void;
}) {
  return <nav className="manor-pager" aria-label={`${subject}分页`}>
    <ArrowButton className="manor-pager__arrow" direction="left" label="上一页" size="sm" shape="diamond" watermark={false}
      aria-controls={controls} disabled={page === 0} onClick={() => onPage(page - 1)}/>
    <span role="status" aria-live="polite" aria-atomic="true" aria-label={`${subject}，第 ${page + 1} 页，共 ${count} 页`}>{page + 1} / {count}</span>
    <ArrowButton className="manor-pager__arrow" direction="right" label="下一页" size="sm" shape="diamond" watermark={false}
      aria-controls={controls} disabled={page >= count - 1} onClick={() => onPage(page + 1)}/>
  </nav>;
}

export interface ManorPanelTab { id: string; label: ReactNode; count?: number }
export interface ManorPanelTabs {
  /** 页签组的读屏名,例如「日志分组」。 */
  label: string;
  items: readonly ManorPanelTab[];
  active: string;
  onSelect: (id: string) => void;
}

/** 名牌 + 内凹面板(与房间抽屉同一配方):名牌骑在面板上沿,aside 骑在上沿右端,
 *  例如这一块自己的分页。面板随内容高度,不在内部另画标题。
 *  给了 tabs 时,上沿改为一排页签:当前页签是名牌,其余是不垫牌的字;面板内容成为它的 tabpanel。 */
export function ManorPanel({label, icon, tabs, aside, className, children, ...props}: Omit<HTMLAttributes<HTMLElement>, "children"> & {
  label?: ReactNode; icon?: string; tabs?: ManorPanelTabs; aside?: ReactNode; children?: ReactNode;
}) {
  const id = useId();
  const named = props["aria-label"] != null || props["aria-labelledby"] != null || !!tabs;
  return <section className={cx("manor-panel", className)} aria-labelledby={named ? undefined : id} {...props}>
    {tabs ? <ManorTabRow uid={id} tabs={tabs}/> : <header className="manor-panel__tag">
      <h3 id={id}>{icon && <ManorGlyph src={icon}/>}{label}</h3>
    </header>}
    {aside != null && <div className="manor-panel__aside">{aside}</div>}
    {tabs ? <div className="manor-panel__tabpanel" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tabs.active}`}>{children}</div> : children}
  </section>;
}

/** 页签行:左右键在页签间移动并切换,Home/End 到两端(WAI-ARIA tabs,自动激活)。 */
function ManorTabRow({uid, tabs}: {uid: string; tabs: ManorPanelTabs}) {
  const row = useRef<HTMLDivElement>(null);
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.items.findIndex(tab => tab.id === tabs.active);
    const next = event.key === "ArrowRight" ? Math.min(index + 1, tabs.items.length - 1)
      : event.key === "ArrowLeft" ? Math.max(index - 1, 0)
      : event.key === "Home" ? 0 : event.key === "End" ? tabs.items.length - 1 : null;
    if (next === null || next === index) return;
    event.preventDefault();
    tabs.onSelect(tabs.items[next].id);
    row.current?.querySelector<HTMLButtonElement>(`[data-tab="${CSS.escape(tabs.items[next].id)}"]`)?.focus();
  };
  return <div ref={row} className="manor-panel__tabs" role="tablist" aria-label={tabs.label} onKeyDown={move}>
    {tabs.items.map(tab => {
      const active = tab.id === tabs.active;
      return <button key={tab.id} type="button" role="tab" className="manor-panel__tab" data-tab={tab.id}
        id={`${uid}-tab-${tab.id}`} aria-selected={active} aria-controls={`${uid}-panel`} tabIndex={active ? 0 : -1}
        onClick={() => { if (!active) tabs.onSelect(tab.id); }}>
        <span>{tab.label}{tab.count != null && <b>{tab.count}</b>}</span>
      </button>;
    })}
  </div>;
}

/** 展台:菱形暗纹向四周淡出,下方一道台面线,中点一枚小菱形。放一枚物品格或印记。 */
export function ManorStage({className, children}: {className?: string; children: ReactNode}) {
  return <div className={cx("manor-showcase__stage", className)}>
    <DiamondWatermark className="manor-showcase__pattern" size={36} outerOpacity={1} innerOpacity={1}/>
    {children}
  </div>;
}

/** 物品展台:大物品格立在菱形暗纹与台面线上,名称在下。类别由所在面板的名牌承担。
 *  tag 是挂在展台右上角的状态签,例如「待交付」。 */
export function ManorItemShowcase({icon, name, tag, tone = "interface", rarity}: {
  icon: string; name: string; tag?: ReactNode; tone?: "interface" | "rarity"; rarity?: string;
}) {
  return <div className="manor-showcase">
    <ManorStage>
      <ItemSlotStatic icon={icon} name={name} tone={tone} rarity={rarity} showRarity={tone === "rarity" && !!rarity} aria-hidden="true"/>
      {tag != null && <small className="manor-showcase__tag">{tag}</small>}
    </ManorStage>
    <h4 className="manor-showcase__name">{name}</h4>
  </div>;
}

/** 数值行:标签在左,数字与单位在右。放在 ManorStats 里。
 *  control 用来代替数字,例如可调的 ManorQuantity。 */
export function ManorStat({label, value, unit, control}: {label: ReactNode; value?: ReactNode; unit?: ReactNode; control?: ReactNode}) {
  return <div className="manor-stat"><dt>{label}</dt><dd>{control ?? <b>{value}</b>}{unit != null && <small>{unit}</small>}</dd></div>;
}

/** 数量选择:与分页同一对菱形箭头,夹着金色数字;越界的一端箭头失效。 */
export function ManorQuantity({label, value, minimum = 1, maximum, disabled, onChange}: {
  /** 读屏名,例如「食物携带数量」;两枚箭头读作「减少…」「增加…」。 */
  label: string; value: number; minimum?: number; maximum: number; disabled?: boolean; onChange: (value: number) => void;
}) {
  return <span className="manor-quantity" role="group" aria-label={label}>
    <ArrowButton className="manor-pager__arrow" direction="left" label={`减少${label}`} size="sm" shape="diamond" watermark={false}
      disabled={disabled || value <= minimum} onClick={() => onChange(value - 1)}/>
    <output aria-label={label}>{value}</output>
    <ArrowButton className="manor-pager__arrow" direction="right" label={`增加${label}`} size="sm" shape="diamond" watermark={false}
      disabled={disabled || value >= maximum} onClick={() => onChange(value + 1)}/>
  </span>;
}

export function ManorStats({className, children}: {className?: string; children: ReactNode}) {
  return <dl className={cx("manor-stats", className)}>{children}</dl>;
}
