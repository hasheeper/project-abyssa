import type { MansionPhaseId } from "./data";
import type { MansionArtwork } from "./mansion-assets";

export type MansionClock = {day: number; phase: MansionPhaseId};
export type MansionJob = "entry" | "advance" | "refresh" | "sync" | "weather";
export const MANSION_PASSAGE_TIMING = {cover: 420, settle: 620, reveal: 660} as const;
export type MansionPresentation = {
  id: number;
  job: MansionJob;
  step: "cover" | "work" | "paint" | "reveal" | "ready" | "error";
  clock: MansionClock;
  origin: MansionClock;
  destination: MansionClock;
  artwork: MansionArtwork | null;
  error: string;
};
export const sameMansionClock = (a: MansionClock, b: MansionClock) => a.day === b.day && a.phase === b.phase;
export function initialMansionPresentation(clock: MansionClock): MansionPresentation {
  return {id: 0, job: "entry", step: "work", clock, origin: clock, destination: clock, artwork: null, error: ""};
}
type Event =
  | {type: "start"; job: MansionJob; destination: MansionClock}
  | {type: "covered"; id: number}
  | {type: "prepared"; id: number; artwork: MansionArtwork; clock: MansionClock}
  | {type: "reveal"; id: number}
  | {type: "ready"; id: number}
  | {type: "failed"; id: number; error: string};

/** One state machine owns the loading screen and displayed clock. Async results
 * from older visits/jobs cannot reopen the screen or publish an obsolete phase. */
export function mansionPresentationReducer(state: MansionPresentation, event: Event): MansionPresentation {
  if (event.type === "start") return {
    ...state, id: state.id + 1, job: event.job,
    // Only a fully displayed scene fades into the cover. A restarted job under
    // an existing cover must stay opaque rather than expose unfinished work.
    step: state.step === "ready" && state.artwork ? "cover" : "work",
    origin: state.clock, destination: event.destination, error: ""
  };
  if (event.id !== state.id) return state;
  if (event.type === "covered") return state.step === "cover" ? {...state, step: "work"} : state;
  if (event.type === "prepared") return state.step === "work" ? {...state, step: "paint", artwork: event.artwork, clock: event.clock, destination: event.clock} : state;
  if (event.type === "reveal") return state.step === "paint" ? {...state, step: "reveal"} : state;
  if (event.type === "ready") return state.step === "reveal" ? {...state, step: "ready"} : state;
  return {...state, step: "error", error: event.error};
}
