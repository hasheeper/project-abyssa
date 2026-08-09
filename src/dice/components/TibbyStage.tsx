import { useEffect, useState } from "react";
import { Nameplate } from "../../components/Nameplate";
import { RpgDialogue } from "../../components/RpgDialogue";
import { MOODS } from "../game";
import type { MoodKey } from "../game";
import { WoodCorners } from "./WoodCorners";

interface TibbyStageProps {
  dialogue: string;
  dialogueKey: number;
  moodKey: MoodKey;
}

export function TibbyStage({ dialogue, dialogueKey, moodKey }: TibbyStageProps) {
  const mood = MOODS[moodKey];
  const [expression, setExpression] = useState(mood.expression);

  useEffect(() => {
    setExpression(mood.expression);
    if (mood.expression !== "amused" && mood.expression !== "surprised") return;
    const timer = window.setTimeout(() => setExpression("calm"), 850);
    return () => window.clearTimeout(timer);
  }, [dialogueKey, mood.expression]);

  return (
    <aside className="tibby-stage">
      <div className="tibby-stage__recess">
        <span className="tibby-stage__backplate" aria-hidden="true" />
        <figure className="portrait-panel wood-panel" data-expression={expression}>
          <div className="portrait-panel__background"><div className="diamond-pattern" /><span className="portrait-panel__halo" aria-hidden="true" /></div>
          <div className="portrait-panel__image" key={dialogueKey}>
            <img src="https://files.catbox.moe/0d7uzq.png" alt="缇比·奥雷利亚" />
          </div>
          <Nameplate className="portrait-panel__nameplate" name="缇比·奥雷利亚" secondaryName="TIBBY AURELIA" />
          <WoodCorners />
        </figure>
        <span className="tibby-stage__divider" aria-hidden="true">
          <i data-part="rail" />
          <b data-part="mark" />
          <i data-part="rail" />
        </span>
        <RpgDialogue
          key={dialogueKey}
          className="tibby-dialogue"
          name="缇比"
          text={dialogue}
          showNameplate={false}
          typing
          typingSpeed={31}
          autoHeight
          aria-live="polite"
        />
      </div>
    </aside>
  );
}
