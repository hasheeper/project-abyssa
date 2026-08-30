import { useState } from "react";
import { VisualNovelScene } from "../../shared/ui/patterns/VisualNovelScene";
import { SCENARIOS } from "./scenarios";
import type { ScenarioId } from "./scenarios";

const shopBg = import.meta.env.DEV
  ? "/src/assets/bg/shop.png"
  : "../src/assets/bg/shop.png";

const ORDER: ScenarioId[] = ["two", "three", "four"];

export function App() {
  const [scenario, setScenario] = useState<ScenarioId>("three");
  const current = SCENARIOS[scenario];

  return (
    <main className="novel-app">
      <header className="novel-app__toolbar">
        <div className="novel-app__title">
          <p>ABYSSA UI · VISUAL NOVEL PREVIEW</p>
          <h1>AVG 对话界面</h1>
        </div>
        <nav className="novel-app__tabs" aria-label="场景切换">
          {ORDER.map((id) => (
            <button
              key={id}
              type="button"
              data-active={id === scenario}
              onClick={() => setScenario(id)}
            >
              {SCENARIOS[id].label}
            </button>
          ))}
        </nav>
      </header>

      <section className="novel-app__stage" aria-label="AVG 对话预览">
        {/* key 保证切场景时完全重置槽位/行号 */}
        <VisualNovelScene
          key={scenario}
          background={shopBg}
          actors={current.actors}
          script={current.script}
        />
      </section>

      <footer className="novel-app__hint">点击画面 / 空格 / 回车 推进对话</footer>
    </main>
  );
}
