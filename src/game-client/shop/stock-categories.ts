/** Explicit presentation categories based on the current items' uses. */
export const stockCategories = [
  {id: "equipment", label: "配装"},
  {id: "battle", label: "战斗"},
  {id: "exploration", label: "探索"},
  {id: "curio", label: "奇物"},
  {id: "currency", label: "旧币"},
  {id: "salvage", label: "杂物"},
] as const;

export type StockCategory = typeof stockCategories[number]["id"];
export type StockFilter = "all" | StockCategory;
