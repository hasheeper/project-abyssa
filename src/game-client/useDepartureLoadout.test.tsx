import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { tutorialEntryFixture } from "./testing/new-game";
import { availableLoadout, departureLoadoutKey, useDepartureLoadout } from "./useDepartureLoadout";

afterEach(() => {cleanup();sessionStorage.clear();vi.restoreAllMocks();});
it("only carries unique, available, known supplies, at most six by default", () => {
  const items = ["a","b","c","d","e","f","g"].map(id=>({id,availableCharges:2}));
  items.push({id:"empty",availableCharges:0});
  expect(availableLoadout(["unknown","a","a","empty","b",null,"c","d","e","f","g"],items)).toEqual(["a","b","c","d","e","f"]);
  expect(availableLoadout(["a","b","c","d","e"],items,4)).toEqual(["a","b","c","d"]);
  expect(availableLoadout({ids:["a"]},items)).toEqual([]);
});

it("keeps a window-scoped selection across pages and reloads without touching the game record", async () => {
  const f = await tutorialEntryFixture();
  try {
    const record = f.session.getSnapshot().record!, journey = f.session.runtime.queries.journey(record)!;
    const before = structuredClone(record);
    const first = renderHook(() => useDepartureLoadout(record,journey));
    expect(first.result.current.ids).toEqual(["item.food","item.potion"]);
    act(() => first.result.current.setIds(["item.potion"])); first.unmount();
    const map = renderHook(() => useDepartureLoadout(record,journey));
    expect(map.result.current.ids).toEqual(["item.potion"]);
    act(() => map.result.current.setIds([])); map.unmount();
    const reopened = renderHook(() => useDepartureLoadout(record,journey));
    expect(reopened.result.current.ids).toEqual([]); // An intentional empty bag is not defaults.
    expect(f.session.getSnapshot().record).toEqual(before);
    const other = structuredClone(record); other.head.epoch = "other-epoch";
    expect(departureLoadoutKey(other)).not.toBe(departureLoadoutKey(record));
    const switched = renderHook(() => useDepartureLoadout(other,journey));
    expect(switched.result.current.ids).toEqual(["item.food","item.potion"]);
  } finally {cleanup();f.session.dispose();}
});

it("rejects stale unavailable items, handles malformed storage, and reports failed persistence", async () => {
  const f = await tutorialEntryFixture();
  try {
    const record = f.session.getSnapshot().record!, journey = f.session.runtime.queries.journey(record)!;
    sessionStorage.setItem(departureLoadoutKey(record),'["item.food","item.ward","unknown"]');
    const first = renderHook(() => useDepartureLoadout(record,journey));
    expect(first.result.current.ids).toEqual(["item.food"]); first.unmount();
    sessionStorage.setItem(departureLoadoutKey(record),'{malformed');
    const next = renderHook(() => useDepartureLoadout(record,journey));
    expect(next.result.current.ids).toEqual(["item.food","item.potion"]);
    vi.spyOn(Storage.prototype,"setItem").mockImplementation(() => {throw Error("blocked");});
    act(() => next.result.current.setIds(["item.food"]));
    expect(next.result.current.ids).toEqual(["item.food"]);
    expect(next.result.current.storageUnavailable).toBe(true);
  } finally {cleanup();f.session.dispose();}
});
