export type CurrencyKind = "lira" | "crystal" | "gold";

export interface CurrencyAmountProps {
  value: number;
  currency?: CurrencyKind;
  label?: string;
  className?: string;
}

export function CurrencyAmount({ value, currency = "lira", label, className }: CurrencyAmountProps) {
  const name = currency === "crystal" ? "远古晶石" : currency === "gold" ? "金币" : "里拉";
  return (
    <span className={["abyssa-currency-amount", className].filter(Boolean).join(" ")} data-currency={currency} aria-label={label ?? `${name} ${value}`}>
      <i aria-hidden="true"><span data-part="ring" /><span data-part="mark" /></i>
      <span>{value.toLocaleString("en-US")}</span>
    </span>
  );
}
