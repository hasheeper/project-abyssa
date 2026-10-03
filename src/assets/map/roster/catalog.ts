import type { CharacterArchiveAffiliationTone } from "../../../shared/domain/characters/archive";
import abyssaField from "./field-abyssa.webp";
import alvitrField from "./field-alvitr.webp";
import eloraField from "./field-elora.webp";
import eusticeField from "./field-eustice.webp";
import kororoField from "./field-kororo.webp";
import lenoreField from "./field-lenore.webp";
import mariettaField from "./field-marietta.webp";
import normaField from "./field-norma.webp";
import vivienneField from "./field-vivienne.webp";

/* 出战名单牌：牌底按阵营一张（paper-<阵营>.webp，由 sortie-roster.css 铺），
   每人再叠一张印在拱龛里的专色色场。两者都由
   scripts/prepare-map-dossier.py 离线生成；色场是照着该阵营的纸印的，
   所以这里登记的阵营必须与档案一致（catalog.test.ts 把关）。
   牌顶的立牌不在这里：它就是地图上那枚队伍立牌（../party-figures/catalog.ts）。 */
export interface RosterCardEntry {
  readonly faction: CharacterArchiveAffiliationTone;
  readonly field: string;
}

export const rosterCards = {
  eustice: { faction: "hero-party", field: eusticeField },
  elora: { faction: "hero-party", field: eloraField },
  kororo: { faction: "hero-party", field: kororoField },
  norma: { faction: "hero-party", field: normaField },
  marietta: { faction: "demon-cadre", field: mariettaField },
  alvitr: { faction: "demon-cadre", field: alvitrField },
  lenore: { faction: "demon-cadre", field: lenoreField },
  vivienne: { faction: "demon-cadre", field: vivienneField },
  abyssa: { faction: "demon-lord", field: abyssaField }
} as const satisfies Record<string, RosterCardEntry>;

/** 没有登记的人只印牌底，不借别人的专色。 */
export function rosterCardField(id: string): string | undefined {
  return (rosterCards as Record<string, RosterCardEntry>)[id]?.field;
}
