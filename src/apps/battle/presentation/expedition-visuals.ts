import type { ExpeditionDieSuit } from "../ExpeditionDie3D";
import type { CharacterId, EnemyState } from "../engine";
import type { GlyphName } from "../ExpeditionGlyph";
import kaelPortrait from "../../../assets/characters/portraits/kael.png";
import eusticePortrait from "../../../assets/characters/portraits/eustice.png";
import eloraPortrait from "../../../assets/characters/portraits/elora.png";
import kororoPortrait from "../../../assets/characters/portraits/kororo.png";
import normaPortrait from "../../../assets/characters/portraits/norma.png";
import blightedSentinel from "../../../assets/battle/enemy-blighted-sentinel.png";
import crystallineChoir from "../../../assets/battle/enemy-crystalline-choir.png";
import miasmaAmalgam from "../../../assets/battle/enemy-miasma-amalgam.png";

export interface PartyVisual {
  id: CharacterId;
  name: string;
  nameplate: string;
  portrait: string;
  tone: "steel" | "crimson" | "verdant" | "violet" | "ochre";
  skills: readonly string[];
  themeColor: string;
  suit: ExpeditionDieSuit;
}

export const PARTY_VISUALS: Record<CharacterId, PartyVisual> = {
  kael: {
    id: "kael",
    name: "凯尔",
    nameplate: "KAEL",
    portrait: kaelPortrait,
    tone: "steel",
    skills: ["all-for-one", "sword", "split-cross"],
    themeColor: "#3d6079",
    suit: "holy"
  },
  eustice: {
    id: "eustice",
    name: "尤斯缇丝",
    nameplate: "EUSTICE",
    portrait: eusticePortrait,
    tone: "crimson",
    skills: ["sword", "split-cross", "fast-arrow"],
    themeColor: "#7b342f",
    suit: "holy"
  },
  elora: {
    id: "elora",
    name: "艾洛拉",
    nameplate: "ELORA",
    portrait: eloraPortrait,
    tone: "verdant",
    skills: ["miracle", "wand", "heart"],
    themeColor: "#477051",
    suit: "earth"
  },
  kororo: {
    id: "kororo",
    name: "柯萝萝",
    nameplate: "KORORO",
    portrait: kororoPortrait,
    tone: "violet",
    skills: ["gravity", "star", "moon"],
    themeColor: "#654b72",
    suit: "abyss"
  },
  norma: {
    id: "norma",
    name: "诺玛",
    nameplate: "NORMA",
    portrait: normaPortrait,
    tone: "ochre",
    skills: ["arsenal", "mask", "fast-arrow"],
    themeColor: "#7d643d",
    suit: "earth"
  }
};

export const ENEMY_ART: Record<EnemyState["art"], string> = {
  sentinel: blightedSentinel,
  amalgam: miasmaAmalgam,
  choir: crystallineChoir
};

export const INTENT_GLYPH: Record<string, GlyphName> = {
  attack: "intent-attack",
  charge: "intent-charge",
  seal: "intent-seal",
  countdown: "intent-countdown",
  summon: "intent-summon"
};

export const LOG_TONE_COLOR: Record<string, string> = {
  good: "verdant",
  bad: "enemy",
  gold: "value",
  purple: "loot",
  system: "system"
};
