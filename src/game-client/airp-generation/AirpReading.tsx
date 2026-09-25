import { useMemo } from "react";
import { SceneSequence } from "../../shared/presentation/adv/SceneSequence";
import { PLAYER_ACTOR_ID } from "../../shared/domain/player-identity";
import { Stage } from "../../shared/stage";
import { StoryReading, type StoryReadingProps } from "../StoryReading";
import { storyAssets, storyActors, storyMessages, storySlots } from "../story-actors";
import { usePlayerName } from "../../shared/domain/PlayerIdentity";
import type { ReadingChapter } from "../../shared/presentation/adv/useReadingReview";
import type { ReadingPage } from "../../shared/presentation/adv/ReadingPlayer";
import "../../shared/stage/stage.css";
import { useFlowReaderEntrance } from "./FlowReaderEntrance";

/** Role labels are metadata, not prose. Keep the saved original unchanged. */
export const airpVisibleLines = (lines: StoryReadingProps["lines"]) => lines.map(line => line.kind === "action"
  ? {...line, text: line.text.replace(/^(?:narrator|旁白)[：:][\t ]*/gmi, "")} : line);

/** AIRP is the player's POV. Reuse authored ADV preparation/entrance without changing saved text or progress. */
export type AirpPastScene = {id: string; title: string; lines: StoryReadingProps["lines"]; readCount: number; response?: string; background?: string};
export function AirpReading({ sceneId, previousScenes = [], embedded = false, ...props }: Omit<StoryReadingProps, "offstageActorId"> & { sceneId: string; previousScenes?: AirpPastScene[]; embedded?: boolean }) {
  const playerName = usePlayerName();
  const entrance=useFlowReaderEntrance();
  const lines = useMemo(() => airpVisibleLines(props.lines), [props.lines]);
  const assets = useMemo(() => storyAssets(props.lines, props.background, PLAYER_ACTOR_ID), [props.lines, props.background]);
  const history: ReadingChapter<ReadingPage>[] = previousScenes.filter(s => s.id !== sceneId && s.readCount > 0).map(s => {
    const source = airpVisibleLines(s.lines).slice(0, s.readCount), actors = storyActors(source, playerName);
    const pages = source.map((line, i): ReadingPage => ({id: line.id, actors, background: s.background ?? props.background, initialSlots: storySlots(source, PLAYER_ACTOR_ID),
      messages: storyMessages(source.slice(0, i+1), undefined, playerName).filter(m => m.kind !== "stage" || m.actorId !== PLAYER_ACTOR_ID)
        .map(m => m.kind === "say" && m.actorId === PLAYER_ACTOR_ID ? {...m, offstage: true} : m)}));
    if (s.response && pages.length) pages.push({...pages.at(-1)!, id: `${s.id}:response`, messages: [...pages.at(-1)!.messages, {id:`${s.id}:response`,kind:"choice",text:s.response,sequence:1}]});
    return {id:s.id,title:s.title,pages};
  });
  const content = <SceneSequence openingBlocked={entrance?.blocked} advEntrance={entrance?"dissolve":undefined} onPrepared={entrance?.prepared}
    frame={{ id: `airp-reading:${sceneId}`, kind: "adv", backdrop: props.background, assets,
    content: <StoryReading {...props} sceneId={sceneId} history={history} lines={lines} offstageActorId={PLAYER_ACTOR_ID}/> }}/>;
  // Flow overlays already live in Stage; nesting another scaled canvas shrinks the AVG.
  return embedded ? <div className="airp-reader airp-reader--embedded">{content}</div>
    : <Stage background="var(--abyssa-rp-backdrop)" canvasClassName="airp-reader">{content}</Stage>;
}
