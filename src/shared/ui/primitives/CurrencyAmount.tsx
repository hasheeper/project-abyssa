import { useMoney } from "./Money";

export type CurrencyKind = "lira" | "crystal" | "gold";

export interface CurrencyAmountProps {
  value: number;
  currency?: CurrencyKind;
  /** Optional account/service name. The component appends the amount and unit. */
  label?: string;
  className?: string;
  /** Optional account emblem; default coin and crystal artwork is unchanged. */
  iconUrl?: string;
}

export function CurrencyAmount({ value, currency = "lira", label, className, iconUrl }: CurrencyAmountProps) {
  const money = useMoney(), crystal = currency === "crystal";
  const name = crystal ? "远古晶石" : "铜里拉";
  const amount = crystal ? value : money.copper(value);
  return (
    <span className={["abyssa-currency-amount", className].filter(Boolean).join(" ")} data-currency={crystal ? "crystal" : "lira"} aria-label={`${label ?? name} ${amount.toLocaleString("en-US")}${crystal ? "" : " G"}`}>
      <i aria-hidden="true" data-icon={iconUrl ? "custom" : undefined}
        style={iconUrl ? {WebkitMaskImage: `url(${JSON.stringify(iconUrl)})`, maskImage: `url(${JSON.stringify(iconUrl)})`} : undefined}>
        {!iconUrl && !crystal && <><span data-part="ring" /><span data-part="mark" /></>}
      </i>
      <span>{amount.toLocaleString("en-US")}</span>
      {!crystal && <small className="abyssa-currency-amount__unit" aria-hidden="true">G</small>}
    </span>
  );
}
