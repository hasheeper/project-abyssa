import { useCampaignMenuCommands } from "../../game-client/CampaignMenuScope";
import { ExpeditionBattleSurface } from "./presentation/ExpeditionBattleSurface";
import { useMemo } from "react";
import {
  DOWNED_RETURN_HP,
  LAYER_MULTIPLIERS,
  MAX_HP,
  canActWith,
  canToggleLoad,
  canUndo,
  evaluateHand,
  getFrenzyWarningRounds,
  getIncomingDamageFor,
  getIntentThreat,
  isEnemyFrenzied,
  isEnemyDefeated,
  getLayerPayout,
  getStateFace,
  getUndoLabel,
  hasUnloadedDice,
  type CharacterId,
  type BattleCommand
} from "./view";
import { useExpeditionBattleController } from "./controller/useExpeditionBattleController";
import {
  type BattleUiSkin
} from "./battleUiSkins";
import {
  ENEMY_ART,
} from "./presentation/expedition-visuals";
import {
  getEnemyTargetCommand,
  getMemberTargetCommand,
} from "./presentation/battle-view-model";
import { useExpeditionBattlePresentation } from "./presentation/useExpeditionBattlePresentation";
import { ExpeditionBattleSidebar, type ExpeditionBattleSidebarProps } from "./presentation/ExpeditionBattleSidebar";
import { ExpeditionBattleOverlays } from "./presentation/ExpeditionBattleOverlays";
import { ExpeditionDicePanel } from "./presentation/ExpeditionDicePanel";

/* ============================================================
   主界面
============================================================ */

export type ExpeditionBattleScreenProps = {
  onSettle: () => void;
  inspectHref?: (id: string) => string;
  saving?: boolean;
  uiSkin?: BattleUiSkin;
  defaultUiSkin?: BattleUiSkin;
  onUiSkinChange?: (skin: BattleUiSkin) => void;
};

export function ExpeditionBattleScreen({
  onSettle,
  inspectHref,
  saving = false,
  uiSkin,
  defaultUiSkin = "timber",
  onUiSkinChange
}: ExpeditionBattleScreenProps) {
  const controller = useExpeditionBattleController();
  const battlePresentation = useExpeditionBattlePresentation(controller);
  const engine = controller.state;
  const heldActor = controller.heldActor;
  const setHeldActor = controller.holdActor;
  const {
    phase,
    layerClearPending,
    interactive,
    canInitialRoll,
    isRolling,
    visuals,
    attackFx,
    supportFx,
    enemyTurnFx,
    presentedEnemies,
    registerEnemyNode,
    isBusy: isPresentationBusy,
    play
  } = battlePresentation;
  const perform = (command: BattleCommand) => { void play(command); };
  const handleDieToggle = (index: number) => { if (interactive && canToggleLoad(engine, index)) perform({ type: "toggle-load", dieIndex: index }); };
  const handleInitialRoll = () => { if (canInitialRoll) perform({ type: "roll-dice" }); };
  const handleReroll = () => { if (interactive && engine.rerollsRemaining > 0) perform({ type: "reroll-dice" }); };
  const handleUndo = () => { if (interactive && canUndo(engine)) perform({ type: "undo" }); };
  const handleEndTurn = () => { if (interactive) perform({ type: "end-turn" }); };
  useCampaignMenuCommands([
    {id:"end-turn", label:"结束回合", detail:"交由敌方行动", disabled:!interactive, onSelect:handleEndTurn},
    {id:"retreat", label:"撤退", detail:"尚未开放", disabled:true},
    {id:"camp", label:"扎营", detail:"尚未开放", disabled:true},
  ], !controller.ready || isPresentationBusy());
  const handleMemberCardClick = (memberId: CharacterId) => {
    if (!interactive || isPresentationBusy()) return;
    if (heldActor) {
      const command = getMemberTargetCommand(engine, heldActor, memberId);
      if (command) { perform(command); return; }
      if (heldActor === memberId) { setHeldActor(null); return; }
    }
    if (canActWith(engine, memberId)) setHeldActor(memberId);
  };
  const handleEnemyClick = (enemyId: string) => {
    if (!interactive || !heldActor || isPresentationBusy()) return;
    const command = getEnemyTargetCommand(engine, heldActor, enemyId);
    if (command) perform(command);
  };
  const handleIntentClick = (enemyId: string) => { if (interactive && heldActor && !isPresentationBusy()) perform({ type: "block-intent", actorId: heldActor, enemyId }); };
  const handleGoDeeper = () => perform({ type: "go-deeper" });
  const handleLeaveExpedition = () => perform({ type: "leave-expedition" });

  /* ---------- 派生数据 ---------- */

  const hand = useMemo(
    () => (phase === "act" ? evaluateHand(engine) : null),
    [engine, phase]
  );

  /* 参与当前牌型的骰主：点亮其命数角标 */
  const scoringOwners = useMemo(
    () => new Set(hand?.contributors ?? []),
    [hand]
  );

  /*
   * 普通行动阶段只展示已入账倍率；最后一只怪物倒下后，自动结算前的
   * 1.2 秒直接预览含本回合牌型的最终值，避免结果看起来凭空跳变。
   */
  const closingHandBonus = layerClearPending ? (hand?.adjustedBonus ?? 0) : 0;
  const displayedHandBonus = engine.handMultiplier + closingHandBonus;
  const handFactor = Math.round((1 + displayedHandBonus) * 100) / 100;
  const layerFactor = LAYER_MULTIPLIERS[engine.layer - 1] ?? LAYER_MULTIPLIERS[4];
  /* 本层预计入袋 = 散金 × 牌型 × 层倍率 */
  const projected = layerClearPending
    ? getLayerPayout({ ...engine, handMultiplier: displayedHandBonus })
    : getLayerPayout(engine);

  /* 拿起的角色骰面，决定哪些目标高亮 */
  const heldFace = heldActor
    ? getStateFace(engine, engine.dice.find((die) => die.ownerId === heldActor)!)
    : null;
  const heldVerb = heldFace?.verb ?? null;

  const undoLabel = getUndoLabel(engine);
  const undoReady = canUndo(engine);
  const unloadedRemain = hasUnloadedDice(engine);

  const sidebarProps = {
    partyIds: engine.party.map(member => member.id),
    reaction: battlePresentation.reaction,
    engine: engine,
    layerClearPending: layerClearPending,
    handFactor: handFactor,
    layerFactor: layerFactor,
    projected: projected
  } satisfies ExpeditionBattleSidebarProps;
  return <ExpeditionBattleSurface
    onSettle={onSettle} inspectHref={inspectHref} saving={saving} uiSkin={uiSkin}
    defaultUiSkin={defaultUiSkin} onUiSkinChange={onUiSkinChange}
    label="裂隙远征战斗界面"
    party={engine.party.map(member => ({...member, maxHp: MAX_HP, returnHp: DOWNED_RETURN_HP,
      ready: canActWith(engine, member.id), incoming: getIncomingDamageFor(engine, member.id),
      healable: heldVerb === "heal" && heldActor !== member.id && !member.downed && member.hp < MAX_HP,
    }))}
    presentedEnemies={presentedEnemies.map(enemy => ({...enemy, artUrl: ENEMY_ART[enemy.art],
      frenzyWarning: getFrenzyWarningRounds(engine, enemy), defeated: isEnemyDefeated(enemy),
      frenzyActive: isEnemyFrenzied(engine, enemy), threat: getIntentThreat(engine, enemy.id),
      targetable: heldVerb === "attack" || heldVerb === "wild" || heldVerb === "coin",
      intentBlockable: enemy.intent?.type === "attack" && (heldVerb === "guard" || heldVerb === "wild"),
    }))}
    phase={phase} layerClearPending={layerClearPending} interactive={interactive} isRolling={isRolling}
    heldActor={heldActor} attackFx={attackFx} supportFx={supportFx} enemyTurnFx={enemyTurnFx}
    registerEnemyNode={registerEnemyNode} isPresentationBusy={isPresentationBusy}
    handleMemberCardClick={handleMemberCardClick} handleEnemyClick={handleEnemyClick} handleIntentClick={handleIntentClick}
    dicePanel={<ExpeditionDicePanel
                    engine={engine}
                    visuals={visuals}
                    enemyTurnFx={enemyTurnFx}
                    scoringOwners={scoringOwners}
                    interactive={interactive}
                    initialRollReady={canInitialRoll}
                    busy={isRolling || phase === "enemy"}
                    attackFx={attackFx}
                    supportFx={supportFx}
                    hand={hand}
                    undoLabel={undoLabel}
                    undoReady={undoReady}
                    unloadedRemain={unloadedRemain}
                    onDieToggle={handleDieToggle}
                    onUndo={handleUndo}
                    onRoll={handleInitialRoll}
                    onReroll={handleReroll}
                    onEndTurn={handleEndTurn}
                  />}
    sidebar={<ExpeditionBattleSidebar {...sidebarProps} />}
    overlays={<ExpeditionBattleOverlays
        engine={engine}
        onGoDeeper={handleGoDeeper}
        onLeaveExpedition={handleLeaveExpedition}
        onSettle={onSettle}
        busy={saving || controller.presenting || !controller.ready}
      />}
  />;
}
