// Isolated native experiment: do not widen the formal game's emotion protocol.
import assert from 'node:assert/strict';

/** @typedef {{id: string, name: string}} Identity */
/** @typedef {{cues: Record<string, {expression: string}>, specials?: Record<string, {expression: string}>}} Profile */
/** @typedef {{common: Record<string, string>, actors: (Identity & {specials: string[]})[], player: Identity}} ExpressionCatalog */
/** @typedef {{paragraph: number, kind: 'narration' | 'dialogue', text: string, speaker?: string, name?: string, emotion?: string, scope?: 'common' | 'special', bilingual?: string}} ReadingLine */

/** Presence is explicit scene state, never inferred from mentioned/activated character cards. */
/** @param {{labels: Record<string, string>, profiles: Record<string, Profile>, recipes: Record<string, Record<string, unknown>>, actors: Record<string, string>, player: Identity}} source
 * @returns {ExpressionCatalog}
 */
export function nativeExpressionCatalog({labels, profiles, recipes, actors, player}) {
  assert(Object.keys(labels).length && Object.keys(actors).length, 'Missing expression catalog or present actors');
  const selected = Object.entries(actors).map(([id, name]) => {
    assert(Object.hasOwn(profiles, id) && Object.hasOwn(recipes, id), `Missing expression assets: ${id}`);
    const profile = profiles[id], faces = recipes[id];
    for (const emotion of Object.keys(labels)) {
      assert(profile.cues[emotion] && Object.hasOwn(faces, profile.cues[emotion].expression), `Missing common expression: ${id}/${emotion}`);
    }
    const specials = Object.keys(profile.specials ?? {});
    for (const special of specials) {
      assert(!Object.hasOwn(labels, special), 'Special collides with common emotion');
      assert(profile.specials);
      assert(Object.hasOwn(faces, profile.specials[special].expression), `Missing special expression: ${id}/${special}`);
    }
    return {id, name, specials};
  });
  const identities = [...selected, player];
  for (const actor of identities) {
    assert(actor && /^[a-z][a-z0-9-]*$/.test(actor.id) && typeof actor.name === 'string' && actor.name.trim(), 'Invalid scene identity');
    assert(!/[\[\]：:\r\n]/.test(actor.name), 'Unsupported speaker-name delimiters');
  }
  const aliases = identities.flatMap(actor => [...new Set([actor.id, actor.name])]);
  assert.equal(new Set(aliases).size, aliases.length, 'Ambiguous scene identities');
  return {common: {...labels}, actors: selected, player: {...player}};
}

/** @param {string} template @param {ExpressionCatalog} catalog */
export function nativeExpressionPrompt(template, catalog) {
  const marker = '{{差分目录}}';
  assert.equal(template.split(marker).length, 2, 'Expected one expression catalog slot');
  const common = Object.entries(catalog.common).map(([id, label]) => `${id}=${label}`).join('、');
  const actors = catalog.actors.map(actor => `${actor.name}（${actor.id}）：${actor.specials.length ? `专属 ${actor.specials.join('、')}` : '仅通用项'}`);
  return template.replace(marker, () => `通用差分：${common}\n本场角色：\n${actors.join('\n')}\n玩家${catalog.player.name}（${catalog.player.id}）：仅通用标记，静态头像。`);
}

/** Keep paragraph boundaries and existing Chinese verbatim; retain speaker/emotion separately. */
/** @param {string} body @param {(text: string) => string} extractDialogue @param {ExpressionCatalog} catalog */
export function readNativeExpressionBody(body, extractDialogue, catalog) {
  /** @type {ReadingLine[]} */
  const lines = [];
  const actors = [...catalog.actors, {...catalog.player, specials: []}];
  const reading = body.split(/(\r?\n\s*\r?\n)/).map((part, index) => {
    if (index % 2 || !part.trim()) return part;
    const match = /^([\t ]*)([^\r\n：:\[\]]+?)\[([^\]\r\n]+)\][\t ]*[：:][\t ]*(「[^\r\n]*」)([\t ]*)$/.exec(part);
    if (!match) {
      assert(!/^\s*(?:「|[^\r\n「」]*[：:]\s*「)/u.test(part) && !/^\s*[^\r\n]*\[[^\r\n]*\]/u.test(part), 'Missing or malformed dialogue expression tag');
      assert(!/[\u3040-\u30ff]/u.test(part), 'Japanese outside tagged dialogue');
      lines.push({paragraph: lines.length + 1, kind: 'narration', text: part.trim()});
      return part;
    }
    const [, leading, name, emotion, bilingual, trailing] = match;
    const actor = actors.find(actor => name.trim() === actor.id || name.trim() === actor.name);
    assert(actor, `Speaker is not present: ${name.trim()}`);
    const common = Object.hasOwn(catalog.common, emotion);
    assert(common || actor.specials.includes(emotion), `Unsupported expression for ${actor.id}: ${emotion}`);
    const chinese = extractDialogue(bilingual);
    assert(chinese.startsWith('「') && chinese.endsWith('」') && !/[\u3040-\u30ff]/u.test(chinese), 'Invalid Chinese dialogue extraction');
    lines.push({paragraph: lines.length + 1, kind: 'dialogue', speaker: actor.id, name: actor.name,
      emotion, scope: common ? 'common' : 'special', bilingual, text: chinese});
    return leading + chinese + trailing;
  }).join('');
  assert(lines.some(line => line.kind === 'dialogue'), 'No tagged dialogue found');
  return {body: reading, lines};
}
