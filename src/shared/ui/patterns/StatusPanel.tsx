import { useId } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/cx";
import { DiamondWatermark } from "../primitives/DiamondWatermark";
import type { DiamondWatermarkConfig } from "../primitives/DiamondWatermark";
import { BondCrystal } from "../primitives/BondCrystal";
import bandageRollIcon from "../../../assets/icons/items/bandage-roll.svg";
import openBookIcon from "../../../assets/icons/items/open-book.svg";
import padlockIcon from "../../../assets/icons/items/padlock.svg";
import runeStoneIcon from "../../../assets/icons/items/rune-stone.svg";
import tiedScrollIcon from "../../../assets/icons/items/tied-scroll.svg";

export interface StatusField {
  label: ReactNode;
  secondaryLabel?: ReactNode;
  value: ReactNode;
}

export interface StatusStat {
  label: ReactNode;
  secondaryLabel?: ReactNode;
  value: ReactNode;
  accent?: boolean;
}

export interface StatusTrait {
  name: ReactNode;
  summary?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  iconUrl?: string;
}

export type StatusPanelAffiliationTone =
  | "demon-lord"
  | "demon-cadre"
  | "hero-party";

export interface StatusPanelAffiliation {
  label: ReactNode;
  secondaryLabel?: ReactNode;
  tone?: StatusPanelAffiliationTone;
}

export interface StatusBond {
  level: number;
  progress?: number;
  progressMax?: number;
  slots?: number;
}

export interface StatusChip {
  label: ReactNode;
  detail?: ReactNode;
  tone?: "neutral" | "danger";
  icon?: "wound" | "book";
  iconUrl?: string;
}

const statusChipIcons = {
  wound: bandageRollIcon,
  book: openBookIcon
} as const;

export interface StatusPact {
  name: ReactNode;
  iconUrl?: string;
  currentStage?: 1 | 2 | 3;
  trigger: ReactNode;
  currentTerm: ReactNode;
}

export interface StatusPanelData {
  title: ReactNode;
  titleRootIndex?: number;
  subtitle?: ReactNode;
  affiliation?: StatusPanelAffiliation;
  state?: ReactNode;
  bond?: StatusBond;
  statusChips?: StatusChip[];
  pact?: StatusPact;
  fields?: StatusField[];
  stats?: StatusStat[];
  traits?: StatusTrait[];
  parametersTitle?: ReactNode;
  archiveTitle?: ReactNode;
  traitsTitle?: ReactNode;
  recordTitle?: ReactNode;
  record?: ReactNode;
}

export interface StatusPanelProps extends HTMLAttributes<HTMLDivElement> {
  data: StatusPanelData;
  watermark?: DiamondWatermarkConfig;
}

function StatusTitle({ title, rootIndex }: { title: ReactNode; rootIndex?: number }) {
  if (
    typeof title !== "string" ||
    rootIndex === undefined ||
    rootIndex <= 0 ||
    rootIndex >= title.length
  ) {
    return <>{title}</>;
  }

  return (
    <>
      <span className="abyssa-status-panel__title-accent">{title[0]}</span>
      {title.slice(1, rootIndex)}
      <span className="abyssa-status-panel__title-root">{title[rootIndex]}</span>
      {title.slice(rootIndex + 1)}
    </>
  );
}

function PactGlyph({ src, name }: { src: string; name: string }) {
  return (
    <i
      className="abyssa-status-panel__pact-glyph"
      data-pact-icon={name}
      style={{
        WebkitMaskImage: `url("${src}")`,
        maskImage: `url("${src}")`
      }}
      aria-hidden="true"
    />
  );
}

function BondBand({ bond, chips = [] }: { bond: StatusBond; chips?: StatusChip[] }) {
  const slots = Math.max(1, bond.slots ?? 5);
  const level = Math.max(0, Math.min(slots, Math.floor(bond.level)));
  const progress = Math.max(0, bond.progress ?? 0);
  const progressMax = Math.max(1, bond.progressMax ?? 100);
  const currentRatio = level < slots ? Math.min(1, progress / progressMax) : 0;
  const totalProgress = Math.min(100, ((level + currentRatio) / slots) * 100);

  return (
    <section className="abyssa-status-panel__bond" aria-label="羁绊与当前状态">
      <div className="abyssa-status-panel__bond-main">
        <header className="abyssa-status-panel__bond-heading">
          <span>BOND 羁绊 · Lv.{level}</span>
        </header>
        <div
          className="abyssa-status-panel__bond-track"
          role="list"
          aria-label="羁绊阶段"
          style={{
            "--abyssa-bond-slots": slots,
            "--abyssa-bond-track-progress": `${Number(totalProgress.toFixed(2))}%`
          } as CSSProperties}
        >
          {Array.from({ length: slots }, (_, index) => {
            const stage = index + 1;
            const state = index < level ? "complete" : index === level ? "current" : "locked";
            return (
              <span
                className="abyssa-status-panel__bond-node"
                data-state={state}
                role="listitem"
                aria-label={
                  state === "complete"
                    ? `羁绊阶段 ${stage}，已达成`
                    : state === "current"
                      ? `羁绊阶段 ${stage}，进行中 ${progress} / ${progressMax}`
                      : `羁绊阶段 ${stage}，未解锁`
                }
                key={stage}
              >
                <BondCrystal
                  state={state}
                  stage={stage}
                  progress={progress}
                  progressMax={progressMax}
                  textureSeed={stage * 11}
                />
              </span>
            );
          })}
          <span className="abyssa-status-panel__bond-scale" aria-hidden="true">
            {Array.from({ length: slots }, (_, index) => {
              const state = index < level ? "complete" : index === level ? "current" : "locked";
              return <i data-state={state} key={index} />;
            })}
          </span>
          <small className="abyssa-status-panel__bond-progress">{progress}/{progressMax}</small>
        </div>
      </div>
      {!!chips.length && (
        <aside className="abyssa-status-panel__status">
          <h4>STATUS 当前状态</h4>
          <div className="abyssa-status-panel__chips" aria-label="当前状态">
            {chips.map((chip, index) => {
              const icon = chip.icon ?? (chip.tone === "danger" ? "wound" : undefined);
              const iconUrl = chip.iconUrl ?? (icon ? statusChipIcons[icon] : undefined);

              return (
                <span data-tone={chip.tone ?? "neutral"} key={`${String(chip.label)}-${index}`}>
                  <i
                    data-icon={icon ?? (iconUrl ? "custom" : undefined)}
                    style={iconUrl ? {
                      WebkitMaskImage: `url("${iconUrl}")`,
                      maskImage: `url("${iconUrl}")`
                    } : undefined}
                    aria-hidden="true"
                  />
                  <b>{chip.label}</b>
                  {chip.detail && <em>· {chip.detail}</em>}
                </span>
              );
            })}
          </div>
        </aside>
      )}
    </section>
  );
}

function PactPanel({ pact }: { pact: StatusPact }) {
  const currentStage = pact.currentStage ?? 1;
  const stageLabels = [
    { number: "I", label: "初始" },
    { number: "II", label: "现行" },
    { number: "III", label: "重签" }
  ];

  return (
    <section className="abyssa-status-panel__lower-section abyssa-status-panel__lower-section--pact">
      <header className="abyssa-status-panel__pact-heading">
        <div className="abyssa-status-panel__pact-title">
          <PactGlyph src={pact.iconUrl ?? padlockIcon} name="skill" />
          <h4>
            <span>PACT 能力</span>
            <b>{pact.name}</b>
          </h4>
        </div>
        <ol aria-label="私约重签阶段">
          {stageLabels.map(({ number, label }, index) => {
            const stage = (index + 1) as 1 | 2 | 3;
            const state = stage < currentStage ? "past" : stage === currentStage ? "current" : "locked";
            const stateIcon = state === "locked" ? padlockIcon : undefined;

            return (
              <li data-state={state} key={number}>
                <i className="abyssa-status-panel__pact-stage-inset" aria-hidden="true" />
                <b>{number}</b>
                <span>{label}</span>
                {stateIcon && <PactGlyph src={stateIcon} name={state} />}
                {index < stageLabels.length - 1 && (
                  <i className="abyssa-status-panel__pact-stage-arrow" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ol>
      </header>
      <div className="abyssa-status-panel__pact-body">
        <div className="abyssa-status-panel__pact-clause">
          <PactGlyph src={runeStoneIcon} name="trigger" />
          <div>
            <b>触发条件</b>
            <p>{pact.trigger}</p>
          </div>
        </div>
        <div className="abyssa-status-panel__pact-clause" data-current="true">
          <PactGlyph src={tiedScrollIcon} name="authority" />
          <div>
            <b>现行权柄</b>
            <p>{pact.currentTerm}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function StatusPanel({ data, watermark, className, ...props }: StatusPanelProps) {
  const traitTooltipUid = useId().replaceAll(":", "");
  const hasArchiveContent = Boolean(data.pact || data.traits?.length || data.record);

  return (
    <div
      className={cx("abyssa-status-panel", className)}
      {...props}
    >
      <div className="abyssa-status-panel__middle">
        <div className="abyssa-status-panel__inner">
          <div className="abyssa-status-panel__content">
            {watermark !== false && <DiamondWatermark className="abyssa-status-panel__watermark" {...watermark} />}

            <span className="abyssa-status-panel__corner" data-corner="tl" aria-hidden="true" />
            <span className="abyssa-status-panel__corner" data-corner="tr" aria-hidden="true" />
            <span className="abyssa-status-panel__corner" data-corner="bl" aria-hidden="true" />
            <span className="abyssa-status-panel__corner" data-corner="br" aria-hidden="true" />

            <span className="abyssa-status-panel__rivet" data-rivet="tl" aria-hidden="true" />
            <span className="abyssa-status-panel__rivet" data-rivet="tr" aria-hidden="true" />
            <span className="abyssa-status-panel__rivet" data-rivet="br" aria-hidden="true" />
            <span className="abyssa-status-panel__rivet" data-rivet="bl" aria-hidden="true" />

            <div className="abyssa-status-panel__information">
              <section className="abyssa-status-panel__identity">
                <div className="abyssa-status-panel__heading">
                  <div>
                    <div className="abyssa-status-panel__title-line">
                      <h3 aria-label={typeof data.title === "string" ? data.title : undefined}>
                        <StatusTitle title={data.title} rootIndex={data.titleRootIndex} />
                      </h3>
                      {data.affiliation && (
                        <span
                          className="abyssa-status-panel__affiliation"
                          data-tone={data.affiliation.tone ?? "hero-party"}
                          role="img"
                          aria-label={String(data.affiliation.secondaryLabel ?? data.affiliation.label)}
                          data-tooltip={String(data.affiliation.secondaryLabel ?? data.affiliation.label)}
                          title={String(data.affiliation.secondaryLabel ?? data.affiliation.label)}
                        >
                          <span className="abyssa-status-panel__affiliation-icon" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    {data.subtitle && <p>{data.subtitle}</p>}
                  </div>
                  {data.state && (
                    <span className="abyssa-status-panel__state">{data.state}</span>
                  )}
                </div>

                {!!data.fields?.length && (
                  <dl className="abyssa-status-panel__fields">
                    {data.fields.map((field, index) => (
                      <div key={`${String(field.label)}-${index}`}>
                        <dt>
                          {field.label}
                          {field.secondaryLabel && <small>{field.secondaryLabel}</small>}
                        </dt>
                        <i aria-hidden="true" />
                        <dd>{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>

              {data.bond && <BondBand bond={data.bond} chips={data.statusChips} />}

              {!!data.stats?.length && (
                <section className="abyssa-status-panel__parameters" aria-label="参数">
                  <div className="abyssa-status-panel__divider">
                    <span>{data.parametersTitle ?? "PARAMETERS"}</span>
                  </div>
                  <dl className="abyssa-status-panel__stats">
                    {data.stats.map((stat, index) => (
                      <div key={`${String(stat.label)}-${index}`}>
                        <dt>
                          {stat.label}
                          {stat.secondaryLabel && <small>{stat.secondaryLabel}</small>}
                        </dt>
                        <i aria-hidden="true" />
                        <dd data-accent={stat.accent || undefined}>{stat.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {hasArchiveContent && (
                    <div className="abyssa-status-panel__divider">
                      <span>{data.archiveTitle ?? "ARCHIVE RECORD"}</span>
                    </div>
                  )}
                </section>
              )}

              {hasArchiveContent && (
                <>
                  {!data.stats?.length && (
                    <div className="abyssa-status-panel__divider">
                      <span>{data.archiveTitle ?? "ARCHIVE RECORD"}</span>
                    </div>
                  )}

                  <div
                    className={cx(
                      "abyssa-status-panel__archive-content",
                      data.pact && "abyssa-status-panel__archive-content--pact"
                    )}
                  >
                    <div className="abyssa-status-panel__lower">
                      {data.pact ? (
                        <PactPanel pact={data.pact} />
                      ) : !!data.traits?.length && (
                        <section className="abyssa-status-panel__lower-section abyssa-status-panel__lower-section--traits">
                          <h4 className="abyssa-status-panel__subsection-title">
                            {data.traitsTitle ?? "INHERENT TRAITS"}
                          </h4>
                          <div className="abyssa-status-panel__traits">
                            {data.traits.map((trait, index) => {
                              const tooltipId = `${traitTooltipUid}-trait-${index}`;

                              return (
                                <article
                                  key={`${String(trait.name)}-${index}`}
                                  data-has-description={trait.description ? true : undefined}
                                  aria-describedby={trait.description ? tooltipId : undefined}
                                  tabIndex={trait.description ? 0 : undefined}
                                >
                                  <span
                                    className="abyssa-status-panel__trait-icon"
                                    data-empty={trait.icon || trait.iconUrl ? undefined : true}
                                    aria-hidden="true"
                                  >
                                    {trait.iconUrl ? (
                                      <span
                                        className="abyssa-status-panel__trait-glyph"
                                        style={{
                                          WebkitMaskImage: `url("${trait.iconUrl}")`,
                                          maskImage: `url("${trait.iconUrl}")`
                                        }}
                                      />
                                    ) : trait.icon}
                                  </span>
                                  <div className="abyssa-status-panel__trait-copy">
                                    <h5>{trait.name}</h5>
                                    {trait.summary && <p>{trait.summary}</p>}
                                  </div>
                                  {trait.description && (
                                    <span
                                      className="abyssa-status-panel__trait-tooltip"
                                      id={tooltipId}
                                      role="tooltip"
                                    >
                                      {trait.description}
                                    </span>
                                  )}
                                </article>
                              );
                            })}
                          </div>
                        </section>
                      )}

                      {data.record && (
                        <section className="abyssa-status-panel__lower-section abyssa-status-panel__lower-section--biography">
                          <h4 className="abyssa-status-panel__subsection-title">
                            {data.recordTitle ?? "BIOGRAPHY"}
                          </h4>
                          <div
                            className="abyssa-status-panel__record"
                            aria-label={typeof data.record === "string" ? data.record : undefined}
                          >
                            {typeof data.record === "string" && data.record.length > 0 ? (
                              <>
                                <span className="abyssa-status-panel__record-initial">{data.record[0]}</span>
                                {data.record.slice(1)}
                              </>
                            ) : data.record}
                          </div>
                        </section>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
