import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RpgNotchedPillArt, RpgNotchedPillButton } from "./RpgNotchedPillButton";

afterEach(cleanup);

it("preserves button props, refs, selection and events after sharing its artwork", () => {
  const ref = createRef<HTMLButtonElement>(), onClick = vi.fn();
  const {rerender} = render(<RpgNotchedPillButton ref={ref} label="重试读取" selected onClick={onClick}/>);
  const button = screen.getByRole("button", {name: "重试读取"});
  expect(ref.current).toBe(button);
  expect(button).toHaveAttribute("type", "button");
  expect(button).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledOnce();
  rerender(<RpgNotchedPillButton ref={ref} label="重试读取" disabled onClick={onClick}/>);
  expect(button).toBeDisabled();
  expect(button).not.toHaveAttribute("aria-pressed");
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledOnce();
});

it("renders decorative artwork in a real link without an interactive child", () => {
  render(<a href="#/menu" aria-label="返回菜单"><RpgNotchedPillArt label="返回菜单" watermark={false}/></a>);
  const link = screen.getByRole("link", {name: "返回菜单"});
  expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  expect(link.querySelector("pattern")).toBeNull();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
