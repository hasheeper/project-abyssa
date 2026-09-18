import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {llmRoot} from './config.mjs';
import {requireValue} from './errors.mjs';

export const localRoot = resolve(llmRoot,'.local');
export async function writePrivateJson(path,value) {
  await writeFile(path, JSON.stringify(value,null,2)+'\n', {mode:0o600,flag:'wx'});
}
export async function saveRun({request,context,result,validation,profileName}, root = resolve(localRoot,'runs')) {
  await mkdir(root,{recursive:true,mode:0o700});
  const id = new Date().toISOString().replaceAll(':','-')+'-'+randomUUID().slice(0,8);
  const directory = resolve(root,id);
  await mkdir(directory,{mode:0o700});
  // Never persist transport headers, credentials, raw reasoning blocks or provider configuration.
  await writePrivateJson(resolve(directory,'request.json'),{schemaVersion:1,profile:profileName,request});
  if (context) {
    await writePrivateJson(resolve(directory,'context.json'),context.manifest);
    await writePrivateJson(resolve(directory,'task.json'),context.task);
  }
  await writePrivateJson(resolve(directory,'response.json'),{schemaVersion:1,...result});
  await writePrivateJson(resolve(directory,'validation.json'),validation ?? {ok:result.complete,issues:result.complete ? [] : ['Provider output is incomplete.']});
  if (context?.session && result.complete && validation?.ok) {
    await writePrivateJson(resolve(directory,'next-session.json'),{
      ...context.session,
      messages:[...context.session.messages, context.messages.at(-1), {role:'assistant',content:result.text}],
    });
  }
  const digest = createHash('sha256').update(result.text).digest('hex');
  await writePrivateJson(resolve(directory,'review.json'),{schemaVersion:1,status:'pending',responseSha256:digest,checks:{characterVoice:false,naturalDialogue:false,japaneseChinese:false,visualNovelPacing:false,continuity:false,playerAgency:false},notes:''});
  return directory;
}
export async function inspectReview(directory) {
  const parse = async file => JSON.parse(await readFile(resolve(directory,file),'utf8'));
  const [review,result,validation] = await Promise.all(['review.json','response.json','validation.json'].map(parse));
  const digest = createHash('sha256').update(result.text).digest('hex');
  const checks = ['characterVoice','naturalDialogue','japaneseChinese','visualNovelPacing','continuity','playerAgency'];
  const issues = [];
  if (review.responseSha256 !== digest) issues.push('Review belongs to a different response revision.');
  if (!result.complete || !validation.ok) issues.push('Output is incomplete or structural validation failed.');
  try {
    const task = await parse('task.json');
    const {validateEditorial} = await import('./editorial.mjs');
    if (!validateEditorial(result.text,task).ok) issues.push('Current response does not pass the saved task contract.');
  } catch (error) {
    if (error.code !== 'ENOENT') issues.push('Unable to revalidate the saved task.');
  }
  if (review.status !== 'approved' || !checks.every(c => review.checks?.[c] === true)) issues.push('Human review and all six checks are required.');
  if (review.status === 'approved' && !(typeof review.notes === 'string' && review.notes.trim())) issues.push('Record concrete review notes.');
  requireValue(review.schemaVersion === 1,'Unsupported review version.','REVIEW');
  return {approved:issues.length === 0,issues};
}
