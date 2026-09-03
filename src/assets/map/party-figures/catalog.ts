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

export interface PartyFigureCatalogEntry {
  readonly id: PartyFigureId;
  readonly name: string;
  readonly url: string;
}

export const partyFigureCatalog = [
  { id: "abyssa", name: "艾比希斯·贝尔泽兰", url: abyssaUrl },
  { id: "alvitr", name: "阿尔薇特·塞维琳", url: alvitrUrl },
  { id: "elora", name: "艾洛拉·亚金特", url: eloraUrl },
  { id: "eustice", name: "尤斯缇丝·格里芬", url: eusticeUrl },
  { id: "kael", name: "凯尔", url: kaelUrl },
  { id: "kororo", name: "柯萝萝·拉普拉斯", url: kororoUrl },
  { id: "lenore", name: "蕾诺尔·伏尼契", url: lenoreUrl },
  { id: "marietta", name: "玛丽埃塔·克雷格", url: mariettaUrl },
  { id: "norma", name: "诺玛·洛克", url: normaUrl },
  { id: "vivienne", name: "薇薇安·桑格温", url: vivienneUrl }
] as const satisfies readonly PartyFigureCatalogEntry[];

export const partyFigureCatalogById = Object.freeze(
  Object.fromEntries(partyFigureCatalog.map((entry) => [entry.id, entry]))
) as Readonly<Record<PartyFigureId, PartyFigureCatalogEntry>>;
