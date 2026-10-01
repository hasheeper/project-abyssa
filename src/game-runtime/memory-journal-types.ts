/** Read-only, public prose. No generation inputs, GM notes or gameplay commands. */
export type MemorySource = {
  kind: "authored" | "director" | "airp" | "expedition";
  saveId: string; epoch: string; revision: number; factId: string;
  sceneId: string; lineId: string;
  /** Authored reference unlocked by skipping, rather than an acknowledged read. */
  acquisition?: "tutorial-skip";
};
/** Frozen presentation only. It contains no executable choices or live scene handles. */
export type MemoryStage = {
  background: { kind: "asset"; url: string } | { kind: "mansion"; locationId?: string; phase: number };
  actorId?: string; emotion?: string; expression?: string;
  actors?: readonly { characterId: string; emotion?: string }[];
  initialSlots?: { left?: string; right?: string };
  offstageActorId?: string;
  portraits?: Readonly<Record<string, string>>;
};
export type MemoryBlock = { text: string; speaker?: string; kind?: "choice" | "receipt"; source?: MemorySource; stage?: MemoryStage;
  frame?: import("./memory-narrative").NarrativeFrame | import("../content/presentation/narrative-layout").AvgFrame;
  choice?: { choiceId: string; optionId: string } };
export type MemoryEntry = {
  id: string; day: number | null; phase: string; sequence: number;
  title: string; preview: string; summary?: string; actors: readonly string[];
  /** Public subject words used by the shared SVG catalogue's keyword matcher. */
  iconKeywords?: readonly string[];
  location?: string; artwork?: string; blocks: readonly MemoryBlock[];
  replay?: "scene";
  /** Authoritative hierarchy. blocks is a compatibility transcript of these acts. */
  narrative?: import("./memory-narrative").NarrativeEvent;
  recordedDays?: readonly (number | null)[];
};
export type MemoryJournalIssue = { source: string; message: string };
export type MemoryJournalData =
  | { status: "ready"; entries: readonly MemoryEntry[]; issues?: readonly MemoryJournalIssue[] }
  | { status: "unavailable"; reason?: "unsupported-version" | "source-unavailable"; message?: string };
