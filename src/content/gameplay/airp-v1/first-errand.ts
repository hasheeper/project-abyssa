import type { AirpSortieDefinition } from "../../../game-core/contracts";

/** Working authored candidate. Isolated from every released Catalog and PLAYER_CATALOGS. */
export const FIRST_AIRP_ERRAND: AirpSortieDefinition = {
  contractVersion: 1, id: "ripple.elora.old-medicine-case", version: 1,
  tier: "ripple", form: "sortie", title: "旧药箱的搭扣",
  themeKey: "supplies.recover-empty-medicine-case", tags: ["supplies.recovery", "care.practical"], actorIds: ["elora"],
  offerPhases: 8, volatility: "inert", acceptedDeadline: null, cooldownPhases: 256,
  objective: {
    kind: "room-evidence-return", routeId: "old-manor.maintenance",
    roomDefinitionId: "room.old-manor.maintenance.layer-3", layer: 3, roomIndex: 0,
    evidenceId: "evidence.elora.empty-medicine-case", successOutcomes: ["extracted", "cleared"], onWipe: "retry",
  },
  reward: { kind: "memory-only", memoryKey: "memory.elora.returned-medicine-case" },
  scenes: {
    offer: "airp.elora.case.offer", departure: "airp.elora.case.departure", found: "airp.elora.case.found",
    "return-extracted": "airp.elora.case.return-extracted", "return-cleared": "airp.elora.case.return-cleared",
    retry: "airp.elora.case.retry", declined: "airp.elora.case.declined", expired: "airp.elora.case.expired",
  },
};
