import { useState } from "react";
import { AbyssaProvider } from "../components/AbyssaProvider";
import { BattleScreen } from "../components/BattleScreen";
import type { BattleCommandId } from "../components/BattleScreen";
import { battleFixture } from "./data";

export function App() {
  const [selectedCommandId, setSelectedCommandId] =
    useState<BattleCommandId>("skills");
  const [selectedTargetId, setSelectedTargetId] = useState<string | undefined>(
    battleFixture.enemies[0]?.id
  );

  return (
    <AbyssaProvider className="battle-preview-app">
      <main className="battle-preview-app__main">
        <header className="battle-preview-app__toolbar">
          <div>
            <p>ABYSSA UI · INTERACTIVE PREVIEW</p>
            <h1>战斗界面</h1>
          </div>
        </header>

        <section
          id="battle-preview-stage"
          className="battle-preview-app__stage"
          aria-label="混沌领域战斗预览"
        >
          <BattleScreen
            scene={battleFixture.scene}
            allies={battleFixture.allies}
            enemies={battleFixture.enemies}
            turnOrder={battleFixture.turnOrder}
            activeActorId={battleFixture.activeActorId}
            holyAttackDamage={{
              "blighted-sentinel": 286,
              "miasma-amalgam": 244
            }}
            attackMotionMode="full"
            selectedCommandId={selectedCommandId}
            onSelectedCommandIdChange={setSelectedCommandId}
            selectedTargetId={selectedTargetId}
            onSelectedTargetIdChange={setSelectedTargetId}
          />
        </section>
      </main>
    </AbyssaProvider>
  );
}
