import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { tutorialEntryFixture } from "../../game-client/testing/new-game";
import { GameSessionScope } from "../../game-client/react";
import { useMansionEstate } from "./useMansionEstate";

afterEach(() => {cleanup(); vi.restoreAllMocks();});

it("wires modern equipment into stock without counting worn gear or zero-stock catalogue entries as available", async () => {
  const fixture = await tutorialEntryFixture();
  try {
    const record = fixture.session.getSnapshot().record!;
    const before = structuredClone(record);
    const progression = fixture.runtime.queries.progression(record)!;
    const query = vi.spyOn(fixture.runtime.queries, "progression").mockReturnValue({...progression, inventory: [
      {instanceId: "stored", definitionId: "equipment.spare-blade", grantId: "grant-1", location: {kind: "inventory"}, definition: {id: "equipment.spare-blade", slot: "general", replacement: "attack", power: 1, scope: "all-native-blanks"}},
      {instanceId: "worn", definitionId: "equipment.spare-blade", grantId: "grant-2", location: {kind: "equipped", ownerId: "eustice"}, definition: {id: "equipment.spare-blade", slot: "general", replacement: "attack", power: 1, scope: "all-native-blanks"}},
    ]});
    const supplies = fixture.runtime.queries.journey(record)!.items;
    const {result, rerender} = renderHook(useMansionEstate, {
      wrapper: ({children}: {children: ReactNode}) => <GameSessionScope session={fixture.session}>{children}</GameSessionScope>,
    });
    expect(result.current.fixedEntries).toHaveLength(supplies.length);
    expect(result.current.sandboxEntries).toHaveLength(2);
    expect(result.current.sandboxEntries.find(entry => entry.id === "worn")).toMatchObject({status: "已装备", ownership: "由尤斯缇丝携带"});
    expect(result.current.stockTotal).toBe(supplies.filter(item => item.storedCharges > 0).length + 1);
    expect(result.current.capacity).toBeUndefined();
    const projection = result.current.sandboxEntries;
    const stable = result.current;
    rerender();
    expect(result.current.sandboxEntries).toBe(projection);
    expect(query).toHaveBeenCalledOnce();
    act(() => result.current.toggleStock());
    expect(result.current.stockOpen).toBe(true);
    for (const key of ["levels", "upgrading", "repairProgress", "damaged", "readyProduction", "closeStock", "toggleStock", "advancePhase", "time"] as const) {
      expect(result.current[key]).toBe(stable[key]);
    }
    expect(query).toHaveBeenCalledOnce();
    expect(fixture.session.getSnapshot().record).toEqual(before);
  } finally {fixture.session.dispose();}
});
