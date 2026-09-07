import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ExpeditionDiceTray, type ExpeditionDiceSlot, type ExpeditionDiceTrayProps } from "./ExpeditionDicePanel";

afterEach(cleanup);

function trayProps(): ExpeditionDiceTrayProps {
  const owners = ["kael", "eustice", "elora", "kororo", "norma"];
  const values = [3, 1, 2, 3, 2];
  const slots: ExpeditionDiceSlot[] = owners.map((ownerId, i) => ({
    ownerId, dieIndex: i, faceIndex: values[i] - 1, loaded: true, spent: i === 1 || i === 4,
    sealed: false, downed: false, canToggle: false, rustFaceCount: 0, gildFaceCount: 0,
    faces: Array.from({length: 6}, (_, j) => ({verb: "guard", power: 1, quality: "plain", pip: j + 1,
      asleep: ownerId === "kororo" && j === 2})),
  }));
  const noop = () => {};
  return {
    slots, visuals: Object.fromEntries(owners.map(owner => [owner, {rotation: {x: 0, y: 0}, rolling: false, rollDuration: .9}])),
    hand: {name: "一对", bonus: .1, adjustedBonus: .1, qualityModifier: 0, pips: [3, 1, 2, 2], used: [2, 2], contributors: ["elora", "norma"]},
    scoringOwners: new Set(["elora", "norma"]), awaitingInitialRoll: false, rerollsRemaining: 0,
    interactive: true, initialRollReady: false, busy: false, enemyTurnFx: null, attackFx: null, supportFx: null,
    undoLabel: null, undoReady: false, unloadedRemain: false,
    onDieToggle: noop, onUndo: noop, onRoll: noop, onReroll: noop, onEndTurn: noop,
  };
}

it("explains the actual pair, makes sleep explicit, and keeps the spent contributing pip visible", () => {
  const props = trayProps();
  const {container, rerender} = render(<ExpeditionDiceTray {...props}/>);
  const hand = screen.getByRole("status", {name: "当前牌型 一对，倍率加成 +0.1"});
  expect(hand).toHaveTextContent("一对+0.1");
  expect(hand).toHaveAttribute("title", expect.stringContaining("参与判定点数：3 / 1 / 2 / 2"));
  expect(hand).toHaveAttribute("title", expect.stringContaining("不计入：柯萝萝（沉眠）"));
  const front = (owner: string, value: number) => container.querySelector(`[data-owner="${owner}"] [data-face="${value}"]`)!;
  expect(front("kororo", 3).querySelector(".expedition-flat-die-frame__fate")).toHaveTextContent("眠");
  expect(front("norma", 2).querySelector("[data-scoring]")).not.toBeNull();
  expect(front("norma", 2).querySelector(".expedition-flat-die-frame__fate")).toHaveTextContent("2");
  const norma = container.querySelector('[data-owner="norma"] .expedition-die')!;
  expect(norma).toHaveAttribute("aria-description", "已使用；命数 2 点，参与成牌");
  expect(norma).toBeDisabled();

  // Same used die, now exhausted: the explanation must no longer promise eligibility.
  rerender(<ExpeditionDiceTray {...props} slots={props.slots.map(d => d.ownerId === "norma" ? {...d, downed: true} : d)}
    hand={{...props.hand!, name: "散牌", bonus: 0, adjustedBonus: 0, pips: [3, 1, 2], used: [], contributors: []}}
    scoringOwners={new Set()}/>);
  expect(norma).toHaveAttribute("aria-description", "已使用；命数 2 点，力竭不参与成牌");
  expect(front("norma", 2).querySelector("[data-scoring]")).toBeNull();
});

it("distinguishes unrolled and sealed dice from used dice", () => {
  const props = trayProps();
  const {container} = render(<ExpeditionDiceTray {...props} hand={null} slots={props.slots.map((d, i) =>
    i === 0 ? {...d, faceIndex: null, loaded: false} : i === 1 ? {...d, sealed: true} : d)}/>);
  expect(container.querySelector('[data-owner="kael"] .expedition-die')).toHaveAttribute("aria-description", "未掷不参与成牌");
  expect(container.querySelector('[data-owner="eustice"] .expedition-die')).toHaveAttribute("aria-description", "已使用；命数 1 点，封锁不参与成牌");
});
