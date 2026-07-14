import { useId } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../utils/cx";
import { DiamondWatermark } from "./DiamondWatermark";
import type { DiamondWatermarkConfig } from "./DiamondWatermark";

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

export interface StatusPanelData {
  title: ReactNode;
  titleRootIndex?: number;
  subtitle?: ReactNode;
  affiliation?: StatusPanelAffiliation;
  state?: ReactNode;
  fields?: StatusField[];
  stats?: StatusStat[];
  traits?: StatusTrait[];
  parametersTitle?: ReactNode;
  archiveTitle?: ReactNode;
  traitsTitle?: ReactNode;
  recordTitle?: ReactNode;
  record?: ReactNode;
  quote?: ReactNode;
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

export function StatusPanel({ data, watermark, className, ...props }: StatusPanelProps) {
  const traitTooltipUid = useId().replaceAll(":", "");

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
                  {(!!data.traits?.length || data.record) && (
                    <div className="abyssa-status-panel__divider">
                      <span>{data.archiveTitle ?? "ARCHIVE RECORD"}</span>
                    </div>
                  )}
                </section>
              )}

              {(!!data.traits?.length || data.record) && (
                <>
                  {!data.stats?.length && (
                    <div className="abyssa-status-panel__divider">
                      <span>{data.archiveTitle ?? "ARCHIVE RECORD"}</span>
                    </div>
                  )}

                  <div className="abyssa-status-panel__archive-content">
                    <div className="abyssa-status-panel__lower">
                      {!!data.traits?.length && (
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
                                    data-empty={trait.icon ? undefined : true}
                                    aria-hidden="true"
                                  >
                                    {trait.icon}
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
                    {data.quote && (
                      <blockquote className="abyssa-status-panel__quote">{data.quote}</blockquote>
                    )}
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
