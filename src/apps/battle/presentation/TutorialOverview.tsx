import { useState } from "react";
import { AbyssaProvider } from "../../../shared/ui/primitives/AbyssaProvider";
import { RpgFrame } from "../../../shared/ui/primitives/RpgFrame";
import { RpgShapeButton } from "../../../shared/ui/primitives/RpgShapeButton";
import { HandbookReader, handbookCopy as copy, type HandbookPage } from "./GameHandbook";

/** Same manual as in-battle help, not a simulated tutorial run. */
export function TutorialOverview({busy, error, onBegin, onReturn}: {
  busy: boolean; error: string; onBegin: () => void; onReturn: () => void;
}) {
  const [page, setPage] = useState<HandbookPage>({chapter: 0, section: 0});
  return <AbyssaProvider className="tutorial-overview">
      <main aria-label={copy.title}>
        <RpgFrame className="tutorial-overview__frame" padding="lg">
          <header className="tutorial-overview__header">
            <p className="tutorial-overview__eyebrow">ABYSSA / PLAY GUIDE</p>
            <h1>{copy.title}</h1><p>{copy.intro}</p>
          </header>
          <HandbookReader page={page} onPage={setPage}/>
          <footer className="tutorial-overview__footer">
            {(error || busy) && <p className="tutorial-overview__status" role="status">{error || copy.ui.preparing}</p>}
            <div className="tutorial-overview__actions">
              <RpgShapeButton label={copy.ui.return} disabled={busy} onClick={onReturn}/>
              <RpgShapeButton label={error ? copy.ui.retry : copy.ui.begin} variant="teal" disabled={busy} onClick={onBegin}/>
            </div>
          </footer>
        </RpgFrame>
      </main>
    </AbyssaProvider>;
}
