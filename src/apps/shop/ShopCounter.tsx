import { RpgModal } from "../../shared/ui/primitives/RpgModal";
import { EquipmentFacePreview } from "../../game-client/EquipmentFacePreview";
import { useMoney } from "../../shared/ui/primitives/Money";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { shopDialogue, type ShopDialogueLine } from "../../content/presentation/shop-dialogue";
import type { SceneFeedbackEntry } from "../../shared/ui/patterns/SceneFeedback";
import { ShopSurface } from "../../game-client/shop/ShopSurface";
import { TradeDetail } from "../../game-client/shop/TradeDetail";
import type { StockItem } from "../../game-client/shop/StockList";
import { stockCategories, type StockCategory, type StockFilter } from "../../game-client/shop/stock-categories";
import type { ShopSupply } from "./shop-counter-model";
import type { ShopLootInventory, ShopLootItem, ShopMode } from "./shop-loot-model";
import { groupShopLoot } from "./shop-loot-model";
import { ShopAppraisalHistory } from "./ShopAppraisalHistory";
import { useShopVisitEntrance } from "./ShopVisit";
import "../../shared/ui/motion/page-board.css";
import "../../game-client/shop/styles.css";
import "./shop-live.css";

export type ShopCounterProps = {
  products: (ShopSupply & {category?: StockCategory})[];
  loot?: ShopLootInventory;
  initialMode?: ShopMode;
  funds: number; crystals: number; busy: boolean; available: boolean;
  onPurchase: (id: string, quantity: number) => Promise<string | null>;
  onAppraise?: (id: string) => Promise<string | null>;
  onSell?: (id: string, quantity?: number) => Promise<string | null>;
  navigation?: ReactNode; embedded?: boolean;
  scrapPrice?: number;
  guidedPurchase?: {speech: ShopDialogueLine; onFinish: () => void; error?: string | null};
};
const presentLoot = (item: ShopLootItem, owned = true): StockItem => ({
  id: item.instanceId, name: item.resultId ? item.name : item.unknownName,
  description: item.resultId ? item.description : item.appearance,
  rarity: item.resultId ? item.rarity : undefined,
  icon: !item.resultId && item.unknownIconUrl ? item.unknownIconUrl : item.iconUrl, owned: owned ? item.quantity ?? 1 : 0, lotSize: item.quantity ?? 1, identified: !!item.resultId, price: item.appraisalFee, category: item.category ?? "curio",
  priceLabel: item.refused ? "拒收" : undefined,
});
type Receipt = {kind: "sell" | "appraise"; item: ShopLootItem; total: number; quantity: number; rowId: string; soldIds: string[]};

/** Inventory and money are always committed runtime props, never optimistic copies. */
export function ShopCounter({products, loot, funds, crystals, busy, available, onPurchase, onAppraise, onSell,
  initialMode = "buy", navigation, embedded, scrapPrice, guidedPurchase}: ShopCounterProps) {
  const money = useMoney();
  const hasLoot = !!loot && !!onAppraise && !!onSell;
  const entranceProfile = useShopVisitEntrance();
  const [previewItem, setPreviewItem] = useState<StockItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [mode, setMode] = useState<ShopMode>(hasLoot ? initialMode : "buy");
  const [category, setCategory] = useState<StockFilter>("all");
  const [selectedId, setSelectedId] = useState("");
  const [recallId, setRecallId] = useState<string | null>(null);
  const [requested, setRequested] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState<Receipt | null>(null);
  const [awaitingAppraisal, setAwaitingAppraisal] = useState<string | null>(null);
  const [reading, setReading] = useState<{item: ShopLootItem; step: number} | null>(null);
  const [speech, setSpeech] = useState<{line: ShopDialogueLine; turn: number}>({line: shopDialogue[hasLoot ? initialMode : "buy"], turn: 0});
  const [feedback, setFeedback] = useState<SceneFeedbackEntry[]>([]);
  const inFlight = useRef(false), mounted = useRef(true), serial = useRef(0);
  const focusAfterSale = useRef<string | null>(null), scope = useRef<HTMLDivElement>(null);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  const working = busy || pending || !!awaitingAppraisal;
  const appraisals = loot?.history.filter(entry => entry.kind === "appraise") ?? [];
  const groups = groupShopLoot((loot?.items ?? []).filter(item => mode === "appraise" ? item.appraisable !== false : (item.sellable ?? !!item.resultId) || item.refused), mode);
  const modeItems: StockItem[] = mode === "buy" ? products.map(item => ({...item, icon: item.iconUrl, category: item.category ?? "battle"}))
    : groups.map(group => ({...presentLoot(group.item), id: group.id, owned: group.owned, price: mode === "sell" ? group.item.salePrice : group.item.appraisalFee}));
  const offered = new Set<StockCategory>(mode === "buy" ? products.map(item => item.category ?? "battle") : modeItems.map(item => item.category));
  const categories = [{id: "all" as const, label: "全部", count: modeItems.length},
    ...stockCategories.filter(item => offered.has(item.id)).map(item => ({...item, count: modeItems.filter(row => row.category === item.id).length}))];
  const rows = modeItems.filter(item => category === "all" || item.category === category);
  const historical = mode === "appraise" && recallId ? appraisals.find(entry => entry.item.instanceId === recallId)?.item : undefined;
  const selected = historical ? presentLoot(historical, !!loot?.items.some(item => item.instanceId === recallId))
    : rows.find(item => item.id === selectedId) ?? rows[0];
  const selectedGroup = groups.find(group => group.id === selected?.id);
  const curio = mode === "buy" ? undefined : selectedGroup?.item ?? historical;
  const maximum = selected ? mode === "buy" ? (selected.purchaseMaximum ?? Math.max(0, (selected.capacity ?? 0) - selected.owned)) : mode === "sell" ? Math.min(999, selectedGroup?.instanceIds.length ?? 0) : Math.min(1, selected.owned) : 0;
  const quantity = Math.min(maximum, Math.max(1, Math.floor(requested)));
  const total = (selected?.price ?? 0) * (mode === "appraise" ? 1 : quantity) + (mode === "sell" ? curio?.bundleTotal ?? 0 : 0);
  const identified = mode === "appraise" && !!selected?.identified;
  const sold = identified && selected?.owned === 0;
  const short = mode !== "sell" && !identified && total > funds;
  const disabled = working || !available || !selected || !!reading || !!sold || !!curio?.refused || (!identified && (maximum === 0 || short));
  const action = working ? "处理中" : !available ? "暂不可交易" : reading ? "鉴定中" : sold ? "已出售" : identified ? "去出售"
    : curio?.refused ? "拒收" : !selected ? "暂无物品" : maximum === 0 ? selected.delivery === "equipment" ? "售罄" : "已备足" : short ? "银钱不足" : {buy: "购买", sell: "出售", appraise: "鉴定"}[mode];

  function say(line: ShopDialogueLine) {setSpeech(current => ({line, turn: current.turn + 1}));}
  function read(item: ShopLootItem) {
    setSelectedId(item.instanceId);
    if (item.appraisal.length) {setReading({item, step: 0}); say(item.appraisal[0]);}
    else {setReading(null); say(item.kept);}
  }
  function finishReceipt(receipt: Receipt) {
    setError(null);
    if (receipt.kind === "appraise") {
      if (receipt.item.generated) setAwaitingAppraisal(receipt.item.instanceId);
      else read(receipt.item);
    }
    else {
      if (mode === "sell") {
        const index = rows.findIndex(item => item.id === receipt.rowId);
        const remaining = receipt.item.stackable && loot?.items.some(item => item.definitionId === receipt.item.definitionId && item.resultId === receipt.item.resultId && !receipt.soldIds.includes(item.instanceId));
        setSelectedId(remaining ? receipt.rowId : (rows[index + 1] ?? rows[index - 1])?.id ?? "");
      }
      say(receipt.item.sold); focusAfterSale.current = receipt.item.instanceId;
      setFeedback(current => [...current, {id: `shop-sale-${++serial.current}`, kind: "notice", tone: "success",
        message: `已出售${receipt.item.resultId ? receipt.item.name : receipt.item.unknownName}${receipt.quantity > 1 ? ` ×${receipt.quantity}` : ""}，收入 ${money.format(receipt.total)}。`}]);
    }
  }
  // A durable write may be confirmed by the next session refresh after its promise failed.
  useEffect(() => {
    if (busy || pending || !awaitingAppraisal) return;
    const item = loot?.history.find(entry => entry.kind === "appraise" && entry.item.instanceId === awaitingAppraisal)?.item;
    if (!item?.resultId) return;
    // The successful committed receipt is the first projection allowed to reveal the script.
    setAwaitingAppraisal(null); read(item);
  }, [busy, pending, awaitingAppraisal, loot?.history]);
  useEffect(() => {
    if (working || !uncertain || !uncertain.soldIds.every(id => loot?.history.some(entry => entry.kind === uncertain.kind && entry.item.instanceId === id))) return;
    setUncertain(null); finishReceipt(uncertain);
  }, [working, uncertain, loot?.history]);
  useEffect(() => {
    const id = focusAfterSale.current;
    if (working || !id || loot?.items.some(item => item.instanceId === id)) return;
    focusAfterSale.current = null;
    scope.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"], .new-shop-stock__empty h2')?.focus({preventScroll: true});
  }, [working, loot?.items]);

  function switchMode(next: ShopMode) {
    if (working || next !== "buy" && !hasLoot) return;
    setMode(next); setCategory("all"); setSelectedId(""); setRecallId(null); setRequested(1); setReading(null); setError(null); say(shopDialogue[next]);
  }
  function select(item: StockItem) {
    if (working) return;
    setSelectedId(item.id); setRecallId(null); setRequested(1); setReading(null); setError(null);
    const found = groups.find(group => group.id === item.id)?.item;
    if (found?.generated) {say(found.resultId ? found.knownSelection ?? found.kept : mode === "appraise" ? found.teaser : found.offer ?? found.kept); return;}
    if (found) say(found.refused ? found.refusal ?? found.kept : mode === "appraise" ? found.resultId ? found.kept : found.teaser : found.resultId && found.appraisable !== false ? found.appraisal.at(-1) ?? found.kept : found.offer ?? found.kept);
  }
  function keep() {if (working || !curio) return; setReading(null); say(curio.kept);}
  function continueReading() {
    if (working || !reading) return;
    const step = reading.step + 1;
    if (step < reading.item.appraisal.length) {setReading({...reading, step}); say(reading.item.appraisal[step]);}
    else {setReading(null); say(reading.item.kept);}
  }
  async function transact() {
    if (disabled || inFlight.current || !selected) return;
    if (identified) {switchMode("sell"); setSelectedId(groupShopLoot(loot?.items ?? [], "sell").find(group => group.instanceIds.includes(curio!.instanceId))?.id ?? selected.id); return;}
    inFlight.current = true; setPending(true); setError(null);
    const repeated = mode === "appraise" && !curio?.generated && curio?.definitionId && appraisals.some(entry => !entry.item.generated && entry.item.definitionId === curio.definitionId && entry.item.instanceId !== curio.instanceId);
    const receipt: Receipt | null = curio ? {kind: mode === "sell" ? "sell" : "appraise", item: repeated && curio.repeatAppraisal ? {...curio, appraisal: curio.repeatAppraisal} : curio, total, quantity,
      rowId: selected.id, soldIds: mode === "sell" ? selectedGroup!.instanceIds.slice(0, quantity) : [curio.instanceId]} : null;
    try {
      const failure = await (mode === "buy" ? onPurchase(selected.id, quantity) : mode === "sell" ? quantity > 1 ? onSell!(curio!.instanceId, quantity) : onSell!(curio!.instanceId) : onAppraise!(curio!.instanceId));
      if (!mounted.current) return;
      if (failure) {setError(failure); setUncertain(receipt); return;}
      setUncertain(null); setRequested(1);
      if (receipt) finishReceipt(receipt);
      else {
        say(selected.delivery === "equipment" ? shopDialogue.equipmentPurchased : shopDialogue.purchased);
        setFeedback(current => [...current, {id: `shop-purchase-${++serial.current}`, kind: "reward",
          reward: {id: selected.id, kind: "item", name: selected.name, icon: selected.icon, quantity}}]);
      }
    } catch {
      if (mounted.current) {setError("交易未能确认，请稍后重试。"); setUncertain(receipt);}
    } finally {inFlight.current = false; if (mounted.current) setPending(false);}
  }

  return <div ref={scope} className="shop-live">
    <ShopSurface overlay={<RpgModal open={previewOpen} onClose={() => setPreviewOpen(false)} title={`${previewItem?.name ?? "装备"} · 配装预览`}>
      <div className="equipment-editor">{previewItem?.preview && <EquipmentFacePreview key={previewItem.id} preview={previewItem.preview}/>}<p>购买后可在角色页面装备。此处试配不改变当前装备。</p></div>
    </RpgModal>} embedded={embedded} entranceProfile={entranceProfile} mode={mode} category={category} categories={categories}
      rows={rows} selected={selected} funds={funds} crystals={crystals} pendingCount={loot?.items.filter(item => item.appraisable !== false && !item.resultId).length ?? 0}
      busy={working} interactionDisabled={working} disabledModes={guidedPurchase || !hasLoot ? ["sell", "appraise"] : []}
      switchMode={switchMode} changeCategory={next => {if (working) return; setCategory(next); setSelectedId(""); setRecallId(null); setRequested(1); setReading(null); setError(null);}}
      select={select} speech={guidedPurchase ? {line: guidedPurchase.speech, turn: 0} : speech} onContinue={reading ? continueReading : undefined}
      continueLabel={reading && reading.step === reading.item.appraisal.length - 1 ? "收好" : undefined}
      feedback={feedback} onDismiss={id => setFeedback(current => current.filter(entry => entry.id !== id))}
      footer={scrapPrice !== undefined && <p className="shop-live__scrap">未鉴定物按 {scrapPrice} G 收购。</p>}
      navigation={guidedPurchase ? <div className="shop-visit-actions">{guidedPurchase.error && <span role="alert">{guidedPurchase.error}</span>}<button type="button" disabled={working} onClick={guidedPurchase.onFinish}>结束购买</button><span>可以一件不买</span></div> : navigation}
      history={mode === "appraise" && <ShopAppraisalHistory entries={appraisals} busy={working} onSelect={item => {
        setRecallId(item.instanceId); setError(null); read(item);
      }}/>}
      detail={readingAction => <TradeDetail key={`${mode}:${selected?.id}`} item={selected} mode={mode} quantity={quantity} maximum={maximum} total={total}
        onPreview={() => {if (selected) {setPreviewItem(selected); setPreviewOpen(true);}}}
        action={readingAction?.label ?? action} actionLabel={readingAction?.ariaLabel} disabled={readingAction?.disabled ?? disabled}
        busy={working || !available} appraising={!!reading} identified={identified} saleValue={curio?.salePrice} bundleTotal={mode === "sell" ? curio?.bundleTotal : 0}
        normalAppraisalFee={curio?.normalAppraisalFee} appraisalReason={curio?.appraisalReason}
        error={error ?? (!available ? "远征期间无法交易，请返回洋馆后再来。" : null)} onQuantity={setRequested} onAction={readingAction?.onAction ?? (() => void transact())}
        secondaryActions={identified && <div className="shop-live__result-actions">
          {reading ? reading.step < reading.item.appraisal.length - 1 && <button type="button" disabled={working} onClick={keep}>收好</button>
            : <button type="button" disabled={working} onClick={() => curio && read(curio)}>再听一遍</button>}
        </div>}/>} />
  </div>;
}
