import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ExpeditionHandReadout } from "./ExpeditionBattleChrome";

afterEach(cleanup);
it("shows a hand's additive bonus, including a formed hand reduced to zero by quality", () => {
  const hand = {name:"两对",bonus:0.2,adjustedBonus:0.2,qualityModifier:0,pips:[3,1,2,3,2],used:[3,3,2,2],contributors:["kael","elora","kororo","norma"]};
  const {container,rerender} = render(<ExpeditionHandReadout hand={hand}/>);
  expect(screen.getByRole("status")).toHaveAttribute("aria-label","当前牌型 两对，倍率加成 +0.2");
  expect(container.querySelector(".abyssa-expedition-hand__bonus")).toHaveTextContent("+0.2");
  rerender(<ExpeditionHandReadout hand={{...hand,qualityModifier:-0.2,adjustedBonus:0}}/>);
  expect(screen.getByRole("status")).toHaveAttribute("aria-label","当前牌型 两对，倍率加成 +0");
  expect(container.querySelector(".abyssa-expedition-hand__bonus")).toHaveTextContent("+0.0");
});
