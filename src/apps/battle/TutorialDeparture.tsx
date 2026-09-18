import { useEffect, useRef } from "react";
import { useGameSession, useGameState } from "../../game-client/react";
import { GameLoading } from "../../game-client/GameLoading";
import { DiceActionButton } from "../../shared/ui/patterns/action-dock/DiceActionButton";

/** One authoritative departure, including the fixed party/allowance and saved continuation seed. */
export function TutorialDeparture() {
  const session = useGameSession(), game = useGameState();
  const started = useRef(false), submitting = useRef(false);
  const begin = async () => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      // Refresh replays the original pending request on storage failure, rather
      // than creating another run. An already committed departure won't repeat.
      if (session.getSnapshot().error) await session.refresh();
      const record = session.getSnapshot().record;
      if (!record || session.getSnapshot().status !== "ready") return;
      const tutorial = session.runtime.queries.tutorial(record);
      if (!tutorial?.canBegin) return;
      await session.dispatch({type: "start-expedition", runId: session.runtime.newId(), routeId: tutorial.routeId,
        partyIds: tutorial.partyIds, itemIds: tutorial.itemIds, seed: session.runtime.newSeed()});
    } finally { submitting.current = false; }
  };
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void begin();
  }, []);
  return game.error ? <section className="game-client-gate"><DiceActionButton label="重试出发" onClick={() => void session.refresh().then(begin)}/></section> : <GameLoading/>;
}
