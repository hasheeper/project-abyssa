import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

afterEach(cleanup);

describe("component catalog", () => {
  it("allows the preview sidebar to collapse and reopen", () => {
    const { container } = render(<App />);
    const shell = container.querySelector(".demo-shell");

    fireEvent.click(screen.getByRole("button", { name: "收起侧栏" }));
    expect(shell).toHaveAttribute("data-sidebar-collapsed", "true");
    expect(screen.getByRole("button", { name: "展开侧栏" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    fireEvent.click(screen.getByRole("button", { name: "展开侧栏" }));
    expect(shell).not.toHaveAttribute("data-sidebar-collapsed");
  });
});
