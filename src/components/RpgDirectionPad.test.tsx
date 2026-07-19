import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RpgDirectionPad } from "./RpgDirectionPad";

afterEach(cleanup);

describe("RpgDirectionPad", () => {
  it("selects directions in uncontrolled mode and reports the change", () => {
    const onValueChange = vi.fn();
    render(<RpgDirectionPad defaultValue="up" onValueChange={onValueChange} />);

    expect(screen.getByRole("button", { name: "Up" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Right" }));

    expect(onValueChange).toHaveBeenCalledWith("right");
    expect(screen.getByRole("button", { name: "Right" })).toHaveAttribute("aria-pressed", "true");
  });

  it("honours controlled selection and disabled state", () => {
    render(<RpgDirectionPad value="left" disabled />);

    expect(screen.getByRole("button", { name: "Left" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Down" })).toBeDisabled();
  });
});
