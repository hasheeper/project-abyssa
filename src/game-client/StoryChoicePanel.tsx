import type { AuthoredUserChoice, UserChoiceTone } from "../content/presentation/authored-story";

const toneLabel: Record<UserChoiceTone, string> = {
  iron: "指令",
  seasoned: "拿捏",
  pragmatic: "包容",
};

/** A decision beat belongs to the ADV stage and never opens a modal. */
export function StoryChoicePanel({choice, disabled, onChoose}: {choice:AuthoredUserChoice;disabled:boolean;onChoose:(tone:UserChoiceTone)=>void}) {
  return <section className="story-choice" aria-label={choice.prompt} onClick={event=>event.stopPropagation()}>
    <p className="story-choice__prompt">{choice.prompt}</p>
    <div className="story-choice__options">
      {choice.options.map(option=><button key={option.tone} type="button" disabled={disabled} data-tone={option.tone} onClick={()=>onChoose(option.tone)}>
        <small>{toneLabel[option.tone]}</small>
        <strong>{option.label}</strong>
      </button>)}
    </div>
  </section>;
}
