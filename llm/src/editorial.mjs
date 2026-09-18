/** Editorial structure only. No network, gameplay writes, or aesthetic acceptance. */
export const EMOTIONS = Object.freeze([
  'neutral', 'smile', 'joy', 'sad', 'angry', 'surprised', 'serious',
  'closed', 'wry', 'flustered', 'displeased', 'confident', 'confused', 'panicked',
]);
export const ACTORS = Object.freeze([
  'kael', 'abyssa', 'marietta', 'alvitr', 'lenore', 'vivienne',
  'eustice', 'elora', 'kororo', 'norma', 'tibby',
]);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const stableId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
const unique = values => new Set(values).size === values.length;
const exactKeys = (value, required, optional = []) => record(value)
  && required.every(key => Object.hasOwn(value, key))
  && Object.keys(value).every(key => [...required, ...optional].includes(key));

/** A task is the editor-approved contract, not an instruction to expand the plot. */
export function validateEditorialTask(task) {
  const issues = [];
  if (!record(task)) return ['task must be an object'];
  if (task.schemaVersion !== 1) issues.push('task.schemaVersion must be 1');
  if (!stableId(task.id)) issues.push('task.id must be a stable task identifier');
  if (!stableId(task.sceneId)) issues.push('task.sceneId must be a stable identifier');
  if (!Array.isArray(task.actors) || !task.actors.length
    || task.actors.some(actor => !record(actor) || !ACTORS.includes(actor.id) || !nonempty(actor.name))
    || !unique(task.actors.map(actor => actor?.id))) issues.push('task.actors must contain unique known actors and display names');
  const actors = new Set(Array.isArray(task.actors) ? task.actors.map(actor => actor?.id) : []);
  if (!Array.isArray(task.contextActors) || !unique(task.contextActors)
    || task.contextActors.some(id => !ACTORS.includes(id))
    || [...actors].some(id => !task.contextActors.includes(id))) issues.push('task.contextActors must include all task actors');
  if (!record(task.player) || task.player.actorId !== 'kael' || task.player.nameToken !== '{{user}}'
    || typeof task.player.authoredSpeech !== 'boolean') issues.push('task.player must preserve kael / {{user}} and explicit authoredSpeech');
  const playerActor = Array.isArray(task.actors) ? task.actors.find(actor => actor?.id === 'kael') : undefined;
  if (playerActor && playerActor.name !== '{{user}}') issues.push('task player display name must be {{user}}');
  if (!Array.isArray(task.slots) || !task.slots.length) issues.push('task.slots must be nonempty');
  else {
    if (!unique(task.slots.map(slot => slot?.id))) issues.push('task slot IDs must be unique');
    for (const [i, slot] of task.slots.entries()) {
      if (!record(slot) || !stableId(slot.id) || !actors.has(slot.actorId)) {
        issues.push(`task.slots[${i}] must bind a stable ID to a known task actor`);
        continue;
      }
      if (!Array.isArray(slot.allowedEmotions) || !slot.allowedEmotions.length
        || !unique(slot.allowedEmotions) || slot.allowedEmotions.some(id => !EMOTIONS.includes(id))) {
        issues.push(`task.slots[${i}].allowedEmotions must use the existing emotion vocabulary`);
      }
      if (slot.actorId === 'kael' && task.player?.authoredSpeech !== true) issues.push(`task.slots[${i}] grants unapproved player speech`);
    }
  }
  if (!Array.isArray(task.outline) || !task.outline.length
    || task.outline.some(scene => !record(scene) || !stableId(scene.sceneId))
    || !unique(task.outline.map(scene => scene?.sceneId))
    || !task.outline.some(scene => scene?.sceneId === task.sceneId)) issues.push('task.outline must include this scene exactly once');
  if (!Array.isArray(task.immutableBranches)) issues.push('task.immutableBranches must be explicit (empty array when none)');
  if (!record(task.state)) issues.push('task.state must declare the known scene state');
  if (!Array.isArray(task.constraints) || !task.constraints.length || task.constraints.some(v => !nonempty(v))) issues.push('task.constraints must be nonempty strings');
  if (task.revisionNotes !== undefined && (!Array.isArray(task.revisionNotes) || task.revisionNotes.some(note => !nonempty(note)))) issues.push('task.revisionNotes must be an array of nonempty strings when provided');
  if (task.humanReview?.required !== true) issues.push('task.humanReview.required must be true');
  return issues;
}

const legacyName = /凯尔|凱爾|ケイル|ケール|\bkael\b/iu;
const silence = /^[\s.…！？!?ー―—・、]+$/u;

function dialogueIssues(text) {
  if (!nonempty(text)) return ['text must be nonempty'];
  const issues = [];
  if (text.length > 4000) issues.push('line exceeds 4000 characters; allocate paging explicitly');
  if (legacyName.test(text)) issues.push('legacy player name is forbidden; use {{user}} when naming the player');
  const withoutPlayer = text.replaceAll('{{user}}', '');
  if (/[{}<>]/u.test(withoutPlayer)) issues.push('only the exact {{user}} token is allowed; no markup or other template tokens');
  // This checks the envelope/scripts, not translation accuracy or Japanese fluency.
  const match = /^「([^\r\n]+)（([^\r\n（）]+)）」$/u.exec(text);
  if (!match || /[「」]/u.test(match[1]) || /[「」]/u.test(match[2])) {
    issues.push('text must use 「日本語原文（中文翻译）」 on one line');
  } else {
    const [, japanese, chinese] = match;
    if (!japanese.trim() || !chinese.trim()) issues.push('both language segments must be nonempty');
    if (!/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(japanese) && !silence.test(japanese)) issues.push('Japanese segment is missing');
    if (!/\p{Script=Han}/u.test(chinese) && !silence.test(chinese)) issues.push('Chinese translation is missing');
    if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(chinese)) issues.push('Chinese translation still contains Japanese kana');
  }
  return issues;
}

function reviewIssues(review, task, draft) {
  const issues = [];
  if (!review.startsWith('【角色演出】')) issues.push('review must start with 【角色演出】');
  const headings = ['[拟态废案]', '[本音矫正]', '[定稿录入]'];
  const sections = [...review.matchAll(/\[角色:([A-Za-z0-9._-]+)\]([\s\S]*?)\[\/角色\]/g)];
  const speakers = [...new Set(task.slots.map(slot => slot.actorId))];
  const ids = sections.map(match => match[1]);
  if (!unique(ids) || ids.length !== speakers.length || speakers.some(id => !ids.includes(id))) issues.push('review must cover every speaking actor exactly once, with no extra actors');
  for (const [, id, body] of sections) {
    let previous = -1;
    for (const heading of headings) {
      const index = body.indexOf(heading);
      if (index <= previous) issues.push(`review ${id} must contain the three editorial headings in order`);
      previous = index;
    }
    if (!/REQUIRE\s*[：:]/u.test(body) || !/FORBIDDEN\s*[：:]/u.test(body)) issues.push(`review ${id} needs REQUIRE / FORBIDDEN correction summaries`);
    const revision = body.split('[定稿录入]')[1];
    const actorLines = Array.isArray(draft?.lines) ? draft.lines.filter(line => line?.actorId === id) : [];
    if (!revision || !actorLines.some(line => nonempty(line.text) && revision.includes(line.text))) issues.push(`review ${id} final example must match a draft line`);
  }
  if (!review.includes('D.【语言协议锁】')
    || !review.includes('日本語原文（中文翻译）')
    || !review.includes('保留日文原文的语癖、片假名习惯与口语缩略')) issues.push('review must restate both language protocol requirements');
  return issues;
}

/** ok means structural acceptance only. Every result still requires human review. */
export function validateEditorial(text, task) {
  const issues = validateEditorialTask(task);
  if (issues.length) return {ok: false, issues};
  if (typeof text !== 'string' || text.length > 200000) return {ok: false, issues: ['output must be text no longer than 200000 characters']};
  const envelope = /^\s*<planning>([\s\S]*?)<\/planning>\s*(\{[\s\S]*\})\s*$/u.exec(text);
  if (!envelope || /<\/?planning>/u.test(envelope[1]) || /<\/?planning>/u.test(envelope[2])) {
    return {ok: false, issues: ['output must contain one <planning> review followed by one JSON object, without fences or extra prose']};
  }
  const review = envelope[1].trim();
  let draft;
  try { draft = JSON.parse(envelope[2]); }
  catch { return {ok: false, issues: ['draft is not valid JSON'], review}; }
  if (!exactKeys(draft, ['schemaVersion', 'sceneId', 'lines'])) issues.push('draft allows only schemaVersion, sceneId, lines');
  if (draft?.schemaVersion !== 1) issues.push('draft.schemaVersion must be 1');
  if (draft?.sceneId !== task.sceneId) issues.push('draft.sceneId differs from the assigned scene');
  if (!Array.isArray(draft?.lines)) issues.push('draft.lines must be an array');
  else {
    if (draft.lines.length !== task.slots.length) issues.push('draft must contain exactly the assigned slots');
    if (!unique(draft.lines.map(line => line?.id))) issues.push('duplicate line IDs');
    draft.lines.forEach((line, index) => {
      const slot = task.slots[index];
      if (!exactKeys(line, ['id', 'actorId', 'text'], ['emotion'])) {
        issues.push(`lines[${index}] allows only id, actorId, text, emotion (no facts, choices, state, or actions)`);
        if (!record(line)) return;
      }
      if (!slot || line.id !== slot.id) issues.push(`lines[${index}] must match its assigned slot and order`);
      if (!slot || line.actorId !== slot.actorId) issues.push(`lines[${index}] changes the assigned actor`);
      if (!task.actors.some(actor => actor.id === line.actorId)) issues.push(`lines[${index}] has an unknown actor`);
      if (line.actorId === 'kael' && !task.player.authoredSpeech) issues.push(`lines[${index}] inserts unapproved player speech`);
      if (Object.hasOwn(line, 'emotion') && !slot?.allowedEmotions.includes(line.emotion)) issues.push(`lines[${index}] has an unapproved emotion`);
      for (const issue of dialogueIssues(line.text)) issues.push(`lines[${index}]: ${issue}`);
    });
  }
  issues.push(...reviewIssues(review, task, draft));
  return {ok: issues.length === 0, issues, draft, review};
}
