import { useMoney } from "../../shared/ui/primitives/Money";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CurrencyAmount } from "../../shared/ui/primitives/CurrencyAmount";
import { IconButton } from "../../shared/ui/primitives/IconButton";
import { ItemSlotStatic } from "../../shared/ui/primitives/ItemSlot";
import { DEFAULT_ITEM_RARITY } from "../../shared/ui/items/rarity";
import { RpgFrame } from "../../shared/ui/primitives/RpgFrame";
import { RpgNotchedPillButton } from "../../shared/ui/primitives/RpgNotchedPillButton";
import { UiContentTransition } from "../../shared/ui/motion/UiContentTransition";
import { ShopStockHeader, ShopColumnWells, SHOP_PAGE_SIZE } from "./ShopStockHeader";
import { supplyPurchase, type ShopSupply } from "./shop-counter-model";
import type { ShopDialogueLine } from "../../content/presentation/shop-dialogue";

export type ShopTradeItem = Omit<ShopSupply, "capacity"> & {capacity?: number; successLine?: ShopDialogueLine};
export type ShopTradeReceipt = {item: ShopTradeItem; quantity: number; total: number; recovered?: boolean};

function TradeHelp({ id, text, tone, autoOpen, mode }: { mode: "buy" | "sell"; id: string; text: string; tone: string; autoOpen: boolean }) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  // Only actionable errors open here; success uses the shared scene notice.
  useEffect(() => setOpen(autoOpen), [autoOpen, text]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!host.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return <div className="shop-counter__help" ref={host}
    onMouseEnter={() => setOpen(true)}
    onMouseLeave={() => { if (!host.current?.contains(document.activeElement)) setOpen(false); }}
    onFocus={() => setOpen(true)}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button className="shop-counter__help-trigger" type="button" aria-label={mode === "buy" ? "查看购买说明" : "查看出售说明"}
      aria-expanded={open} aria-controls={id} onClick={() => setOpen(true)}>?</button>
    <p className="shop-counter__notice" id={id} role="status" aria-live="polite" aria-atomic="true" data-tone={tone} hidden={!open}>{text}</p>
  </div>;
}

/** Buying and selling use the same list, selection, detail and checkout. */
export function ShopTradePanel({mode, products, funds, busy, available, panelId, tabId, confirmedSales = [],
  emptyAction, onTrade, onPending, onSuccess}: {
  mode: "buy" | "sell"; products: ShopTradeItem[]; funds: number; busy: boolean; available: boolean;
  panelId: string; tabId: string; confirmedSales?: string[]; emptyAction?: ReactNode;
  onTrade: (id: string, quantity: number) => Promise<string | null>;
  onPending: (pending: boolean) => void; onSuccess: (receipt: ShopTradeReceipt) => void;
}) {
  const selling = mode === "sell";
  const [selectedId, setSelectedId] = useState(products[0]?.id);
  const [requested, setRequested] = useState(1);
  const [pending, setPending] = useState(false), [error, setError] = useState<string>();
  const inFlight = useRef(false), rows = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  const emptyHeading = useRef<HTMLHeadingElement>(null), focusAfterSale = useRef(false);
  const uncertain = useRef<ShopTradeReceipt | null>(null);
  const uid = useId();
  const selectedIndex = Math.max(0, products.findIndex(product => product.id === selectedId));
  const item = products[selectedIndex];
  const page = Math.floor(selectedIndex / SHOP_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(products.length / SHOP_PAGE_SIZE));
  const pageStart = page * SHOP_PAGE_SIZE;
  const visibleProducts = products.slice(pageStart, pageStart + SHOP_PAGE_SIZE);
  const quantity = item ? Math.min(item.owned, Math.max(1, Math.floor(requested))) : 0;
  const quote = !item ? null : selling
    ? {remaining: item.owned, quantity, total: item.price * quantity, shortfall: 0, after: item.owned - quantity}
    : supplyPurchase(item as ShopSupply, funds, requested);
  const working = pending || busy;
  const disabled = working || !available || !quote || quote.remaining === 0 || quote.shortfall > 0;
  const money = useMoney();
  const action = !available ? selling ? "暂不可出售" : "暂不可购买"
    : working ? selling ? "正在确认" : "正在装袋" : !quote ? "暂无商品" : quote.remaining === 0 ? "已备足" : quote.shortfall > 0 ? "银钱不足" : selling ? "出 售" : "购 买";
  const guidance = !available ? selling ? "请先结束当前旅程或剧情，再来出售物品。" : "请先结束当前旅程或剧情，再来补充物资。"
    : !quote ? "货架暂时空着，稍后再来看看。"
    : working ? "正在确认交易，请稍候。"
    : quote.remaining === 0 ? "这份补给已经备足，无需重复购买。"
    : quote.shortfall > 0 ? `小队资金还差 ${money.format(quote.shortfall)}，可减少数量或稍后再来。`
    : selling ? "出售所选物品，款项直接计入小队资金。" : "每份补充 1 次充能 · 出征前请将物资加入行囊。";

  useEffect(() => () => onPending(false), [onPending]);
  useEffect(() => {
    if (!selling || working) return;
    const removed = selectedId && !products.some(p => p.id === selectedId);
    if (!removed && !focusAfterSale.current) return;
    focusAfterSale.current = false;
    if (removed) setSelectedId(item?.id);
    (rows.current.get(item?.id ?? "") ?? emptyHeading.current)?.focus({preventScroll: true});
  }, [selling, working, item?.id, products, selectedId]);
  useEffect(() => {
    if (!pendingFocus.current) return;
    rows.current.get(pendingFocus.current)?.focus({preventScroll: true});
    pendingFocus.current = null;
  }, [item?.id, page, working]);
  useEffect(() => {
    const attempt = uncertain.current;
    if (working || !attempt || !confirmedSales.includes(attempt.item.id)) return;
    uncertain.current = null;
    focusAfterSale.current = true;
    setError(undefined);
    onSuccess({...attempt, recovered: true});
    (rows.current.get(item?.id ?? "") ?? emptyHeading.current)?.focus({preventScroll: true});
  }, [working, confirmedSales, item?.id, onSuccess]);

  function select(id: string) {
    if (working || id === item?.id) return;
    setSelectedId(id); setRequested(1); setError(undefined);
  }
  function focusProduct(index: number) {
    if (working || !products[index]) return;
    const id = products[index].id;
    const mounted = rows.current.get(id);
    if (mounted) mounted.focus({preventScroll: true}); else pendingFocus.current = id;
    select(id);
  }
  function changePage(direction: -1 | 1) {
    const next = Math.max(0, Math.min(pageCount - 1, page + direction));
    if (next !== page) focusProduct(next * SHOP_PAGE_SIZE);
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "Home" ? 0 : event.key === "End" ? products.length - 1
      : event.key === "ArrowDown" ? Math.min(products.length - 1, index + 1)
      : event.key === "ArrowUp" ? Math.max(0, index - 1)
      : event.key === "PageDown" ? Math.min(products.length - 1, index + SHOP_PAGE_SIZE)
      : event.key === "PageUp" ? Math.max(0, index - SHOP_PAGE_SIZE) : null;
    if (next === null || working) return;
    event.preventDefault(); focusProduct(next);
  }
  async function transact() {
    if (disabled || !item || !quote || inFlight.current) return;
    inFlight.current = true; setPending(true); onPending(true); setError(undefined);
    if (selling) uncertain.current = {item, total: quote.total, quantity: quote.quantity};
    try {
      const failure = await onTrade(item.id, quote.quantity);
      if (failure) setError(failure);
      else {
        uncertain.current = null;
        focusAfterSale.current = selling;
        setRequested(1);
        onSuccess({item, quantity: quote.quantity, total: quote.total});
      }
    } catch { setError("交易未能确认，请检查库存和余额后重试。"); }
    finally { inFlight.current = false; setPending(false); onPending(false); }
  }
  return (
    <div className="shop-counter__ledger" data-empty={!item || undefined} id={panelId} role="tabpanel" aria-labelledby={tabId}>
          <RpgFrame className="shop-counter__stock-frame" padding="none" watermark={false}>
          <section className="shop-counter__stock" aria-label={selling ? "回收柜台" : "补给货架"}>
            <ShopStockHeader title={selling ? "可售物品" : "在售物资"} count={products.length}
              page={page} pageCount={pageCount} busy={working} listId={`${uid}-stock-list`}
              ownedLabel={selling ? "持有" : "持有 / 上限"} priceLabel="单价" onPage={changePage}/>
            <div className="shop-counter__stock-well">
            {!!products.length && <ShopColumnWells/>}
            {products.length ? <div className="shop-counter__list" id={`${uid}-stock-list`} role="listbox" aria-label={selling ? "可出售物品" : "商品列表"} aria-busy={working}>
              {visibleProducts.map((entry, index) => {
                const full = !selling && entry.owned >= entry.capacity!;
                return <button key={entry.id} type="button" role="option" className="shop-counter__item"
                  ref={node => { if (node) rows.current.set(entry.id, node); else rows.current.delete(entry.id); }}
                  tabIndex={entry.id === item?.id ? 0 : -1} aria-selected={entry.id === item?.id}
                  aria-posinset={pageStart + index + 1} aria-setsize={products.length}
                  aria-controls={`${uid}-detail`} data-full={full || undefined} disabled={working}
                  aria-description={entry.description}
                  onClick={() => select(entry.id)} onKeyDown={event => navigate(event, pageStart + index)}>
                  <ItemSlotStatic icon={entry.iconUrl} name={entry.name} rarity={DEFAULT_ITEM_RARITY} showRarity={false}
                    size={42} className="shop-counter__stock-slot" data-selected={entry.id === item?.id || undefined} aria-hidden="true" />
                  <span className="shop-counter__item-name"><strong>{entry.name}</strong></span>
                  <span className="shop-counter__owned" aria-label={selling ? `持有 ${entry.owned} 件` : `持有 ${entry.owned}，上限 ${entry.capacity}${full ? "，已备足" : ""}`}><b>{entry.owned}</b>{!selling && <span> / {entry.capacity}</span>}</span>
                  <span className="shop-counter__price" data-short={!selling && funds < entry.price && !full || undefined}><CurrencyAmount value={entry.price} currency="gold" /></span>
                </button>;
              })}
            </div> : <div className="shop-counter__stock-empty" id={`${uid}-stock-list`}>
              <h2 ref={emptyHeading} tabIndex={-1}>{selling ? "暂无可出售物品" : "暂无在售补给"}</h2>
              {emptyAction ?? <p>{selling ? "带回的物品鉴定后，可在这里出售。" : "货架暂时空着，稍后再来看看。"}</p>}
              {error && <p role="alert">{error}</p>}
            </div>}
            </div>
          </section>
          </RpgFrame>
          {item && quote && <RpgFrame className="shop-counter__detail-frame" padding="none" watermark={false}>
            <section className="shop-counter__detail" id={`${uid}-detail`} aria-label={selling ? "商品详情与出售" : "商品详情与购买"}>
                <UiContentTransition className="shop-counter__description" contentKey={item.id}>
                  <div className="shop-counter__detail-emblem">
                    <ItemSlotStatic icon={item.iconUrl} name={item.name} rarity={DEFAULT_ITEM_RARITY} showRarity={false}
                      size={84} className="shop-counter__detail-slot" />
                  </div>
                  <div className="shop-counter__detail-copy">
                    <div className="shop-counter__detail-heading">
                      <h2>{item.name}</h2>
                      <div className="shop-counter__capacity" role="group" aria-label="库存预览">
                        <span>持有</span><b>{item.owned}{!selling && ` / ${item.capacity}`}</b>
                        {quote.remaining ? <>
                          <span className="shop-counter__capacity-arrow" aria-hidden="true">→</span>
                          <output aria-label={selling ? "出售后库存" : "补充后库存"} title={selling ? "出售后库存" : "补充后库存"}>{quote.after}{!selling && ` / ${item.capacity}`}</output>
                        </> : <span className="shop-counter__capacity-full">已备足</span>}
                      </div>
                    </div>
                    <p>{item.description}</p>
                  </div>
                </UiContentTransition>
                <div className="shop-counter__checkout">
                  <div className="shop-counter__quantity">
                    <span>数量</span>
                    <div>
                      <IconButton label="减少数量" icon="minus" size="sm" variant="dark" disabled={working || !available || quote.quantity <= 1} onClick={() => { setRequested(quote.quantity - 1); setError(undefined); }} />
                      <output aria-label={selling ? "出售数量" : "补充数量"}>{quote.quantity}</output>
                      <IconButton label="增加数量" icon="plus" size="sm" variant="teal" disabled={working || !available || quote.quantity >= quote.remaining} onClick={() => { setRequested(quote.quantity + 1); setError(undefined); }} />
                    </div>
                  </div>
                  <div className="shop-counter__total" data-short={quote.shortfall > 0 || undefined}>
                    <span>{selling ? "收入" : "合计"}</span>
                    <CurrencyAmount value={quote.total} currency="gold" />
                  </div>
                  <div className="shop-counter__purchase-area">
                    <RpgNotchedPillButton className="shop-counter__purchase" label={action} variant="teal" disabled={disabled} aria-describedby={`${uid}-purchase-note`} onClick={transact} />
                    <TradeHelp mode={mode} id={`${uid}-purchase-note`} text={error ?? guidance}
                      tone={error || quote.shortfall ? "error" : "hint"} autoOpen={!!error} />
                  </div>
                </div>
            </section>
          </RpgFrame>}
        </div>
  );
}
