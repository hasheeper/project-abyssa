import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BattleScreen } from "./BattleScreen";
import type {
  BattleAlly,
  BattleEnemy,
  BattleScene,
  BattleSpritePose,
  BattleTurnEntry
} from "./BattleScreen";

const imageUrl = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

const scene: BattleScene = {
  id: "test-order",
  tone: "order",
  label: "Test battlefield",
  backgroundUrl: imageUrl
};

const allies: BattleAlly[] = [
  {
    id: "hero",
    name: "HERO",
    portraitUrl: imageUrl,
    spriteSheetUrl: imageUrl,
    hp: 80,
    maxHp: 100,
    mp: 30,
    maxMp: 50,
    pose: "action",
    placement: { x: 70, y: 82 }
  }
];

const enemies: BattleEnemy[] = [
  {
    id: "enemy-a",
    name: "ENEMY A",
    spriteUrl: imageUrl,
    hp: 0,
    maxHp: 100,
    placement: { x: 20, y: 82 }
  },
  {
    id: "enemy-b",
    name: "ENEMY B",
    spriteUrl: imageUrl,
    hp: 60,
    maxHp: 100,
    placement: { x: 35, y: 82 }
  }
];

const turnOrder: BattleTurnEntry[] = [
  { id: "turn-hero", unitId: "hero", side: "ally", label: "Hero" },
  { id: "turn-enemy", unitId: "enemy-b", side: "enemy", label: "Enemy B" }
];

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("BattleScreen", () => {
  it("renders the battlefield, semantic turn order, resources, and atlas pose", () => {
    const { container } = render(
      <BattleScreen
        scene={scene}
        allies={allies}
        enemies={enemies}
        turnOrder={turnOrder}
        activeActorId="hero"
      />
    );

    expect(screen.getByLabelText("Test battlefield")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Action order" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { current: "step" })).toHaveAttribute(
      "data-side",
      "ally"
    );
    expect(screen.getByRole("progressbar", { name: "HERO HP" })).toHaveAttribute(
      "aria-valuenow",
      "80"
    );
    expect(screen.getByRole("progressbar", { name: "HERO MP" })).toHaveAttribute(
      "aria-valuemax",
      "50"
    );
    expect(container.querySelector('[data-unit-id="hero"]')).toHaveAttribute(
      "data-pose",
      "action"
    );
    expect(container.querySelector(".abyssa-battle-screen__ally-sprite")).toHaveAttribute(
      "data-row",
      "0"
    );
    expect(container.querySelector(".abyssa-battle-screen__ally-sprite")).toHaveAttribute(
      "data-column",
      "1"
    );
    expect(container.querySelector(".abyssa-battle-screen__status-panel-frame")).not.toBeInTheDocument();
    expect(container.querySelector(".abyssa-battle-screen__status-portrait-frame")).not.toBeInTheDocument();
    expect(container.querySelector(".abyssa-battle-screen__status-art img")).toHaveAttribute(
      "src",
      imageUrl
    );
    expect(container.querySelector(".abyssa-battle-screen__status-card[data-active]")).toBeInTheDocument();
  });

  it("defaults to attack and the first living target, then updates uncontrolled state", () => {
    const onCommandChange = vi.fn();
    const onTargetChange = vi.fn();
    render(
      <BattleScreen
        scene={scene}
        allies={allies}
        enemies={enemies}
        turnOrder={turnOrder}
        activeActorId="hero"
        onSelectedCommandIdChange={onCommandChange}
        onSelectedTargetIdChange={onTargetChange}
      />
    );

    expect(screen.getByRole("button", { name: "ATTACK" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Target ENEMY A" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Target ENEMY B" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "SKILLS" }));
    expect(onCommandChange).toHaveBeenCalledWith("skills");
    expect(screen.getByRole("button", { name: "SKILLS" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "Target ENEMY B" }));
    expect(onTargetChange).toHaveBeenCalledWith("enemy-b");
  });

  it("honors controlled selections without mutating them locally", () => {
    const onCommandChange = vi.fn();
    const onTargetChange = vi.fn();
    const livingEnemies = enemies.map((enemy) => ({ ...enemy, hp: 60 }));
    render(
      <BattleScreen
        scene={scene}
        allies={allies}
        enemies={livingEnemies}
        turnOrder={turnOrder}
        activeActorId="hero"
        selectedCommandId="defend"
        selectedTargetId="enemy-a"
        onSelectedCommandIdChange={onCommandChange}
        onSelectedTargetIdChange={onTargetChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "ITEMS" }));
    fireEvent.click(screen.getByRole("button", { name: "Target ENEMY B" }));
    expect(onCommandChange).toHaveBeenCalledWith("items");
    expect(onTargetChange).toHaveBeenCalledWith("enemy-b");
    expect(screen.getByRole("button", { name: "DEFEND" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Target ENEMY A" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("disables commands during an enemy turn and handles empty battle data", () => {
    const { rerender } = render(
      <BattleScreen
        scene={scene}
        allies={allies}
        enemies={enemies}
        turnOrder={turnOrder}
        activeActorId="enemy-b"
      />
    );

    for (const label of ["ATTACK", "SKILLS", "ITEMS", "DEFEND"]) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    }

    rerender(
      <BattleScreen
        scene={scene}
        allies={[]}
        enemies={[]}
        turnOrder={[]}
      />
    );
    expect(screen.getByText("NO PARTY MEMBERS")).toBeInTheDocument();
    expect(screen.getByText("NO TARGET")).toBeInTheDocument();
  });

  it("maps every supported pose to the expected two-by-two atlas cell", () => {
    const poses: BattleSpritePose[] = ["idle", "action", "hurt", "guard"];
    const poseAllies = poses.map((pose, index) => ({
      ...allies[0]!,
      id: pose,
      name: pose.toUpperCase(),
      pose,
      placement: { x: 60 + index * 8, y: 82 }
    }));
    const { container } = render(
      <BattleScreen
        scene={scene}
        allies={poseAllies}
        enemies={[]}
        turnOrder={[]}
        activeActorId="idle"
      />
    );

    const expected = {
      idle: ["0", "0"],
      action: ["0", "1"],
      hurt: ["1", "0"],
      guard: ["1", "1"]
    } as const;
    for (const pose of poses) {
      const sprite = container.querySelector(
        `.abyssa-battle-screen__ally-sprite[data-pose="${pose}"]`
      );
      expect(sprite).toHaveAttribute("data-row", expected[pose][0]);
      expect(sprite).toHaveAttribute("data-column", expected[pose][1]);
    }
  });

  it("runs the four-stage attack cut-in against the selected target", async () => {
    vi.useFakeTimers();
    const onAttack = vi.fn();
    const idleAllies: BattleAlly[] = [{ ...allies[0]!, pose: "idle" }];
    const { container } = render(
      <BattleScreen
        scene={scene}
        allies={idleAllies}
        enemies={enemies}
        turnOrder={turnOrder}
        activeActorId="hero"
        onAttack={onAttack}
      />
    );
    const battle = container.querySelector(".abyssa-battle-screen");

    fireEvent.click(screen.getByRole("button", { name: "ATTACK" }));
    expect(battle).toHaveAttribute("data-attack-phase", "anticipate");
    expect(container.querySelector('[data-unit-id="hero"]')).toHaveAttribute(
      "data-pose",
      "action"
    );
    expect(
      (container.querySelector('[data-unit-id="hero"]') as HTMLElement).style.getPropertyValue(
        "--abyssa-battle-actor-lunge-x"
      )
    ).toBe("-11.5cqw");
    expect(
      (container.querySelector('[data-unit-id="hero"]') as HTMLElement).style.getPropertyValue(
        "--abyssa-battle-ally-drift-x"
      )
    ).toBe("-2.4cqw");
    expect(
      (container.querySelector('[data-unit-id="enemy-b"]') as HTMLElement).style.getPropertyValue(
        "--abyssa-battle-enemy-knockback-x"
      )
    ).toBe("-4.5cqw");
    expect(
      (container.querySelector('[data-unit-id="enemy-b"]') as HTMLElement).style.getPropertyValue(
        "--abyssa-battle-enemy-drift-x"
      )
    ).toBe("-5.6cqw");
    expect(screen.getByRole("button", { name: "Target ENEMY B" })).toBeDisabled();

    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(battle).toHaveAttribute("data-attack-phase", "hitstop");
    await act(async () => vi.advanceTimersByTimeAsync(70));
    expect(battle).toHaveAttribute("data-attack-phase", "impact");
    expect(container.querySelector('[data-unit-id="enemy-b"]')).toHaveAttribute(
      "data-impact-active",
      "true"
    );
    expect(container.querySelector('[data-unit-id="hero"]')).toHaveAttribute(
      "data-impact-active",
      "true"
    );
    expect(onAttack).toHaveBeenCalledWith({
      actorId: "hero",
      targetId: "enemy-b",
      damage: 310
    });
    await act(async () => vi.advanceTimersByTimeAsync(280));
    expect(battle).toHaveAttribute("data-attack-phase", "recover");
    expect(battle).toHaveAttribute("data-cinematic", "true");
    expect(container.querySelector('[data-unit-id="enemy-b"]')).toHaveAttribute(
      "data-impact-active",
      "true"
    );
    await act(async () => vi.advanceTimersByTimeAsync(420));
    expect(battle).not.toHaveAttribute("data-attack-phase");
    expect(battle).not.toHaveAttribute("data-cinematic");
    expect(container.querySelector('[data-unit-id="enemy-b"]')).not.toHaveAttribute(
      "data-impact-active"
    );
    expect(container.querySelector('[data-unit-id="hero"]')).not.toHaveAttribute(
      "data-impact-active"
    );
    expect(container.querySelector('[data-unit-id="hero"]')).toHaveAttribute(
      "data-pose",
      "idle"
    );
  });

  it("casts the holy skill from above against every living enemy", async () => {
    vi.useFakeTimers();
    const onHolyAttack = vi.fn();
    const livingEnemies = enemies.map((enemy) => ({ ...enemy, hp: 60 }));
    const { container } = render(
      <BattleScreen
        scene={scene}
        allies={[{ ...allies[0]!, pose: "idle" }]}
        enemies={livingEnemies}
        turnOrder={turnOrder}
        activeActorId="hero"
        defaultSelectedCommandId="skills"
        holyAttackDamage={{ "enemy-a": 128, "enemy-b": 146 }}
        onHolyAttack={onHolyAttack}
      />
    );
    const battle = container.querySelector(".abyssa-battle-screen");

    fireEvent.click(screen.getByRole("button", { name: "SKILLS" }));
    expect(battle).toHaveAttribute("data-action-kind", "holy-aoe");
    expect(battle).toHaveAttribute("data-attack-phase", "anticipate");
    expect(container.querySelector('[data-unit-id="hero"]')).toHaveAttribute(
      "data-pose",
      "action"
    );
    expect(container.querySelectorAll(".abyssa-battle-screen__holy-strike")).toHaveLength(2);
    expect(container.querySelector(".abyssa-battle-screen__attack-slash")).not.toBeInTheDocument();
    expect(
      (container.querySelector('[data-unit-id="hero"]') as HTMLElement).style.getPropertyValue(
        "--abyssa-battle-actor-lunge-x"
      )
    ).toBe("-3.2cqw");
    expect(
      (container.querySelector('[data-unit-id="enemy-a"]') as HTMLElement).style.getPropertyValue(
        "--abyssa-battle-enemy-knockback-x"
      )
    ).toBe("-1.8cqw");
    expect(
      (container.querySelector('[data-unit-id="enemy-a"]') as HTMLElement).style.getPropertyValue(
        "--abyssa-battle-enemy-knockback-y"
      )
    ).toBe("");

    await act(async () => vi.advanceTimersByTimeAsync(220));
    expect(battle).toHaveAttribute("data-attack-phase", "hitstop");
    await act(async () => vi.advanceTimersByTimeAsync(180));
    expect(battle).toHaveAttribute("data-attack-phase", "impact");
    expect(container.querySelector('[data-unit-id="enemy-a"]')).toHaveAttribute(
      "data-impact-active",
      "true"
    );
    expect(container.querySelector('[data-unit-id="enemy-b"]')).toHaveAttribute(
      "data-impact-active",
      "true"
    );
    expect(onHolyAttack).toHaveBeenCalledWith({
      actorId: "hero",
      targetIds: ["enemy-a", "enemy-b"],
      damageByTarget: { "enemy-a": 128, "enemy-b": 146 }
    });
    expect(container.querySelectorAll(".abyssa-battle-screen__field-holy-damage")).toHaveLength(2);

    await act(async () => vi.advanceTimersByTimeAsync(330));
    expect(battle).toHaveAttribute("data-attack-phase", "recover");
    await act(async () => vi.advanceTimersByTimeAsync(430));
    expect(battle).not.toHaveAttribute("data-action-kind");
    expect(container.querySelector('[data-unit-id="hero"]')).toHaveAttribute(
      "data-pose",
      "idle"
    );
  });
});
