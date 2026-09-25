import { createContext, useContext, useMemo, type ReactNode } from "react";

// Old save facts keep their original integer scale. Conversion is presentation-only.
const MoneyScale = createContext(1);
export function MoneyProvider({scale = 1, children}: {scale?: number; children: ReactNode}) {
  return <MoneyScale.Provider value={scale}>{children}</MoneyScale.Provider>;
}
export function formatMoney(value: number, scale = 1) {
  return `${(value * scale).toLocaleString("en-US")} G`;
}
export function useMoney() {
  const scale = useContext(MoneyScale);
  return useMemo(() => ({scale, copper: (value: number) => value * scale, format: (value: number) => formatMoney(value, scale)}), [scale]);
}

export function MoneyText({value}: {value: number | undefined}) {
  return <>{useMoney().format(value ?? 0)}</>;
}
