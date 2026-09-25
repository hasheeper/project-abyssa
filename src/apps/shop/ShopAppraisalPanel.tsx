import { useMoney } from "../../shared/ui/primitives/Money";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { RpgFrame } from "../../shared/ui/primitives/RpgFrame";
import { shopDialogue } from "../../content/presentation/shop-dialogue";
import { ItemSlotStatic } from "../../shared/ui/primitives/ItemSlot";
import { CurrencyAmount } from "../../shared/ui/primitives/CurrencyAmount";
import { RpgNotchedPillButton } from "../../shared/ui/primitives/RpgNotchedPillButton";
import { UiContentTransition } from "../../shared/ui/motion/UiContentTransition";
import type { ShopLootInventory, ShopMode } from "./shop-loot-model";
import { ShopStockHeader, ShopColumnWells, SHOP_PAGE_SIZE } from "./ShopStockHeader";
import { ShopMerchantDialogue } from "./ShopMerchantDialogue";
import "./shop-loot.css";

export function ShopAppraisalPanel({loot, funds, busy, available, panelId, tabId, dialogueHost, portraitHost, dialogueReady, onAppraise, onMode, onPending}: {
  loot: ShopLootInventory; funds: number; busy: boolean; available: boolean;
  panelId: string; tabId: string; dialogueHost: HTMLDivElement | null;
  portraitHost: HTMLDivElement | null; dialogueReady: boolean;
  onAppraise: (id: string) => Promise<string | null>;
  onMode: (mode: ShopMode) => void; onPending: (pending: boolean) => void;
}) {
  const rows = loot.items.filter(i => !i.resultId);
  const [selection, setSelection] = useState<string>();
  const [cursor, setCursor] = useState<string>();
  const [resultId, setResultId] = useState<string>();
  const [beat, setBeat] = useState(0), [kept, setKept] = useState(false), [replaying, setReplaying] = useState(false);
  const [pending, setPending] = useState(false), [notice, setNotice] = useState<{text: string; error?: boolean}>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dialogueTurn, setDialogueTurn] = useState(0);
  const inFlight = useRef(false), list = useRef<HTMLDivElement>(null);
  const resultActions = useRef<HTMLDivElement>(null), restoreFocus = useRef(false);
  const detailHeading = useRef<HTMLHeadingElement>(null), openFocus = useRef(false), listFocus = useRef(false);
  const returnIndex = useRef(0);
  const nextLine = useRef<HTMLButtonElement>(null), history = useRef<HTMLDivElement>(null), historyButton = useRef<HTMLButtonElement>(null);
  const uncertain = useRef<{instanceId: string; price: number} | null>(null);
  const statusId = useId();
  const appraisals = loot.history.filter(t => t.kind === "appraise");
  const activeId = resultId ?? selection;
  const item = activeId ? loot.items.find(i => i.instanceId === activeId) ?? appraisals.find(t => t.item.instanceId === activeId)?.item : undefined;
  const focusedRow = rows.find(i => i.instanceId === cursor) ?? rows[Math.min(returnIndex.current, rows.length - 1)];
  const page = Math.floor(Math.max(0, rows.findIndex(row => row.instanceId === focusedRow?.instanceId)) / SHOP_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(rows.length / SHOP_PAGE_SIZE));
  const pageStart = page * SHOP_PAGE_SIZE;
  const visibleRows = rows.slice(pageStart, pageStart + SHOP_PAGE_SIZE);
  const owned = !!item && loot.items.some(i => i.instanceId === item.instanceId);
  const identified = !!item?.resultId;
  const sold = !!item && loot.history.some(t => t.kind === "sell" && t.item.instanceId === item.instanceId);
  const price = item?.appraisalFee ?? 0;
  const short = !identified ? Math.max(0, price - funds) : 0;
  const working = busy || pending;
  const actionable = !!item && owned && !identified;
  const money = useMoney();
  const reason = !available ? "请先结束当前旅程或剧情。" : short ? `小队资金还差 ${money.format(short)}，可以稍后再来。` : undefined;
  const canListen = identified && (!sold || replaying) && !kept;
  const line = !item ? shopDialogue.appraise
    : sold && !replaying ? item.sold : kept ? item.kept : identified ? item.appraisal[Math.min(beat, item.appraisal.length - 1)] : item.teaser;
  const lineKey = `${activeId ?? "welcome"}:${sold && !replaying ? "sold" : kept ? "kept" : identified ? `appraisal:${beat}` : "teaser"}:${dialogueTurn}`;
  useEffect(() => () => onPending(false), [onPending]);
  useEffect(() => {
    if (!historyOpen) return;
    const outside = (event: PointerEvent) => { if (!history.current?.contains(event.target as Node)) setHistoryOpen(false); };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault(); setHistoryOpen(false); historyButton.current?.focus({preventScroll: true});
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape);};
  }, [historyOpen]);
  useEffect(() => {
    const attempt = uncertain.current;
    if (working || !attempt || !loot.history.some(t => t.kind === "appraise" && t.item.instanceId === attempt.instanceId)) return;
    // A restored request can succeed after the original callback reported an
    // uncertain write. Replace that stale notice from the committed history.
    uncertain.current = null; restoreFocus.current = true;
    setResultId(attempt.instanceId); setBeat(0); setKept(false); setReplaying(false);
    setNotice({text: `鉴定已确认，支付 ${money.format(attempt.price)}。`});
  }, [working, loot.history]);
  useEffect(() => {
    if (working || !restoreFocus.current) return;
    const target = canListen ? nextLine.current : resultActions.current?.querySelector<HTMLButtonElement>("button[data-result-action]");
    if (!target || target.disabled) return;
    restoreFocus.current = false;
    target.focus({preventScroll: true});
  }, [working, notice, dialogueHost, canListen]);
  useEffect(() => {
    if (item && openFocus.current && detailHeading.current) {
      openFocus.current = false; detailHeading.current.focus({preventScroll: true});
    }
    if (!item && listFocus.current) {
      listFocus.current = false;
      const row = [...list.current?.querySelectorAll<HTMLButtonElement>("[data-id]") ?? []].find(row => row.dataset.id === focusedRow?.instanceId);
      if (row) focusRow(row);
      else historyButton.current?.focus({preventScroll: true});
    }
  }, [item, focusedRow]);
  function focusRow(row: HTMLButtonElement) {
    row.focus({preventScroll: true});
    const container = list.current;
    if (!container) return;
    if (row.offsetTop < container.scrollTop) container.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > container.scrollTop + container.clientHeight) container.scrollTop = row.offsetTop + row.offsetHeight - container.clientHeight;
  }
  function openItem(id: string) {
    if (working) return;
    returnIndex.current = Math.max(0, rows.findIndex(row => row.instanceId === id));
    openFocus.current = true; setCursor(id); setHistoryOpen(false); setDialogueTurn(turn => turn + 1);
    setSelection(id); setResultId(undefined); setBeat(0); setKept(false); setReplaying(false); setNotice(undefined);
  }
  function returnToList() {
    if (working) return;
    listFocus.current = true; restoreFocus.current = false;
    setSelection(undefined); setResultId(undefined); setHistoryOpen(false); setBeat(0); setKept(false); setReplaying(false); setNotice(undefined); setDialogueTurn(turn => turn + 1);
  }
  function navigate(event: KeyboardEvent, index: number) {
    const next = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : ["ArrowDown", "ArrowRight"].includes(event.key) ? index + 1 : ["ArrowUp", "ArrowLeft"].includes(event.key) ? index - 1 : event.key === "PageDown" ? index + 7 : event.key === "PageUp" ? index - 7 : null;
    if (next === null || working) return;
    event.preventDefault();
    focusIndex(Math.max(0, Math.min(rows.length - 1, next)));
  }
  function focusIndex(index: number) {
    const id = rows[index]?.instanceId;
    if (!id || working) return;
    const row = [...list.current?.querySelectorAll<HTMLButtonElement>("[data-id]") ?? []].find(row => row.dataset.id === id);
    if (row) focusRow(row); else listFocus.current = true;
    setCursor(id);
  }
  function changePage(direction: -1 | 1) {
    const next = Math.max(0, Math.min(pageCount - 1, page + direction));
    if (next !== page) focusIndex(next * SHOP_PAGE_SIZE);
  }
  async function transact() {
    if (!actionable || !item || reason || working || inFlight.current) return;
    inFlight.current = true; setPending(true); onPending(true); setNotice(undefined);
    uncertain.current = {instanceId: item.instanceId, price};
    try {
      const error = await onAppraise(item.instanceId);
      if (error) setNotice({text: error, error: true});
      else {
        uncertain.current = null;
        restoreFocus.current = true;
        setResultId(item.instanceId); setBeat(0); setKept(false); setReplaying(false);
        setNotice({text: `鉴定完成，支付 ${money.format(price)}。`});
      }
    } catch { setNotice({text: "交易未能确认，请重新读取进度后重试。", error: true}); }
    finally { inFlight.current = false; setPending(false); onPending(false); }
  }
  const historyControl = !!appraisals.length && <div className="shop-loot__history" ref={history}>
    <button type="button" className="shop-loot__quiet" ref={historyButton} disabled={working}
      aria-expanded={historyOpen} aria-controls={`${statusId}-history`} onClick={() => setHistoryOpen(value => !value)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5c3.5-1 5.5 0 8 1.5 2.5-1.5 4.5-2.5 8-1.5v15c-3.5-1-5.5 0-8 1.5-2.5-1.5-4.5-2.5-8-1.5Z M12 6v15"/></svg>
      鉴定记录
    </button>
    {historyOpen && <div className="shop-loot__records" id={`${statusId}-history`} role="region" aria-label="鉴定记录">
      <p>免费重看</p>
      {[...appraisals].reverse().map(t => <button type="button" key={t.id} disabled={working} onClick={() => {
        restoreFocus.current = true; setResultId(t.item.instanceId); setBeat(0); setKept(false); setReplaying(true);
        setDialogueTurn(turn => turn + 1);
        setNotice({text: `重看${t.item.name}的鉴定，不收取费用。`}); setHistoryOpen(false);
      }}>
        <span>{t.item.name}</span>
        {loot.history.some(h => h.kind === "sell" && h.item.instanceId === t.item.instanceId) && <small>已出售</small>}
      </button>)}
    </div>}
  </div>;
  return <>
    <div className="shop-loot" role="tabpanel" id={panelId} aria-labelledby={tabId}>
      <RpgFrame className="shop-counter__stock-frame shop-loot__frame" padding="none" watermark={false}>
        <section className="shop-loot__counter" data-view={item ? "detail" : "list"} aria-label="战利品与交易">
          {item && <header className="shop-loot__tools">
            <button type="button" className="shop-loot__quiet shop-loot__back" disabled={working} onClick={returnToList}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 3-5 5 5 5"/></svg>返回列表
            </button>
            {historyControl}
          </header>}
          {item ? <>
            <div className="shop-counter__well shop-loot__detail-well">
            <UiContentTransition className="shop-loot__object" contentKey={`${item.instanceId}:${identified}`}>
              <ItemSlotStatic className="shop-counter__detail-slot shop-loot__emblem" icon={item.iconUrl} name={identified ? item.name : item.unknownName} size={156} showRarity={false}/>
              <div className="shop-loot__copy">
                {sold && <span className="shop-loot__sold">已出售</span>}
                <h2 ref={detailHeading} tabIndex={-1}>{identified ? item.name : item.unknownName}</h2>
                {owned && <span className="shop-loot__quantity">持有 ×1</span>}
                <p>{identified ? item.description : item.appearance}</p>
              </div>
            </UiContentTransition>
            </div>
            <div className="shop-loot__checkout" ref={resultActions}>
              {(actionable || identified && owned) && <div className="shop-counter__total">
                <span>{!identified ? "鉴定费" : "回收价"}</span><CurrencyAmount currency="gold" value={identified ? item.salePrice : price}/>
              </div>}
              <div className="shop-loot__decisions">
                {identified && owned && <button type="button" className="shop-loot__quiet" disabled={working} onClick={() => {
                  setKept(true); setNotice({text: "物品已收好。"}); setDialogueTurn(turn => turn + 1);
                }}>收好</button>}
                {actionable ? <RpgNotchedPillButton className="shop-counter__purchase" label={working ? "正在确认" : short ? "银钱不足" : "鉴 定"}
                  disabled={working || !!reason} aria-describedby={reason || notice?.error ? statusId : undefined} onClick={() => void transact()}/>
                  : <RpgNotchedPillButton className="shop-counter__purchase" data-result-action label={identified && owned ? "去出售" : "返回物品列表"}
                    disabled={working} onClick={() => identified && owned ? onMode("sell") : returnToList()}/>}
              </div>
            </div>
          </> : <section className="shop-counter__stock" aria-label="鉴定柜台">
            <ShopStockHeader title="待鉴定物品" count={rows.length} page={page} pageCount={pageCount} busy={working}
              listId={`${statusId}-list`} ownedLabel="持有" priceLabel="鉴定费" actions={historyControl} onPage={changePage}/>
            <div className="shop-counter__stock-well">
              {!!rows.length && <ShopColumnWells/>}
              {rows.length ? <div className="shop-counter__list" id={`${statusId}-list`} ref={list} role="list" aria-label="待鉴定物品" aria-busy={working}>
                {visibleRows.map((entry, index) => <div role="listitem" key={entry.instanceId}>
                  <button type="button" className="shop-counter__item" data-id={entry.instanceId}
                    aria-label={`查看${entry.unknownName}详情`}
                    aria-description={`持有 1 件，鉴定费 ${money.format(entry.appraisalFee)}`}
                    disabled={working} tabIndex={entry.instanceId === focusedRow?.instanceId ? 0 : -1}
                    onClick={() => openItem(entry.instanceId)} onKeyDown={event => navigate(event, pageStart + index)}>
                    <ItemSlotStatic className="shop-counter__stock-slot" icon={entry.iconUrl} name={entry.unknownName} size={42} showRarity={false} aria-hidden="true"/>
                    <span className="shop-counter__item-name"><strong>{entry.unknownName}</strong></span>
                    <span className="shop-counter__owned" aria-label="持有 1 件"><b>1</b></span>
                    <span className="shop-counter__price"><CurrencyAmount currency="gold" value={entry.appraisalFee} label="鉴定费"/></span>
                  </button>
                </div>)}
              </div> : <div className="shop-counter__stock-empty" id={`${statusId}-list`}>
                <h2>暂无待鉴定物品</h2>
                <p>带回看不懂的东西，可以交给缇比鉴定。</p>
              </div>}
            </div>
          </section>}
          <p className="shop-loot__status" id={statusId} role="status" aria-live="polite" data-visible={!!notice?.error || !!reason || undefined}>{notice?.error ? notice.text : reason ?? notice?.text}</p>
        </section>
      </RpgFrame>
    </div>
    {/* Reading controls belong beside Tibby's voice; they never submit a trade. */}
    {dialogueHost && createPortal(<ShopMerchantDialogue line={line} lineKey={lineKey} ready={dialogueReady}
      portraitHost={portraitHost} disabled={working}
      continueLabel={item && beat + 1 < item.appraisal.length ? "继续听" : "再听一遍"}
      onContinue={canListen ? () => {setBeat((beat + 1) % item!.appraisal.length); setDialogueTurn(turn => turn + 1);} : undefined}
      continueRef={node => {
        nextLine.current = node;
        if (node && !node.disabled && !working && restoreFocus.current) {
          restoreFocus.current = false; node.focus({preventScroll: true});
        }
      }}/>, dialogueHost)}
  </>;
}
