import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../utils/cx";
import { DiamondWatermark, resolveDiamondWatermark } from "./DiamondWatermark";
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
  description?: ReactNode;
}

export interface StatusPanelData {
  title: ReactNode;
  subtitle?: ReactNode;
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

export function StatusPanel({ data, watermark, className, ...props }: StatusPanelProps) {
  const watermarkOptions = resolveDiamondWatermark(watermark, { size: 52, outerOpacity: 0.48, innerOpacity: 0.38 });
  return (
    <div
      className={cx("abyssa-status-panel", className)}
      {...props}
    >
      <div className="abyssa-status-panel__middle">
        <div className="abyssa-status-panel__inner">
          <div className="abyssa-status-panel__content">
            {watermarkOptions && <DiamondWatermark className="abyssa-status-panel__watermark" {...watermarkOptions} />}

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
                    <h3>{data.title}</h3>
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

                  <div className="abyssa-status-panel__lower">
                    {!!data.traits?.length && (
                      <section>
                        <h4 className="abyssa-status-panel__subsection-title">
                          {data.traitsTitle ?? "INHERENT TRAITS"}
                        </h4>
                        <div className="abyssa-status-panel__traits">
                          {data.traits.map((trait, index) => (
                            <article key={`${String(trait.name)}-${index}`}>
                              <h5>{trait.name}</h5>
                              {trait.description && <p>{trait.description}</p>}
                            </article>
                          ))}
                        </div>
                      </section>
                    )}

                    {data.record && (
                      <section>
                        <h4 className="abyssa-status-panel__subsection-title">
                          {data.recordTitle ?? "BIOGRAPHY"}
                        </h4>
                        <div className="abyssa-status-panel__record">{data.record}</div>
                        {data.quote && <blockquote>{data.quote}</blockquote>}
                      </section>
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
