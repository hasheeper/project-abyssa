import "./loot.css";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type Ref } from "react";
import { ArrowButton } from "../../../shared/ui/primitives/ArrowButton";
import { AvatarFrame } from "../../../shared/ui/primitives/AvatarFrame";
import { CurrencyAmount } from "../../../shared/ui/primitives/CurrencyAmount";
import { ItemSlotStatic } from "../../../shared/ui/primitives/ItemSlot";
import { useMoney } from "../../../shared/ui/primitives/Money";
import { modalFocusables } from "../../../shared/ui/primitives/useModalPresentation";
import { RpgFacetDiamond } from "../../../shared/ui/primitives/RpgFacetDiamond";
import { DiceActionButton } from "../../../shared/ui/patterns/action-dock/DiceActionButton";
import { useUiMotion } from "../../../shared/ui/motion/UiMotionProvider";
import { useLedgerStage } from "../presentation/ledger-stage";
import { LootHoverDetail } from "./LootHoverDetail";
import { useLootHover } from "./LootPocketView";
import { LEDGER_PARTY_TAGS, type LedgerPartyTag, type LedgerSpeaker } from "./ledger-voices";
import { lootItemLabel, type LootItemView } from "./loot-item";
import { hasLoot, itemCount, type LootOutcome, type LootPocket, type LootSettlement, type LootStack } from "./loot-types";
import "./loot-settlement.css";

const OUTCOMES: Record<LootOutcome, { title: string; english: string }> = {
  cleared: { title: "远征完成", english: "EXPEDITION COMPLETE" },
  retreated: { title: "撤离归来", english: "RETURN FROM EXPEDITION" },
  failed: { title: "远征失利", english: "EXPEDITION LOST" },
};
// Beats after the page appears; the stage owns everything before it.
const LIT_AT = 420, LIT_STEP = 130, MONEY_AT = 900, MONEY_MS = 900, TURN_AT = 2400, COMPLETE_AT = 2700;
const PER_PAGE = 5;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const RARITY_ORDER = ["mythic", "amethyst", "gold", "silver", "bronze", "unknown"];

export interface LootSettlementContext {
  /** Supplied by the expedition adapter, never inferred from its visual skin. */
  locationName: string;
  progressLabel?: string;
}
export type LedgerClockPhase = "dawn" | "day" | "dusk" | "night";
export type LedgerDepthNode = { kind: "passed" | "exit" | "fell" | "ahead"; room?: string };
/** `gold` is absent for the layer whose loose gold was lost. */
export type LedgerRow = { layer: number; room?: string; looseGold: number; bonusPercent?: number; multiplier?: number; gold?: number };
export type LedgerPartyMember = { id: string; name: string; avatar?: string; hp: number; maxHp: number; tag: LedgerPartyTag };
export type LedgerSupplyGroup = { label: string; pocket: LootPocket };

const PHASE_GLYPH: Record<LedgerClockPhase, string> = { dawn: "晨", day: "昼", dusk: "昏", night: "夜" };
const PHASE_TURN: Record<LedgerClockPhase, number> = { dawn: 0, day: 90, dusk: 180, night: 270 };

/** Stops of the five-slot window; the last page sits flush instead of leaving gaps. */
function shelfStops(count: number) {
  const stops: number[] = [];
  for (let start = 0; start < count - PER_PAGE; start += PER_PAGE) stops.push(start);
  stops.push(Math.max(0, count - PER_PAGE));
  return stops;
}

function PhaseGlyph({ phase }: { phase: LedgerClockPhase }) {
  if (phase === "night") return <><path d="M102 62a29 29 0 1 0 20 41 28 28 0 0 1-20-41Z" data-relief=""/><path d="m113 66 2.5 7.5 7.5 2.5-7.5 2.5-2.5 7.5-2.5-7.5-7.5-2.5 7.5-2.5Z" data-star=""/></>;
  if (phase === "day") return <><circle cx="90" cy="90" r="18" data-relief=""/>{Array.from({ length: 8 }, (_, i) => <path key={i} d="M90 56v8" transform={`rotate(${i * 45} 90 90)`}/>)}</>;
  return <><path d="M68 98a22 22 0 0 1 44 0Z" data-relief=""/><path d="M90 65v-6M61 71l5 5M119 71l-5 5M56 101h68M68 110h44"/><path d={phase === "dawn" ? "m85 121 5-5 5 5" : "m85 117 5 5 5-5"}/></>;
}

/** The mansion time emblem's dial. The hand moves one quarter on the last beat. */
function LedgerClock({ from, to }: { from: LedgerClockPhase; to: LedgerClockPhase }) {
  return <aside className="ledger-clock" style={{ "--hand-from": `${PHASE_TURN[from]}deg`, "--hand-to": `${PHASE_TURN[to] < PHASE_TURN[from] ? PHASE_TURN[to] + 360 : PHASE_TURN[to]}deg` } as CSSProperties}
    aria-label={`洋馆时辰：${PHASE_GLYPH[from]}时转入${PHASE_GLYPH[to]}时`}>
    <svg className="ledger-clock__dial" viewBox="0 0 180 180" aria-hidden="true">
      <path className="ledger-clock__bezel" d="M57 9 H123 L171 57 V123 L123 171 H57 L9 123 V57 Z"/>
      <circle className="ledger-clock__face" cx="90" cy="90" r="63"/>
      <g className="ledger-clock__ticks">{Array.from({ length: 24 }, (_, i) => <path key={i} d={i % 6 ? "M90 32v3" : "M90 31v6"} transform={`rotate(${i * 15} 90 90)`}/>)}</g>
      <g className="ledger-clock__hand"><path d="m90 22 3 5-3 5-3-5Z"/></g>
      <g className="ledger-clock__glyph" data-glyph="from"><PhaseGlyph phase={from}/></g>
      <g className="ledger-clock__glyph" data-glyph="to"><PhaseGlyph phase={to}/></g>
    </svg>
    <p className="ledger-clock__caption" aria-hidden="true"><small>洋馆时辰</small><span><b data-from="">{PHASE_GLYPH[from]}</b><i/><b data-to="">{PHASE_GLYPH[to]}</b></span></p>
  </aside>;
}

/** Display-only count-up; claiming remains the caller's explicit transaction. */
function LedgerFunds({ value, from, done, note }: { value: number; from: number; done: boolean; note?: string }) {
  const money = useMoney();
  const [shown, setShown] = useState(from);
  useEffect(() => {
    if (done) return;
    setShown(from);
    let frame = 0;
    const timer = window.setTimeout(() => {
      const started = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - started) / MONEY_MS);
        setShown(Math.round(from + (value - from) * (1 - (1 - progress) ** 3)));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, MONEY_AT);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [value, from, done]);
  return <div className="ledger-money" role="group" aria-label={`带回资金 ${money.format(value)}`}>
    <span>带回资金</span>
    <div className="ledger-money__amount" aria-hidden="true"><CurrencyAmount value={done ? value : shown} currency="lira"/></div>
    {note && <p>{note}</p>}
  </div>;
}

type Hover = ReturnType<typeof useLootHover>;
function LedgerItem({ stack, item, hover, supply }: { stack: LootStack; item?: LootItemView; hover: Hover; supply?: boolean }) {
  const name = item?.name ?? stack.itemId;
  const known = item && item.rarity !== "unknown" ? item.rarity : undefined;
  const plain = supply || !known;
  return <button type="button" className="ledger-item" aria-label={item ? lootItemLabel(item, stack.quantity) : `${name}，数量 ${stack.quantity}`}
    aria-describedby={hover.active?.itemId === stack.itemId ? hover.tooltipId : undefined}
    onMouseEnter={event => hover.show(stack.itemId, event.currentTarget, true)} onMouseLeave={hover.leave}
    onFocus={event => hover.show(stack.itemId, event.currentTarget)} onBlur={hover.leave}
    onClick={event => hover.show(stack.itemId, event.currentTarget)}>
    <span className="ledger-item-art">
      <ItemSlotStatic icon={item?.icon} name={name} rarity={known} tone={plain ? "interface" : "rarity"} showRarity={!plain} aria-hidden="true"/>
      {(supply || stack.quantity > 1) && <span className="abyssa-item-count" data-depleted={stack.quantity === 0 || undefined} aria-hidden="true">{stack.quantity}</span>}
    </span>
    <span className={supply ? "ledger-supplies__name" : "ledger-haul__name"} aria-hidden={supply || undefined}>{name}</span>
  </button>;
}

export function LootSettlementView({ receipt, catalog, context, onConfirm, busy = false, error, confirmLabel = "返回", onReview, bonusFunds = 0, supplies, supplyGroups, pendingReward, confirmRef, speaker, clock, depth, rows, party }: {
  receipt: LootSettlement; catalog: Record<string, LootItemView>; context: LootSettlementContext; onConfirm: () => void;
  busy?: boolean; error?: string; confirmLabel?: string; onReview?: () => void; bonusFunds?: number;
  /** Ungrouped remaining supplies; `supplyGroups` takes precedence when given. */
  supplies?: LootPocket; supplyGroups?: readonly LedgerSupplyGroup[];
  /** Included in the displayed total, paid together with the receipt on confirmation. */
  pendingReward?: {label: string; copper: number}; confirmRef?: Ref<HTMLButtonElement>;
  speaker?: LedgerSpeaker; clock?: { from: LedgerClockPhase; to: LedgerClockPhase };
  depth?: readonly LedgerDepthNode[]; rows?: readonly LedgerRow[]; party?: readonly LedgerPartyMember[];
}) {
  const { reduced } = useUiMotion();
  const stage = useLedgerStage();
  const money = useMoney();
  const hover = useLootHover();
  const titleId = useId();
  const page = useRef<HTMLElement>(null);
  const shelf = useRef<HTMLDivElement>(null);
  // Mounted mid-claim (or remounted after a failed one): nothing left to perform.
  const [mountedBusy] = useState(busy);
  const identity = receipt.id ?? receipt;
  const [skippedFor, setSkippedFor] = useState<typeof identity | null>(null);
  const [beat, setBeat] = useState({ receipt: identity, at: 0 });
  const [view, setView] = useState<"summary" | "detail">();
  const [shelfAt, setShelfAt] = useState({ receipt: identity, page: 0 });
  const instant = reduced || stage.instant || mountedBusy || skippedFor === identity;
  const at = beat.receipt === identity ? beat.at : 0;
  const reveal = instant ? "instant" : at >= COMPLETE_AT ? "complete" : "playing";
  const nodes = depth ?? [];
  const lit = (index: number) => instant || at >= LIT_AT + index * LIT_STEP;
  const copy = OUTCOMES[receipt.outcome];

  useEffect(() => { page.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    if (instant) return;
    const marks = [...nodes.map((_, index) => LIT_AT + index * LIT_STEP), TURN_AT, COMPLETE_AT];
    const timers = marks.map(ms => window.setTimeout(() => setBeat(current => current.receipt === identity && current.at >= ms ? current : { receipt: identity, at: ms }), ms));
    return () => timers.forEach(clearTimeout);
  }, [identity, instant, nodes.length]);

  const haul = receipt.returned.items.map((stack, index) => ({ stack, index }))
    .sort((a, b) => RARITY_ORDER.indexOf(catalog[a.stack.itemId]?.rarity ?? "unknown") - RARITY_ORDER.indexOf(catalog[b.stack.itemId]?.rarity ?? "unknown") || a.index - b.index)
    .map(({ stack }) => stack);
  const paged = haul.length > 6;
  const stops = shelfStops(haul.length);
  const shelfPage = shelfAt.receipt === identity ? Math.min(shelfAt.page, stops.length - 1) : 0;
  const turn = useCallback((step: number) => {
    hover.close();
    setShelfAt(current => {
      const from = current.receipt === identity ? current.page : 0;
      return { receipt: identity, page: Math.min(stops.length - 1, Math.max(0, from + step)) };
    });
  }, [identity, stops.length, hover.close]);
  useEffect(() => {
    const node = shelf.current;
    if (!node) return;
    let wheelAt = 0;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(delta) < 4 || performance.now() - wheelAt < 420) return;
      wheelAt = performance.now();
      turn(Math.sign(delta));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [paged, turn]);

  const groups = (supplyGroups ?? (supplies ? [{ label: "带回战备", pocket: supplies }] : [])).filter(group => group.pocket.items.length > 0);
  const detailOpen = view === "detail";
  const hasDetail = !!rows?.length || !!party?.length || groups.length > 0;
  const toggleDetail = () => { hover.close(); setView(detailOpen ? "summary" : "detail"); };
  const visibleStacks = detailOpen ? groups.flatMap(group => group.pocket.items) : haul;
  const activeItem = hover.active && catalog[hover.active.itemId];
  const activeStack = hover.active && visibleStacks.find(stack => stack.itemId === hover.active!.itemId);

  const losses = [{ label: "未入袋遗失", pocket: receipt.lostUnbanked }, { label: "入袋折损", pocket: receipt.lostBanked }].filter(group => hasLoot(group.pocket));
  const pending = pendingReward?.copper ?? 0;
  const countFrom = receipt.outcome === "failed" ? receipt.banked.copper : pendingReward ? receipt.returned.copper : 0;
  const note = [
    receipt.outcome === "failed" && receipt.banked.copper > 0 && `已入袋 ${money.format(receipt.banked.copper)}　·　团灭保留一半`,
    pendingReward && `${pendingReward.label} ${money.format(pendingReward.copper)}`,
    bonusFunds > 0 && `首次接管奖励 ${money.format(bonusFunds)} · 另行入账`,
  ].filter(Boolean).join("　·　");
  const reach = nodes.findIndex(node => node.kind === "exit" || node.kind === "fell");
  const reachIndex = reach >= 0 ? reach : nodes.reduce((last, node, index) => node.kind === "passed" ? index : last, 0);
  const span = Math.max(1, nodes.length - 1);
  const verb = (kind: LedgerDepthNode["kind"]) => kind === "fell" ? "倒下" : kind === "exit" ? receipt.outcome === "cleared" ? "讨伐" : "撤离" : undefined;

  const finishReveal = () => setSkippedFor(identity);
  return <section ref={page} className="ledger-page" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
    data-ui-motion={reduced ? "reduced" : "full"}
    data-outcome={receipt.outcome} data-view={view} data-reveal={reveal} data-time-turned={instant || at >= TURN_AT ? "" : undefined} data-layout={speaker ? undefined : "solo"}
    onClickCapture={event => { if (reveal === "playing") { event.preventDefault(); event.stopPropagation(); finishReveal(); } }}
    onKeyDownCapture={event => { if (reveal === "playing" && ["Enter", " ", "Escape"].includes(event.key)) { event.preventDefault(); event.stopPropagation(); finishReveal(); } }}
    onKeyDown={event => {
      if (event.key === "Tab") {
        const controls = modalFocusables(event.currentTarget);
        const first = controls[0], last = controls.at(-1);
        if (!first) { event.preventDefault(); event.currentTarget.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      else if (event.key === "Escape" && detailOpen) { event.preventDefault(); toggleDetail(); }
      else if (paged && !detailOpen && (event.key === "ArrowLeft" || event.key === "ArrowRight")) { event.preventDefault(); turn(event.key === "ArrowLeft" ? -1 : 1); }
    }}>
    {speaker && <figure className="ledger-speaker" data-speaker={speaker.id}>
      <span className="ledger-speaker__glow" aria-hidden="true"/>
      <img className="ledger-speaker__art" src={speaker.portrait} alt="" draggable={false}/>
      <figcaption className="ledger-speaker__line"><strong>{speaker.name}{speaker.title && <small>{speaker.title}</small>}</strong><p>{speaker.line}</p></figcaption>
    </figure>}
    {clock && <LedgerClock from={clock.from} to={clock.to}/>}
    <div className="ledger-page__column">
      <div className="ledger-page__views">
        <div className="ledger-page__summary" hidden={detailOpen}>
          <header className="ledger-title">
            <p>{context.progressLabel ?? context.locationName}</p>
            <h2 id={titleId}>{copy.title}</h2>
            <small>{copy.english}</small>
          </header>
          {nodes.length > 0 && <ol className="ledger-depth" style={{ "--reach": reachIndex / span } as CSSProperties} aria-label="远征深度">
            <span className="ledger-depth__groove" aria-hidden="true"><i className="ledger-depth__reach"/></span>
            {nodes.map((node, index) => {
              const numeral = ROMAN[index] ?? String(index + 1), action = verb(node.kind), shown = node.kind !== "ahead" && lit(index);
              return <li key={index} data-kind={node.kind} data-lit={shown && action ? "" : undefined}
                style={{ "--x": nodes.length > 1 ? index / span : .5, "--i": index } as CSSProperties}
                aria-label={[`第 ${numeral} 层`, node.kind !== "ahead" && node.room, action].filter(Boolean).join(" ")}>
                <RpgFacetDiamond label={numeral} state={!shown ? "coming" : node.kind === "passed" ? "elapsed" : "current"} aria-hidden="true"/>
                {action && <small className="ledger-depth__caption" aria-hidden="true">{node.room ?? `第 ${numeral} 层`}<span>·</span>{action}</small>}
              </li>;
            })}
          </ol>}
          <LedgerFunds value={receipt.returned.copper + pending} from={countFrom} done={reveal !== "playing"} note={note || undefined}/>
          <section className="ledger-haul" aria-label="此行收获">
            <header><i aria-hidden="true"/><h3>此行收获</h3><span>{itemCount(receipt.returned)} <small>件</small></span><i aria-hidden="true"/></header>
            {!haul.length ? <p className="ledger-haul__empty">暂无道具收获</p> : (() => {
              const list = <ul data-count={haul.length} data-paged={paged ? "" : undefined} aria-label="带回道具" style={paged ? { "--offset": stops[shelfPage] } as CSSProperties : undefined}>
                {haul.map((stack, index) => <li key={stack.itemId} className="abyssa-rarity" data-rarity={catalog[stack.itemId]?.rarity ?? "unknown"} style={{ "--i": paged ? index % PER_PAGE : index } as CSSProperties}
                  inert={paged && (index < stops[shelfPage] || index >= stops[shelfPage] + PER_PAGE) || undefined}
                  aria-hidden={paged && (index < stops[shelfPage] || index >= stops[shelfPage] + PER_PAGE) || undefined}>
                  <LedgerItem stack={stack} item={catalog[stack.itemId]} hover={hover}/>
                </li>)}
              </ul>;
              if (!paged) return list;
              return <>
                <div ref={shelf} className="ledger-haul__shelf">
                  <ArrowButton direction="left" label="上一页收获" size="sm" shape="diamond" watermark={false} className="ledger-haul__arrow" data-dir="left" disabled={shelfPage === 0} onClick={() => turn(-1)}/>
                  <div className="ledger-haul__window">{list}</div>
                  <ArrowButton direction="right" label="下一页收获" size="sm" shape="diamond" watermark={false} className="ledger-haul__arrow" data-dir="right" disabled={shelfPage === stops.length - 1} onClick={() => turn(1)}/>
                </div>
                <p className="ledger-haul__pips" aria-hidden="true">{stops.map((stop, index) => <i key={stop} data-on={index === shelfPage ? "" : undefined}/>)}</p>
              </>;
            })()}
          </section>
          {(!!receipt.questReturned?.items.length || !!receipt.questLost?.items.length || losses.length > 0) && <div className="ledger-loss">
            {!!receipt.questReturned?.items.length && <section className="ledger-loss__items" data-tone="quest" aria-label="带回委托物品">
              <strong>委托物品 · 待交付</strong>
              {receipt.questReturned.items.map(stack => <span key={stack.itemId}>{catalog[stack.itemId]?.name ?? stack.itemId} <small>×</small>{stack.quantity}</span>)}
              <small>返回洋馆后交给委托人。</small>
            </section>}
            {!!receipt.questLost?.items.length && <section className="ledger-loss__items" aria-label="遗失委托物品">
              <strong>委托物品遗失</strong>
              <span>{receipt.questLost.items.map(stack => catalog[stack.itemId]?.name ?? stack.itemId).join("、")}未能带回。向委托人反馈后可再次出征。</span>
            </section>}
            {losses.length > 0 && <section className="ledger-loss__record" aria-label="遗失记录">
              {losses.map(group => <p className="ledger-loss__items" key={group.label}>
                <strong>{group.label}</strong>
                {group.pocket.copper > 0 && <span className="ledger-loss__gold"><CurrencyAmount value={group.pocket.copper} currency="lira"/></span>}
                {group.pocket.items.map(stack => <span key={stack.itemId}>{catalog[stack.itemId]?.name ?? stack.itemId} <small>×</small>{stack.quantity}</span>)}
              </p>)}
            </section>}
          </div>}
        </div>
        {detailOpen && <div className="ledger-page__detail">
          {!!rows?.length && <section className="ledger-rows" aria-label="逐层账目">
            <header className="ledger-detail-head"><i aria-hidden="true"/><h3>逐层账目</h3><i aria-hidden="true"/></header>
            <table>
              <thead><tr><th scope="col">层</th><th scope="col">区域</th><th scope="col">散金</th><th scope="col">加成</th><th scope="col">倍率</th><th scope="col">入账</th></tr></thead>
              <tbody>{rows.map(row => <tr key={row.layer} data-lost={row.gold === undefined || undefined}>
                <th scope="row">{ROMAN[row.layer - 1] ?? row.layer}</th>
                <td>{row.room ?? "—"}</td>
                <td>{row.looseGold}</td>
                <td>{row.bonusPercent === undefined ? "—" : `+${(row.bonusPercent / 100).toFixed(2)}`}</td>
                <td>{row.multiplier === undefined ? "—" : `×${row.multiplier.toFixed(2)}`}</td>
                <td>{row.gold === undefined ? "遗失" : row.gold}</td>
              </tr>)}</tbody>
            </table>
          </section>}
          {!!party?.length && <section className="ledger-party" aria-label="归来状态">
            <header className="ledger-detail-head"><i aria-hidden="true"/><h3>归来状态</h3><i aria-hidden="true"/></header>
            <ul>{party.map(member => <li key={member.id} data-tag={member.tag}>
              <AvatarFrame src={member.avatar} fallback={member.name.slice(0, 1)} data-kind={member.id}/>
              <strong>{member.name}</strong>
              <span className="abyssa-expedition-party-card__hearts" aria-label={`生命 ${member.hp} / ${member.maxHp}`}>
                {Array.from({ length: member.maxHp }, (_, slot) => <i key={slot} data-filled={slot < member.hp || undefined}/>)}
              </span>
              <small>{LEDGER_PARTY_TAGS[member.tag]}</small>
            </li>)}</ul>
          </section>}
          {groups.length > 0 && <section className="ledger-supplies" aria-label="剩余战备">
            <header className="ledger-detail-head"><i aria-hidden="true"/><h3>剩余战备</h3><i aria-hidden="true"/></header>
            <div className="ledger-supplies__groups">{groups.map(group => <ul key={group.label} aria-label={groups.length > 1 ? group.label : "带回战备"}>
              {group.pocket.items.map(stack => <li key={stack.itemId} data-spent={stack.quantity === 0 || undefined}>
                <LedgerItem stack={stack} item={catalog[stack.itemId]} hover={hover} supply/>
              </li>)}
            </ul>)}</div>
          </section>}
        </div>}
      </div>
      <footer className="ledger-foot">
        {error && <p role="alert">{error}</p>}
        <div className="ledger-foot__actions">
          {hasDetail && <DiceActionButton label={detailOpen ? "返回总览" : "账目明细"} disabled={busy} onClick={toggleDetail}/>}
          <DiceActionButton ref={confirmRef} label={busy ? "正在入账" : error ? "重试结算" : confirmLabel} primary disabled={busy} onClick={onConfirm}/>
          {onReview && <DiceActionButton label="回顾落幕" disabled={busy} onClick={onReview}/>}
        </div>
      </footer>
    </div>
    {hover.active && activeItem && activeStack && <LootHoverDetail id={hover.tooltipId} item={activeItem} quantity={activeStack.quantity} anchor={hover.active.anchor} onClose={hover.close} onEnter={hover.keep} onLeave={hover.leave}/>}
  </section>;
}
