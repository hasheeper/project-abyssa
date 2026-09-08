import { useCampaignMenuCommands } from "../../game-client/CampaignMenuScope";
import { ItemDock } from "../../shared/ui/patterns/action-dock/ItemDock";
import { supplyArt } from "../../content/presentation/supply-icons";
import { useSceneTransition } from "../../shared/transition";
import { useGameSession } from "../../game-client/react";
import { gameHref, recordLocator } from "../../game-client/navigation";
import { useEffect, useState } from "react";
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
  manorFace,
  manorMemberTargetAction,
} from "./presentation/manor-battle-model";

/** Content/controller binding for the approved shared battle UI. */
export function ManorBattleView({presentation: p, ...props}: ExpeditionBattleScreenProps & {presentation: ReturnType<typeof useManorBattlePresentation>}) {
  const session = useGameSession(), { navigate } = useSceneTransition();
  const v = p.view,
    expedition = v.expedition;
  const run = expedition?.run,
    battle = v.battle;
  const [suppliesOpen, setSuppliesOpen] = useState(false);
  useEffect(() => {setSuppliesOpen(false);}, [run?.id, expedition?.node]);
  const [actorId, setActorId] = useState(
    run?.party.find((m) => m.hp > 0)?.id ?? "",
  );
  useCampaignMenuCommands([
    {id: "end-turn", label: "结束回合", detail: "交由敌方行动", disabled: p.busy || battle?.phase !== "act", onSelect: () => {
      if (p.isBusy() || battle?.phase !== "act" || !run) return;
      const ref = battle.encounter.memory && p.memory?.memory ? {kind:"memory" as const,id:run.id,attempt:p.memory.memory.attempt} : {kind:"expedition" as const,id:run.id};
      void p.perform({type:"battle-command",runRef:ref,command:{type:"end-turn"}});
    }},
    {id: "retreat", label: "撤退", detail: "尚未开放", disabled: true},
    {id: "camp", label: "扎营", detail: "尚未开放", disabled: true},
  ], p.busy);
  if (!expedition || !run) return null;
  const memory = !!battle?.encounter.memory;
  const clockwork = v.contentRef.contentVersion >= 3 && v.contentRef.rulesVersion === 4;
  const runRef = memory && p.memory?.memory ? {kind: "memory" as const, id: run.id, attempt: p.memory.memory.attempt} : {kind: "expedition" as const, id: run.id};
  const ordinaryRef = {kind: "expedition" as const, id: run.id};
  const eventActorId = v.party.some((m) => m.id === actorId && m.hp > 0)
    ? actorId
    : (v.party.find((m) => m.hp > 0)?.id ?? "");
  const phase = p.enemyTurnFx ? "enemy" : (battle?.phase ?? "complete");
  const interactive = !p.busy && phase === "act";
  const perform = (command: DemoBattleCommand) =>
    void p.perform(
      command.type === "undo"
        ? { type: "undo", runRef }
        : { type: "battle-command", runRef, command },
    );
  const options =
    v.party.find((m) => m.id === p.heldActor)?.actions.options ?? [];
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
      const action = manorMemberTargetAction(options, battle?.enemies ?? [], id);
      if (action) {
        act(action.choice, action.targetId);
        return;
      }
      if (p.heldActor === id) {
        p.holdActor(null);
        return;
      }
    }
    if (v.party.find((m) => m.id === id)?.actions.options.length)
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
    if (p.isBusy()) return;
    void p.perform({ type: "use-item", runRef, instanceId, target });
  };
  const itemLabel = (target: DemoItemTarget) => {
    if (target.kind === "round") return "增加一次重掷";
    if (target.kind === "information") return target.scope === "event" ? "查看当前事件" : "侦查下一层";
    if (target.kind === "intent") {
      const enemy = battle?.enemies.find(e => e.id === target.id || e.intent?.id === target.id);
      const seat = (battle?.encounter.formation.indexOf(enemy?.id ?? "") ?? -1) + 1;
      const victim = v.party.find(m => m.id === enemy?.intent?.targetId)?.name;
      return `第 ${seat} 席 · ${victim ? `攻击${victim}` : enemy?.definition.name ?? "敌方攻击"}`;
    }
    const member = v.party.find(m => m.id === target.id);
    return `${member?.name}${target.faceId ? ` · ${member?.faces.find(f => f.id === target.faceId)?.name}` : ""}`;
  };
  const eventChoice = (choiceId: "read" | "skip" | "attempt") => {
    if (p.isBusy()) return;
    void p.perform({ type: "choose-event", runRef: ordinaryRef, roomId: v.roomId!,
      choiceId, actorId: choiceId === "attempt" ? eventActorId : null });
  };
  const advance = () => {
    if (!p.isBusy()) void p.perform({type: "advance-room", runRef: ordinaryRef, roomId: v.roomId!});
  };
  const exit = (choice: "leave" | "continue") => {
    if (!p.isBusy()) void p.perform({type: "choose-exit", runRef: ordinaryRef, roomId: v.roomId!, choice});
  };
  const inlineJourney = !memory && ["event", "room-complete", "exit"].includes(expedition.node);
  const eventDie = p.eventRoll ?? manorEventDie(v);
  const overlay = expedition.node === "finished" && (
    <div className="abyssa-expedition-overlay" role="dialog" aria-modal="true"
      aria-label={expedition.result.outcome === "wipe" ? "强行撤离" : "远征结束"}>
      <div className="abyssa-expedition-modal" data-wide>
        <h3>{expedition.result.outcome === "wipe" ? "强行撤离" : "远征结束"}</h3>
        <div className="abyssa-expedition-modal__body">
          <p>最深抵达第 {expedition.result.deepestLayer} 层。</p>
          <p className="abyssa-expedition-modal__highlight">本次带回 <strong data-currency="gold">{expedition.result.totalGold}G</strong></p>
          {expedition.result.outcome === "wipe" && <p data-tone="bad">遗失本层散金 {expedition.result.lostLooseGold}G 与本次包裹金币 {expedition.result.lostBankedGold}G。</p>}
          <p>回馆后，剩余配给归还库存。</p>
        </div>
        <div className="abyssa-expedition-modal__actions">
          <DiceActionButton label="返回洋馆" primary disabled={p.busy || props.saving} onClick={props.onSettle}/>
        </div>
      </div>
    </div>
  );
  const sidebarProps = {
    partyIds: v.party.map(member => member.id),
    reaction: p.reaction,
    title: memory ? "MEMORY · 回忆" : "MANOR YIELD",
    memory: memory ? {
            readoutLabel: clockwork ? "钟鸣威力" : "侍偶护域",
            protection: clockwork ? (battle?.enemies[0]?.intent?.kind === "attack" ? battle.enemies[0].damage : battle?.enemies[0]?.definition.attack ?? 0) : battle?.enemies.find(e => e.id === battle.encounter.memory?.bossId)?.protection ?? 0,
            preview: p.heldActor ? options.filter(o => o.choice === "attack").map(o => `${battle?.enemies.find(e => e.id === o.targetId)?.definition.name}：${"damage" in o && o.damage && typeof o.damage === "object" && "applied" in o.damage ? o.damage.applied : o.amount}`).join("；") || "当前骰面没有攻击目标。" : null,
            busy: p.busy,
            onLeave: () => { if (!p.busy && runRef.kind === "memory") void session.dispatch({type: "leave-memory", runRef}).then(batch => {if (batch) navigate(gameHref("mansion", recordLocator(batch.after)));}); },
          } : undefined,
    layers: v.depthFactors,
    engine: {
            location: memory ? clockwork ? "旧日钟廊" : "魔王城礼仪回廊" : "克雷格旧庄园",
            layer: run.layer,
            round: battle?.encounter.round ?? 0,
            gold: run.looseGold,
            bagGold: run.bankedGold,
            deepestLayer: run.layer,
            log: v.log,
          },
    handFactor: v.economy!.handFactor,
    layerFactor: v.economy!.layerFactor,
    earthFactor: v.economy!.earthFactor,
    projected: v.economy!.projected,
    layerClearPending: false,

  } satisfies ExpeditionBattleSidebarProps;
  return (
    <ExpeditionBattleSurface
      {...props}
      title={memory ? clockwork ? "停下来的钟声" : "王座前的提线魔女" : "克雷格旧庄园"}
      label={memory ? "玛丽埃塔回忆战斗界面" : "克雷格旧庄园战斗界面"}
      party={p.party}
      presentedEnemies={p.presentedEnemies}
      phase={phase}
      layerClearPending={false}
      heldActor={p.heldActor}
      interactive={interactive}
      isRolling={p.isRolling}
      attackFx={p.attackFx}
      supportFx={p.supportFx}
      enemyTurnFx={p.enemyTurnFx}
      registerEnemyNode={p.registerEnemyNode}
      isPresentationBusy={p.isBusy}
      handleMemberCardClick={onMember}
      handleEnemyClick={onEnemy}
      handleIntentClick={onIntent}
      sceneStyle={
        memory ? {backgroundImage: clockwork ? `var(--battle-scene-tint), var(--battle-scene-curtain), url("${manorScenes["old-manor.service-corridor"]}")` : "var(--battle-scene-tint), var(--battle-scene-curtain)"} : v.room && manorScenes[v.room.sceneId]
          ? {
              backgroundImage: `var(--battle-scene-tint), var(--battle-scene-curtain), url("${manorScenes[v.room.sceneId]}")`,
            }
          : undefined
      }
      journey={inlineJourney ? {
        key: `${v.roomId}:${expedition.node}`,
        label: manorJourneyTitle(v),
        content: <ManorJourneyPanel view={v} actorId={eventActorId} eventRoll={p.eventRoll}/>,
      } : undefined}
      journeyMotion={p.journeyMotion}
      partyChoice={inlineJourney && expedition.node === "event" && v.event?.kind === "relic" ? {
        selectedId: eventActorId, disabled: p.busy, onSelect: setActorId,
      } : undefined}
      dicePanel={
        <ExpeditionDiceTray
          controls={inlineJourney ? <ManorJourneyActions view={v} actorId={eventActorId} busy={p.busy} eventRoll={p.eventRoll}
            onChoice={eventChoice} onAdvance={advance} onExit={exit}/> : undefined}
          itemPanel={v.supplies.length ? {
            open: suppliesOpen, onToggle: () => setSuppliesOpen(open => !open),
            content: <ItemDock key={`${run.id}:${suppliesOpen}`} busy={p.busy} items={v.supplies.map(s => ({
              id: s.instanceId, name: s.definition.name, charges: s.charges,
              ...supplyArt[s.definition.kind], unavailableReason: s.unavailableReason ?? undefined,
              targets: s.targets.map(t => ({id: JSON.stringify(t), label: itemLabel(t), onSelect: () => useSupply(s.instanceId, t)})),
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
              m.die.faceIndex !== null,
          }))}
          visuals={p.visuals}
          enemyTurnFx={p.enemyTurnFx}
          scoringOwners={new Set(battle?.hand.contributors ?? [])}
          interactive={interactive}
          initialRollReady={!p.busy && phase === "roll"}
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
          undoReady={battle?.canUndo ?? false}
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
        <ExpeditionBattleSidebar {...sidebarProps} />
      }
      overlays={memory && p.memory?.memory?.node !== "battle" ? null : overlay}
    />
  );
}
