import { useCallback, useMemo, useState } from "react";
import type { MapLocationId } from "../types";
import {
  EMPTY_SORTIE_PARTY,
  buildSortieOrder,
  explainSortieOrderRejection,
  reconcileParty,
  saveSortieOrder,
  setCommandMode,
  toggleRosterMember
} from "./sortie-model";
import type { SortieMember, SortieParty } from "./sortie-model";

/* ============ 出击面板的三态机 ============
 *
 *   map   —— 只有地图。队伍缩在左下角。
 *   team  —— 配队。队伍铺开，名单抽屉升起。
 *   pop   —— 委托侧板。点地标进入。
 *
 * 三者互斥。互斥是刻意的：同时开两层浮层会让「点空白关掉哪一层」
 * 变成不可预测的问题，也会让地图彻底被遮住。
 *
 * backTo 记住「从委托点进配队」的来路，编完队回到那份委托，
 * 而不是掉回裸地图 —— 玩家的意图是改这一趟的队，不是取消这一趟。 */

export type SortieMode = "map" | "team" | "pop";

export interface UseSortieOptions {
  roster: readonly SortieMember[];
  nodeIds: readonly MapLocationId[];
  /** 出发。默认写 sessionStorage 后由调用方决定去向。 */
  onDepart: (nodeId: MapLocationId, party: SortieParty) => void;
  storage?: Pick<Storage, "setItem">;
  now?: () => number;
}

export function useSortie({ roster, nodeIds, onDepart, storage, now }: UseSortieOptions) {
  const [mode, setMode] = useState<SortieMode>("map");
  const [party, setParty] = useState<SortieParty>(EMPTY_SORTIE_PARTY);
  const [activeNode, setActiveNode] = useState<MapLocationId | null>(null);
  const [backTo, setBackTo] = useState<MapLocationId | null>(null);

  const toggleMember = useCallback(
    (memberId: string) => setParty((current) => toggleRosterMember(roster, current, memberId)),
    [roster]
  );

  const toggleCommand = useCallback(
    () =>
      setParty((current) =>
        setCommandMode(current, current.command === "personal" ? "delegate" : "personal")
      ),
    []
  );

  const openTeam = useCallback((fromNode?: MapLocationId | null) => {
    setBackTo(fromNode ?? null);
    setMode("team");
  }, []);

  const openNode = useCallback((nodeId: MapLocationId) => {
    setActiveNode(nodeId);
    setBackTo(null);
    setMode("pop");
  }, []);

  const closeAll = useCallback(() => {
    setActiveNode(null);
    setBackTo(null);
    setMode("map");
  }, []);

  /** 编队完成：有来路就回委托，否则回地图。 */
  const finishTeam = useCallback(() => {
    if (backTo) {
      setActiveNode(backTo);
      setBackTo(null);
      setMode("pop");
      return;
    }
    closeAll();
  }, [backTo, closeAll]);

  /** 点遮罩：配队态等同完成，委托态等同关闭。 */
  const dismiss = useCallback(() => {
    if (mode === "team") finishTeam();
    else closeAll();
  }, [mode, finishTeam, closeAll]);

  /* 名单可能在配队期间变化。渲染前先对账，只剔除已从名单消失的 id；
     伤势/缺骰面成员仍留在预览队伍，真正出发时再由 rejection 拦截。 */
  const reconciled = useMemo(() => reconcileParty(roster, party), [roster, party]);

  const rejection = useMemo(
    () =>
      activeNode === null
        ? "还没选目的地。"
        : explainSortieOrderRejection(roster, nodeIds, activeNode, reconciled),
    [roster, nodeIds, activeNode, reconciled]
  );

  const depart = useCallback(() => {
    if (activeNode === null) return;
    if (explainSortieOrderRejection(roster, nodeIds, activeNode, reconciled) !== null) return;
    const order = buildSortieOrder(activeNode, reconciled, (now ?? Date.now)());
    const target = storage ?? (typeof sessionStorage === "undefined" ? null : sessionStorage);
    if (target) saveSortieOrder(target, order);
    onDepart(activeNode, reconciled);
  }, [activeNode, roster, nodeIds, reconciled, now, storage, onDepart]);

  return {
    mode,
    party: reconciled,
    activeNode,
    rejection,
    toggleMember,
    toggleCommand,
    openTeam,
    openNode,
    finishTeam,
    closeAll,
    dismiss,
    depart
  };
}
