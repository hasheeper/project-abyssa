/** Adjacent visual steps of an already committed permutation. Never resolves a rule. */
export function formationSteps(before: readonly string[], after: readonly string[]): string[][] {
  const order = [...before], steps: string[][] = [];
  if (order.length !== after.length || new Set(order).size !== order.length || after.some(id => !order.includes(id))) return [[...after]];
  for (let target = 0; target < after.length; target++) {
    let index = order.indexOf(after[target]);
    while (index > target) {
      [order[index - 1], order[index]] = [order[index], order[index - 1]];
      steps.push([...order]); index--;
    }
  }
  return steps;
}
