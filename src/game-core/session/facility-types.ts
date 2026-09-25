import type { FacilityId, FacilityLevel } from "../contracts/facilities";
export type Construction = {roomId: FacilityId; fromLevel: FacilityLevel; toLevel: FacilityLevel; cost: number; readyAt: number};
export type FacilityBatch = {id: string; projectId: string; readyAt: number; remaining: number};
export type FacilityState = {
  startedAt: number; levels: Record<FacilityId, FacilityLevel>;
  enabledBy: Partial<Record<FacilityId, string>>;
  materials: Record<string, number>;
  batches: Partial<Record<FacilityId, FacilityBatch>>;
  selectedProject: string;
  order: {id: string; recipeId: string; quantity: number; readyAt: number} | null;
  reservations: Record<string, number>;
  overflow: Record<string, number>;
  funding?: {seed: string; paidThroughWeek: number; totalGranted: number; lastAmount: number};
  construction?: (Construction & {id: string; startedAt: number}) | null;
};
