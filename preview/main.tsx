import { useState } from "react";
import type { ReactNode } from "react";
import {
  AbyssaProvider,
  ArrowButton,
  CharacterSelector,
  DiamondWatermark,
  IconButton,
  Nameplate,
  Progress,
  RibbonButton,
  RpgBackButton,
  RpgCheckbox,
  RpgCircleButton,
  RpgDialogue,
  RpgDiamondNodeTrack,
  RpgFrame,
  RpgHeader,
  RpgHexButton,
  RpgNotchButton,
  RpgNotchedPillButton,
  RpgPanel,
  RpgRadio,
  RpgShapeButton,
  RpgSquarePanel,
  RpgStatusNode,
  RpgTab,
  StatusPanel,
  Toggle,
  VerticalIndicator
} from "../src/index";
import { demoCharacters } from "../src/demo/data";
import "../src/styles/index.css";
import "./preview.css";

interface PreviewCardProps {
  name: string;
  children: ReactNode;
  wide?: boolean;
  tall?: boolean;
}

function PreviewCard({ name, children, wide, tall }: PreviewCardProps) {
  return (
    <article
      className="catalog-card"
      data-wide={wide || undefined}
      data-tall={tall || undefined}
      id={name.toLowerCase().replaceAll(" / ", "-").replaceAll(" ", "-")}
    >
      <header className="catalog-card__header">
        <h3>{name}</h3>
        <a href={`#${name.toLowerCase().replaceAll(" / ", "-").replaceAll(" ", "-")}`}>#</a>
      </header>
      <div className="catalog-card__stage">{children}</div>
    </article>
  );
}

interface CatalogSectionProps {
  id: string;
  label: string;
  children: ReactNode;
}

function CatalogSection({ id, label, children }: CatalogSectionProps) {
  return (
    <section className="catalog-section" id={id}>
      <header className="catalog-section__header">
        <h2>{label}</h2>
        <span aria-hidden="true" />
      </header>
      <div className="catalog-grid">{children}</div>
    </section>
  );
}

export function App() {
  const [enabled, setEnabled] = useState(true);
  const [radio, setRadio] = useState("dark");
  const [checked, setChecked] = useState(true);
  const [tab, setTab] = useState("status");
  const [node, setNode] = useState("balanced");
  const [panel, setPanel] = useState("04");
  const [squarePanel, setSquarePanel] = useState("03");

  return (
    <AbyssaProvider className="static-catalog">
      <header className="catalog-bar">
        <a className="catalog-bar__brand" href="#structure">ABYSSA UI</a>
        <nav aria-label="组件分类">
          <a href="#structure">结构</a>
          <a href="#actions">操作</a>
          <a href="#inputs">输入</a>
          <a href="#status">状态</a>
          <a href="#screens">完整界面</a>
        </nav>
      </header>

      <main className="catalog-main">
        <CatalogSection id="structure" label="结构">
          <PreviewCard name="RpgHeader" wide>
            <div className="stack headers">
              <RpgHeader label="CHARACTER STATUS" variant="dark" />
              <RpgHeader label="SYSTEM CONFIG" variant="teal" />
            </div>
          </PreviewCard>

          <PreviewCard name="RpgFrame" wide>
            <div className="frame-grid">
              <RpgFrame padding="sm">Dark</RpgFrame>
              <RpgFrame variant="teal" padding="sm">Teal</RpgFrame>
              <RpgFrame variant="light" padding="sm">Light</RpgFrame>
            </div>
          </PreviewCard>

          <PreviewCard name="DiamondWatermark">
            <div className="watermark-sample">
              <DiamondWatermark
                size={50}
                outerFill="rgb(255 255 255 / 8%)"
                innerFill="rgb(255 255 255 / 4%)"
              />
              <span>DOUBLE DIAMOND</span>
            </div>
          </PreviewCard>

          <PreviewCard name="RpgPanel" wide>
            <div className="panel-grid">
              {(["01", "02", "03", "04", "05", "06"] as const).map((number, index) => (
                <RpgPanel
                  key={number}
                  number={number}
                  variant={(["dark", "gray", "deep", "teal", "teal-outline", "light"] as const)[index]}
                  selected={panel === number}
                  onClick={() => setPanel(number)}
                  aria-label={`选择面板 ${number}`}
                />
              ))}
            </div>
          </PreviewCard>

          <PreviewCard name="RpgSquarePanel" wide>
            <div className="square-panel-grid">
              {(["01", "02", "03", "04", "05", "06"] as const).map((number, index) => (
                <RpgSquarePanel
                  key={number}
                  number={number}
                  variant={(["dark", "gray", "teal", "teal-outline", "deep", "light"] as const)[index]}
                  selected={squarePanel === number}
                  onClick={() => setSquarePanel(number)}
                  aria-label={`选择小面板 ${number}`}
                />
              ))}
            </div>
          </PreviewCard>
        </CatalogSection>

        <CatalogSection id="actions" label="操作">
          <PreviewCard name="RibbonButton" wide>
            <div className="stack ribbons">
              <RibbonButton variant="dark" fullWidth>Dark action</RibbonButton>
              <RibbonButton variant="light" fullWidth>Light action</RibbonButton>
              <RibbonButton variant="teal" fullWidth>Primary action</RibbonButton>
            </div>
          </PreviewCard>

          <PreviewCard name="RpgHexButton" wide>
            <div className="stack hex-buttons">
              <RpgHexButton variant="dark" fullWidth>New Game</RpgHexButton>
              <RpgHexButton variant="light" fullWidth>Continue</RpgHexButton>
              <RpgHexButton variant="teal" fullWidth>Load Game</RpgHexButton>
            </div>
          </PreviewCard>

          <PreviewCard name="RpgShapeButton / RpgCircleButton" wide>
            <div className="shape-grid">
              <RpgCircleButton label="Open" variant="dark" />
              <RpgCircleButton label="Open" variant="teal" />
              <RpgShapeButton label="Select" shape="square" variant="light" />
              <RpgShapeButton label="Confirm" shape="chamfer" variant="teal" />
              <RpgShapeButton label="Continue" shape="pill" variant="dark" />
            </div>
          </PreviewCard>

          <PreviewCard name="RpgNotchButton / RpgNotchedPillButton" wide>
            <div className="action-pairs">
              <RpgNotchButton variant="dark" />
              <RpgNotchButton variant="teal" />
              <RpgNotchedPillButton label="Previous" variant="dark" />
              <RpgNotchedPillButton label="Continue" variant="teal" />
            </div>
          </PreviewCard>

          <PreviewCard name="RpgBackButton">
            <div className="inline centered">
              <RpgBackButton variant="dark" />
              <RpgBackButton variant="teal" />
            </div>
          </PreviewCard>

          <PreviewCard name="IconButton / ArrowButton">
            <div className="icon-grid">
              <IconButton label="关闭" icon="close" shape="diamond" variant="dark" />
              <IconButton label="增加" icon="plus" variant="light" size="md" />
              <IconButton label="减少" icon="minus" variant="teal" size="md" />
              <ArrowButton label="向左" direction="left" variant="dark" size="md" />
              <ArrowButton label="向右" direction="right" double variant="teal" size="md" />
            </div>
          </PreviewCard>
        </CatalogSection>

        <CatalogSection id="inputs" label="输入与导航">
          <PreviewCard name="RpgTab" wide>
            <div className="tab-row" role="tablist" aria-label="状态分类">
              {(["status", "items", "archive", "map"] as const).map((id, index) => (
                <RpgTab
                  key={id}
                  label={id}
                  role="tab"
                  variant={(["dark", "light", "decorated", "teal"] as const)[index]}
                  selected={tab === id}
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                />
              ))}
            </div>
          </PreviewCard>

          <PreviewCard name="Toggle">
            <div className="control-line">
              <Toggle checked={enabled} onCheckedChange={setEnabled} variant="teal" />
              <output>{enabled ? "ON" : "OFF"}</output>
            </div>
          </PreviewCard>

          <PreviewCard name="RpgRadio / RpgCheckbox">
            <div className="choice-grid">
              <div role="radiogroup" aria-label="主题">
                {(["gray", "dark", "teal"] as const).map((variant) => (
                  <label key={variant}>
                    <RpgRadio
                      name="preview-theme"
                      label={`${variant} theme`}
                      variant={variant}
                      checked={radio === variant}
                      onCheckedChange={(next) => next && setRadio(variant)}
                    />
                    <span>{variant}</span>
                  </label>
                ))}
              </div>
              <div>
                <label><RpgCheckbox label="空白" variant="empty" /><span>empty</span></label>
                <label><RpgCheckbox label="暗色" variant="dark" checked={checked} onCheckedChange={setChecked} /><span>dark</span></label>
                <label><RpgCheckbox label="青色" variant="teal" defaultChecked /><span>teal</span></label>
              </div>
            </div>
          </PreviewCard>

          <PreviewCard name="RpgDiamondNodeTrack" wide>
            <RpgDiamondNodeTrack
              items={[
                { id: "quiet", label: "安静" },
                { id: "balanced", label: "均衡" },
                { id: "vivid", label: "鲜明", variant: "teal" }
              ]}
              value={node}
              onValueChange={setNode}
              label="响应级别"
            />
          </PreviewCard>
        </CatalogSection>

        <CatalogSection id="status" label="状态与信息">
          <PreviewCard name="Nameplate">
            <Nameplate name="艾比希斯·贝尔泽兰" secondaryName="ABYSSA BEELZERAN" />
          </PreviewCard>

          <PreviewCard name="Progress">
            <div className="stack progress-list">
              <Progress label="Stability" value={83} showValue />
              <Progress label="Resonance" value={52} variant="light" size="sm" showValue />
            </div>
          </PreviewCard>

          <PreviewCard name="RpgStatusNode">
            <div className="inline centered">
              <RpgStatusNode label="不可用" icon="close" variant="disabled" />
              <RpgStatusNode label="已确认" icon="check" variant="dark" />
              <RpgStatusNode label="已选中" icon="check" variant="teal" />
            </div>
          </PreviewCard>

          <PreviewCard name="VerticalIndicator">
            <div className="inline indicators">
              <VerticalIndicator variant="dark" />
              <VerticalIndicator variant="light" />
              <VerticalIndicator variant="teal" />
            </div>
          </PreviewCard>

          <PreviewCard name="RpgDialogue" wide>
            <div className="stack dialogues">
              <RpgDialogue
                name="Abyssa"
                text={"……太阳的光，感觉舒服的时候，就醒了。\n这里的阳光，味道最好。"}
              />
              <RpgDialogue name="name tag" variant="light" />
            </div>
          </PreviewCard>

          <PreviewCard name="StatusPanel" wide tall>
            <StatusPanel data={demoCharacters.find((character) => character.id === "abyssa")!.status} />
          </PreviewCard>
        </CatalogSection>

        <CatalogSection id="screens" label="完整界面">
          <PreviewCard name="CharacterSelector" wide>
            <CharacterSelector
              className="character-selector"
              items={demoCharacters.map(({ id, number, name, selectorVariant }) => ({
                id,
                number,
                label: name,
                variant: selectorVariant
              }))}
              defaultValue="abyssa"
              columns={3}
            />
          </PreviewCard>
        </CatalogSection>
      </main>
    </AbyssaProvider>
  );
}
