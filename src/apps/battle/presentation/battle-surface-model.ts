import type { CSSProperties } from "react";
/** UI-only values. A manor run is never cast to legacy battle state. */
export type BattleSurfaceMember = {
  id: string;
  hp: number;
  maxHp: number;
  returnHp: number;
  downed: boolean;
  shield: number;
  shieldLabel?: string;
  ready: boolean;
  healable: boolean;
  incoming: { raw: number; final: number };
};
export type BattleSurfaceEnemy = {
  id: string;
  name: string;
  art: string;
  artUrl: string;
  artStyle?: CSSProperties;
  hp: number;
  maxHp: number;
  attack: number;
  blocked: number;
  intent: {
    type: string;
    title: string;
    value?: number;
    targetId?: string;
    description?: string;
  } | null;
  defeated: boolean;
  frenzyWarning: number | null;
  frenzyActive: boolean;
  threat: "blocked" | "normal" | "lethal" | null;
  targetable: boolean;
  intentBlockable: boolean;
};

export type BattleEnemyFx = Omit<
  import("./useExpeditionBattlePresentation").EnemyTurnFx,
  "intent" | "intentType"
> & {
  intentType: string;
  intent: NonNullable<BattleSurfaceEnemy["intent"]>;
};
