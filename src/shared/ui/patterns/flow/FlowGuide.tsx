import "./flow-guide.css";

export type GuideText = readonly (string | {key: string})[];
export type FlowGuideData = {
  objective?: string;
  description?: string;
  steps: readonly {id: string; label: string; text: GuideText; note?: string; current?: boolean}[];
  note?: string;
};

/** A concise itinerary inside the existing modal, without a second panel. */
export function FlowGuide({guide}: {guide: FlowGuideData}) {
  return <section className="flow-guide" aria-label="任务指引">
    {guide.objective && <p className="flow-guide__objective"><span>目标</span><strong>{guide.objective}</strong></p>}
    {guide.description && <p className="flow-guide__description">{guide.description}</p>}
    {!!guide.steps.length && <ol className="flow-guide__route" data-objective={!!guide.objective || undefined}>
      {guide.steps.map(step => <li key={step.id} data-current={step.current || undefined}>
        <span className="flow-guide__label">{step.label}</span>
        <p className="flow-guide__text">{step.text.map((part, i) => typeof part === "string" ? part : <em key={i}>{part.key}</em>)}
          {step.note && <small>{step.note}</small>}
        </p>
      </li>)}
    </ol>}
    {guide.note && <p className="flow-guide__notice">{guide.note}</p>}
  </section>;
}
