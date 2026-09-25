/** Selection follows a committed toggle; fixing another die never unfixes the first. */
export function selectionAfterDieToggle<T extends string>(current: T | null, owner: T, loaded: boolean): T | null {
  return loaded ? owner : current === owner ? null : current;
}
