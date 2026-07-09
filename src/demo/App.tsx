import { useState } from "react";
import {
  AbyssaProvider,
  ArrowButton,
  CharacterStatusScreen,
  IconButton,
  Progress,
  RibbonButton,
  RpgFrame,
  RpgPanel,
  SectionHeader,
  Toggle
} from "../index";
import type { AbyssaVariant, PanelVariant } from "../index";
import { demoCharacters } from "./data";

const variants: AbyssaVariant[] = ["dark", "light", "teal"];
const panelVariants: PanelVariant[] = [
  "dark",
  "gray",
  "deep",
  "teal",
  "teal-outline",
  "light"
];

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5 7h14M5 12h14M5 17h14" />
      <circle cx="3" cy="7" r=".8" fill="currentColor" />
      <circle cx="3" cy="12" r=".8" fill="currentColor" />
      <circle cx="3" cy="17" r=".8" fill="currentColor" />
    </svg>
  );
}

export function App() {
  const [selectedPanel, setSelectedPanel] = useState(3);
  const [enabled, setEnabled] = useState(true);

  return (
    <AbyssaProvider className="demo-app">
      <header className="demo-hero">
        <p className="demo-kicker">ABYSSA DESIGN SYSTEM · 0.1</p>
        <h1>Retro RPG UI Components</h1>
        <p>从静态视觉原型提取的可组合、可访问、数据驱动组件。</p>
      </header>

      <main className="demo-content">
        <section className="demo-section">
          <SectionHeader title="CONTROLS" subtitle="BUTTONS & INPUTS" />
          <RpgFrame className="demo-card" padding="lg">
            <div className="demo-ribbons">
              {variants.map((variant) => (
                <RibbonButton key={variant} variant={variant} fullWidth>
                  {variant} button
                </RibbonButton>
              ))}
            </div>

            <div className="demo-controls">
              {variants.map((variant) => (
                <IconButton key={variant} label={`${variant} menu`} variant={variant} shape="square">
                  <MenuIcon />
                </IconButton>
              ))}
              <ArrowButton label="向左" direction="left" variant="dark" shape="circle" />
              <ArrowButton label="向右" direction="right" double variant="teal" shape="circle" />
              <Toggle checked={enabled} onCheckedChange={setEnabled} variant={enabled ? "teal" : "light"} />
            </div>

            <div className="demo-progress">
              <Progress label="Stability" value={83} showValue />
              <Progress label="Resonance" value={52} variant="light" size="sm" />
            </div>
          </RpgFrame>
        </section>

        <section className="demo-section">
          <SectionHeader title="PANELS" subtitle="CHARACTER SELECTOR" variant="teal" />
          <div className="demo-panel-grid">
            {panelVariants.map((variant, index) => (
              <RpgPanel
                key={variant}
                number={String(index + 1).padStart(2, "0")}
                variant={variant}
                selected={selectedPanel === index}
                aria-label={`选择角色 ${index + 1}`}
                onClick={() => setSelectedPanel(index)}
              />
            ))}
          </div>
        </section>

        <section className="demo-section demo-section--screen">
          <CharacterStatusScreen characters={demoCharacters} defaultSelectedId="abyssa" />
        </section>
      </main>

      <footer className="demo-footer">@abyssa/ui · React + TypeScript</footer>
    </AbyssaProvider>
  );
}
