import type { PartyFigureId } from "../../../content/characters/partyFigureCalibration";
import abyssaUrl from "./abyssa.png";
import alvitrUrl from "./alvitr.png";
import eloraUrl from "./elora.png";
import eusticeUrl from "./eustice.png";
import kaelUrl from "./kael.png";
import kororoUrl from "./kororo.png";
import lenoreUrl from "./lenore.png";
import mariettaUrl from "./marietta.png";
import normaUrl from "./norma.png";
import vivienneUrl from "./vivienne.png";
import abyssaStandee from "./standee-abyssa.webp";
import alvitrStandee from "./standee-alvitr.webp";
import eloraStandee from "./standee-elora.webp";
import eusticeStandee from "./standee-eustice.webp";
import kaelStandee from "./standee-kael.webp";
import kororoStandee from "./standee-kororo.webp";
import lenoreStandee from "./standee-lenore.webp";
import mariettaStandee from "./standee-marietta.webp";
import normaStandee from "./standee-norma.webp";
import vivienneStandee from "./standee-vivienne.webp";

export interface PartyFigureCatalogEntry {
  readonly id: PartyFigureId;
  readonly name: string;
  /** 抠好的原图：调校工作台用它看校准。 */
  readonly url: string;
  /** 同一张画布用卡纸刀模切下的立牌（scripts/prepare-map-dossier.py）：
   *  地图上的队伍与名单牌上的立牌都用它，校准原样适用。 */
  readonly standee: string;
}

export const partyFigureCatalog = [
  { id: "abyssa", name: "艾比希斯·贝尔泽兰", url: abyssaUrl, standee: abyssaStandee },
  { id: "alvitr", name: "阿尔薇特·塞维琳", url: alvitrUrl, standee: alvitrStandee },
  { id: "elora", name: "艾洛拉·亚金特", url: eloraUrl, standee: eloraStandee },
  { id: "eustice", name: "尤斯缇丝·格里芬", url: eusticeUrl, standee: eusticeStandee },
  { id: "kael", name: "你", url: kaelUrl, standee: kaelStandee },
  { id: "kororo", name: "柯萝萝·拉普拉斯", url: kororoUrl, standee: kororoStandee },
  { id: "lenore", name: "蕾诺尔·伏尼契", url: lenoreUrl, standee: lenoreStandee },
  { id: "marietta", name: "玛丽埃塔·克雷格", url: mariettaUrl, standee: mariettaStandee },
  { id: "norma", name: "诺玛·洛克", url: normaUrl, standee: normaStandee },
  { id: "vivienne", name: "薇薇安·桑格温", url: vivienneUrl, standee: vivienneStandee }
] as const satisfies readonly PartyFigureCatalogEntry[];

export const partyFigureCatalogById = Object.freeze(
  Object.fromEntries(partyFigureCatalog.map((entry) => [entry.id, entry]))
) as Readonly<Record<PartyFigureId, PartyFigureCatalogEntry>>;
