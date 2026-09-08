import { useMemo, useState } from "react";
import { AdvStage } from "../../shared/presentation/adv/AdvStage";
import { CHARACTER_EMOTION_PROFILES } from "../../content/presentation/character-emotions";
import { EMOTION_LABELS } from "../../shared/domain/presentation/emotion";
import { resolveEmotionCue } from "../../shared/ui/patterns/emotion-cues";
import { EMOTE_LABELS, EMOTE_IDS } from "../../shared/ui/patterns/emotes";
import { mergeEmote, type ParamMap, type EmoteState } from "./params";
import { MOTION_LABELS } from "../../shared/ui/patterns/motions";
import type { RpActor, RpMessage, RpSeat } from "../../shared/ui/patterns/rp-stage";
import { ROSTER, NAME_BY_ID } from "./characters";
import background from "../../assets/backgrounds/manor-night-gallery.jpg";
import "../../shared/ui/styles/dialogue.css";
import "./emotion-preview.css";

/** Real stage, real profiles. Controls are tooling only, never part of a game dialogue. */
export function EmotionPreview({params, emotes, onClose}: {params: ParamMap; emotes: EmoteState; onClose: () => void}) {
  const [ids, setIds] = useState({left:"eustice", right:"marietta"});
  const [messages, setMessages] = useState<RpMessage[]>([]);
  const [selected, setSelected] = useState({left:"neutral", right:"neutral"});
  const actors = useMemo<RpActor[]>(() => Object.values(ids).map(id => ({
    id, name:NAME_BY_ID[id], expression:"a", emotionProfile:CHARACTER_EMOTION_PROFILES[id],
    spriteCalibration: params[id].cal,
    emotePlacements: Object.fromEntries(EMOTE_IDS.map(emote => [emote, mergeEmote(emotes,id,emote)])),
  })), [ids, params, emotes]);
  const play = (side: RpSeat, trigger: string) => {
    setSelected(prev => ({...prev,[side]:trigger}));
    // An explicit tool replay briefly resets derived state, without remounting the stage/entry.
    setMessages(prev => [...prev, {id:`reset-${prev.length}`,kind:"say",actorId:ids[side],emotion:trigger === "neutral" ? "smile" : "neutral",text:""},
      {id:`cue-${prev.length}`,kind:"say",actorId:ids[side],emotion:trigger,text:`${NAME_BY_ID[ids[side]]} · ${EMOTION_LABELS[trigger as keyof typeof EMOTION_LABELS] ?? trigger}`}]);
  };
  return <div className="studio emotion-preview">
    <header className="studio-bar">
      <div className="studio-bar__title"><p>ABYSSA · EMOTION DIRECTION</p><h1>情绪联动</h1></div>
      <div className="studio-bar__actions"><span>沿用工作台当前校准 · 点选情绪查看反应</span><button className="studio-btn" onClick={onClose}>返回参数工作台</button></div>
    </header>
    <main className="emotion-preview__stage" aria-label="情绪联动舞台">
      <AdvStage key={`${ids.left}-${ids.right}`} actors={actors} messages={messages} initialSlots={ids} background={background} typing={false} hydrate/>
    </main>
    <div className="emotion-preview__controls">
      {(["left","right"] as const).map(side => {
        const id = ids[side], profile = CHARACTER_EMOTION_PROFILES[id];
        const cue = resolveEmotionCue(actors.find(a => a.id === id)!, selected[side]);
        return <section key={side} aria-label={side === "left" ? "左侧情绪" : "右侧情绪"}>
          <header><select aria-label={side === "left" ? "左侧角色" : "右侧角色"} value={id} onChange={event => {
            setIds(prev => ({...prev,[side]:event.target.value})); setMessages([]); setSelected(prev => ({...prev,[side]:"neutral"}));
          }}>{ROSTER.map(actor => <option key={actor.id} value={actor.id} disabled={actor.id === ids[side === "left" ? "right" : "left"]}>{actor.name}</option>)}</select>
          <button className="studio-btn" onClick={() => play(side,selected[side])}>重播此反应</button></header>
          <p>{profile.direction}</p>
          <div className="emotion-preview__triggers">{[...Object.entries(EMOTION_LABELS), ...Object.keys(profile.specials ?? {}).map(key => [key,key])].map(([trigger,label]) =>
            <button className="studio-btn" key={trigger} data-trigger={trigger} data-on={selected[side] === trigger || undefined} onClick={() => play(side,trigger)}>{label}</button>
          )}</div>
          <output>表情 {cue.expression} · 气泡 {cue.emote ? EMOTE_LABELS[cue.emote] : "无"} · 动作 {cue.motion ? `${MOTION_LABELS[cue.motion.id]} ${cue.motion.amplitude}px / ${cue.motion.duration}ms` : "静止"}</output>
        </section>;
      })}
    </div>
  </div>;
}
