import type { DirectorCommand, DirectorMaterial } from "../game-application/airp-director/contracts";
import { activatedDirectorDocuments } from "../content/presentation/airp/director-documents";
import { lowR8Source } from "../content/presentation/airp/low-r8-source";

/** Compatibility for already-existing content19/22/24/26 saves. New games use content28. */
export function historicalDirectorConfiguration(contentVersion: number, connection: DirectorMaterial): Extract<DirectorCommand, {type: "airp-director-configure"}> {
  if (![19, 22, 24, 26].includes(contentVersion)) throw Error("该存档不支持 AIRP 日程配置。");
  return {type: "airp-director-configure", material: {...connection, resources: {...connection.resources, version: Math.max(7, connection.resources.version), sources: structuredClone(activatedDirectorDocuments)}},
    ...([22, 24, 26].includes(contentVersion) ? {lowMaterial: lowR8Source, lowReadVersion: 6, lowContextVersion: 21} : {})};
}
export function historicalAirpMaterial(contentVersion: number) {
  if (![22, 24, 26].includes(contentVersion)) throw Error("该存档没有正式 AIRP 结算配置。");
  return lowR8Source;
}
