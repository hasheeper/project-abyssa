import type { DemoCatalog, DemoCatalogRef } from "../../contracts/demo";
import type { D5Catalog, D5CatalogRef } from "../../contracts/d5";
import type { DemoRunState, DemoSupply, DemoBattleState, DemoCheckpoint, DemoEvent } from "./demo-state";

/** Internal shared computation types. Public v2/v3 readers retain their narrow versions. */
export type RuleCatalog = DemoCatalog | D5Catalog;
export type RuleContext = { readonly data: RuleCatalog; readonly ref: DemoCatalogRef | D5CatalogRef };
export type MemorySupply = Omit<DemoSupply, "source"> & { source: "memory.marietta.allowance" };
export type RuleRun = DemoRunState<DemoCatalogRef | D5CatalogRef, DemoSupply | MemorySupply>;
export type RuleBattleState = DemoBattleState<RuleRun>;
export type RuleCheckpoint = DemoCheckpoint<RuleRun>;
export type RuleResolution = { state: RuleBattleState; events: DemoEvent[] };

export type RuleExpeditionRun = DemoRunState<DemoCatalogRef | D5CatalogRef>;
