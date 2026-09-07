import { d5EncounterView } from "./d5-views";
import type { AnyGameRecord } from "../game-application";
import { projectCharacterHistory } from "../game-application";
import {
  getEffectiveFaceQuality,
  demoFace,
  resolveDemoCharacter,
} from "../game-core/battle";
import type { CatalogRegistry } from "./catalogs";

/** Validate once per record, then project all members from the same head. No presentation imports. */
export function createCharacterArchiveQuery(registry: CatalogRegistry) {
  return (raw: AnyGameRecord) => {
    const record = registry.read(raw),
      entry = registry.resolve(record.schemaVersion, record.contentRef);
    const base = {
      head: record.head,
      contentRef: record.contentRef,
      runRef: record.schemaVersion === 4 ? record.snapshot.campaign.activeRunRef : record.schemaVersion === 1 ? record.snapshot.expedition ? {kind: "expedition" as const, id: record.snapshot.expedition.id} : null : record.snapshot.campaign.activeRunRef,
      simulation: record.contentRef.catalogId.startsWith("abyssa.fixture."),
    };
    if (record.schemaVersion === 1 && entry.version === 1) {
      const c = entry.catalog.data,
        expedition = record.snapshot.expedition;
      const context = {
        catalog: c,
        routeId: expedition?.routeId ?? c.defaultRouteId,
        partyOrder: expedition?.party.map((p) => p.id) ?? c.defaultParty,
      };
      return {
        ...base,
        version: 1 as const,
        leaderId: c.leaderId,
        runId: expedition?.id ?? null,
        characters: Object.values(c.characters).map((ch) => {
          const member = expedition?.party.find((p) => p.id === ch.id);
          const equipment = (
            member
              ? expedition!.loadout.equipment
              : record.snapshot.campaign.inventory.equipment
          ).filter((e) => e.ownerId === ch.id);
          return {
            version: 1 as const,
            id: ch.id,
            name: ch.name,
            available: record.snapshot.campaign.availableCharacterIds.includes(
              ch.id,
            ),
            inRun: !!member,
            hp: member?.hp ?? null,
            maxHp: c.balance.MAX_HP,
            downed: member?.downed ?? false,
            faces: ch.faces.map((face, index) => ({
              ...face,
              quality: getEffectiveFaceQuality(
                context,
                ch.id,
                index,
                member?.rustLevel ?? 0,
              ),
              baseQuality: face.quality,
            })),
            equipment,
            history: projectCharacterHistory(record, ch.id),
          };
        }),
      };
    }
    if (record.schemaVersion !== 1 && entry.version !== 1) {
      const c = entry.catalog.data,
        battle = record.schemaVersion === 4 ? d5EncounterView(record) : record.snapshot.expedition;
      return {
        ...base,
        version: 2 as const,
        leaderId: c.leaderId,
        runId: battle?.run.id ?? null,
        characters: Object.values(c.characters).map((ch) => {
          const member = battle?.run.party.find((m) => m.id === ch.id);
          const progress = member
            ? battle!.run.progress
            : record.snapshot.campaign.progress;
          const config =
            member?.config ?? resolveDemoCharacter(c, progress, ch.id);
          const growth = Object.values(c.growth).find(
            (g) => g.ownerId === ch.id && g.level === config.level + 1,
          );
          const next = growth
            ? resolveDemoCharacter(
                c,
                {
                  ...progress,
                  appliedGrowthIds: [...progress.appliedGrowthIds, growth.id],
                },
                ch.id,
              )
            : null;
          return {
            version: 2 as const,
            id: ch.id,
            name: ch.name,
            available: (record.schemaVersion === 4 ? record.snapshot.campaign.availableCharacterIds : c.profiles[record.profileId].availableCharacterIds).includes(ch.id),
            inRun: !!member,
            hp: member?.hp ?? null,
            maxHp: config.maxHp,
            downed: member?.hp === 0,
            config,
            baseFaces: ch.faces,
            faces: config.faces.map((f, faceIndex) =>
              member
                ? demoFace(battle!, {
                    ownerId: ch.id,
                    faceIndex,
                    loaded: false,
                    sealed: false,
                    spent: false,
                  })!
                : f,
            ),
            temporaryRust: member?.temporaryRust ?? [],
            actions: c.actions,
            equipment: progress.equipment
              .filter((e) => e.ownerId === ch.id)
              .map((e) => ({ ...e, definition: c.equipment[e.definitionId] })),
            generalApplicable: ch.faces.some(
              (f) => c.actions[f.actionId].kind === "blank",
            ),
            formationCovenant: entry.version === 4 && ch.id === "marietta",
            covenant: config.covenantId
              ? (c.covenants[config.covenantId] ?? null)
              : null,
            next,
            growth: growth ?? null,
            teamLevel3Ids: progress.appliedGrowthIds
              .filter((id) => c.growth[id].level === 3)
              .map((id) => c.growth[id].ownerId),
            history: projectCharacterHistory(record, ch.id),
          };
        }),
      };
    }
    throw new Error("Record and Catalog version mismatch");
  };
}
export type CharacterArchiveView = ReturnType<
  ReturnType<typeof createCharacterArchiveQuery>
>;
export type ArchiveCharacterView = CharacterArchiveView["characters"][number];
