import type { Meta, StoryObj } from "@storybook/react-vite";
import domainsOfChaos from "../assets/png3/background/domains_of_chaos.png";
import eloraSpriteSheet from "../assets/png3/elora.png";
import eusticeSpriteSheet from "../assets/png3/eustice.png";
import kororoSpriteSheet from "../assets/png3/kororo.png";
import blightedSentinel from "../assets/png3/monster/blighted_sentinel.png";
import miasmaAmalgam from "../assets/png3/monster/miasma_amalgam.png";
import normaSpriteSheet from "../assets/png3/norma.png";
import eloraStandingPortrait from "../assets/png/elora.png";
import eusticeStandingPortrait from "../assets/png/eustice.png";
import kororoStandingPortrait from "../assets/png/kororo.png";
import normaStandingPortrait from "../assets/png/norma.png";
import eloraPortrait from "../assets/avatar/elora.png";
import eusticePortrait from "../assets/avatar/eustice.png";
import kororoPortrait from "../assets/avatar/kororo.png";
import normaPortrait from "../assets/avatar/norma.png";
import { BattleScreen } from "./BattleScreen";
import type {
  BattleAlly,
  BattleEnemy,
  BattleScene,
  BattleSpritePose,
  BattleTurnEntry
} from "./BattleScreen";

const chaosScene: BattleScene = {
  id: "domains-of-chaos",
  tone: "chaos",
  label: "Domains of Chaos",
  backgroundUrl: domainsOfChaos,
  backgroundAlt: "A ruined battlefield beneath the domain of chaos",
  backgroundPosition: "center 52%"
};

const allies: BattleAlly[] = [
  {
    id: "eustice",
    name: "EUSTICE",
    portraitUrl: eusticeStandingPortrait,
    spriteSheetUrl: eusticeSpriteSheet,
    spriteAlt: "Eustice ready for battle",
    hp: 450,
    maxHp: 500,
    mp: 190,
    maxMp: 500,
    pose: "idle",
    placement: { x: 45, y: 85, scale: 0.78, zIndex: 2 },
    poseAdjustments: {
      action: { offsetX: -2, offsetY: 1, scale: 1.03 },
      hurt: { offsetX: 1, offsetY: 2 },
      guard: { offsetX: -1 }
    }
  },
  {
    id: "elora",
    name: "ELORA",
    portraitUrl: eloraStandingPortrait,
    spriteSheetUrl: eloraSpriteSheet,
    spriteAlt: "Elora ready for battle",
    hp: 420,
    maxHp: 500,
    mp: 240,
    maxMp: 300,
    pose: "idle",
    placement: { x: 38, y: 88, scale: 0.7, zIndex: 3 }
  },
  {
    id: "kororo",
    name: "KORORO",
    portraitUrl: kororoStandingPortrait,
    spriteSheetUrl: kororoSpriteSheet,
    spriteAlt: "Kororo ready for battle",
    hp: 390,
    maxHp: 450,
    mp: 90,
    maxMp: 100,
    pose: "idle",
    placement: { x: 29, y: 76, scale: 0.67, zIndex: 1 }
  },
  {
    id: "norma",
    name: "NORMA",
    portraitUrl: normaStandingPortrait,
    spriteSheetUrl: normaSpriteSheet,
    spriteAlt: "Norma ready for battle",
    hp: 440,
    maxHp: 500,
    mp: 80,
    maxMp: 100,
    pose: "idle",
    placement: { x: 20, y: 87, scale: 0.65, zIndex: 2 }
  }
];

const chaosEnemies: BattleEnemy[] = [
  {
    id: "blighted-sentinel",
    name: "BLIGHTED SENTINEL",
    portraitUrl: blightedSentinel,
    spriteUrl: blightedSentinel,
    spriteAlt: "The Blighted Sentinel",
    hp: 780,
    maxHp: 1000,
    placement: { x: 70, y: 88, scale: 0.66, zIndex: 2 }
  },
  {
    id: "miasma-amalgam",
    name: "MIASMA AMALGAM",
    portraitUrl: miasmaAmalgam,
    spriteUrl: miasmaAmalgam,
    spriteAlt: "The Miasma Amalgam",
    hp: 620,
    maxHp: 850,
    placement: { x: 84, y: 84, scale: 0.72, zIndex: 1 }
  }
];

const chaosTurnOrder: BattleTurnEntry[] = [
  {
    id: "turn-sentinel",
    unitId: "blighted-sentinel",
    side: "enemy",
    label: "Blighted Sentinel",
    portraitUrl: blightedSentinel
  },
  {
    id: "turn-eustice",
    unitId: "eustice",
    side: "ally",
    label: "Eustice",
    portraitUrl: eusticePortrait
  },
  {
    id: "turn-kororo",
    unitId: "kororo",
    side: "ally",
    label: "Kororo",
    portraitUrl: kororoPortrait
  },
  {
    id: "turn-elora",
    unitId: "elora",
    side: "ally",
    label: "Elora",
    portraitUrl: eloraPortrait
  },
  {
    id: "turn-norma",
    unitId: "norma",
    side: "ally",
    label: "Norma",
    portraitUrl: normaPortrait
  },
  {
    id: "turn-amalgam",
    unitId: "miasma-amalgam",
    side: "enemy",
    label: "Miasma Amalgam",
    portraitUrl: miasmaAmalgam
  }
];

const meta = {
  title: "Compositions/BattleScreen",
  component: BattleScreen,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div
        className="abyssa-theme"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 16,
          background: "#080d0f"
        }}
      >
        <Story />
      </div>
    )
  ],
  args: {
    scene: chaosScene,
    allies,
    enemies: chaosEnemies,
    turnOrder: chaosTurnOrder,
    activeActorId: "kororo"
  }
} satisfies Meta<typeof BattleScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DomainsOfChaos: Story = {};

const fourPoses: BattleSpritePose[] = ["idle", "action", "hurt", "guard"];

export const FourHeroPoses: Story = {
  args: {
    allies: allies.map((ally, index) => ({
      ...ally,
      pose: fourPoses[index]
    }))
  }
};

export const EnemyTurn: Story = {
  args: {
    scene: chaosScene,
    enemies: chaosEnemies,
    turnOrder: chaosTurnOrder,
    activeActorId: "blighted-sentinel"
  }
};

export const NoTarget: Story = {
  args: {
    enemies: [],
    turnOrder: chaosTurnOrder.filter((entry) => entry.side === "ally")
  }
};

export const DamageFeedback: Story = {
  args: {
    allies: allies.map((ally) =>
      ally.id === "eustice"
        ? {
            ...ally,
            pose: "hurt" as const,
            floatingFeedback: [
              { id: "eustice-damage", text: "310", tone: "damage" as const }
            ]
          }
        : ally
    ),
    enemies: chaosEnemies.map((enemy) => ({
      ...enemy,
      floatingFeedback: [
        { id: "choir-break", text: "BREAK", tone: "status" as const, offsetY: -8 }
      ]
    }))
  }
};
