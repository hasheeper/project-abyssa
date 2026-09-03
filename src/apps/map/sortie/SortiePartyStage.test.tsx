import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SortiePartyStage } from "./SortiePartyStage";
import { sortieLeader, sortieRoster } from "./sortie-roster";

describe("SortiePartyStage", () => {
  it("packs active members from the left and gives the leader the next external position", () => {
    const props = {
      mode: "map" as const,
      roster: sortieRoster,
      leader: sortieLeader,
      onOpen: vi.fn(),
      onRemoveMember: vi.fn(),
      onToggleCommand: vi.fn()
    };
    const { container, rerender } = render(
      <SortiePartyStage
        {...props}
        party={{ memberIds: ["eustice", "alvitr"], command: "personal" }}
      />
    );

    const slotOf = (name: string) =>
      screen.getByRole("button", { name }).closest(".abyssa-sortie-stage__slot") as HTMLElement;
    const eustice = slotOf("尤斯缇丝·格里芬");
    const alvitr = slotOf("阿尔薇特·塞维琳");
    const leader = slotOf("凯尔");

    expect(container.querySelector(".abyssa-sortie-stage")).toHaveAttribute("data-party-size", "2");
    expect(eustice).toHaveAttribute("data-lineup-index", "0");
    expect(eustice.style.getPropertyValue("--sortie-map-left")).toBe("22px");
    expect(alvitr).toHaveAttribute("data-lineup-index", "1");
    expect(alvitr.style.getPropertyValue("--sortie-map-left")).toBe("126px");
    expect(leader).toHaveAttribute("data-lineup-index", "2");
    expect(leader.style.getPropertyValue("--sortie-map-left")).toBe("230px");
    expect(leader.style.getPropertyValue("--sortie-pop-left")).toBe("307px");
    expect(container.querySelectorAll('.abyssa-sortie-stage__slot[data-empty="true"]')).toHaveLength(2);

    rerender(
      <SortiePartyStage
        {...props}
        party={{ memberIds: [], command: "personal" }}
      />
    );
    const soloLeader = slotOf("凯尔");
    expect(soloLeader).toHaveAttribute("data-lineup-index", "0");
    expect(soloLeader.style.getPropertyValue("--sortie-map-left")).toBe("22px");

    rerender(
      <SortiePartyStage
        {...props}
        party={{ memberIds: ["eustice"], command: "delegate" }}
      />
    );
    const stowedLeader = container.querySelector(
      '.abyssa-sortie-stage__slot[data-leader="true"]'
    ) as HTMLElement;
    expect(stowedLeader).toHaveAttribute("data-stowed", "true");
    expect(stowedLeader).toHaveAttribute("data-lineup-index", "1");
    expect(stowedLeader).not.toHaveAttribute("aria-hidden");

    rerender(
      <SortiePartyStage
        {...props}
        mode="pop"
        questSide="right"
        party={{ memberIds: ["eustice"], command: "delegate" }}
      />
    );
    const advancedMember = screen
      .getByRole("button", { name: "尤斯缇丝·格里芬，点击调整队伍" })
      .closest(".abyssa-sortie-stage__slot") as HTMLElement;
    expect(advancedMember.style.getPropertyValue("--sortie-map-left")).toBe("22px");
    expect(advancedMember.style.getPropertyValue("--sortie-pop-left")).toBe("571px");
    expect(container.querySelector('.abyssa-sortie-stage__slot[data-leader="true"]'))
      .toHaveAttribute("aria-hidden", "true");

    rerender(
      <SortiePartyStage
        {...props}
        mode="pop"
        questSide="right"
        party={{ memberIds: ["eustice", "alvitr"], command: "personal" }}
      />
    );
    const twoPersonMember = screen
      .getByRole("button", { name: "尤斯缇丝·格里芬，点击调整队伍" })
      .closest(".abyssa-sortie-stage__slot") as HTMLElement;
    const frontLeader = screen
      .getByRole("button", { name: "凯尔，点击调整队伍" })
      .closest(".abyssa-sortie-stage__slot") as HTMLElement;
    expect(twoPersonMember.style.getPropertyValue("--sortie-pop-left")).toBe("307px");
    expect(frontLeader.style.getPropertyValue("--sortie-pop-left")).toBe("571px");
  });

  it("keeps the same calibrated figures while moving from map to either quest side", () => {
    const onOpen = vi.fn();
    const onRemoveMember = vi.fn();
    const onToggleCommand = vi.fn();
    const stage = (mode: "map" | "pop", questSide?: "left" | "right") => (
      <SortiePartyStage
        mode={mode}
        questSide={questSide}
        roster={sortieRoster}
        leader={sortieLeader}
        party={{ memberIds: ["alvitr"], command: "personal" }}
        onOpen={onOpen}
        onRemoveMember={onRemoveMember}
        onToggleCommand={onToggleCommand}
      />
    );

    const { container, rerender } = render(stage("map"));
    const stageElement = container.querySelector(".abyssa-sortie-stage") as HTMLElement;

    const alvitr = within(container)
      .getByRole("button", { name: "阿尔薇特·塞维琳" })
      .querySelector("img") as HTMLImageElement;
    const leader = within(container)
      .getByRole("button", { name: "凯尔" })
      .querySelector("img") as HTMLImageElement;

    const calibration = (image: HTMLImageElement) => ({
      scale: image.style.getPropertyValue("--sortie-figure-scale"),
      x: image.style.getPropertyValue("--sortie-figure-x"),
      y: image.style.getPropertyValue("--sortie-figure-y"),
      flipX: image.style.getPropertyValue("--sortie-figure-flip-x")
    });
    const alvitrCalibration = calibration(alvitr);
    const leaderCalibration = calibration(leader);
    expect(alvitrCalibration).toEqual({ scale: "1.11", x: "4%", y: "0%", flipX: "-1" });
    expect(leaderCalibration).toEqual({ scale: "0.97", x: "0%", y: "0%", flipX: "1" });

    for (const questSide of ["left", "right"] as const) {
      rerender(stage("pop", questSide));

      const currentStage = container.querySelector(".abyssa-sortie-stage") as HTMLElement;
      const currentAlvitr = within(container)
        .getByRole("button", { name: "阿尔薇特·塞维琳，点击调整队伍" })
        .querySelector("img") as HTMLImageElement;
      const currentLeader = within(container)
        .getByRole("button", { name: "凯尔，点击调整队伍" })
        .querySelector("img") as HTMLImageElement;

      expect(currentStage).toBe(stageElement);
      expect(currentStage).toHaveAttribute("data-mode", "pop");
      expect(currentStage).toHaveAttribute("data-quest-side", questSide);
      expect(currentAlvitr).toBe(alvitr);
      expect(currentLeader).toBe(leader);
      expect(calibration(currentAlvitr)).toEqual(alvitrCalibration);
      expect(calibration(currentLeader)).toEqual(leaderCalibration);
    }
  });
});
