import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { manorIcon } from "../shared/ui/patterns/manor-icons";
import { UiContentTransition } from "../shared/ui/motion/UiContentTransition";
import { RpgFacetDiamond } from "../shared/ui/primitives/RpgFacetDiamond";
import { ManorGlyph } from "../shared/ui/patterns/ManorSection";
import { ManorPanel } from "../shared/ui/patterns/ManorParts";
import { JournalActionLink, JournalButton, JournalDockBar, JournalDockContext, JournalLedger, JournalLedgerRow, JournalPlace, JournalSection } from "./JournalPrimitives";
import {
  JOURNAL_CATEGORIES, JOURNAL_GLYPHS, JOURNAL_GROUPS,
  type JournalCategory, type JournalGroup, type JournalTone
} from "./journal-format";
import "./journal-browser.css";

/** 一个操作。馆内的操作给 onClick,去别的画面给 href;主操作排在最右。 */
export interface JournalAction {
  label: string;
  /** 读屏名,缺省同 label。 */
  name?: string;
  emphasis?: "normal" | "primary";
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
}
/** 事实行:期限、目标、路线、已收下的物品。标签短,值可以是一句话。 */
export interface JournalFact { label: string; value: ReactNode }
export interface JournalItemRow { id: string; icon: string; name: string; note?: string; quantity: number }
/** 物品清单:带回物品、待鉴定的收获。 */
export interface JournalItems { label: string; rows: readonly JournalItemRow[] }

/** 过滤掉条件不成立的操作,便于来源按状态逐条列出。 */
export const journalActions = (...actions: (JournalAction | false | null | undefined)[]) =>
  actions.filter((action): action is JournalAction => !!action);

export interface JournalEntry {
  id: string;
  title: string;
  /** 人物或来源:艾洛拉、缇比的杂货铺、小队。 */
  source: string;
  category: JournalCategory;
  /** 状态词,取自 JOURNAL_STATUS;运行时视图自带的进度原样传入。 */
  status: string;
  /** 地点,只出现在阅读区语境行。 */
  place?: string;
  /** 标题行右端的补充,例如归来的最深层数。 */
  detail?: ReactNode;
  group: JournalGroup;
  actionable?: boolean;
  ongoing?: boolean;
  sourceId?: string;
  /* ---- 正文只给数据,版式由 JournalRecord 统一绘制:
     头部(语境 · 标题)→ 概要 → 事实 → 段落 → 物品 → 条件 → 嵌入件 → 记录;
     操作不进正文,钉在阅读面板下沿的操作栏。 ---- */
  /** 一句话概要,正文的第一段。 */
  lead?: ReactNode;
  paragraphs?: readonly ReactNode[];
  facts?: readonly JournalFact[];
  items?: JournalItems;
  /** 尚未开放时的开放条件。 */
  condition?: string;
  /** 只给自带交互的嵌入件(今日安排的流程、归来的入账单),不用来拼普通正文。 */
  custom?: ReactNode;
  /** 折叠的历史记录,排在正文末尾。 */
  records?: ReactNode;
  /** 操作栏:左端是地点,右端是按钮(主操作在最右)。 */
  actions?: readonly JournalAction[];
  /** 按钮由嵌入件经 JournalDock 放进操作栏(今日安排);地点同样移到操作栏。 */
  embeddedActions?: boolean;
}

/** 目录副标题:人物 · 状态。 */
export const journalMeta = (entry: Pick<JournalEntry, "source" | "status">) => `${entry.source} · ${entry.status}`;
export function journalTone(entry: Pick<JournalEntry, "group" | "actionable">): JournalTone {
  return entry.group === "locked" ? "locked" : entry.actionable ? "action" : entry.group === "archive" ? "done" : "ongoing";
}
const facetState = {action: "current", ongoing: "elapsed", done: "coming"} as const;

/** Selection is reading state only. No entry is opened through a gameplay command.
 *  左:按分组切换的目录面板(页签跟随选中的条目);右:阅读面板,名牌写类别,状态骑在上沿右端。 */
export function JournalBrowser({entries, selectedId, onSelect, empty, tools}: {
  entries: JournalEntry[]; selectedId: string | null; onSelect: (id: string | null) => void;
  empty: ReactNode; tools?: ReactNode;
}) {
  const uid = useId(), reader = useRef<HTMLElement>(null), index = useRef<HTMLElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  const selected = entries.find(e => e.id === selectedId) ?? entries.find(e => e.group !== "locked");
  const previousSelection = useRef(selected?.id);
  useEffect(() => {
    if (selectedId !== (selected?.id ?? null)) onSelect(selected?.id ?? null);
  }, [selectedId, selected?.id, onSelect]);
  useEffect(() => {
    // A new reader already starts at zero. Even writing scrollTop=0 on mount
    // forces layout before the manor window has painted its first frame.
    if (previousSelection.current === selected?.id) return;
    previousSelection.current = selected?.id;
    if (reader.current) reader.current.scrollTop = 0;
  }, [selected?.id]);
  // 键盘跨组移动时,目标条目要等页签切过去、新列表渲染后才有按钮可聚焦。
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    entryButton(index.current, target)?.focus();
  }, [selected?.id]);
  const groups = JOURNAL_GROUPS.map(group => ({...group, entries: entries.filter(e => e.group === group.id)}))
    .filter(group => group.entries.length);
  const ordered = groups.flatMap(group => group.entries);
  // 页签跟随选中的条目;只有未开放条目时停在第一组,但不替玩家选中未开放的条目。
  const activeGroup = groups.find(group => group.id === selected?.group) ?? groups[0];
  const move = (event: KeyboardEvent<HTMLElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || !(event.target instanceof HTMLButtonElement)) return;
    const at = ordered.findIndex(e => e.id === (event.target as HTMLButtonElement).dataset.journalEntry);
    if (at < 0) return;
    event.preventDefault();
    const next = ordered[event.key === "Home" ? 0 : event.key === "End" ? ordered.length - 1
      : Math.max(0, Math.min(ordered.length - 1, at + (event.key === "ArrowDown" ? 1 : -1)))];
    // 上下键可越过组界(同库存跨页):目标在别的组时,页签随选中切换,焦点稍后交过去。
    const button = entryButton(index.current, next.id);
    if (button) button.focus(); else pendingFocus.current = next.id;
    onSelect(next.id);
  };
  const tabs = activeGroup && {
    label: "日志分组", active: activeGroup.id,
    items: groups.map(group => ({id: group.id, label: group.label, count: group.entries.length})),
    onSelect: (id: string) => { const first = groups.find(group => group.id === id)?.entries[0]; if (first) onSelect(first.id); },
  };
  const category = selected && JOURNAL_CATEGORIES[selected.category];
  return <div className="journal-browser">
    <ManorPanel className="journal-browser__index" label={tabs ? undefined : "记事"} tabs={tabs}>
      <nav ref={index} className="journal-browser__list" aria-label="日志条目" onKeyDown={move}>
        {activeGroup ? <ul className="journal-browser__entries" data-group={activeGroup.id}>
          {activeGroup.entries.map(e => <li key={e.id}>
            <JournalIndexRow entry={e} current={selected?.id === e.id} controls={`${uid}-reader`} onSelect={onSelect}/>
          </li>)}
        </ul> : <p className="journal-browser__index-empty">尚无记事</p>}
        {tools && <div className="journal-browser__tools">{tools}</div>}
      </nav>
    </ManorPanel>
    <ManorPanel className="journal-browser__reader-panel" label={category?.label ?? "旅程记事"}
      icon={category && manorIcon(category.icon)} aside={selected && <JournalStatusMark entry={selected}/>}>
      <JournalDockContext.Provider value={{target: dock, place: selected?.place}}>
        <article ref={reader} id={`${uid}-reader`} className="journal-browser__reader" tabIndex={0} aria-label={selected?.title ?? "旅程记事"}>
          <UiContentTransition className="journal-browser__reading" contentKey={selected?.id ?? "empty"}>
            <Fragment key={selected?.id ?? "empty"}>{selected ? <JournalRecord entry={selected}/> : empty}</Fragment>
          </UiContentTransition>
        </article>
      </JournalDockContext.Provider>
      {/* 操作栏钉在面板下沿,不随正文滚动;嵌入件经 JournalDock 把自己的进度与按钮放进这里。 */}
      <div ref={setDock} className="journal-dock">
        {!!selected?.actions?.length && <UiContentTransition key={selected.id} contentKey={selected.id}>
          <JournalDockBar lead={selected.place && <JournalPlace place={selected.place}/>}>
            {[...selected.actions].sort((a, b) => Number(a.emphasis === "primary") - Number(b.emphasis === "primary"))
              .map(action => <JournalActionControl key={action.label} action={action}/>)}
          </JournalDockBar>
        </UiContentTransition>}
      </div>
    </ManorPanel>
  </div>;
}

function entryButton(root: HTMLElement | null, id: string) {
  return root?.querySelector<HTMLButtonElement>(`button[data-journal-entry="${CSS.escape(id)}"]`) ?? null;
}

/** 一行一条:图标格 / 标题与副标题 / 待处理标记。尚未开放的条目收成单行。 */
function JournalIndexRow({entry, current, controls, onSelect}: {
  entry: JournalEntry; current: boolean; controls: string; onSelect: (id: string) => void;
}) {
  const tone = journalTone(entry), meta = journalMeta(entry), locked = tone === "locked";
  return <button type="button" data-journal-entry={entry.id} data-source-id={entry.sourceId} data-locked={locked || undefined}
    data-tone={tone} aria-label={`查看记录：${entry.title}`} aria-description={meta}
    aria-current={current ? "true" : undefined} aria-controls={controls} onClick={() => onSelect(entry.id)}>
    {/* 尚未开放的条目不画图标,只留一枚空心菱形节点,整组读作一列安静的预告。 */}
    <span className="journal-entry__icon">{locked ? <i className="journal-entry__node"/>
      : <ManorGlyph src={manorIcon(JOURNAL_CATEGORIES[entry.category].icon)}/>}</span>
    <span className="journal-entry__copy">
      <strong title={entry.title}>{entry.title}</strong>
      {locked ? <small title={entry.source}>{entry.source}</small> : <small title={meta}>{meta}</small>}
    </span>
    {tone === "action" && <RpgFacetDiamond className="journal-entry__marker" label="" state="current" aria-hidden="true"/>}
  </button>;
}

/** 阅读面板上沿右端的状态:可处理为亮菱形,进行中为暗菱形,未开放为挂锁。 */
function JournalStatusMark({entry}: {entry: JournalEntry}) {
  const tone = journalTone(entry);
  return <span className="journal-record__status" data-tone={tone}>
    {tone === "locked" ? <ManorGlyph src={manorIcon(JOURNAL_GLYPHS.condition)}/>
      : <RpgFacetDiamond label="" state={facetState[tone]} aria-hidden="true"/>}
    {entry.status}
  </span>;
}

/** 统一的记事版式。头部:语境行(人物 · 地点) / 标题;类别在面板名牌上,状态在上沿右端。
 *  正文按固定顺序排各来源给的数据;有操作时地点移到操作栏左端,语境行只写人物。 */
function JournalRecord({entry}: {entry: JournalEntry}) {
  const docked = !!entry.actions?.length || !!entry.embeddedActions;
  const context = [entry.source, !docked && entry.place].filter(Boolean).join(" · ");
  const total = entry.items?.rows.reduce((count, row) => count + row.quantity, 0) ?? 0;
  return <div className="journal-record" data-tone={journalTone(entry)}>
    <header className="journal-record__heading">
      <p className="journal-record__context">{context}</p>
      <div className="journal-record__title-row"><h3>{entry.title}</h3>{entry.detail}</div>
    </header>
    <div className="journal-record__body">
      {entry.lead != null && <p className="journal-record__lead">{entry.lead}</p>}
      {!!entry.facts?.length && <dl className="journal-facts">
        {entry.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
      </dl>}
      {entry.paragraphs?.map((text, index) => <p key={index}>{text}</p>)}
      {entry.items && <JournalLedger label={entry.items.label} summary={`${total.toLocaleString("en-US")} 件`}>
        {entry.items.rows.map(row => <JournalLedgerRow key={row.id} icon={row.icon} name={row.name} quantity={row.quantity} note={row.note}/>)}
      </JournalLedger>}
      {entry.condition && <JournalSection label="开放条件" icon={JOURNAL_GLYPHS.condition} className="journal-condition">
        <p>{entry.condition}</p>
        <p className="journal-record__note">达成后，这段记事会移到「当前事项」。</p>
      </JournalSection>}
      {entry.custom}
      {entry.records}
    </div>
  </div>;
}

function JournalActionControl({action}: {action: JournalAction}) {
  const {label, name, emphasis, disabled, onClick, href} = action;
  return href && !disabled
    ? <JournalActionLink href={href} emphasis={emphasis} aria-label={name}>{label}</JournalActionLink>
    : <JournalButton emphasis={emphasis} disabled={disabled} aria-label={name} onClick={onClick}>{label}</JournalButton>;
}
