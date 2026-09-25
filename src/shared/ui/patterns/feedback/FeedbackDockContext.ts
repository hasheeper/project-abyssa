import { createContext } from "react";
import type { SceneFeedbackEntry } from "./types";

export type DockFeedback = { entries: readonly SceneFeedbackEntry[]; paused: boolean; dismiss: (id: string) => void };
export const FeedbackDockContext = createContext<((id: string, value: DockFeedback | null) => void) | null>(null);
