import { MoneyText } from "../../shared/ui/primitives/Money";
import { TideTutorialGuide } from "./presentation/TideTutorialGuide";
import { AirpPanel } from "../../game-client/AirpPanel";
import { TideJourneyPanel, TideJourneyActions, tideJourneyTitle, tideEventCopy, tideEventVisible } from "./presentation/TideJourneyPanel";
import { tideGuideAllows } from "./presentation/guided-tide-model";
import { useTutorialAnchors, useTutorialSuspension } from "../../shared/tutorial";
import { HandbookModal } from "./presentation/GameHandbook";
import handbookIcon from "../../assets/icons/items/bookmark.svg";
import { tideScene } from "./presentation/tide-scene";
import { resolvePlayerText } from "../../shared/domain/player-identity";
import { usePlayerName } from "../../shared/domain/PlayerIdentity";
import { useCampaignMenuCommands } from "../../game-client/CampaignMenuScope";
import { ItemDock } from "../../shared/ui/patterns/action-dock/ItemDock";
import { supplyArt } from "../../content/presentation/supply-icons";
import { useSceneTransition } from "../../shared/transition";
import { useGameSession } from "../../game-client/react";
import { gameHref, recordLocator } from "../../game-client/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BattleOperationGuide } from "./presentation/BattleOperationGuide";
import type { DemoBattleCommand } from "../../game-core/battle";
import type { DemoItemTarget } from "../../game-core/session";
import type { ExpeditionBattleScreenProps } from "./ExpeditionBattleScreen";
import type { useManorBattlePresentation } from "./controller/useManorBattlePresentation";
import { ExpeditionBattleSurface } from "./presentation/ExpeditionBattleSurface";
import { ManorJourneyPanel, ManorJourneyActions, manorJourneyTitle } from "./presentation/ManorJourneyPanel";
import { manorEventDie } from "./presentation/manor-event-presentation";
import { ExpeditionDiceTray } from "./presentation/ExpeditionDicePanel";
import { ExpeditionBattleSidebar, type ExpeditionBattleSidebarProps } from "./presentation/ExpeditionBattleSidebar";
import { DiceActionButton } from "../../shared/ui/patterns/action-dock/DiceActionButton";
import { manorScenes } from "../../content/presentation/old-manor";
import {
  manorEnemyTargetAction,
  battleMemberName,
  manorFace,
  manorMemberTargetAction,
} from "./presentation/manor-battle-model";

import type { ManorScene } from "./presentation/manor-scene";
import { useSceneSequenceBusy } from "../../shared/presentation/adv/SceneSequence";
import type { BattleLedgerContent } from "./presentation/ExpeditionBattleLedger";

export type BattlePresentationSlots = { renderLedger?: BattleLedgerContent; outcome?: ReactNode; terminal?: ReactNode; feedback?: ReactNode };

/** Content/controller binding for the approved shared battle UI. */
export function ManorBattleView({presentation: p, scene, sceneReady = true, roomLoading, slots, ...props}: ExpeditionBattleScreenProps & {presentation: ReturnType<typeof useManorBattlePresentation>; scene?: ManorScene; sceneReady?: boolean; roomLoading?: ReactNode; slots?: BattlePresentationSlots}) {
  const playerName = usePlayerName();
  const sequenceBusy = useSceneSequenceBusy();
  const entering = !!scene && (sequenceBusy || !sceneReady);
  const session = useGameSession(), { navigate } = useSceneTransition();
  const anchor = useTutorialAnchors();
  const v = p.view,
    expedition = v.expedition;
  const tutorial = v.tutorial?.runRef ? v.tutorial : null;
  const tutorialStage = tideScene(v);
  const tutorialBlocked = !!tutorial && tutorial.stage !== "active";
  const run = expedition?.run,
    battle = v.battle;
  const route = v.routes[run?.routeId ?? v.defaultRouteId];
  const routeName = route?.name ?? "远征";
  const [suppliesOpen, setSuppliesOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [guide, setGuide] = useState(0);
  const [guideExpansion, setGuideExpansion] = useState(0);
  const [handbookOpen, setHandbookOpen] = useState(false);
  useTutorialSuspension(handbookOpen);
  const closeGuide = useCallback(() => {
    setGuide(0);
    if (tutorial?.guide?.mode === "guided") return;
    // Closing manually opened help must also dismiss the tutorial underneath it.
    if (tutorial?.runRef && tutorial.hintsEnabled) void session.dispatch({type: "tutorial-hints", runRef: tutorial.runRef, enabled: false});
  }, [session, tutorial?.runRef?.id, tutorial?.hintsEnabled, tutorial?.guide?.mode]);
  useEffect(() => {setSuppliesOpen(false);}, [run?.id, expedition?.node]);
  useEffect(() => {
    if (tutorial?.guide && tutorial.guide.step?.input.kind !== "item") setSuppliesOpen(false);
  }, [tutorial?.guide?.cursor, tutorial?.guide?.mode]);
  const [actorId, setActorId] = useState(
    tutorial?.guide ? "" : run?.party.find((m) => m.hp > 0)?.id ?? "",
  );
  useEffect(() => {
    if (tutorial?.guide && expedition?.node === "event") setActorId("");
  }, [run?.id, expedition?.node, tutorial?.attempt]);
  const canBattle = (command: DemoBattleCommand) => !entering && !tutorialBlocked && tideGuideAllows(v, {type: "battle", command});
  useCampaignMenuCommands([
    {id: "handbook", label: "玩法手册", detail: "战斗与探索规则", icon: handbookIcon, disabled: p.busy, onSelect: () => {
      if (!p.isBusy()) setHandbookOpen(true);
    }},
    {id:"battle-guide",label:"操作指引",detail:"显示当前步骤",disabled:p.busy || (tutorial?.guide?.mode === "guided" ? tutorialBlocked : !battle || !["roll","act"].includes(battle.phase)),onSelect:()=>{
      if (p.isBusy()) return;
      if (tutorial?.guide?.mode === "guided") {
        setGuideExpansion(value=>value+1);
        if (!tutorial.hintsEnabled) void session.dispatch({type:"tutorial-hints",runRef:tutorial.runRef!,enabled:true});
      }
      else if (tutorial && !tutorial.hintsEnabled) void session.dispatch({type:"tutorial-hints",runRef:tutorial.runRef!,enabled:true});
      else setGuide(value=>value+1);
    }},
    ...(tutorial?.guide?.canExit ? [{id: "exit-guided", label: "退出带做", detail: "取消步骤限制，继续自由操作", disabled: p.busy, onSelect: () => {
      if (!p.isBusy()) void p.perform({type:"tutorial-guide",runRef:tutorial.runRef!,planId:tutorial.guide!.planId,attempt:tutorial.attempt!,mode:"free"});
    }}] : []),
    // Tutorial actions stay on the board; omit duplicate and unavailable rail commands.
    ...(!tutorial ? [{id: "end-turn", label: "结束回合", detail: "交由敌方行动", disabled: p.busy || !canBattle({type:"end-turn"}) || battle?.phase !== "act", onSelect: () => {
      if (p.isBusy() || !canBattle({type:"end-turn"}) || battle?.phase !== "act" || !run) return;
      const ref = battle.encounter.memory && p.memory?.memory ? {kind:"memory" as const,id:run.id,attempt:p.memory.memory.attempt} : {kind:"expedition" as const,id:run.id};
      void p.perform({type:"battle-command",runRef:ref,command:{type:"end-turn"}});
    }},
    {id: "retreat", label: "撤退", detail: "尚未开放", disabled: true},
    {id: "camp", label: "扎营", detail: "尚未开放", disabled: true}] : []),
  ], entering || p.busy || handbookOpen);
  if (!expedition || !run) return null;
  const memory = !!battle?.encounter.memory;
  const clockwork = v.contentRef.contentVersion >= 3 && v.contentRef.rulesVersion === 4;
  const runRef = memory && p.memory?.memory ? {kind: "memory" as const, id: run.id, attempt: p.memory.memory.attempt} : {kind: "expedition" as const, id: run.id};
  const ordinaryRef = {kind: "expedition" as const, id: run.id};
  const eventActorId = v.party.some((m) => m.id === actorId && m.hp > 0)
    ? actorId
    : tutorial?.guide ? "" : (v.party.find((m) => m.hp > 0)?.id ?? "");
  const phase = p.enemyTurnFx ? "enemy" : (battle?.phase ?? "complete");
  const interactive = !entering && !p.busy && !handbookOpen && !tutorialBlocked && phase === "act";
  const perform = (command: DemoBattleCommand) => {
    if (p.isBusy() || !canBattle(command)) return;
    void p.perform(
      command.type === "undo"
        ? { type: "undo", runRef }
        : { type: "battle-command", runRef, command },
    );
  };
  const options =
    (v.party.find((m) => m.id === p.heldActor)?.actions.options ?? []).filter(o => canBattle({type:"act",actorId:p.heldActor!,choice:o.choice,targetId:o.targetId}));
  const canPickMember = (id: string) => v.party.find(m => m.id === id)?.actions.options.some(o => canBattle({type:"act",actorId:id,choice:o.choice,targetId:o.targetId})) ?? false;
  // In the guard lesson, select the single intent instead of inferring it from an ally.
  const memberAction = (id: string) => tutorial?.guide?.mode === "guided" && options.some(o => o.choice === "guard") ? null : manorMemberTargetAction(options, battle?.enemies ?? [], id);
  const canSelectMember = (id: string) => !!memberAction(id) || canPickMember(id) || p.heldActor === id;
  const act = (
    choice: "attack" | "guard" | "heal" | "bind" | "guard-all",
    targetId: string | null,
  ) => {
    if (
      interactive &&
      p.heldActor &&
      options.some((o) => o.choice === choice && o.targetId === targetId)
    )
      perform({ type: "act", actorId: p.heldActor, choice, targetId });
  };
  /* 点队友 / 点敌人 / 点意图三条路径与裂隙版同语义（含拿盾骰点被攻击
     队友即格挡）；目标推导在 manor-battle-model，本组件只提交。 */
  const onMember = (id: string) => {
    if (!interactive) return;
    if (p.heldActor) {
      const action = memberAction(id);
      if (action) {
        act(action.choice, action.targetId);
        return;
      }
      if (p.heldActor === id) {
        p.holdActor(null);
        return;
      }
    }
    if (canPickMember(id))
      p.holdActor(id);
  };
  const onEnemy = (id: string) => {
    if (!interactive || !p.heldActor) return;
    const action = manorEnemyTargetAction(options, battle?.enemies ?? [], id);
    if (action) act(action.choice, action.targetId);
  };
  const onIntent = (id: string) => {
    if (options.some((o) => o.choice === "guard-all")) act("guard-all", null);
    else act("guard", id);
  };
  const useSupply = (instanceId: string, target: DemoItemTarget) => {
    if (p.isBusy() || !tideGuideAllows(v, {type:"item",instanceId,target})) return;
    void p.perform({ type: "use-item", runRef, instanceId, target });
  };
  const itemLabel = (target: DemoItemTarget) => {
    if (target.kind === "round") return "增加一次重掷";
    if (target.kind === "information") return target.scope === "event" ? "查看当前事件" : "侦查下一层";
    if (target.kind === "intent") {
      const enemy = battle?.enemies.find(e => e.id === target.id || e.intent?.id === target.id);
      const seat = (battle?.encounter.formation.indexOf(enemy?.id ?? "") ?? -1) + 1;
      const victim = v.party.find(m => m.id === enemy?.intent?.targetId);
      return `第 ${seat} 席 · ${victim ? `攻击${battleMemberName(victim, playerName)}` : enemy?.definition.name ?? "敌方攻击"}`;
    }
    const member = v.party.find(m => m.id === target.id);
    return `${battleMemberName(member, playerName)}${target.faceId ? ` · ${member?.faces.find(f => f.id === target.faceId)?.name}` : ""}`;
  };
  const canChooseEvent = (choice: "read" | "skip" | "attempt") => tideGuideAllows(v, {type:"event",roomId:v.roomId!,choice,actorId:choice === "attempt" ? eventActorId : null});
  const eventChoice = (choiceId: "read" | "skip" | "attempt") => {
    if (p.isBusy() || !canChooseEvent(choiceId)) return;
    void p.perform({ type: "choose-event", runRef: ordinaryRef, roomId: v.roomId!,
      choiceId, actorId: choiceId === "attempt" ? eventActorId : null });
  };
  const canAdvance = tideGuideAllows(v, {type:"advance",roomId:v.roomId!});
  const advance = () => {
    if (!p.isBusy() && canAdvance) void p.perform({type: "advance-room", runRef: ordinaryRef, roomId: v.roomId!});
  };
  const observation = tutorial?.guide?.operation;
  const observe = observation?.type === "tutorial-observe" ? () => {
    if (!p.isBusy()) void p.perform({...observation,runRef:ordinaryRef});
  } : undefined;
  const exit = (choice: "leave" | "continue") => {
    if (!p.isBusy()) void p.perform({type: "choose-exit", runRef: ordinaryRef, roomId: v.roomId!, choice});
  };
  const inlineJourney = !!tutorial?.canRetry || !memory && ["event", "room-complete", "exit"].includes(expedition.node);
  const eventDie = p.eventRoll ?? manorEventDie(v);
  const tideEvent = tideEventVisible(v);
  const overlay = slots?.terminal ?? (!slots?.outcome && !tutorial && expedition.node === "finished" && (
    <div className="abyssa-expedition-overlay" role="dialog" aria-modal="true"
      aria-label={expedition.result.outcome === "wipe" ? "强行撤离" : "远征结束"}>
      <div className="abyssa-expedition-modal" data-wide>
        <h3>{expedition.result.outcome === "wipe" ? "强行撤离" : "远征结束"}</h3>
        <div className="abyssa-expedition-modal__body">
          <p>最深抵达第 {expedition.result.deepestLayer} 层。</p>
          <p className="abyssa-expedition-modal__highlight">本次带回 <strong data-currency="gold"><MoneyText value={expedition.result.totalGold}/></strong></p>
          {expedition.result.outcome === "wipe" && <p data-tone="bad">遗失本层散金 <MoneyText value={expedition.result.lostLooseGold}/> 与本次包裹资金 <MoneyText value={expedition.result.lostBankedGold}/>。</p>}
          <p>回馆后，剩余配给归还库存。</p>
        </div>
        <div className="abyssa-expedition-modal__actions">
          <DiceActionButton label="返回洋馆" primary disabled={p.busy || props.saving} onClick={props.onSettle}/>
        </div>
      </div>
    </div>
  ));
  const sidebarProps = {
    partyIds: v.party.map(member => member.id),
    reaction: p.reaction,
    quiet: !!tutorial?.guide,
    battleObjective: tutorial?.guide && tutorial.encounter === 4 ? "击败全部敌人，夺回货物。" : undefined,
    title: memory ? "MEMORY · 回忆" : tutorial ? "TIDE CAVE" : route?.ending === "plain" ? "EXPEDITION" : "MANOR YIELD",
    memory: memory ? {
            readoutLabel: clockwork ? "钟鸣威力" : "侍偶护域",
            protection: clockwork ? (battle?.enemies[0]?.intent?.kind === "attack" ? battle.enemies[0].damage : battle?.enemies[0]?.definition.attack ?? 0) : battle?.enemies.find(e => e.id === battle.encounter.memory?.bossId)?.protection ?? 0,
            preview: p.heldActor ? options.filter(o => o.choice === "attack").map(o => `${battle?.enemies.find(e => e.id === o.targetId)?.definition.name}：${"damage" in o && o.damage && typeof o.damage === "object" && "applied" in o.damage ? o.damage.applied : o.amount}`).join("；") || "当前骰面没有攻击目标。" : null,
            busy: p.busy,
            onLeave: () => { if (!p.busy && runRef.kind === "memory") void session.dispatch({type: "leave-memory", runRef}).then(batch => {if (batch) navigate(gameHref("mansion", recordLocator(batch.after)));}); },
          } : undefined,
    layers: v.depthFactors.slice(0, v.layerCount),
    engine: {
            location: memory ? clockwork ? "旧日钟廊" : "魔王城礼仪回廊" : tutorial ? "退潮岩窟" : scene ? `${routeName} · ${scene.location}` : routeName,
            layer: run.layer,
            round: battle?.encounter.round ?? 0,
            gold: run.looseGold,
            bagGold: run.bankedGold,
            deepestLayer: run.layer,
            log: v.log.map(line => ({...line, text: resolvePlayerText(line.text, playerName)})),
          },
    handFactor: v.economy!.handFactor,
    layerFactor: v.economy!.layerFactor,
    earthFactor: v.economy!.earthFactor,
    projected: v.economy!.projected,
    battleGold: v.economy!.battleGold,
    currentLayerGold: run.layerResults.find(result => result.layer === run.layer)?.gold,
    layerClearPending: false,

  } satisfies ExpeditionBattleSidebarProps;
  return (
    <>{tutorial && guide === 0 && <TideTutorialGuide key={`${tutorial.runRef?.id}:${tutorial.attempt}`} expandKey={guideExpansion} view={v} heldActor={p.heldActor} eventActorId={eventActorId} suppliesOpen={suppliesOpen} selectedItem={selectedItem} busy={p.busy || suppliesOpen && tutorial.guide?.step?.input.kind !== "item"} onClose={closeGuide}/>}
    {guide>0 && <BattleOperationGuide key={guide} view={v} heldActor={p.heldActor} busy={p.busy || suppliesOpen} onClose={closeGuide}/>}
    <ExpeditionBattleSurface
      {...props}
      roomLoading={roomLoading}
      outcome={slots?.outcome}
      inert={handbookOpen || entering}
      entrance={!!scene}
      formationKey={battle?.encounter.id ?? "journey"}
      location={scene?.location ?? tutorialStage?.location}
      title={memory ? clockwork ? "停下来的钟声" : "王座前的提线魔女" : tutorial?.canClaim ? "守望者之崖·归来" : tutorial ? "雾滩·退潮岩窟" : routeName}
      label={memory ? "玛丽埃塔回忆战斗界面" : tutorial ? "退潮岩窟战斗界面" : `${routeName}战斗界面`}
      party={p.party.map(m => ({...m,ready:m.ready && canPickMember(m.id),healable:m.healable && !!memberAction(m.id)}))}
      presentedEnemies={tutorial?.canRetry ? [] : p.presentedEnemies.map(e => ({...e,
        targetable:e.targetable && options.some(o => o.targetId === e.id && o.choice !== "guard"),
        intentBlockable:e.intentBlockable && options.some(o => o.choice === "guard-all" || o.choice === "guard" && o.targetId === e.id),
      }))}
      canSelectMember={canSelectMember}
      phase={phase}
      layerClearPending={false}
      heldActor={p.heldActor}
      interactive={interactive}
      isRolling={p.isRolling}
      attackFx={p.attackFx}
      supportFx={p.supportFx}
      enemyTurnFx={p.enemyTurnFx}
      isPresentationBusy={p.isBusy}
      handleMemberCardClick={onMember}
      handleEnemyClick={onEnemy}
      handleIntentClick={onIntent}
      sceneStyle={
        scene ? {backgroundImage: `var(--battle-scene-tint), var(--battle-scene-curtain), url("${scene.background}")`} : tutorialStage ? {backgroundImage: `var(--battle-scene-tint), var(--battle-scene-curtain), url("${tutorialStage.background}")`} : memory ? {backgroundImage: clockwork ? `var(--battle-scene-tint), var(--battle-scene-curtain), url("${manorScenes["old-manor.service-corridor"]}")` : "var(--battle-scene-tint), var(--battle-scene-curtain)"} : v.room && manorScenes[v.room.sceneId]
          ? {
              backgroundImage: `var(--battle-scene-tint), var(--battle-scene-curtain), url("${manorScenes[v.room.sceneId]}")`,
            }
          : undefined
      }
      journey={inlineJourney ? {
        key: `${v.roomId}:${expedition.node}`,
        label: tutorial ? tideJourneyTitle(v) : manorJourneyTitle(v),
        content: tutorial && !tideEvent ? <TideJourneyPanel view={v}/> : <ManorJourneyPanel view={v} actorId={eventActorId} eventRoll={p.eventRoll} eventCopy={tideEvent ? tideEventCopy : undefined}/>,
      } : undefined}
      journeyMotion={p.journeyMotion}
      partyChoice={inlineJourney && expedition.node === "event" && v.event?.kind === "relic" ? {
        selectedId: eventActorId, disabled: p.busy,
        canSelect: id => tideGuideAllows(v, {type:"event",roomId:v.roomId!,choice:"attempt",actorId:id}),
        onSelect: setActorId,
      } : undefined}
      dicePanel={
        <ExpeditionDiceTray
          entrance={!!scene}
          controls={inlineJourney ? tutorial && !tideEvent ? <TideJourneyActions view={v} busy={p.busy || !!props.saving} canAdvance={canAdvance} onRetry={scope => void p.perform({type:"tutorial-retry",runRef:ordinaryRef,attempt:tutorial.attempt!,scope})} onAdvance={advance}/> : <ManorJourneyActions view={v} actorId={eventActorId} busy={p.busy} eventRoll={p.eventRoll}
            canChoose={canChooseEvent} canAdvance={canAdvance} onObserve={observe} onChoice={eventChoice} onAdvance={advance} onExit={exit}/> : undefined}
          itemPanel={v.supplies.length && !tutorialBlocked ? {
            open: suppliesOpen, onToggle: () => setSuppliesOpen(open => !open),
            content: <ItemDock key={`${run.id}:${suppliesOpen}`} onSelectionChange={setSelectedItem} busy={p.busy} items={v.supplies.map(s => ({
              id: s.instanceId, name: s.definition.name, charges: s.charges,
              ...supplyArt[s.definition.kind], unavailableReason: s.unavailableReason ?? undefined,
              slotRef: anchor(`battle.item:${s.instanceId}`),
              targets: s.targets.filter(t => tideGuideAllows(v, {type:"item",instanceId:s.instanceId,target:t})).map(t => ({id: JSON.stringify(t), label: itemLabel(t), ref: tutorial?.guide?.step?.input.kind === "item" ? anchor(`battle.item-target:${s.instanceId}`) : undefined, onSelect: () => useSupply(s.instanceId, t)})),
            }))}/>,
          } : undefined}
          slots={v.party.map((m, index) => ({
            ownerId: m.id,
            dieIndex: index,
            faceIndex: eventDie?.actorId === m.id ? eventDie.faceIndex : m.die?.faceIndex ?? null,
            eventCheck: eventDie?.actorId === m.id ? p.eventRoll?.phase ?? "outcome" : undefined,
            loaded: m.die?.loaded ?? false,
            spent: m.die?.spent ?? false,
            sealed: m.die?.sealed ?? false,
            downed: !m.hp,
            rustFaceCount: m.faces.filter((f) => f.quality === "rust").length,
            gildFaceCount: m.faces.filter((f) => f.quality === "gild").length,
            faces: m.faces.map(manorFace),
            canToggle:
              !!m.die &&
              !!m.hp &&
              !m.die.sealed &&
              !m.die.spent &&
              m.die.faceIndex !== null && canBattle({type:"toggle-load",actorId:m.id}),
          }))}
          visuals={p.visuals}
          enemyTurnFx={p.enemyTurnFx}
          scoringOwners={new Set(battle?.hand.contributors ?? [])}
          interactive={interactive}
          initialRollReady={!entering && !p.busy && canBattle({type:"roll"}) && phase === "roll"}
          rerollReady={canBattle({type:"reroll"})}
          endTurnReady={canBattle({type:"end-turn"})}
          awaitingInitialRoll={phase === "roll"}
          rerollsRemaining={battle?.encounter.rerolls ?? 0}
          busy={p.busy}
          attackFx={p.attackFx}
          supportFx={p.supportFx}
          hand={
            phase === "act" && battle
              ? {
                  ...battle.hand,
                  used: [],
                  pips: battle.hand.dice.map((d) => d.value),
                }
              : null
          }
          undoLabel={battle?.canUndo ? "上一步操作" : null}
          undoReady={!!battle?.canUndo && canBattle({type:"undo"})}
          unloadedRemain={!!battle?.eligibleOwnerIds.length}
          onDieToggle={(i) => {
            if (interactive)
              perform({ type: "toggle-load", actorId: v.party[i].id });
          }}
          onUndo={() => perform({ type: "undo" })}
          onRoll={() => perform({ type: "roll" })}
          onReroll={() => perform({ type: "reroll" })}
          onEndTurn={() => perform({ type: "end-turn" })}
        />
      }
      sidebar={
        <ExpeditionBattleSidebar {...sidebarProps} renderLedger={slots?.renderLedger} entrance={!!scene} objective={!memory && !tutorial ? <AirpPanel compact/> : undefined}/>
      }
      overlays={<>{memory && p.memory?.memory?.node !== "battle" ? null : overlay}{slots?.feedback}</>}
    />
    <HandbookModal open={handbookOpen} onClose={() => setHandbookOpen(false)}/></>
  );
}
