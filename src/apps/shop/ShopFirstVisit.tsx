import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { ShopVisitCommand, ShopVisitProgress } from "../../game-core/contracts/shop-visit";
import { SHOP_FIRST_VISIT, firstVisitLines, firstVisitReading, shopVisitAssetsLines, shopVisitDecision, visitSpeech } from "../../content/presentation/shop-first-visit";
import type { AvgPlaybackLine } from "../../shared/domain/avg/playback";
import { StoryReading } from "../../game-client/StoryReading";
import { storyActors, storyAssets } from "../../game-client/story-actors";
import { usePlayerName } from "../../shared/domain/PlayerIdentity";
import type { CharacterEmotionProfile } from "../../shared/domain/presentation/emotion";
import { StoryItemDisplay } from "../../game-client/StoryItemDisplay";
import { storyItem } from "../../game-client/story-items";
import { avgPresentation } from "../../game-client/avg-assets";
import { createMorningSound } from "../../game-client/morning-sound";
import { SceneSequence } from "../../shared/presentation/adv/SceneSequence";
import { ReadingTool } from "../../shared/presentation/adv/ReadingTool";
import { Stage } from "../../shared/stage";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { useSceneTransition } from "../../shared/transition";
import { ShopSurface } from "../../game-client/shop/ShopSurface";
import { TradeDetail } from "../../game-client/shop/TradeDetail";
import { RpgFrame } from "../../shared/ui/primitives/RpgFrame";
import { CurrencyAmount } from "../../shared/ui/primitives/CurrencyAmount";
import { RpgNotchedPillButton } from "../../shared/ui/primitives/RpgNotchedPillButton";
import type { StockItem } from "../../game-client/shop/StockList";
import { ShopCounter, type ShopCounterProps } from "./ShopCounter";
import { ShopVisitEntrance } from "./ShopVisit";
import "../../game-client/shop/styles.css";
import "./shop-visit.css";
import "./shop-live.css";
import "./shop-first-visit.css";

const presentation = avgPresentation(SHOP_FIRST_VISIT);
const assets = [...storyAssets(shopVisitAssetsLines, presentation.background, "kael"), ...shopVisitAssetsLines.flatMap(line => line.itemId ? [storyItem(line.itemId).image] : [])];
const supplies = new Set(["item.ward", "item.holy-water", "item.divination-slip", "item.maintenance-kit", "item.lucky-charm"]);

function BeatEffect({line, live, sound, played}: {line?: AvgPlaybackLine; live: boolean; sound: RefObject<ReturnType<typeof createMorningSound> | null>; played: Set<string>}) {
  useEffect(() => {
    if (!line || !live || document.hidden || !line.sound || played.has(line.id) || !sound.current) return;
    played.add(line.id); return sound.current.play(line.sound);
  }, [line?.id, live, sound, played]);
  return <StoryItemDisplay item={live && line?.itemId ? storyItem(line.itemId) : undefined}/>;
}

function VisitReading({progress, busy, error, advance, onExit}: {
  progress: ShopVisitProgress; busy: boolean; error: string | null;
  advance: (choice?: "continue" | "A" | "B") => Promise<void>; onExit: () => void;
}) {
  const phaseLines = firstVisitLines(progress), {lines, cursor} = firstVisitReading(progress), current = lines[cursor];
  const playerName = usePlayerName();
  const actors = useMemo(() => storyActors(shopVisitAssetsLines, playerName).map(actor => actor.id !== "tibby" || !actor.emotionProfile ? actor : {
    ...actor, emotionProfile: {...actor.emotionProfile, cues: Object.fromEntries(Object.entries(actor.emotionProfile.cues).map(([key, cue]) => [key, {...cue, motion: null, emote: null}])) as CharacterEmotionProfile["cues"]},
  }), [playerName]);
  const sound = useRef<ReturnType<typeof createMorningSound> | null>(null);
  const played = useRef(new Set<string>(progress.step > 0 ? [current.id] : []));
  useEffect(() => () => sound.current?.close(), []);
  const decision = progress.phase === "valuation" && progress.step === phaseLines.length - 1 && shopVisitDecision.kind === "choice" ? shopVisitDecision : null;
  return <StoryReading wide sceneId={SHOP_FIRST_VISIT.id} title={SHOP_FIRST_VISIT.title} location="守望者杂货铺"
    lines={lines} cursor={cursor} actors={actors} offstageActorId="kael" background={presentation.background} busy={busy} error={error}
    choice={decision ? {id: decision.id, prompt: decision.prompt, options: decision.options.filter(option => option.id !== "C") as {id: "A" | "B"; label: string}[]} : null}
    onChoose={advance} onNext={() => advance()} finalLabel={progress.phase === "arrival" ? "前往鉴定" : progress.phase === "reply" ? "查看出售清单" : progress.phase === "purchase" ? "看看补给" : "返回枢纽"}
    controls={<ReadingTool label="保存进度并返回洋馆" caption="BACK" glyph="back" disabled={busy} onClick={onExit}/>}
    onInteraction={() => {sound.current ??= createMorningSound(); sound.current?.unlock();}}
    renderEffect={(id, live) => <BeatEffect line={lines.find(line => line.id === id)} live={live} sound={sound} played={played.current}/>}/>;
}

export function ShopFirstVisit({progress, shopId, quoteVersion, counter, onCommand, onExit}: {
  progress: ShopVisitProgress | null; shopId: string; quoteVersion: number; counter: ShopCounterProps;
  onCommand: (command: ShopVisitCommand) => Promise<void>; onExit: () => void;
}) {
  const transition = useSceneTransition(), entered = useRef(false), pending = useRef(false);
  const [working, setWorking] = useState(false), [error, setError] = useState<string | null>(null);
  const busy = counter.busy || working;
  async function send(command: ShopVisitCommand) {
    if (pending.current || counter.busy) return;
    pending.current = true; setWorking(true); setError(null);
    try {await onCommand(command);}
    catch (failure) {setError(failure instanceof Error ? failure.message : "进度尚未保存，请重试。"); throw failure;}
    finally {pending.current = false; setWorking(false);}
  }
  const begin = () => send({type: "begin-shop-visit", shopId});
  useEffect(() => {if (!progress && !entered.current && !counter.busy) {entered.current = true; void begin().catch(() => {});}}, [progress, counter.busy]);
  const advance = (choice: "continue" | "A" | "B" = "continue") => send({type: "advance-shop-visit", shopId, phase: progress!.phase, step: progress!.step, choice});
  let content;
  if (!progress) content = <div className="shop-visit-loading" role={error ? "alert" : "status"}>{error ?? "正在打开店门…"}{error && <button onClick={() => void begin().catch(() => {})}>重试</button>}<button disabled={busy} onClick={onExit}>返回洋馆</button></div>;
  else if (progress.phase === "buy") content = <ShopCounter {...counter} busy={busy} embedded initialMode="buy"
    products={counter.products.filter(product => supplies.has(product.id.replace(/^product\./, "")))}
    guidedPurchase={{speech: visitSpeech("purchase", 3), error, onFinish: () => void advance().catch(() => {})}}/>;
  else if (progress.phase === "appraise" || progress.phase === "sell") {
    const mode = progress.phase, ids = mode === "appraise" ? [progress.items.nail] : [progress.items.coins, progress.items.token, ...(progress.choice === "A" ? [progress.items.nail] : [])];
    const items = ids.map(id => counter.loot!.items.find(item => item.instanceId === id)).filter(item => !!item);
    const rows: StockItem[] = items.map(item => ({id: item.instanceId, name: item.resultId ? item.name : item.unknownName, icon: item.iconUrl,
      description: item.resultId ? item.description : item.appearance, owned: item.quantity ?? 1, lotSize: item.quantity ?? 1,
      price: mode === "appraise" ? item.appraisalFee : item.salePrice, category: item.category ?? "curio"}));
    const total = rows.reduce((sum, row) => sum + row.price, 0), complete = items.length === ids.length;
    const transact = () => void send({type: mode === "appraise" ? "appraise-shop-visit" : "sell-shop-visit", shopId, quoteVersion}).catch(() => {});
    content = <ShopSurface embedded entranceProfile="handoff" mode={mode} category="all" categories={[{id: "all", label: mode === "appraise" ? "落货查验" : "出售清单", count: rows.length}]}
      rows={rows} selected={rows[0]} funds={counter.funds} crystals={counter.crystals} pendingCount={mode === "appraise" ? 1 : 0}
      busy={busy} interactionDisabled={busy} disabledModes={mode === "appraise" ? ["buy", "sell"] : ["buy", "appraise"]}
      switchMode={() => {}} changeCategory={() => {}} select={() => {}}
      speech={{line: mode === "appraise" ? visitSpeech("arrival", 29) : visitSpeech("valuation", 9), turn: 0}}
      footer={<p className="shop-live__scrap">未鉴定物按 2 G 收购。</p>}
      navigation={<div className="shop-visit-actions"><button disabled={busy} onClick={onExit}>保存进度并返回洋馆</button></div>}
      feedback={[]} onDismiss={() => {}}
      detail={() => mode === "appraise" ? <TradeDetail item={rows[0]} mode="appraise" quantity={1} maximum={1} total={total}
        action={busy ? "处理中" : "鉴定"} disabled={busy || !complete} appraising={false} identified={false} busy={busy} error={error}
        normalAppraisalFee={300} appraisalReason="落货查验" onQuantity={() => {}} onAction={transact}/>
        : <RpgFrame className="new-shop-detail-frame" padding="none" watermark={false}><section className="shop-visit-sale" aria-label="确认出售清单">
          <h2>确认出售</h2><ul>{rows.map(row => <li key={row.id}><span aria-label="已选">✓</span><span>{row.name} ×{row.owned}</span><CurrencyAmount value={row.price}/></li>)}</ul>
          {progress.choice === "B" && <p>黯秘银结界钉留在行囊中。</p>}
          {error && <p role="alert">{error}</p>}
          <div className="shop-visit-sale__checkout">
            <div className="shop-visit-sale__total">合计收入 <CurrencyAmount value={total}/></div>
            <RpgNotchedPillButton className="new-shop__action" label={busy ? "处理中" : "确认卖出"} disabled={busy || !complete} onClick={transact}/>
          </div>
        </section></RpgFrame>}/>;
  } else content = <VisitReading progress={progress} busy={busy} error={error} advance={advance} onExit={onExit}/>;
  const narrative = !!progress && !["appraise", "sell", "buy"].includes(progress.phase);
  return <AbyssaProvider><Stage background="var(--abyssa-shop-backdrop)" canvasClassName="abyssa-shop-stage shop-visit">
    <ShopVisitEntrance.Provider value="handoff"><SceneSequence openingBlocked={transition.isTransitioning} frame={{id: `shop.visit.${progress?.phase ?? "begin"}`, kind: narrative ? "adv" : "battle",
      assets: narrative ? assets : undefined, content}}/></ShopVisitEntrance.Provider>
  </Stage></AbyssaProvider>;
}
