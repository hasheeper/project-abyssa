import { useId } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/cx";

/** 素材库图标一律走 mask:颜色由所在位置的 currentColor 决定,不随图标文件变化。 */
export function ManorGlyph({src, className}: {src: string; className?: string}) {
  const mask = `url("${src}")`;
  return <i className={cx("manor-glyph", className)} aria-hidden="true"
    style={{maskImage: mask, WebkitMaskImage: mask} as CSSProperties}/>;
}

export type ManorSectionTier = "major" | "minor";

export interface ManorSectionProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  label: ReactNode;
  /** 标签前的素材库图标。 */
  icon?: string;
  /** 标签行右端的附注,例如「2 / 4」「1 件」,或这一组自己的分页。 */
  aside?: ReactNode;
  /** major:窗口内的区块(行囊、库存);minor:阅读区里的小节(开放条件、收获)。 */
  tier?: ManorSectionTier;
  headingLevel?: 3 | 4;
  children?: ReactNode;
}

/**
 * 洋馆工具窗(库存、日志、整备)共用的分节。字阶、颜色和细线都取自
 * manor-utility.css 的变量,调用方只给内容,不再各自画标题与引线。
 * 调用方给了 aria-label 时以它为名,否则以标题为名。
 */
export function ManorSection({label, icon, aside, tier = "major", headingLevel = 3, className, children, ...props}: ManorSectionProps) {
  const id = useId();
  const Heading = headingLevel === 4 ? "h4" : "h3";
  const named = props["aria-label"] != null || props["aria-labelledby"] != null;
  return <section className={cx("manor-section", className)} data-tier={tier} aria-labelledby={named ? undefined : id} {...props}>
    <header className="manor-section__heading">
      {icon && <ManorGlyph src={icon}/>}
      <Heading id={id}>{label}</Heading>
      {aside != null && <div className="manor-section__aside">{aside}</div>}
    </header>
    {children}
  </section>;
}
