import type { DirectorCommand, DirectorMaterial, DirectorState } from "../game-application/airp-director/contracts";
import { directorHash } from "../game-core/session";
import { HOUSEHOLD_RESIDENT_CAST } from "../content/gameplay/airp-director/residents";
import { householdDirectorDocuments } from "../content/presentation/airp/household-documents";
import { householdLowR8Source } from "../content/presentation/airp/low-r8-source";
import { historicalDirectorConfiguration, historicalAirpMaterial } from "./historical-airp-configuration";

export const FORMAL_AIRP_VERSION = 28;
const residentHash = directorHash(HOUSEHOLD_RESIDENT_CAST), lowMaterialHash = directorHash(householdLowR8Source), documentsHash = directorHash(householdDirectorDocuments);

/** One source list for formal day planning, scene GM/Low and home settlement. */
export function formalDirectorMaterial(connection: DirectorMaterial): DirectorMaterial {
  // Activation and offstage briefs require the v7 source reader. Preserve the
  // player's connection/preset; old jobs retain their original material snapshot.
  return {...connection, resources: {...connection.resources, version: Math.max(7, connection.resources.version), sources: structuredClone(householdDirectorDocuments)}};
}

export function directorConfiguration(contentVersion: number, connection: DirectorMaterial): Extract<DirectorCommand, {type: "airp-director-configure"}> {
  if (contentVersion !== FORMAL_AIRP_VERSION) return historicalDirectorConfiguration(contentVersion, connection);
  return {type: "airp-director-configure", material: formalDirectorMaterial(connection), lowMaterial: householdLowR8Source,
    lowReadVersion: 6, lowContextVersion: 21, residentCast: HOUSEHOLD_RESIDENT_CAST};
}

export function needsFormalResidentUpgrade(state: DirectorState): boolean {
  if (directorHash(state.residentCast ?? null) !== residentHash ||
    state.lowReadVersion !== 6 || state.lowContextVersion !== 21 ||
    directorHash(state.lowMaterial ?? null) !== lowMaterialHash) return true;
  if (!state.materialHash) return false;
  const material = state.materials[state.materialHash];
  return material.resources.version < 7 || directorHash(material.resources.sources) !== documentsHash;
}

export function formalResidentUpgrade(state: DirectorState): Extract<DirectorCommand, {type: "airp-director-enable-residents"}> {
  return {type: "airp-director-enable-residents", residentCast: HOUSEHOLD_RESIDENT_CAST, lowMaterial: householdLowR8Source,
    ...(state.materialHash ? {material: formalDirectorMaterial(state.materials[state.materialHash])} : {})};
}

export function airpMaterialForVersion(contentVersion: number) {
  return contentVersion === FORMAL_AIRP_VERSION ? householdLowR8Source : historicalAirpMaterial(contentVersion);
}
