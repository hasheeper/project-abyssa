import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clonePartyFigureCalibrations } from "../../content/characters/partyFigureCalibration";
import { partyFigureCatalog } from "../../assets/map/party-figures/catalog";
import { PartyFigurePreview } from "./PartyFigurePreview";
import { makeInitialPartyFigureLineup } from "./party-figure-model";

afterEach(cleanup);

describe("PartyFigurePreview", () => {
  it("renders a native square canvas with positive y moving upward", () => {
    const calibrations = clonePartyFigureCalibrations();
    calibrations.abyssa = { scale: 1.1, x: 4, y: 3, flipX: true };

    const { container } = render(
      <PartyFigurePreview
        mode="single"
        background="grid"
        showBaseline
        activeId="abyssa"
        partyIds={makeInitialPartyFigureLineup()}
        catalog={partyFigureCatalog}
        calibrations={calibrations}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByLabelText("单图对齐预览")).toBeInTheDocument();
    expect(screen.getByText(/X\+ → 右移 · Y\+ ↑ 上移/)).toBeInTheDocument();
    const image = container.querySelector<HTMLImageElement>(".party-figure-preview__image")!;
    expect(image.style.transform).toBe("translate(4%, -3%) scale(-1.1, 1.1)");
    expect(container.querySelector('[data-guide="baseline"]')).toBeInTheDocument();
    expect(container.querySelector('[data-background="grid"]')).toHaveClass(
      "party-figure-preview__canvas--single"
    );
  });

  it("renders five clickable comparison slots on the reference stage", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <PartyFigurePreview
        mode="party"
        background="parchment"
        showBaseline={false}
        activeId="abyssa"
        partyIds={makeInitialPartyFigureLineup()}
        catalog={partyFigureCatalog}
        calibrations={clonePartyFigureCalibrations()}
        onSelect={onSelect}
      />
    );

    expect(screen.getByLabelText("五人编队对比预览")).toBeInTheDocument();
    expect(screen.getByText(/880 × 350 参考舞台/)).toBeInTheDocument();
    const slots = container.querySelectorAll<HTMLElement>(".party-figure-preview__party-slot");
    expect(slots).toHaveLength(5);
    expect(slots[0].style.getPropertyValue("--party-slot-figure-bottom"))
      .toBe(`${32 / 285 * 100}%`);
    expect(slots[0].style.getPropertyValue("--party-slot-figure-height"))
      .toBe(`${(285 - 32) / 285 * 100}%`);
    fireEvent.click(screen.getByRole("button", { name: `编辑 ${partyFigureCatalog[1].name}` }));
    expect(onSelect).toHaveBeenCalledWith(partyFigureCatalog[1].id);
    expect(container.querySelector('[data-background="parchment"]')).toHaveClass(
      "party-figure-preview__canvas--party"
    );
    expect(container.querySelector('[data-guide="baseline"]')).not.toBeInTheDocument();
  });
});
