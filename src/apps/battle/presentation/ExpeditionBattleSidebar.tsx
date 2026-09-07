import { useEffect, useState } from "react";
import { RpgDialogue } from "../../../shared/ui/primitives/RpgDialogue";
import mariettaPortrait from "../../../assets/characters/portraits/marietta.png";
import { PARTY_VISUALS } from "./expedition-visuals";
import { type ExpeditionLedgerProps } from "./ExpeditionLedger";
import { makeBattleReaction, type BattleReaction } from "./battle-reactions";
import { CompanionStatus } from "./CompanionStatus";
import { ExpeditionBattleLedger } from "./ExpeditionBattleLedger";
import { REACTION_LABELS } from "../../../content/presentation/battle-reactions";

const portraits: Record<string, {name: string; portrait: string; nameplate: string}> = {
  ...PARTY_VISUALS,
  marietta: {name: "玛丽埃塔", portrait: mariettaPortrait, nameplate: "MARIETTA"},
};
export type ExpeditionBattleSidebarProps = ExpeditionLedgerProps & {
  partyIds: readonly string[];
  reaction: BattleReaction | null;
};
function ReactionPortrait({ actorId }: { actorId: string }) {
  const [frame, setFrame] = useState({current: actorId, previous: null as string | null});
  if (frame.current !== actorId) setFrame({current: actorId, previous: frame.current});
  useEffect(() => {
    if (!frame.previous) return;
    const timer = window.setTimeout(() => setFrame(f => ({...f, previous: null})), 460);
    return () => window.clearTimeout(timer);
  }, [frame.current, frame.previous]);
  return <div className="battle-reaction__portrait" aria-hidden="true">
    {frame.previous && <img key={`out:${frame.previous}`} data-character={frame.previous} data-outgoing src={portraits[frame.previous]?.portrait} alt="" draggable={false} />}
    <img key={frame.current} data-character={frame.current} data-arriving={!!frame.previous || undefined} src={portraits[frame.current]?.portrait} alt="" draggable={false} />
  </div>;
}

/** A single instrument body groups the readings above the companion stage. */
export function ExpeditionBattleSidebar({partyIds, reaction, ...ledger}: ExpeditionBattleSidebarProps) {
  const fallback = partyIds.find(id => id !== "kael" && portraits[id]) ?? partyIds.find(id => portraits[id]) ?? "kael";
  const current = reaction && partyIds.includes(reaction.actorId) ? reaction : makeBattleReaction(`ready:${fallback}`, fallback, "ready")!;
  const actor = portraits[current.actorId]!;
  const {engine, memory} = ledger;
  return <aside className="abyssa-expedition-region abyssa-expedition-sidebar battle-companion" aria-label="同行伙伴">
    <span className="abyssa-expedition-sidebar__corners" aria-hidden="true"><i data-corner="tl"/><i data-corner="tr"/><i data-corner="br"/><i data-corner="bl"/></span>
    <div className="battle-companion__instrument">
      <CompanionStatus layer={engine.layer} round={engine.round} memory={!!memory}/>
      <ExpeditionBattleLedger {...ledger}/>
    </div>
    <section className="battle-reaction" aria-label={`${actor.name}的战斗反应`} data-actor={current.actorId} data-reaction-id={current.key}>
      <div className="battle-reaction__stage">
        <span className="battle-reaction__inlay" aria-hidden="true"/>
        <ReactionPortrait actorId={current.actorId}/>
        <div className="battle-reaction__name"><small>{actor.nameplate}</small><strong>{actor.name}</strong><span>{REACTION_LABELS[current.kind]}</span></div>
      </div>
      <div className="battle-reaction__speech" role="status" aria-live="polite" aria-atomic="true">
        <RpgDialogue key={current.key} className="battle-reaction__dialogue" name={actor.name} showNameplate={false} autoHeight text={current.text}/>
      </div>
    </section>
    {memory?.preview && <p className="battle-companion__preview">{memory.preview}</p>}
  </aside>;
}
