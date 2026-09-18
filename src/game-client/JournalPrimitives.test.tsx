import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { JournalActionLink, JournalButton, JournalSurface } from "./JournalPrimitives";

afterEach(cleanup);

it("separates content surfaces from window-level frames", () => {
  const {container} = render(<>
    <JournalSurface role="region" aria-label="行囊">物品</JournalSurface>
    <JournalSurface variant="divider" className="detail" role="complementary" aria-label="详情">用途</JournalSurface>
    <JournalSurface variant="plain" data-testid="plain">正文</JournalSurface>
  </>);
  expect(screen.getByRole("region",{name:"行囊"})).toHaveAttribute("data-surface","inset");
  expect(screen.getByRole("complementary",{name:"详情"})).toHaveAttribute("data-surface","divider");
  expect(screen.getByRole("complementary",{name:"详情"})).toHaveClass("detail");
  expect(screen.getByTestId("plain")).toHaveAttribute("data-surface","plain");
  expect(container.querySelectorAll(".journal-surface__content")).toHaveLength(3);
  expect(container.querySelector(".abyssa-frame")).toBeNull();
});

it("keeps native button behavior and a readable HTML label outside decorative SVGs", async () => {
  const user = userEvent.setup(), onClick = vi.fn();
  const {rerender} = render(<JournalButton onClick={onClick} aria-label="回顾把剑暂时放下">回顾</JournalButton>);
  const button = screen.getByRole("button",{name:"回顾把剑暂时放下"});
  expect(button).toHaveAttribute("type","button");
  expect(button.querySelector(".journal-action__label")).toHaveTextContent("回顾");
  expect(button.querySelector(".journal-action__art")).toHaveAttribute("aria-hidden","true");
  expect(button.querySelector("svg text")).toBeNull();
  await user.click(button);
  expect(onClick).toHaveBeenCalledOnce();
  rerender(<JournalButton disabled onClick={onClick} emphasis="primary" type="submit">加入行囊</JournalButton>);
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute("type","submit");
  expect(button).toHaveAttribute("data-emphasis","primary");
  await user.click(button);
  expect(onClick).toHaveBeenCalledOnce();
});

it("uses a real link without SVG-scaled navigation text", () => {
  render(<JournalActionLink href="/map.html" emphasis="primary">出征编队</JournalActionLink>);
  const link = screen.getByRole("link",{name:"出征编队"});
  expect(link).toHaveAttribute("href","/map.html");
  expect(link).toHaveAttribute("data-emphasis","primary");
  expect(link.querySelector(".journal-action__label")).toHaveTextContent("出征编队");
  expect(link.querySelector("svg text")).toBeNull();
});
