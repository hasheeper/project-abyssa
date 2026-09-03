import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MapLocationId } from "../types";
import { SORTIE_ORDER_STORAGE_KEY } from "./sortie-model";
import type { SortieMember } from "./sortie-model";
import { useSortie } from "./useSortie";

/* 这组测试绕开 UI 直接打规则层：出发按钮在界面上是禁用的，
   所以「点不动」证明不了「挡得住」。跨文档写 sessionStorage 只有这一道关，
   界面之外的调用路径（键盘、脚本、将来的第二个入口）必须撞在同一堵墙上。 */

function member(id: string, overrides: Partial<SortieMember> = {}): SortieMember {
  return {
    id,
    name: id,
    shortName: id,
    title: "T",
    faction: "hero-party",
    factionLabel: "勇者小队",
    faces: [
      { face: 1, pip: 1, action: "attack", power: 2, fate: "awake", suit: "holy" },
      { face: 2, pip: 2, action: "guard", power: 2, fate: "awake", suit: "holy" }
    ],
    boardingLine: "",
    ...overrides
  };
}

const roster: SortieMember[] = [
  member("ready"),
  member("hurt", { absence: { kind: "injury", reason: "轻伤休养" } })
];
const nodeIds: MapLocationId[] = ["cave", "tower"];

function setup() {
  const onDepart = vi.fn();
  const store = new Map<string, string>();
  const storage = { setItem: (key: string, value: string) => void store.set(key, value) };
  const view = renderHook(() =>
    useSortie({ roster, nodeIds, onDepart, storage, now: () => 1_700_000_000_000 })
  );
  return { view, onDepart, store };
}

describe("useSortie", () => {
  it("refuses to write an order for an empty party even when called directly", () => {
    const { view, onDepart, store } = setup();

    act(() => view.result.current.openNode("cave"));
    expect(view.result.current.rejection).toContain("至少");

    act(() => view.result.current.depart());
    expect(onDepart).not.toHaveBeenCalled();
    expect(store.has(SORTIE_ORDER_STORAGE_KEY)).toBe(false);
  });

  it("previews a wounded member but still refuses to write an illegal order", () => {
    const { view, onDepart, store } = setup();

    act(() => view.result.current.toggleMember("hurt"));
    act(() => view.result.current.toggleMember("ghost"));
    expect(view.result.current.party.memberIds).toEqual(["hurt"]);

    act(() => view.result.current.openNode("cave"));
    expect(view.result.current.rejection).toContain("出不了门");
    act(() => view.result.current.depart());
    expect(onDepart).not.toHaveBeenCalled();
    expect(store.has(SORTIE_ORDER_STORAGE_KEY)).toBe(false);
  });

  it("writes the order once the party is legal", () => {
    const { view, onDepart, store } = setup();

    act(() => view.result.current.openNode("cave"));
    act(() => view.result.current.toggleMember("ready"));
    expect(view.result.current.rejection).toBeNull();

    act(() => view.result.current.depart());
    expect(JSON.parse(store.get(SORTIE_ORDER_STORAGE_KEY)!)).toMatchObject({
      version: 1,
      nodeId: "cave",
      memberIds: ["ready"],
      diceCount: 2
    });
    expect(onDepart).toHaveBeenCalledTimes(1);
  });

  /* 从委托进的配队，编完要回到那份委托 ——
     玩家的意图是改这一趟的队，不是取消这一趟。 */
  it("returns to the originating quest after editing the party", () => {
    const { view } = setup();

    act(() => view.result.current.openNode("tower"));
    act(() => view.result.current.openTeam("tower"));
    expect(view.result.current.mode).toBe("team");

    act(() => view.result.current.finishTeam());
    expect(view.result.current.mode).toBe("pop");
    expect(view.result.current.activeNode).toBe("tower");
  });

  it("falls back to the bare map when the party was opened on its own", () => {
    const { view } = setup();

    act(() => view.result.current.openTeam(null));
    act(() => view.result.current.finishTeam());
    expect(view.result.current.mode).toBe("map");
    expect(view.result.current.activeNode).toBeNull();
  });
});
