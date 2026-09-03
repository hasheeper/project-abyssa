import {
  DEFAULT_MANSION_RECTANGLES,
  DEFAULT_MANSION_REGIONS
} from "../../content/mansion/defaultRegions";
import {
  MANSION_PHASES,
  MANSION_ROOM_DETAILS,
  type MansionFund,
  type MansionPhaseId
} from "./data";
import { cleanRegionLabel } from "./mansion-geometry";

export const MAX_FACILITY_LEVEL = 4;
export const REPAIR_STEPS = 3;
const REPAIR_PHASES = 1;
const PROMOTE_COST_FACTOR = 2;
export const MAX_DAMAGED = 3;

export const STOCK_COLUMNS = 6;
export const STOCK_ROWS = 4;
export const STOCK_CAPACITY = STOCK_COLUMNS * STOCK_ROWS * 2;

const MANSION_PRODUCTION_ROOM_IDS = Object.entries(MANSION_ROOM_DETAILS)
  .filter(([, detail]) => detail.production)
  .map(([id]) => id);

const MANSION_REPAIRABLE_ROOM_IDS = Object.entries(MANSION_ROOM_DETAILS)
  .filter(([, detail]) => detail.upgradeCost && detail.fund && !detail.state)
  .map(([id]) => id);

const ROOM_LABELS = new Map(
  [...DEFAULT_MANSION_RECTANGLES, ...DEFAULT_MANSION_REGIONS].map((region) => [
    region.id,
    cleanRegionLabel(region.label)
  ])
);

export type MansionEstateState = {
  phase: MansionPhaseId;
  day: number;
  funds: Record<MansionFund, number>;
  levels: Record<string, number>;
  upgrading: Record<string, number>;
  repairProgress: Record<string, number>;
  damaged: Set<string>;
  readyProduction: Set<string>;
  inventory: Record<string, number>;
};

export type MansionEstateTransition = {
  state: MansionEstateState;
  notice?: string;
};

export function promoteCost(upgradeCost: number): number {
  return upgradeCost * PROMOTE_COST_FACTOR;
}

function fundName(fund: MansionFund): string {
  return fund === "public" ? "维稳公款" : "小队资金";
}

function roomLabel(roomId: string): string {
  return ROOM_LABELS.get(roomId) ?? roomId;
}

export function createMansionEstateState(): MansionEstateState {
  return {
    phase: "day",
    day: 1,
    funds: { public: 12800, party: 1450 },
    levels: Object.fromEntries(
      Object.entries(MANSION_ROOM_DETAILS).map(([id, detail]) => [id, detail.level])
    ),
    upgrading: {},
    repairProgress: {},
    damaged: new Set(["kitchen", "laundry"]),
    readyProduction: new Set(MANSION_PRODUCTION_ROOM_IDS),
    inventory: {}
  };
}

export function previewMansionPhase(
  state: MansionEstateState,
  phase: MansionPhaseId
): MansionEstateTransition {
  if (phase === state.phase) return { state };
  return { state: { ...state, phase } };
}

/**
 * `damageRolls` contains one roll for the amount and one per possible room pick.
 * Passing rolls in makes the transition deterministic and safe to replay in tests.
 */
export function advanceMansionPhase(
  state: MansionEstateState,
  damageRolls: readonly number[]
): MansionEstateTransition {
  const currentIndex = MANSION_PHASES.findIndex((item) => item.id === state.phase);
  const nextIndex = (currentIndex + 1) % MANSION_PHASES.length;
  const nextPhase = MANSION_PHASES[nextIndex]!;
  const completed = Object.entries(state.upgrading)
    .filter(([, remaining]) => remaining <= 1)
    .map(([id]) => id);

  const repairProgress = { ...state.repairProgress };
  for (const id of completed) {
    repairProgress[id] = Math.min((repairProgress[id] ?? 0) + 1, REPAIR_STEPS);
  }

  const upgrading = Object.fromEntries(
    Object.entries(state.upgrading)
      .filter(([, remaining]) => remaining > 1)
      .map(([id, remaining]) => [id, remaining - 1])
  );

  const damaged = new Set(state.damaged);
  for (const id of completed) damaged.delete(id);

  let newlyDamaged = 0;
  if (damaged.size < MAX_DAMAGED) {
    const pool = MANSION_REPAIRABLE_ROOM_IDS.filter(
      (id) => !damaged.has(id) && !state.upgrading[id]
    );
    const availableSlots = MAX_DAMAGED - damaged.size;
    const wanted = Math.min(availableSlots, (damageRolls[0] ?? 1) < 0.35 ? 2 : 1);

    for (let index = 0; index < wanted && pool.length > 0; index += 1) {
      const roll = Math.max(0, Math.min(damageRolls[index + 1] ?? 0, 0.999999999));
      const [picked] = pool.splice(Math.floor(roll * pool.length), 1);
      if (!picked) continue;
      damaged.add(picked);
      newlyDamaged += 1;
    }
  }

  const nextState: MansionEstateState = {
    ...state,
    phase: nextPhase.id,
    day: nextIndex === 0 ? state.day + 1 : state.day,
    upgrading,
    repairProgress,
    damaged,
    readyProduction: new Set(MANSION_PRODUCTION_ROOM_IDS)
  };

  return {
    state: nextState,
    notice: completed.length
      ? `${nextPhase.label}相位 · ${completed.length}处修缮完成`
      : newlyDamaged
        ? `${nextPhase.label}相位 · ${newlyDamaged}处出现损坏`
        : `${nextPhase.label}相位 · 产出结算，角色已换位`
  };
}

export function collectMansionProduction(
  state: MansionEstateState,
  roomId: string
): MansionEstateTransition {
  const production = MANSION_ROOM_DETAILS[roomId]?.production;
  if (!production || !state.readyProduction.has(roomId)) return { state };

  const readyProduction = new Set(state.readyProduction);
  readyProduction.delete(roomId);
  return {
    state: {
      ...state,
      readyProduction,
      inventory: {
        ...state.inventory,
        [production.id]: (state.inventory[production.id] ?? 0) + production.amount
      }
    },
    notice: `已收取 ${production.label} ×${production.amount}${production.unit}`
  };
}

export function startMansionRepair(
  state: MansionEstateState,
  roomId: string
): MansionEstateTransition {
  const detail = MANSION_ROOM_DETAILS[roomId];
  if (!detail?.upgradeCost || !detail.fund || state.upgrading[roomId]) {
    return { state };
  }

  const level = state.levels[roomId] ?? detail.level;
  if (level >= MAX_FACILITY_LEVEL) {
    return { state, notice: "该设施已达到当前最高档位" };
  }
  if ((state.repairProgress[roomId] ?? 0) >= REPAIR_STEPS) {
    return { state, notice: "修缮已完成，可以升级了" };
  }
  if (state.funds[detail.fund] < detail.upgradeCost) {
    return { state, notice: `${fundName(detail.fund)}不足` };
  }

  const damaged = new Set(state.damaged);
  damaged.delete(roomId);
  const step = Math.min((state.repairProgress[roomId] ?? 0) + 1, REPAIR_STEPS);

  return {
    state: {
      ...state,
      funds: {
        ...state.funds,
        [detail.fund]: state.funds[detail.fund] - detail.upgradeCost
      },
      upgrading: { ...state.upgrading, [roomId]: REPAIR_PHASES },
      damaged
    },
    notice: `${roomLabel(roomId)}修缮中 · 第 ${step}/${REPAIR_STEPS} 步`
  };
}

export function promoteMansionFacility(
  state: MansionEstateState,
  roomId: string
): MansionEstateTransition {
  const detail = MANSION_ROOM_DETAILS[roomId];
  if (!detail?.upgradeCost || !detail.fund) return { state };
  const level = state.levels[roomId] ?? detail.level;
  if (level >= MAX_FACILITY_LEVEL) return { state };
  if ((state.repairProgress[roomId] ?? 0) < REPAIR_STEPS) return { state };

  const cost = promoteCost(detail.upgradeCost);
  if (state.funds[detail.fund] < cost) {
    return {
      state,
      notice: `${fundName(detail.fund)}不足，升级需 ${cost} 金币`
    };
  }

  return {
    state: {
      ...state,
      funds: {
        ...state.funds,
        [detail.fund]: state.funds[detail.fund] - cost
      },
      levels: { ...state.levels, [roomId]: level + 1 },
      repairProgress: { ...state.repairProgress, [roomId]: 0 }
    },
    notice: `${roomLabel(roomId)}已升级至 Lv.${level + 1}`
  };
}
