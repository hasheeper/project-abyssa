/** Design-only model. No game imports, save access, UI, or production wiring.
 * Run with Node 22. It validates shelf timing/rotation, not combat or affordability.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export const products = [
  {id: 'spare-blade', name: '备用短刃', price: 1200, mode: 'fixed', day: 2},
  {id: 'iron-bracer', name: '嵌铁护腕', price: 1280, mode: 'fixed', day: 2},
  {id: 'emergency-pouch', name: '应急药囊', price: 1600, mode: 'fixed', day: 4},
  {id: 'leather-bracer', name: '软革护腕', price: 1400, mode: 'fixed', day: 4},
  {id: 'whetstone', name: '磨刃石', price: 1480, mode: 'fixed', day: 6},
  {id: 'watch-bell', name: '守夜铜铃', price: 1680, mode: 'rotation', day: 3},
  {id: 'needle-case', name: '药师针匣', price: 1380, mode: 'rotation', day: 3},
  {id: 'mercenary-strap', name: '佣兵肩带', price: 1680, mode: 'rotation', day: 5},
  {id: 'sleeve-blade', name: '袖藏短刃', price: 1680, mode: 'rotation', day: 5},
];
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ordered = (ids, key) => [...ids].map(id => ({id, key: hash([...key, id])}))
  .sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  .map(row => row.id);
const quota = day => day < 3 ? 0 : day < 7 ? 1 : 2;

export function createModel(seed) {
  return {seed: String(seed), day: 0, cycle: 0, bag: [], admitted: [], rotation: [], bought: {}, history: []};
}

export function fixedOffers(state) {
  return products.filter(p => p.mode === 'fixed' && p.day <= state.day && !state.bought[p.id]).map(p => p.id);
}

export function advanceTo(state, targetDay) {
  assert.ok(Number.isInteger(targetDay) && targetDay >= state.day);
  while (state.day < targetDay) {
    state.day++;
    const eligible = products.filter(p => p.mode === 'rotation' && p.day <= state.day && !state.bought[p.id]).map(p => p.id);
    state.bag = state.bag.filter(id => eligible.includes(id));
    const newIds = eligible.filter(id => !state.admitted.includes(id));
    state.admitted.push(...newIds);
    // Preserve unfinished cycles. Newly eligible items join their tail.
    // At an empty boundary the next full refill includes both old and new items.
    if (state.bag.length) state.bag.push(...ordered(newIds, [state.seed, 'wave-one-v1', 'admit', state.day]));
    const lastOffered = state.rotation.at(-1)?.id, selected = [];
    const target = Math.min(quota(state.day), eligible.length);
    while (selected.length < target) {
      if (!state.bag.length) {
        const shuffled = ordered(eligible, [state.seed, 'wave-one-v1', 'cycle', ++state.cycle]);
        // Only defer the last item. Excluding the entire previous pair would
        // lock a four-item pool into the same two alternating pairs forever.
        state.bag = [...shuffled.filter(id => id !== lastOffered), ...shuffled.filter(id => id === lastOffered)];
      }
      const index = state.bag.findIndex(id => !selected.includes(id));
      assert.notEqual(index, -1, 'Daily draw must have an eligible distinct candidate');
      selected.push(state.bag.splice(index, 1)[0]);
    }
    state.rotation = selected.map(id => ({id, remaining: 1}));
    state.history.push({day: state.day, fixed: fixedOffers(state), rotation: [...selected]});
  }
  return state;
}

export function purchase(state, id) {
  assert.ok(!state.bought[id], 'One shop purchase per equipment product');
  const listing = state.rotation.find(row => row.id === id && row.remaining === 1);
  assert.ok(fixedOffers(state).includes(id) || listing, 'Product must be offered today');
  state.bought[id] = 1;
  if (listing) listing.remaining = 0;
  // No draw, same-day refill, grant processing, or battle RNG consumption here.
}

export function audit() {
  const seeds = 256, days = 28, strategies = ['none', 'all', 'alternate', 'selective'];
  let checkedDays = 0;
  const pairVariety = [];
  for (let seed = 0; seed < seeds; seed++) for (const strategy of strategies) {
    const state = createModel(seed);
    for (let day = 1; day <= days; day++) {
      advanceTo(state, day);
      const row = state.history.at(-1), offered = [...row.fixed, ...row.rotation];
      assert.equal(new Set(offered).size, offered.length);
      for (const id of offered) {
        assert.ok(products.find(p => p.id === id).day <= day);
        assert.ok(!state.bought[id]);
      }
      const before = JSON.stringify(state);
      advanceTo(state, day); fixedOffers(state); fixedOffers(state);
      assert.equal(JSON.stringify(state), before, 'Re-entry does not reroll');
      for (const id of offered) {
        const buy = strategy === 'all' || strategy === 'alternate' && day % 2 === 0 ||
          strategy === 'selective' && Number.parseInt(hash([seed, day, id]).slice(0, 2), 16) < 80;
        if (buy) purchase(state, id);
      }
      assert.deepEqual(state.rotation.map(row => row.id), row.rotation, 'Buying does not refill the shelf');
      const copy = JSON.parse(JSON.stringify(state)), future = structuredClone(state);
      advanceTo(copy, day + 1); advanceTo(future, day + 1);
      assert.deepEqual(copy, future, 'JSON-restored seed and history yield same next day');
      checkedDays++;
    }
    const byDay7 = new Set(state.history.filter(row => row.day <= 7).flatMap(row => row.rotation));
    for (const p of products.filter(p => p.mode === 'rotation')) assert.ok(byDay7.has(p.id), 'All initial random products offered by day 7');
    if (strategy === 'none') {
      pairVariety.push(new Set(state.history.filter(row => row.day >= 7)
        .map(row => [...row.rotation].sort().join('|'))).size);
      for (let end = 10; end <= days; end++) {
        const window = new Set(state.history.filter(row => row.day >= end - 3 && row.day <= end).flatMap(row => row.rotation));
        assert.equal(window.size, 4, 'Stable full pool is covered in every four-day window');
      }
      const jumped = advanceTo(createModel(seed), days);
      assert.deepEqual(jumped, state, 'Skipping visits does not skip the calendar schedule');
    }
    if (strategy === 'all') {
      assert.equal(Object.keys(state.bought).length, 9);
      assert.equal(state.rotation.length, 0, 'Exhausted pool collapses');
      assert.equal(fixedOffers(state).length, 0);
    }
  }
  const example = advanceTo(createModel('example-42'), 10);
  return {
    status: 'passed', model: 'design-only; no production integration or combat balance claim',
    seeds, days, strategies, checkedDays,
    equipmentKinds: products.length, newDefinitions: 7,
    totalEquipmentPrice: products.reduce((sum, p) => sum + p.price, 0),
    day7FirstAppearance: 'all four random products in all sampled scenarios',
    distinctPairsFromDay7: {minimum: Math.min(...pairVariety), maximum: Math.max(...pairVariety), possible: 6},
    example: example.history.map(row => ({day: row.day, baselineSupplies: 5,
      fixed: row.fixed.map(id => products.find(p => p.id === id).name),
      rotation: row.rotation.map(id => products.find(p => p.id === id).name)})),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(audit(), null, 2));
