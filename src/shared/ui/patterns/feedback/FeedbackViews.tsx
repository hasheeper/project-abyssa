import { formatMoney } from "../../primitives/Money";
import type { ButtonHTMLAttributes } from "react";
import { cx } from "../../../lib/cx";
import { CurrencyAmount } from "../../primitives/CurrencyAmount";
import { DiamondWatermark } from "../../primitives/DiamondWatermark";
import { ItemSlotStatic } from "../../primitives/ItemSlot";
import { RpgShapeButton } from "../../primitives/RpgShapeButton";
import { ErrorDetails } from "./ErrorDetails";
import type { EventResultProps, FeedbackNoticeProps, FeedbackReward, FeedbackTone, InlineFeedbackProps, RewardNoticeProps, SceneFeedbackEntry } from "./types";
import "../../styles/components-foundation.css";
import "../../styles/components-controls.css";
import "../../styles/motion-controls.css";
import "../../styles/items.css";
import "../../styles/scene-feedback.css";

function FeedbackMark({ tone }: { tone: FeedbackTone | "error" }) {
  return <svg className="scene-feedback__mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
    <path className="scene-feedback__mark-frame" d="M20 2 38 20 20 38 2 20Z" />
    <path className="scene-feedback__mark-inset" d="m20 7 13 13-13 13L7 20Z" />
    {tone === "success" ? <path d="m12.5 20 5 5 10-11" />
      : tone === "error" ? <path d="m15 15 10 10m0-10L15 25" />
      : <><path d={tone === "info" ? "M20 18v9" : "M20 12v10"} /><circle cx="20" cy={tone === "info" ? 12 : 27} r="1" /></>}
  </svg>;
}

function FeedbackTexture() {
  return <DiamondWatermark className="scene-feedback__texture" size={36} outerFill="currentColor" innerFill="currentColor" outerOpacity={0.025} innerOpacity={0.015} />;
}

/** Static view. Use SceneFeedback for timed presentation and live announcements. */
export function FeedbackNotice({ message, tone = "info", className, style }: FeedbackNoticeProps) {
  return <div className={cx("scene-feedback__surface", "scene-feedback__notice", className)} data-tone={tone} style={style}>
    <FeedbackTexture />
    <FeedbackMark tone={tone} />
    <p>{message}</p>
  </div>;
}

/** A compact acquisition receipt; ownership is already committed by the host. */
export function RewardNotice({ reward, className, style }: RewardNoticeProps) {
  return <div className={cx("scene-feedback__surface", "scene-feedback__reward", className)} style={style}>
    <FeedbackTexture />
    {reward.kind === "item" && reward.icon
      ? <ItemSlotStatic icon={reward.icon} name={reward.name} rarity={reward.rarity} tone={reward.rarity === "unknown" ? "interface" : "rarity"} showRarity={false} size={44} aria-hidden="true" />
      : <FeedbackMark tone="success" />}
    <div className="scene-feedback__reward-copy">
      <p className="scene-feedback__category">{reward.kind === "item" ? "获得道具" : `获得${currencyNames[reward.currency]}`}</p>
      {reward.kind === "item" ? <p className="scene-feedback__item-name">{reward.name}</p>
        : <CurrencyAmount value={reward.quantity} currency={reward.currency} />}
    </div>
    {reward.kind === "item" && <span className="scene-feedback__quantity">×{reward.quantity.toLocaleString("en-US")}</span>}
  </div>;
}

/** One event and its rewards; there are deliberately no focusable item slots. */
export function EventResult({ title, label, description, rewards = [], className, style }: EventResultProps) {
  return <section className={cx("scene-feedback__surface", "scene-feedback__result", className)} style={style}>
    <FeedbackTexture />
    <header className="scene-feedback__result-heading">
      <FeedbackMark tone="success" />
      <div>
        {label && <p className="scene-feedback__category">{label}</p>}
        <h3>{title}</h3>
      </div>
      <span className="scene-feedback__heading-rule" aria-hidden="true" />
    </header>
    {description && <p className="scene-feedback__description">{description}</p>}
    {rewards.length > 0 && <ul className="scene-feedback__rewards" aria-label="获得奖励">
      {rewards.map(reward => <li key={reward.id} data-kind={reward.kind}>
        {reward.kind === "currency"
          ? <CurrencyAmount value={reward.quantity} currency={reward.currency} />
          : <>
            {reward.icon && <ItemSlotStatic icon={reward.icon} name={reward.name} rarity={reward.rarity} tone={reward.rarity === "unknown" ? "interface" : "rarity"} showRarity={false} size={44} aria-hidden="true" />}
            <span className="scene-feedback__item-name">{reward.name}</span>
            <span className="scene-feedback__quantity">×{reward.quantity.toLocaleString("en-US")}</span>
          </>}
      </li>)}
    </ul>}
  </section>;
}

/** Persistent, operation-local failure/help. The host owns resolution/retry. */
export function FeedbackActionButton({ label, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {label: string}) {
  return <RpgShapeButton className={cx("scene-feedback__action", className)} shape="chamfer" label={label}
    watermark={{ outerOpacity: 0.2, innerOpacity: 0.08 }} {...props}><span>{children ?? label}</span></RpgShapeButton>;
}

export function InlineFeedback({ message, tone = "error", action, details, className, style }: InlineFeedbackProps) {
  return <div className={cx("scene-feedback__inline", className)} data-tone={tone} style={style}>
    <FeedbackMark tone={tone} />
    <p role={tone === "error" ? "alert" : "status"} aria-atomic="true">{message}</p>
    {action && <FeedbackActionButton {...action}/>}
    {details?.raw.trim() && <ErrorDetails key={details.id} details={details} />}
  </div>;
}

const currencyNames = { lira: "铜里拉", crystal: "远古晶石", gold: "铜里拉" };
export function feedbackAnnouncement(entry: SceneFeedbackEntry, scale = 1) {
  const rewardText = (reward: FeedbackReward) => reward.kind === "item" ? `${reward.name} ×${reward.quantity}`
    : reward.currency === "crystal" ? `${currencyNames.crystal} ×${reward.quantity}` : `${currencyNames[reward.currency]} ${formatMoney(reward.quantity, scale)}`;
  if (entry.kind === "notice") return entry.message;
  if (entry.kind === "reward") return `获得${entry.reward.kind === "item" ? "道具，" : ""}${rewardText(entry.reward)}`;
  return [entry.label, entry.title, entry.description, ...(entry.rewards ?? []).map(rewardText)].filter(Boolean).join("，");
}
