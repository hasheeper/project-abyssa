export type LootDefinition = {
  id: string; resultId: string; appraisalFee: number; salePrice: number;
  /** One owned instance is one indivisible lot; quantity is its physical item count. */
  quantity?: number; initiallyKnown?: boolean; sellable?: boolean; scrapPrice?: number;
  freeAppraisalGrantIds?: string[];
  /** Optional scrap included when a lot from the same claim is sold. */
  bundleWith?: string;
};
export type LootGrant = {id: string; definitionId: string; routeId: string; roomId: string};
export type LootTable = {id: string; entries: {definitionId: string | null; weight: number}[]};
export type LootRoomTable = {
  id: string; routeId: string; roomId: string; tableIds: string[];
  curio?: {tableId: string; chance: number};
};
export type LootTables = {version: 1; tables: Record<string, LootTable>; rooms: LootRoomTable[]};
export type LootContent = {quoteVersion: number; definitions: Record<string, LootDefinition>; grants: LootGrant[]; dropTables?: LootTables};
export type LootDrop = {instanceId: string; definitionId: string; grantId: string; runId: string; roomId: string};
export type OwnedLoot = (LootDrop | {
  instanceId: string; definitionId: string; grantId: string;
  source: "tutorial-skip"; runId?: never; roomId?: never;
}) & {claimId: string; resultId: string | null; shopVisitOffer?: 1; sampled?: true};
export type LootTrade = {id: string; kind: "appraise" | "sell"; item: OwnedLoot; gold: number};
