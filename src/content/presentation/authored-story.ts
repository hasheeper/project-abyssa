import { PLAYER_ACTOR_ID } from "../../shared/domain/player-identity";

export type UserChoiceTone = "iron" | "seasoned" | "pragmatic";

export type AuthoredUserChoiceOption = {
  tone: UserChoiceTone;
  /** Concrete action first, then an optional short attitude line. */
  label: string;
  action: string;
  line?: string;
};

export type AuthoredDialogueLine = {
  id: string;
  kind?: "line";
  characterId?: string;
  name?: string;
  text: string;
  expression?: string;
  emotion?: string;
};

export type AuthoredAction = {
  id: string;
  kind: "action";
  text: string;
  characterId?: undefined;
  name?: string;
  expression?: undefined;
};

export type AuthoredUserChoice = {
  id: string;
  kind: "user-choice";
  prompt: string;
  options: readonly [AuthoredUserChoiceOption, AuthoredUserChoiceOption, AuthoredUserChoiceOption];
  characterId?: undefined;
  name?: undefined;
  /** Mirrors the prompt for generic transcript tooling; it is not rendered as narration. */
  text: string;
  expression?: undefined;
};

export type AuthoredLine = AuthoredDialogueLine | AuthoredAction | AuthoredUserChoice;
export type AuthoredDecision = { step: number; tone: UserChoiceTone };

export function isUserChoice(line: AuthoredLine | undefined): line is AuthoredUserChoice {
  return line?.kind === "user-choice";
}

export function selectedChoiceLine(choice: AuthoredUserChoice, tone: UserChoiceTone): AuthoredDialogueLine | AuthoredAction {
  const option = choice.options.find(item => item.tone === tone) ?? choice.options[2];
  return option.line
    ? { id: choice.id, characterId: PLAYER_ACTOR_ID, text: option.line }
    : { id: choice.id, kind: "action", text: option.action };
}

export function choicesByStep(decisions: readonly AuthoredDecision[]): ReadonlyMap<number, UserChoiceTone> {
  return new Map(decisions.map(decision => [decision.step, decision.tone]));
}
