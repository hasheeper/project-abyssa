export type ManorContent = {
  firstClearRouteId: string;
  maintenanceRouteId: string;
  boss: { definitionId: string; guestId: string; maxGuests: number; summonBudget: number };
  firstClearReward: { id: string; gold: number };
  storyId: string;
};
