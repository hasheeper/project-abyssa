import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { CharacterStatusScreen } from "../../shared/ui/patterns/CharacterStatusScreen";
import type { CharacterMenuItem } from "../../shared/ui/patterns/CharacterStatusScreen";
import { StatusPanel } from "../../shared/ui/patterns/StatusPanel";
import { DiceLoadoutPanel } from "../../shared/ui/patterns/DiceLoadoutPanel";
import { CharacterChroniclePanel } from "../../shared/ui/patterns/CharacterChroniclePanel";
import { characterProfiles } from "../../content/characters/profiles";
import { findDiceLoadout } from "../../content/characters/diceLoadouts";
import { findChronicle } from "../../content/characters/chronicles";
import { Stage } from "../../shared/stage";

/* 三页分工:
     概要 = 关系现状(羁绊 + 私约)+ 人格底档
     骰装 = 饰品与命骰六面
     记事 = 关键阶段、事件与好感变化的时间线

   记事页刻意**不做**金币流水:饰品的当前状态骰装页已完整呈现
   (charm.origin 连购入来源都写着),再记一遍"花了多少里拉"既不驱动
   战斗也不承载人设 —— 与被删掉的六维评级同类。

   记事页是视觉驱动的框架:记忆如何入库、好感如何计量尚未对齐,
   所以展示契约里全是字符串插槽,组件不解析不推导。
   详见 shared/domain/characters/chronicle.ts 的文件头。 */
const MENU_ITEMS: CharacterMenuItem[] = [
  { id: "summary", label: "概要" },
  { id: "dice", label: "骰装" },
  { id: "archive", label: "记事" }
];

export function App() {
  return (
    <Stage background="var(--abyssa-character-status-backdrop)">
      <AbyssaProvider className="character-status-app">
        <main className="character-status-app__main">
          <CharacterStatusScreen
            characters={characterProfiles}
            defaultSelectedId="lenore"
            menuItems={MENU_ITEMS}
            renderTabPanel={({ character, menuId }) => {
              if (menuId === "dice") {
                return (
                  <DiceLoadoutPanel
                    loadout={findDiceLoadout(character.id)}
                    characterName={character.selectorLabel ?? character.name}
                    themeColor="var(--abyssa-teal)"
                  />
                );
              }
              if (menuId === "archive") {
                /* 摘要读数由这里给成字符串。面板不从 chronicle 推导数值 ——
                   好感如何计量尚未定，推导会变成迁移债。 */
                const bond = character.status.bond;
                const stage = character.status.pact?.currentStage;
                const summary = [
                  ...(bond ? [{ label: "羁绊", value: `Lv.${bond.level}` }] : []),
                  ...(stage
                    ? [{ label: "私约", value: ["I", "II", "III"][stage - 1]! }]
                    : [])
                ];

                return (
                  <CharacterChroniclePanel
                    chronicle={findChronicle(character.id)}
                    characterName={character.selectorLabel ?? character.name}
                    summary={summary}
                  />
                );
              }
              return <StatusPanel data={character.status} />;
            }}
          />
        </main>
      </AbyssaProvider>
    </Stage>
  );
}
