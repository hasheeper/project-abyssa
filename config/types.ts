export type EntryKind = "game" | "lab" | "tool";
export type AssetProfile = "mansion" | "paper-dolls" | "emotes";
export type Entry = {
  id: string;
  html: string;
  kind: EntryKind;
  port: number;
  open?: boolean;
  navigationDependencies: string[];
  assetProfiles: AssetProfile[];
};
export type Target = {
  id: string;
  entries: Entry[];
  home: string | "tools-index";
  outDir: string;
  port: number;
  open: boolean;
  profile: "ui" | "release" | "readable";
};
export type TargetOptions = {
  outDir?: string;
  port?: number;
  host?: string;
  open?: boolean;
  enableAi?: boolean;
  base?: string;
};
