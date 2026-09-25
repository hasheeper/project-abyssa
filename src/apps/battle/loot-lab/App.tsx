import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage } from "../../../shared/stage/Stage";
import { AbyssaProvider } from "../../../shared/ui/primitives/AbyssaProvider";
import { SceneFeedback, type SceneFeedbackEntry } from "../../../shared/ui/patterns/SceneFeedback";
import { SceneTransitionProvider } from "../../../shared/transition";
import { createBattlePreviewSession } from "../../../game-client/battle-preview";
import { GameSessionScope, useGameState } from "../../../game-client/react";
import { CampaignMenuScope } from "../../../game-client/CampaignMenuScope";
import type { GameSession } from "../../../game-client/session";
import { ManorBattleView } from "../ManorBattleView";
import { useManorBattlePresentation } from "../controller/useManorBattlePresentation";
import { BATTLE_UI_SKINS, type BattleUiSkin } from "../battleUiSkins";
import { collectDrop, createLootRun, finishRun, type LootOutcome, type LootRun, type LootSettlement } from "./loot-model";
import { LOOT_ITEMS, LOOT_PREVIEW_ITEM_COUNT, sampleRun } from "./fixtures";
import { deriveLoot, previewDropItem } from "./derive-loot";
import { LootLedger } from "../loot/LootLedger";
import { LootSettlementView } from "../loot/LootSettlementView";

export function App() {
  const [attempt, setAttempt] = useState(0);
  const [session, setSession] = useState<GameSession | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let active: GameSession | undefined;
    setSession(null); setError("");
    void createBattlePreviewSession(19).then(next => {
      if (cancelled) next.dispose();
      else { active = next; setSession(next); }
    }, reason => { if (!cancelled) setError(String(reason)); });
    return () => { cancelled = true; active?.dispose(); };
  }, [attempt]);
  if (!session) return <div className="loot-preview-loading" role={error ? "alert" : "status"}>{error || "正在进入庄园…"}{error && <button onClick={() => setAttempt(value => value + 1)}>重试</button>}</div>;
  return <GameSessionScope session={session}><SceneTransitionProvider><CampaignMenuScope>
    <BattlePreview key={attempt} onRestart={() => setAttempt(value => value + 1)}/>
  </CampaignMenuScope></SceneTransitionProvider></GameSessionScope>;
}

function BattlePreview({ onRestart }: { onRestart: () => void }) {
  const game = useGameState();
  const [skin, setSkin] = useState<BattleUiSkin>("old-manor");
  const [resultLocation, setResultLocation] = useState("克雷格旧庄园");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [debug, setDebug] = useState(new URLSearchParams(window.location.search).get("debug") === "1");
  const [sample, setSample] = useState<LootRun | null>(null);
  const [previewReceipt, setPreviewReceipt] = useState<LootSettlement | null>(null);
  const [feedback, setFeedback] = useState<SceneFeedbackEntry[]>([]);
  const announced = useRef(new Set<string>());
  const sequence = useRef(0);
  const notify = useCallback((id: string, copper: number, itemId: string, quantity: number) => {
    if (announced.current.has(id)) return;
    announced.current.add(id);
    const item = LOOT_ITEMS[itemId]!;
    const entries: SceneFeedbackEntry[] = [{ id: `${id}:item`, kind: "reward", durationMs: 4000, reward: { id, kind: "item", name: item.name, icon: item.icon, rarity: item.rarity, quantity } }];
    if (copper > 0) entries.unshift({ id: `${id}:money`, kind: "reward", durationMs: 4000, reward: { id, kind: "currency", currency: "lira", quantity: copper } });
    setFeedback(current => [...current, ...entries]);
  }, []);
  const p = useManorBattlePresentation({ onEventPresented: (event) => {
    setSample(null);
    const payload = event.payload as Record<string, unknown>;
    if ((event.type === "enemy-defeated" || event.type === "enemy-released") && Number(payload.bounty) > 0) {
      const itemId = previewDropItem(String(payload.targetId));
      notify(event.id, Number(payload.bounty) || 0, itemId, itemId === "rune" ? 2 : 1);
    }
  } });
  const projectedLoot = useMemo(() => deriveLoot(game.record!, p.view), [game.record, p.view]);
  const settledLoot = useRef(projectedLoot);
  // Keep the previous receipt while the controller is presenting a committed
  // action; do not mix future facts with the previous room's visible money.
  if (!p.busy) settledLoot.current = projectedLoot;
  const liveLoot = settledLoot.current;
  const loot = sample ?? liveLoot;
  const receipt = previewReceipt ?? (!p.busy ? liveLoot.settlement : null);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "F2") { event.preventDefault(); setDebug(value => !value); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const showResult = (outcome: LootOutcome) => { setFeedback([]); setPreviewReceipt(finishRun(loot, outcome).settlement); setDebug(false); };
  return <Stage canvasClassName={`abyssa-battle-stage abyssa-battle-stage--${skin}`}>
    <AbyssaProvider className="abyssa-expedition-theme loot-lab" data-battle-ui-skin={skin} motionPreference={reducedMotion ? "reduced" : "system"}>
      <ManorBattleView presentation={p} uiSkin={skin} onUiSkinChange={setSkin} onSettle={onRestart} slots={{
        renderLedger: onClose => <LootLedger run={loot} catalog={LOOT_ITEMS} log={p.view.log} onClose={onClose}/>,
        terminal: <></>,
        feedback: <><SceneFeedback entries={feedback.slice(0, 4)} edge="right" paused={!!receipt} className="loot-lab-feedback" onDismiss={id => setFeedback(current => current.filter(entry => entry.id !== id))}/>
          {receipt && <LootSettlementView receipt={receipt} catalog={LOOT_ITEMS} context={{ locationName: previewReceipt ? resultLocation.trim() || "克雷格旧庄园" : "克雷格旧庄园", progressLabel: `第 ${receipt.layer} 层` }} onConfirm={onRestart}/>}</>,
      }}/>
      <aside className="loot-lab-tools" aria-label="战利品调试工具">
        <button className="loot-lab-tools__toggle" aria-expanded={debug} onClick={() => setDebug(value => !value)}>LOOT LAB <span>F2</span></button>
        {debug && <div className="loot-lab-tools__panel"><header><strong>正常战斗 · 独立预览</strong><small>当前规则与内容 · 内存运行，不改游戏存档</small></header>
          <div className="loot-lab-tools__group"><span>样本</span><button onClick={() => setSample(null)}>当前远征</button><button onClick={() => setSample(sampleRun("mixed"))}>混合收获</button><button onClick={() => setSample(sampleRun("overflow"))}>{LOOT_PREVIEW_ITEM_COUNT} 种道具</button></div>
          <div className="loot-lab-tools__group"><span>少量</span><button onClick={() => setSample(createLootRun())}>无收获</button><button onClick={() => setSample(collectDrop(createLootRun(), { id: "sample:single", source: "单件展示", rewards: { copper: 380, items: [{itemId: "box", quantity: 1}] } }))}>单件道具</button></div>
          <label className="loot-lab-tools__field">结算地点<input value={resultLocation} onChange={event => setResultLocation(event.target.value)} maxLength={40}/></label>
          <label className="loot-lab-tools__field">界面主题<select value={skin} onChange={event => setSkin(event.target.value as BattleUiSkin)}>{BATTLE_UI_SKINS.map(theme => <option key={theme.id} value={theme.id}>{theme.label}</option>)}</select></label>
          <label className="loot-lab-tools__motion"><input type="checkbox" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)}/>减少动态效果</label>
          <div className="loot-lab-tools__group"><span>掉落</span><button disabled={p.busy || !!receipt} onClick={() => {
            const id = `debug:${++sequence.current}`;
            setSample(collectDrop(loot, { id, source: "掉落预览", rewards: { copper: 380, items: [{ itemId: "box", quantity: 1 }, { itemId: "rune", quantity: 2 }, { itemId: "ward", quantity: 1 }] } }));
            notify(id, 380, "box", 1); notify(`${id}:rune`, 0, "rune", 2); notify(`${id}:ward`, 0, "ward", 1);
          }}>叠加提示</button><button disabled={p.busy} onClick={onRestart}>重开战斗</button></div>
          <div className="loot-lab-tools__group"><span>结算</span>{(["failed", "retreated", "cleared"] as const).map((outcome, index) => <button key={outcome} disabled={p.busy} onClick={() => showResult(outcome)}>{["失败", "撤退", "通关"][index]}</button>)}</div>
          <p>正常掷骰、固定骰子、选择角色与目标。击败敌人后触发掉落；清层自动入袋。</p>
          <p>道具为 UI 样本。失败减半的奇数分配暂用预览规则。结算“返回”重新进入独立战斗。</p>
        </div>}
      </aside>
    </AbyssaProvider>
  </Stage>;
}
