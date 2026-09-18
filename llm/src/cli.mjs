import {parseArgs} from 'node:util';
import {copyFile,mkdir,chmod} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve} from 'node:path';
import {llmRoot,defaultConfigPath,defaultSecretsPath,loadConfig,loadSecrets,selectProfile,resolveKey,readJson} from './config.mjs';
import {generate} from './client.mjs';
import {assembleContext} from './context.mjs';
import {validateEditorial} from './editorial.mjs';
import {createLlmServer} from './server.mjs';
import {localRoot,writePrivateJson,saveRun,inspectReview} from './storage.mjs';
import {publicError,requireValue} from './errors.mjs';

const help = `ABYSSA LLM (server-only, text API v1)
  node llm/src/cli.mjs init                         create local config and empty key files
  node llm/src/cli.mjs check [--profile gemini]     validate selected profile/key (no request)
  node llm/src/cli.mjs context [--task PATH]        assemble setting + outline (no key/network)
  node llm/src/cli.mjs generate [--task PATH]       generate an O1-W candidate for review
  node llm/src/cli.mjs generate --input PATH       call with {messages:[{role,content}]}
  node llm/src/cli.mjs review --run PATH           check manually filled review.json
  node llm/src/cli.mjs serve                       authenticated loopback HTTP service
Options: --config PATH --secrets PATH --profile NAME --manifest PATH --session PATH
Defaults: llm/context/o1-w.json and llm/context/tasks/S3-1.json.
Explicit paths resolve from the current directory. No source scripts or gameplay files are rewritten.`;

async function main() {
  const {positionals,values:v} = parseArgs({allowPositionals:true,options:{help:{type:'boolean'},config:{type:'string'},secrets:{type:'string'},profile:{type:'string'},manifest:{type:'string'},task:{type:'string'},session:{type:'string'},input:{type:'string'},run:{type:'string'}}});
  const command = positionals[0];
  if (v.help || !command) {console.log(help); return;}
  requireValue(positionals.length === 1,'Expected exactly one command.','CLI');
  if (command === 'init') {
    for (const [source,destination] of [['config/providers.example.json','config/providers.local.json'],['secrets/keys.example.json','secrets/keys.local.json']]) {
      const dest = resolve(llmRoot,destination);
      try {await copyFile(resolve(llmRoot,source),dest,constants.COPYFILE_EXCL); await chmod(dest,0o600);}
      catch (e) {if (e.code !== 'EEXIST') throw e;}
    }
    console.log('Local configuration and empty key files are ready. Existing files were preserved.'); return;
  }
  if (command === 'review') {
    requireValue(v.run,'Use --run with a generated candidate directory.','CLI');
    const result = await inspectReview(resolve(v.run)); console.log(JSON.stringify(result,null,2));
    if (!result.approved) process.exitCode = 2;
    return;
  }
  requireValue(['context','check','generate','serve'].includes(command),'Unknown command. Use --help.','CLI');
  const contextOptions = () => ({manifestPath:resolve(v.manifest ?? resolve(llmRoot,'context/o1-w.json')),taskPath:resolve(v.task ?? resolve(llmRoot,'context/tasks/S3-1.json')),sessionPath:v.session ? resolve(v.session) : undefined});
  let context;
  if (command === 'context') {
    context = await assembleContext(contextOptions());
  }
  if (command === 'context') {
    const root = resolve(localRoot,'contexts'); await mkdir(root,{recursive:true,mode:0o700});
    const path = resolve(root,`${Date.now()}-context.json`); await writePrivateJson(path,context);
    console.log(JSON.stringify({path,messageCount:context.messages.length,inputChars:context.messages.reduce((n,m)=>n+m.content.length,0)},null,2)); return;
  }
  const config = await loadConfig(v.config ? resolve(v.config) : defaultConfigPath);
  const secrets = await loadSecrets(v.secrets ? resolve(v.secrets) : defaultSecretsPath);
  if (command === 'serve') {
    const server = createLlmServer({config,secrets});
    const port = config.server?.port ?? 8788;
    await new Promise((ok,fail) => {server.once('error',fail); server.listen(port,'127.0.0.1',ok);});
    console.log(`LLM backend listening at http://127.0.0.1:${port} (authentication required).`);
    const stop = () => {server.close(); server.closeAllConnections();};
    process.once('SIGINT',stop); process.once('SIGTERM',stop); return;
  }
  const profileName = v.profile ?? config.defaultProfile, profile = selectProfile(config,profileName), apiKey = resolveKey(profile,secrets);
  if (command === 'check') {console.log(JSON.stringify({profile:profileName,format:profile.format,configured:true,keyConfigured:profile.auth !== 'none'},null,2)); return;}
  requireValue(!(v.input && (v.task || v.session || v.manifest)),'Use either a raw --input or an assembled task.','CLI');
  if (!v.input) context = await assembleContext({...contextOptions(),maxInputChars:profile.maxInputChars});
  const request = v.input ? await readJson(resolve(v.input)) : {messages:context.messages};
  const abort = new AbortController(), cancel = () => abort.abort(); process.once('SIGINT',cancel);
  let result;
  try {result = await generate({profile,apiKey,request,signal:abort.signal});}
  finally {process.off('SIGINT',cancel);}
  const validation = context ? validateEditorial(result.text,context.task) : undefined;
  if (validation && !result.complete) {validation.ok = false; validation.issues.push('Provider output is incomplete.');}
  const directory = await saveRun({request,context,result,validation,profileName});
  console.log(JSON.stringify({directory,complete:result.complete,validation:validation ? {ok:validation.ok,issues:validation.issues} : null,review:'pending',usage:result.usage},null,2));
  if (!result.complete || validation && !validation.ok) process.exitCode = 2;
}
main().catch(error => {console.error(JSON.stringify({error:publicError(error)})); process.exitCode = 1;});
