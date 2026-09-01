import { describe, expect, it } from "vitest";
import {
  DICE_CHARM_COLUMN_W,
  DICE_CONTENT_W,
  DICE_CUBE_PREVIEW_GAP,
  DICE_CUBE_PREVIEW_W,
  DICE_CUBE_SIZE,
  DICE_FACE_CELL,
  DICE_FACE_GAP,
  DICE_FRAME_INSET,
  DICE_INNER_H,
  DICE_INNER_W,
  DICE_INSPECTOR_H,
  DICE_NET_COLUMNS,
  DICE_NET_H,
  DICE_NET_LANE_W,
  DICE_NET_PLACEMENTS,
  DICE_NET_ROWS,
  DICE_NET_SECTION_H,
  DICE_NET_W,
  DICE_SECTION_GAP,
  DICE_STAGE_GAP,
  DICE_TITLE_H
} from "./diceLoadoutGeometry";
import {
  CHARACTER_PANEL_INNER_H,
  CHARACTER_PANEL_INNER_W
} from "./characterTabPanelGeometry";

describe("dice loadout geometry", () => {
  /* 槽位量已抽到 characterTabPanelGeometry(页签页共用)。
     骰装页必须**引用**它,不能自己另算一套 —— 否则两处会各自漂移。 */
  it("takes its slot box from the shared tab-panel geometry", () => {
    expect(DICE_INNER_W).toBe(CHARACTER_PANEL_INNER_W);
    expect(DICE_INNER_H).toBe(CHARACTER_PANEL_INNER_H);
  });

  it("splits the page into a left charm rail and right content column", () => {
    expect(DICE_CHARM_COLUMN_W + DICE_STAGE_GAP + DICE_CONTENT_W).toBeCloseTo(
      DICE_INNER_W,
      2
    );
    expect(DICE_CHARM_COLUMN_W).toBeLessThan(DICE_CONTENT_W);
  });

  it("stacks the die area above the inspector", () => {
    expect(
      DICE_NET_SECTION_H + DICE_SECTION_GAP + DICE_INSPECTOR_H
    ).toBeCloseTo(DICE_INNER_H, 2);
    expect(DICE_NET_SECTION_H).toBeGreaterThan(DICE_INSPECTOR_H);
    expect(DICE_INSPECTOR_H).toBeGreaterThan(180);
  });

  it("fits the one-four-one net inside the upper frame", () => {
    expect(DICE_NET_W).toBe(
      DICE_FACE_CELL * DICE_NET_COLUMNS +
        DICE_FACE_GAP * (DICE_NET_COLUMNS - 1)
    );
    expect(DICE_NET_H).toBe(
      DICE_FACE_CELL * DICE_NET_ROWS +
        DICE_FACE_GAP * (DICE_NET_ROWS - 1)
    );
    expect(DICE_NET_W).toBeLessThanOrEqual(DICE_NET_LANE_W);
    expect(DICE_NET_H).toBeLessThanOrEqual(
      DICE_NET_SECTION_H - DICE_FRAME_INSET - DICE_TITLE_H
    );
    expect(DICE_FACE_CELL).toBe(88);
    expect(DICE_NET_COLUMNS).toBe(4);
    expect(DICE_NET_ROWS).toBe(3);
  });

  it("reserves a right-hand lane for the assembled cube preview", () => {
    expect(
      DICE_NET_LANE_W + DICE_CUBE_PREVIEW_GAP + DICE_CUBE_PREVIEW_W
    ).toBeCloseTo(DICE_CONTENT_W - DICE_FRAME_INSET, 2);
    expect(DICE_CUBE_SIZE).toBeLessThan(DICE_CUBE_PREVIEW_W);
    expect(DICE_CUBE_PREVIEW_W).toBeLessThan(DICE_NET_LANE_W);
  });

  it("places six unique faces as one above, four across, one below", () => {
    expect(DICE_NET_PLACEMENTS).toHaveLength(6);
    expect([...DICE_NET_PLACEMENTS].map((slot) => slot.face).sort()).toEqual([
      1, 2, 3, 4, 5, 6
    ]);

    const keys = DICE_NET_PLACEMENTS.map((slot) => `${slot.row}:${slot.column}`);
    expect(new Set(keys).size).toBe(6);
    expect(DICE_NET_PLACEMENTS.map((slot) => slot.row)).toEqual([
      1, 2, 2, 2, 2, 3
    ]);
    expect(DICE_NET_PLACEMENTS.map((slot) => slot.column)).toEqual([
      2, 1, 2, 3, 4, 2
    ]);
  });
});
