/** Shared presentation contracts; model requests remain with the host. */
export type FlowPhase =
  | "waiting" | "running" | "readable" | "failed" | "unsaved" | "interrupted" | "done";

export interface FlowIdentity {
  saveId: string;
  epoch: string;
  family: "director" | "expedition" | "settlement";
  jobId: string;
  frameId: string;
}

/** One frame across multiple execution stages; never key by progress label or render time. */
export function flowKey(identity: FlowIdentity): string {
  return JSON.stringify([identity.saveId, identity.epoch, identity.family, identity.jobId, identity.frameId]);
}

export interface FlowAction {
  id: string;
  label: string;
  /** Helps adapters distinguish explicit network requests from reading or save recovery. */
  effect: "request" | "storage" | "presentation" | "stop";
  enabled: boolean;
  disabledReason?: string;
}

export interface FlowTaskView {
  key: string;
  title: string;
  location: string;
  phase: FlowPhase;
  /** A truthful, player-facing state; no invented percentage or estimated finish time. */
  status: string;
  detail?: string;
  /** Only when this flow has real stages. Never invent a shared three-stage process. */
  stages?: readonly { id: string; label: string; state: "past" | "current" | "next" }[];
  /** Real elapsed time, deliberately outside the status live region. */
  elapsed?: string;
  primary?: FlowAction;
  secondary?: FlowAction;
  /** Small auxiliary controls such as settings, diagnostics, or stopping a request. */
  utilities?: readonly FlowAction[];
  /** Two quiet ends of the footer: connection settings and call history. */
  footerActions?: readonly FlowAction[];
  /** Capabilities come from the current scene; a disabled entry explains how to return. */
  entry?: { enabled: boolean; label: string };
  /** Lock only an indivisible handoff, not the entire duration of a network request. */
  presentationLocked?: boolean;
}

export interface FlowSurfaceActions {
  /** Only changes presentation. Must not abort a request or mark dialogue as read. */
  onMinimize: (key: string) => void;
  /** Host revalidates the current identity and capability before executing. */
  onAction: (key: string, action: FlowAction) => void;
}

export function flowTone(phase: FlowPhase): "quiet" | "active" | "attention" {
  if (phase === "failed" || phase === "unsaved" || phase === "interrupted") return "attention";
  return phase === "running" || phase === "readable" ? "active" : "quiet";
}

/** This is a surface intent only; it neither persists facts nor initiates a request. */
export type FlowDisplay =
  | { phase: "background" }
  | { phase: "open"; key: string }
  | { phase: "closing"; key: string; next: { kind: "background" } | { kind: "open"; key: string } }
  | { phase: "entering-reader"; key: string; panelGone: boolean; expanded: boolean; prepared: boolean }
  | { phase: "reader"; key: string; entrance?: "dissolve" };

export type FlowDisplayEvent =
  | { type: "open"; key: string }
  | { type: "minimize"; key: string }
  | { type: "read"; key: string }
  | { type: "exited"; key: string }
  | { type: "expanded"; key: string }
  | { type: "prepared"; key: string }
  | { type: "restore-reader"; key: string }
  | { type: "leave-reader"; key: string }
  | { type: "reset" };

export function flowDisplayReducer(state: FlowDisplay, event: FlowDisplayEvent): FlowDisplay {
  if (event.type === "reset") return { phase: "background" };
  if (event.type === "restore-reader") return {phase:"reader",key:event.key};
  if (state.phase === "entering-reader") {
    if (event.type === "leave-reader" && event.key === state.key) return {phase:"background"};
    if (!["exited","expanded","prepared"].includes(event.type) || !("key" in event) || event.key !== state.key) return state;
    const next={...state, panelGone:state.panelGone||event.type==="exited", expanded:state.expanded||event.type==="expanded", prepared:state.prepared||event.type==="prepared"};
    return next.panelGone&&next.expanded&&next.prepared ? {phase:"reader",key:next.key,entrance:"dissolve"} : next;
  }
  if (event.type === "open") {
    if (state.phase === "background") return { phase: "open", key: event.key };
    if (state.phase === "reader") return state; // reader owns its own exit choreography
    if (state.phase === "open") return state.key === event.key ? state
      : { phase: "closing", key: state.key, next: { kind: "open", key: event.key } };
    return { ...state, next: { kind: "open", key: event.key } };
  }
  if (event.type === "minimize" && state.phase === "open" && state.key === event.key)
    return { phase: "closing", key: state.key, next: { kind: "background" } };
  if (event.type === "read" && state.phase === "open" && state.key === event.key)
    return { phase: "entering-reader", key: state.key, panelGone:false, expanded:false, prepared:false };
  if (event.type === "exited" && state.phase === "closing" && state.key === event.key) {
    if (state.next.kind === "background") return { phase: "background" };
    return { phase: state.next.kind, key: state.next.key };
  }
  if (event.type === "leave-reader" && state.phase === "reader" && state.key === event.key)
    return { phase: "background" };
  return state;
}
