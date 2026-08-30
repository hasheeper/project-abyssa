import type { HTMLAttributes } from "react";

export interface SceneArrivalTitleProps extends HTMLAttributes<HTMLElement> {
  eyebrow: string;
  title: string;
  tone?: "teal" | "gold";
  /** 演示页可常驻；真实业务页只在 incoming panel transition 期间显示。 */
  staticDisplay?: boolean;
}

/**
 * 场景抵达标题。
 *
 * 视觉语言来自 loading lab 原有的左上角 scene-caption：细竖线、分区码、
 * 地点名。它只负责“先确认到了哪里”，不跟随实体业务面板下落。
 */
export function SceneArrivalTitle({
  eyebrow,
  title,
  tone = "teal",
  staticDisplay = false,
  className,
  ...props
}: SceneArrivalTitleProps) {
  const rootClass = ["scene-arrival", className].filter(Boolean).join(" ");

  return (
    <header
      className={rootClass}
      data-tone={tone}
      data-static={staticDisplay || undefined}
      aria-hidden="true"
      {...props}
    >
      <span className="scene-arrival__eyebrow">{eyebrow}</span>
      <strong className="scene-arrival__title">{title}</strong>
    </header>
  );
}
