import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../utils/cx";
import { RpgFrame } from "./RpgFrame";

export interface StatusField {
  label: string;
  value: ReactNode;
}

export interface StatusStat {
  label: string;
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
  recordTitle?: ReactNode;
  record?: ReactNode;
  quote?: ReactNode;
}

export interface StatusPanelProps extends HTMLAttributes<HTMLDivElement> {
  data: StatusPanelData;
}

export function StatusPanel({ data, className, ...props }: StatusPanelProps) {
  return (
    <RpgFrame
      className={cx("abyssa-status-panel", className)}
      padding="lg"
      {...props}
    >
      <div className="abyssa-status-panel__heading">
        <div>
          <h3>{data.title}</h3>
          {data.subtitle && <p>{data.subtitle}</p>}
        </div>
        {data.state && <span className="abyssa-status-panel__state">{data.state}</span>}
      </div>

      {!!data.fields?.length && (
        <dl className="abyssa-status-panel__fields">
          {data.fields.map((field) => (
            <div key={field.label}>
              <dt>{field.label}</dt>
              <i aria-hidden="true" />
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {!!data.stats?.length && (
        <section className="abyssa-status-panel__section" aria-label="参数">
          <h4><span>参数</span><small>PARAMETERS</small></h4>
          <dl className="abyssa-status-panel__stats">
            {data.stats.map((stat) => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <i aria-hidden="true" />
                <dd data-accent={stat.accent || undefined}>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {(!!data.traits?.length || data.record) && (
        <div className="abyssa-status-panel__lower">
          {!!data.traits?.length && (
            <section className="abyssa-status-panel__section">
              <h4><span>特性</span><small>TRAITS</small></h4>
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
            <section className="abyssa-status-panel__section">
              <h4>
                <span>{data.recordTitle ?? "人物记录"}</span>
                <small>ARCHIVE</small>
              </h4>
              <div className="abyssa-status-panel__record">{data.record}</div>
              {data.quote && <blockquote>{data.quote}</blockquote>}
            </section>
          )}
        </div>
      )}
    </RpgFrame>
  );
}
