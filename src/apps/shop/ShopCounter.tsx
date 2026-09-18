import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import tibbyPortrait from "../../assets/characters/portraits/tibby-shop.png";
import { CurrencyAmount } from "../../shared/ui/primitives/CurrencyAmount";
import { IconButton } from "../../shared/ui/primitives/IconButton";
import { ItemSlotStatic } from "../../shared/ui/primitives/ItemSlot";
import { DEFAULT_ITEM_RARITY } from "../../shared/ui/items/rarity";
import { Nameplate } from "../../shared/ui/primitives/Nameplate";
import { RpgDialogue } from "../../shared/ui/primitives/RpgDialogue";
import { RpgFrame } from "../../shared/ui/primitives/RpgFrame";
import { RpgNotchedPillButton } from "../../shared/ui/primitives/RpgNotchedPillButton";
import { UiContentTransition } from "../../shared/ui/motion/UiContentTransition";
import { ShopFrame } from "./ShopFrame";
import { supplyPurchase, type ShopSupply } from "./shop-counter-model";
import { useShopIntro } from "./useShopIntro";
import "./shop-motion.css";
import "../../shared/ui/motion/page-board.css";

export type ShopCounterProps = {
  products: ShopSupply[];
  funds: number;
  crystals: number;
  busy: boolean;
  available: boolean;
  onPurchase: (id: string, quantity: number) => Promise<string | null>;
};
type Receipt = { kind: "success" | "error"; text: string };
const STOCK_PAGE_SIZE = 7;

function PurchaseHelp({ id, text, tone, receipt }: { id: string; text: string; tone: string; receipt?: Receipt }) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  // Transaction results open immediately; ordinary guidance stays out of the layout.
  useEffect(() => setOpen(Boolean(receipt)), [receipt, text]);
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
    <button className="shop-counter__help-trigger" type="button" aria-label="查看购买说明"
      aria-expanded={open} aria-controls={id} onClick={() => setOpen(true)}>?</button>
    <p className="shop-counter__notice" id={id} role="status" aria-live="polite" aria-atomic="true" data-tone={tone} hidden={!open}>{text}</p>
  </div>;
}

/** Player-facing stock. Unreleased modes stay disabled; demo transactions remain in ShopView. */
export function ShopCounter({ products, funds, crystals, busy, available, onPurchase }: ShopCounterProps) {
  const intro = useShopIntro();
  const [selectedId, setSelectedId] = useState(products[0]?.id);
  const [requested, setRequested] = useState(1);
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState<Receipt>();
  const inFlight = useRef(false);
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<string | null>(null);
  const uid = useId();
  const selectedIndex = Math.max(0, products.findIndex(product => product.id === selectedId));
  const item = products[selectedIndex];
  // Derive the page from the selection so refreshed/shortened stock cannot
  // leave a hidden selection or a now-empty out-of-range page.
  const page = Math.floor(selectedIndex / STOCK_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(products.length / STOCK_PAGE_SIZE));
  const pageStart = page * STOCK_PAGE_SIZE;
  const visibleProducts = products.slice(pageStart, pageStart + STOCK_PAGE_SIZE);
  const quote = item ? supplyPurchase(item, funds, requested) : null;
  const working = pending || busy;
  const disabled = working || !available || !quote || quote.remaining === 0 || quote.shortfall > 0;
  const action = !available ? "暂不可购买" : working ? "正在装袋" : !quote ? "暂无商品" : quote.remaining === 0 ? "已备足" : quote.shortfall > 0 ? "金币不足" : "购 买";
  const guidance = !available ? "请先结束当前旅程或剧情，再来补充物资。"
    : !quote ? "货架暂时空着，稍后再来看看。"
    : working ? "正在确认交易，请稍候。"
    : quote.remaining === 0 ? "这份补给已经备足，无需重复购买。"
    : quote.shortfall > 0 ? `小队金币还差 ${quote.shortfall}，可减少数量或稍后再来。`
    : "每份补充 1 次充能 · 出征前请将物资加入行囊。";

  useEffect(() => {
    if (!pendingFocus.current) return;
    rows.current.get(pendingFocus.current)?.focus({ preventScroll: true });
    pendingFocus.current = null;
  }, [item?.id, page]);

  function select(id: string) {
    if (working || id === item?.id) return;
    setSelectedId(id); setRequested(1); setReceipt(undefined);
  }
  function focusProduct(index: number) {
    if (working || !products[index]) return;
    const id = products[index].id;
    const mounted = rows.current.get(id);
    if (mounted) mounted.focus({ preventScroll: true });
    else pendingFocus.current = id;
    select(id);
  }
  function changePage(direction: -1 | 1) {
    const next = Math.max(0, Math.min(pageCount - 1, page + direction));
    if (next !== page) focusProduct(next * STOCK_PAGE_SIZE);
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "Home" ? 0 : event.key === "End" ? products.length - 1
      : event.key === "ArrowDown" ? Math.min(products.length - 1, index + 1)
      : event.key === "ArrowUp" ? Math.max(0, index - 1)
      : event.key === "PageDown" ? Math.min(products.length - 1, index + STOCK_PAGE_SIZE)
      : event.key === "PageUp" ? Math.max(0, index - STOCK_PAGE_SIZE) : null;
    if (next === null || working) return;
    event.preventDefault(); focusProduct(next);
  }
  async function purchase() {
    if (disabled || !item || !quote || inFlight.current) return;
    inFlight.current = true; setPending(true); setReceipt(undefined);
    try {
      const error = await onPurchase(item.id, quote.quantity);
      setReceipt(error ? { kind: "error", text: error } : { kind: "success", text: `${item.name}已补充 ${quote.quantity} 次，花费 ${quote.total} 金币。` });
      if (!error) setRequested(1);
    } catch {
      setReceipt({ kind: "error", text: "交易未能确认，请检查库存和余额后重试。" });
    } finally {
      inFlight.current = false; setPending(false);
    }
  }

  return <ShopFrame className="shop-counter-page" intro={intro}>
    <div className="shop-counter" ref={intro.ref}>
      <section className="shop-counter__main" aria-label="交易区">
        <header className="shop-counter__heading">
          <div className="shop-counter__balances" role="group" aria-label="小队资产">
            <div className="shop-counter__purse"><span>小队金币</span><CurrencyAmount value={funds} currency="gold" label={`小队金币余额 ${funds}`} /></div>
            <div className="shop-counter__purse"><span>远古晶石</span><CurrencyAmount value={crystals} currency="crystal" label={`远古晶石余额 ${crystals}`} /></div>
          </div>
        </header>
        <div className="shop-counter__body">
          <div className="shop-counter__modes" role="tablist" aria-label="商店模式">
            <span className="shop-counter__mode">
              <button className="shop-counter__tab" id={`${uid}-buy-tab`} type="button" role="tab" aria-selected="true"
                aria-controls={`${uid}-buy-panel`}><span>购买</span></button>
            </span>
            {([["sell", "出售"], ["appraise", "鉴定"]] as const).map(([mode, label]) =>
              <span className="shop-counter__mode" data-unavailable key={mode} title={`${label}暂未开放`}>
                <button className="shop-counter__tab" type="button" role="tab" aria-selected="false"
                  disabled tabIndex={-1} aria-describedby={`${uid}-${mode}-unavailable`} title={`${label}暂未开放`}><span>{label}</span></button>
                <span id={`${uid}-${mode}-unavailable`} hidden>暂未开放</span>
              </span>
            )}
          </div>
        <div className="shop-counter__ledger" id={`${uid}-buy-panel`} role="tabpanel" aria-labelledby={`${uid}-buy-tab`}>
          <RpgFrame className="shop-counter__stock-frame" padding="none" watermark={false}>
          <section className="shop-counter__stock" aria-label="补给货架">
            <div className="shop-counter__columns">
              <div className="shop-counter__stock-heading">
                <span>在售物资 · {products.length}</span>
                <nav className="shop-counter__pagination" aria-label="商品翻页">
                  <button type="button" className="shop-counter__page-button" disabled={working || page === 0}
                    aria-label="上一页" title="上一页" aria-controls={`${uid}-stock-list`} onClick={() => changePage(-1)}>
                    <svg viewBox="0 0 12 16" aria-hidden="true"><path d="M9 2 3 8l6 6" /></svg>
                  </button>
                  <span className="shop-counter__page-number" role="status" aria-live="polite" aria-label="货架页码"><b>{page + 1}</b><span> / </span>{pageCount}</span>
                  <button type="button" className="shop-counter__page-button" disabled={working || page === pageCount - 1}
                    aria-label="下一页" title="下一页" aria-controls={`${uid}-stock-list`} onClick={() => changePage(1)}>
                    <svg viewBox="0 0 12 16" aria-hidden="true"><path d="m3 2 6 6-6 6" /></svg>
                  </button>
                </nav>
              </div>
              <span>持有 / 上限</span><span>单价</span>
            </div>
            <div className="shop-counter__stock-well">
            <span className="shop-counter__column-wells" aria-hidden="true"><i data-column="owned" /><i data-column="price" /></span>
            <div className="shop-counter__list" id={`${uid}-stock-list`} role="listbox" aria-label="商品列表" aria-busy={working}>
              {visibleProducts.map((entry, index) => {
                const full = entry.owned >= entry.capacity;
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
                  <span className="shop-counter__owned" aria-label={`持有 ${entry.owned}，上限 ${entry.capacity}${full ? "，已备足" : ""}`}><b>{entry.owned}</b><span> / {entry.capacity}</span></span>
                  <span className="shop-counter__price" data-short={funds < entry.price && !full || undefined}><CurrencyAmount value={entry.price} currency="gold" /></span>
                </button>;
              })}
              {!products.length && <p className="shop-counter__empty">货架暂时空着，稍后再来看看。</p>}
            </div>
            </div>
          </section>
          </RpgFrame>
          <RpgFrame className="shop-counter__detail-frame" padding="none" watermark={false}>
            <section className="shop-counter__detail" id={`${uid}-detail`} aria-label="商品详情与购买">
              {item && quote ? <>
                <UiContentTransition className="shop-counter__description" contentKey={item.id}>
                  <div className="shop-counter__detail-emblem">
                    <ItemSlotStatic icon={item.iconUrl} name={item.name} rarity={DEFAULT_ITEM_RARITY} showRarity={false}
                      size={84} className="shop-counter__detail-slot" />
                  </div>
                  <div className="shop-counter__detail-copy">
                    <div className="shop-counter__detail-heading">
                      <h2>{item.name}</h2>
                      <div className="shop-counter__capacity" role="group" aria-label="库存预览">
                        <span>持有</span><b>{item.owned} / {item.capacity}</b>
                        {quote.remaining ? <>
                          <span className="shop-counter__capacity-arrow" aria-hidden="true">→</span>
                          <output aria-label="补充后库存" title="补充后库存">{quote.after} / {item.capacity}</output>
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
                      <IconButton label="减少数量" icon="minus" size="sm" variant="dark" disabled={working || !available || quote.quantity <= 1} onClick={() => { setRequested(quote.quantity - 1); setReceipt(undefined); }} />
                      <output aria-label="补充数量">{quote.quantity}</output>
                      <IconButton label="增加数量" icon="plus" size="sm" variant="teal" disabled={working || !available || quote.quantity >= quote.remaining} onClick={() => { setRequested(quote.quantity + 1); setReceipt(undefined); }} />
                    </div>
                  </div>
                  <div className="shop-counter__total" data-short={quote.shortfall > 0 || undefined}>
                    <span>合计</span>
                    <CurrencyAmount value={quote.total} currency="gold" />
                  </div>
                  <div className="shop-counter__purchase-area">
                    <RpgNotchedPillButton className="shop-counter__purchase" label={action} variant="teal" disabled={disabled} aria-describedby={`${uid}-purchase-note`} onClick={purchase} />
                    <PurchaseHelp id={`${uid}-purchase-note`} text={receipt?.text ?? guidance}
                      tone={receipt?.kind ?? (quote.shortfall ? "error" : "hint")} receipt={receipt} />
                  </div>
                </div>
              </> : <h2>暂无在售补给</h2>}
            </section>
          </RpgFrame>
        </div>
        </div>
      </section>
      <aside className="shop-counter__merchant" aria-label="店主缇比">
        <RpgFrame className="shop-counter__portrait-frame" padding="none">
          <div className="shop-counter__scenery" aria-hidden="true" />
          <div className="shop-counter__portrait"><img src={tibbyPortrait} alt="缇比·奥雷利亚" /></div>
          <div className="shop-counter__portrait-shade" aria-hidden="true" />
        </RpgFrame>
        <Nameplate name="缇比·奥雷利亚" secondaryName="TIBBY AURELIA" />
        <RpgDialogue name="缇比" showNameplate={false} autoHeight
          text={receipt?.kind === "success" ? "收好啦～出发前记得装进行囊，没用完的，下次还能带走哦。" : "想补些什么？食物和治疗药水，洋馆已经替你备好啦。"} />
        <p className="shop-counter__allowance">食物 · 治疗药水　出征时免费配给</p>
      </aside>
    </div>
  </ShopFrame>;
}
