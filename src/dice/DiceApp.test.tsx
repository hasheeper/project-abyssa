import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiceApp } from "./DiceApp";

describe("DiceApp rolling motion", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("automatically deals both private hands with the 3D rolling motion", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    const { container } = render(<DiceApp />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(620);
    });

    const playerDice = [...container.querySelectorAll<HTMLButtonElement>('.die[data-side="player"]')];
    expect(playerDice).toHaveLength(5);
    expect(playerDice.every(die => die.querySelectorAll('.die__face[data-result="true"]').length === 1)).toBe(true);
    expect(playerDice.every(die => die.dataset.rolling === "true")).toBe(true);
    expect(playerDice[0]!.querySelector<HTMLElement>(".die__cube")?.style.getPropertyValue("--roll-duration")).toBe("0.9625s");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    expect(playerDice.every(die => die.dataset.rolling === "false")).toBe(true);
    expect(screen.getByRole("button", { name: /过牌.*CHECK/ })).toBeInTheDocument();
    expect(container.querySelector(".action-dock .betting-controls")).toBeInTheDocument();
    expect(container.querySelectorAll(".action-dock__actions .dice-action-button")).toHaveLength(4);
    expect(container.querySelectorAll('.die[data-side="opponent"][data-covered="true"]')).toHaveLength(5);
  });

  it("uses a nested outer frame without the dealer mood status bar", () => {
    const { container } = render(<DiceApp />);

    expect(container.querySelector(".reaction-bar")).not.toBeInTheDocument();
    expect(container.querySelector(".dice-outer-frame__surface .game-layout")).toBeInTheDocument();
    expect(container.querySelectorAll(".dice-outer-frame__rails [data-edge]")).toHaveLength(4);
    expect(container.querySelector(".portrait-panel .portrait-panel__nameplate.abyssa-nameplate")).toBeInTheDocument();
    expect(container.querySelector(".portrait-panel__role")).not.toBeInTheDocument();
    expect(screen.queryByText(/BLACK MARKET DEALER/)).not.toBeInTheDocument();
    expect(container.querySelector(".portrait-panel__fade")).not.toBeInTheDocument();
    expect(container.querySelector(".tibby-stage > .tibby-stage__recess")).toBeInTheDocument();
    expect(container.querySelector(".tibby-stage__recess > .tibby-stage__backplate")).toBeInTheDocument();
    expect(container.querySelectorAll(".tibby-stage__divider [data-part]")).toHaveLength(3);
    expect(container.querySelector(".tibby-stage__recess > .tibby-dialogue.abyssa-dialogue")).toBeInTheDocument();
    expect(container.querySelector(".tibby-dialogue[data-nameplate=\"false\"]")).toBeInTheDocument();
    expect(container.querySelector(".dialogue-panel")).not.toBeInTheDocument();
    expect(container.querySelector(".dice-duel > .action-dock")).toBeInTheDocument();
    expect(container.querySelector(".dice-board--player .action-dock")).not.toBeInTheDocument();
    const table = container.querySelector<HTMLElement>(".table-status")!;
    expect(table.querySelector(".table-status__surface")).toBeInTheDocument();
    expect(table).toHaveTextContent("起蛊");
    expect(table.querySelector('.abyssa-currency-amount[data-currency="lira"]')).toBeInTheDocument();
    expect(table.querySelectorAll(".table-coin--stacked, .table-coin--incoming")).toHaveLength(6);
    expect(new Set([...table.querySelectorAll<HTMLElement>(".table-coin--stacked, .table-coin--incoming")].map(coin => coin.style.getPropertyValue("--coin-x"))).size).toBeGreaterThan(3);
    expect(table.querySelectorAll('.table-status__incoming-coins[data-side="opponent"] .table-coin--incoming')).toHaveLength(3);
    expect(table.querySelectorAll('.table-status__incoming-coins[data-side="player"] .table-coin--incoming')).toHaveLength(3);
    expect(table.textContent).not.toContain("TIBBY");
    expect(table.textContent).not.toContain("YOU");
    expect(table.querySelector(".table-status__dealer")).not.toBeInTheDocument();
    expect(container.querySelector(".dice-board--opponent .dice-board__dealer")).toBeInTheDocument();
    expect(container.querySelector(".dice-board--player .dice-board__dealer")).not.toBeInTheDocument();
    expect(container.querySelector(".action-dock__funds")).toBeInTheDocument();
    expect(container.querySelector(".dice-board--player .dice-board__state output")).not.toBeInTheDocument();
  });

  it("reveals the opponent dice for five seconds before settling a fold", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    const { container } = render(<DiceApp />);

    await act(async () => { await vi.advanceTimersByTimeAsync(1800); });
    fireEvent.click(screen.getByRole("button", { name: /弃牌.*FOLD/ }));

    expect(container.querySelectorAll('.die[data-side="opponent"][data-covered="false"]')).toHaveLength(5);
    expect(container.querySelector(".result-overlay")).not.toBeInTheDocument();
    expect(container.querySelector(".table-status")).toHaveTextContent("骰面公示中 · 5 秒后定局");

    await act(async () => { await vi.advanceTimersByTimeAsync(4999); });
    expect(container.querySelector(".result-overlay")).not.toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(container.querySelector(".result-overlay")).toBeInTheDocument();
  });

  it("keeps the final showdown visible for five seconds before settling", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    const { container } = render(<DiceApp />);

    await act(async () => { await vi.advanceTimersByTimeAsync(1800); });
    fireEvent.click(screen.getByRole("button", { name: /过牌.*CHECK/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1900); });
    fireEvent.click(screen.getByRole("button", { name: /跟注.*CALL/ }));
    fireEvent.click(screen.getByRole("button", { name: /确认.*CONFIRM/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1650); });
    fireEvent.click(screen.getByRole("button", { name: /结束.*STAND/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    fireEvent.click(screen.getByRole("button", { name: /过牌.*CHECK/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1900); });
    fireEvent.click(screen.getByRole("button", { name: /跟注.*CALL/ }));

    expect(container.querySelectorAll('.die[data-side="opponent"][data-covered="false"]')).toHaveLength(5);
    expect(container.querySelector(".table-status")).toHaveTextContent("骰面公示中 · 5 秒后定局");
    expect(container.querySelector(".result-overlay")).not.toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(4999); });
    expect(container.querySelector(".result-overlay")).not.toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(container.querySelector(".result-overlay")).toBeInTheDocument();
  });

  it("moves from betting into irreversible public locks and the private reroll", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    const { container } = render(<DiceApp />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1800); });

    fireEvent.click(screen.getByRole("button", { name: /过牌.*CHECK/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1900); });
    expect(container.querySelector('.table-status__incoming-coins[data-side="opponent"]')).toBeInTheDocument();
    const opponentField = container.querySelector<HTMLElement>(".table-status__coin-field")!;
    expect(opponentField.querySelectorAll(".table-coin--stacked, .table-coin--incoming")).toHaveLength(Number(opponentField.dataset.coinCount));
    fireEvent.click(screen.getByRole("button", { name: /跟注.*30 G.*CALL/ }));

    expect(container.querySelector('.table-status__incoming-coins[data-side="player"]')).toBeInTheDocument();
    const playerField = container.querySelector<HTMLElement>(".table-status__coin-field")!;
    expect(playerField.querySelectorAll(".table-coin--stacked, .table-coin--incoming")).toHaveLength(Number(playerField.dataset.coinCount));
    expect(container.querySelectorAll(".action-dock__actions .dice-action-button")).toHaveLength(4);

    const firstDie = container.querySelector<HTMLButtonElement>('.die[data-side="player"]')!;
    fireEvent.click(firstDie);
    expect(firstDie.dataset.lock).toBe("public");
    expect(firstDie.querySelector('.die__selection[data-kind="public"]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /确认.*CONFIRM/ }));

    await act(async () => { await vi.advanceTimersByTimeAsync(1650); });
    expect(screen.getByRole("button", { name: /重掷.*REROLL/ })).toBeInTheDocument();
    expect(container.querySelectorAll(".action-dock__actions .dice-action-button")).toHaveLength(4);
    expect(container.querySelector('.dice-board--opponent[data-revealed="true"]')).toBeInTheDocument();
    expect(container.querySelector('.dice-board--opponent .die__selection[data-kind="public"]')).toBeInTheDocument();
    expect(firstDie).toBeDisabled();
    expect(container.querySelectorAll('.die[data-side="opponent"][data-covered="false"]')).toHaveLength(5);

    const playerDice = container.querySelectorAll<HTMLButtonElement>('.die[data-side="player"]');
    expect(screen.getByRole("button", { name: /重掷.*REROLL 4\/4/ })).toBeEnabled();
    const secondDie = playerDice[1]!;
    fireEvent.click(secondDie);
    expect(secondDie.querySelector('.die__selection[data-kind="private"]')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /重掷.*REROLL 3\/3/ })).toBeEnabled();
  });
});
