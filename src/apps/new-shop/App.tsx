import { useRef, useState } from "react";
import { shopDialogue, type ShopDialogueLine } from "../../content/presentation/shop-dialogue";
import type { SceneFeedbackEntry } from "../../shared/ui/patterns/SceneFeedback";
import type { ShopEntranceProfile } from "../../game-client/shop/entrance";
import { ShopSurface } from "../../game-client/shop/ShopSurface";
import { TradeDetail } from "../../game-client/shop/TradeDetail";
import type { StockItem } from "../../game-client/shop/StockList";
import { stockCategories, type StockFilter } from "../../game-client/shop/stock-categories";
import { initialLoot, initialSupplies, presentLoot, previewLootDefinitions } from "./preview-data";
import type { Mode } from "../../game-client/shop/stock-model";
const modes = [{id: "buy", name: "购买"}, {id: "sell", name: "出售"}, {id: "appraise", name: "鉴定"}] as const;

/** An isolated visual lab. All transactions end at component state. */
export function App({entranceProfile = "standard"}: {entranceProfile?: ShopEntranceProfile}) {
  const [entrance, setEntrance] = useState({cycle: 0, profile: entranceProfile});
  const [mode, setMode] = useState<Mode>("buy");
  const [category, setCategory] = useState<StockFilter>("all");
  const [supplies, setSupplies] = useState(initialSupplies);
  const [loot, setLoot] = useState(initialLoot);
  const [funds, setFunds] = useState(4400);
  const [selectedId, setSelectedId] = useState("ward");
  const [requested, setRequested] = useState(1);
  const [speech, setSpeech] = useState({line: shopDialogue.buy as ShopDialogueLine, turn: 0});
  const [appraisal, setAppraisal] = useState<{id: string; step: number} | null>(null);
  const [feedback, setFeedback] = useState<SceneFeedbackEntry[]>([]);
  const serial = useRef(0);
  const presented = loot.map(presentLoot);
  const modeItems: StockItem[] = mode === "buy" ? supplies : presented.filter(item => mode === "appraise" || item.identified)
    .map(item => ({...item, price: mode === "sell" ? item.value : item.fee}));
  const offeredCategories = new Set((mode === "buy" ? supplies : Object.values(previewLootDefinitions)).map(item => item.category));
  const categories = [
    {id: "all" as const, label: "全部", count: modeItems.length},
    ...stockCategories.filter(entry => offeredCategories.has(entry.id)).map(entry => ({
      ...entry, count: modeItems.filter(item => item.category === entry.id).length,
    })),
  ];
  const rows = modeItems.filter(item => category === "all" || item.category === category);
  const selected = rows.find(item => item.id === selectedId) ?? rows[0];
  const selectedLoot = presented.find(item => item.id === selected?.id);
  const maximum = selected ? mode === "buy" ? Math.max(0, selected.capacity! - selected.owned) : selected.owned : 0;
  const quantity = Math.min(maximum, Math.max(1, requested));
  const total = (selected?.price ?? 0) * (mode === "appraise" ? 1 : quantity);
  const identified = mode === "appraise" && selected?.identified;
  const cannotPay = mode !== "sell" && funds < total;
  const disabled = !selected || !!appraisal || !!identified || maximum === 0 || cannotPay;
  const action = appraisal ? "鉴定中" : identified ? "已鉴定" : !selected ? "暂无物品" : maximum === 0 ? "已备足" : cannotPay ? "银钱不足" : modes.find(item => item.id === mode)!.name;
  const pendingCount = loot.filter(item => !item.identified).length;

  function say(line: ShopDialogueLine) { setSpeech(current => ({line, turn: current.turn + 1})); }
  function notify(entry: Omit<Extract<SceneFeedbackEntry, {kind: "reward"}>, "id">) {
    setFeedback(current => [...current, {...entry, id: `new-shop-${++serial.current}`}]);
  }
  function switchMode(next: Mode) {
    if (appraisal) return;
    setMode(next); setCategory("all"); setSelectedId(""); setRequested(1); say(shopDialogue[next]);
  }
  function changeCategory(next: StockFilter) {
    if (appraisal || category === next) return;
    setCategory(next); setSelectedId(""); setRequested(1);
  }
  function select(item: StockItem) {
    if (appraisal) return;
    setSelectedId(item.id); setRequested(1);
    const curio = presented.find(entry => entry.id === item.id);
    if (mode === "appraise" && curio) say(curio.identified ? curio.kept : curio.teaser);
  }
  function transact() {
    if (disabled || !selected) return;
    if (mode === "buy") {
      setFunds(current => current - total);
      setSupplies(current => current.map(item => item.id === selected.id ? {...item, owned: item.owned + quantity} : item));
      notify({kind: "reward", reward: {id: selected.id, kind: "item", name: selected.name, icon: selected.icon, quantity}});
      say(shopDialogue.purchased);
    } else if (mode === "sell") {
      setFunds(current => current + total); setLoot(current => current.filter(item => item.id !== selected.id));
      notify({kind: "reward", reward: {id: selected.id, kind: "currency", currency: "gold", quantity: total}});
      say(selectedLoot!.sold);
    } else {
      setFunds(current => current - total);
      setSelectedId(selected.id); setAppraisal({id: selected.id, step: 0});
      say(selectedLoot!.appraisal[0]);
    }
    setRequested(1);
  }
  function continueAppraisal() {
    if (!appraisal) return;
    const item = presented.find(entry => entry.id === appraisal.id)!;
    const step = appraisal.step + 1;
    if (step < item.appraisal.length) {
      setAppraisal({...appraisal, step}); say(item.appraisal[step]);
    } else {
      setLoot(current => current.map(entry => entry.id === appraisal.id ? {...entry, identified: true} : entry));
      setAppraisal(null); say(item.kept);
    }
  }
  function reset() {
    setSupplies(initialSupplies()); setLoot(initialLoot()); setFunds(4400); setMode("buy"); setCategory("all"); setSelectedId("ward");
    setRequested(1); setAppraisal(null); setFeedback([]); say(shopDialogue.buy);
  }
  function replay(profile: ShopEntranceProfile) {
    if (appraisal) return;
    setEntrance(current => ({cycle: current.cycle + 1, profile}));
    say(speech.line);
  }

  return <ShopSurface entranceProfile={entrance.profile} entranceCycle={entrance.cycle}
    mode={mode} category={category} categories={categories} rows={rows} selected={selected} funds={funds} crystals={0}
    busy={!!appraisal} pendingCount={pendingCount} switchMode={switchMode} changeCategory={changeCategory} select={select}
    speech={speech} onContinue={appraisal ? continueAppraisal : undefined} feedback={feedback}
    continueLabel={appraisal && appraisal.step === selectedLoot!.appraisal.length - 1 ? "收好" : undefined}
    onDismiss={id => setFeedback(current => current.filter(entry => entry.id !== id))}
    detail={readingAction => <TradeDetail key={`${mode}:${selected?.id}`} item={selected} mode={mode} quantity={quantity} maximum={maximum} total={total}
      action={readingAction?.label ?? (identified ? "去出售" : action)} actionLabel={readingAction?.ariaLabel}
      disabled={readingAction?.disabled ?? (!!appraisal || !identified && disabled)} appraising={!!appraisal} identified={!!identified} saleValue={selectedLoot?.value}
      onQuantity={setRequested} onAction={readingAction?.onAction ?? (identified && selected ? () => {switchMode("sell"); setSelectedId(selected.id);} : transact)} />}
    footer={<div className="new-shop__nav-foot"><span aria-hidden="true">✧</span>
      <button onClick={() => replay("standard")} disabled={!!appraisal} aria-label="重播进场" title="重播进场，保留当前物品和资金">↺<span>重播进场</span></button>
      <div className="new-shop__preview-tools">
        <button onClick={() => replay("handoff")} disabled={!!appraisal}>短衔接</button>
        <button onClick={reset}>重置预览</button>
      </div>
    </div>} />;
}
