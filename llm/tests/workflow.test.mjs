import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {saveRun,inspectReview} from '../src/storage.mjs';
import {llmRoot,loadConfig,loadSecrets} from '../src/config.mjs';
import {assembleContext} from '../src/context.mjs';
import {validateEditorial} from '../src/editorial.mjs';

async function temporary(t){const path=await mkdtemp(join(tmpdir(),'abyssa-llm-'));t.after(()=>rm(path,{recursive:true,force:true}));return path;}
function candidate(task){
 const text='「……行くよ。（……走了。）」';
 return `<planning>\n【角色演出】\n[角色:norma]\n[拟态废案]「移動を開始します。（开始移动程序。）」\n[本音矫正] REQUIRE：短促自然。FORBIDDEN：程序播报。\n[定稿录入]${text}\n[/角色]\nD.【语言协议锁】\n日本語原文（中文翻译）\n保留日文原文的语癖、片假名习惯与口语缩略\n</planning>\n${JSON.stringify({schemaVersion:1,sceneId:task.sceneId,lines:[{id:'S3-1',actorId:'norma',text,emotion:'serious'}]})}`;
}
test('a candidate remains pending, continuation is explicit, and review binds exact response',async t=>{
 const root=await temporary(t),context=await assembleContext();const result={text:candidate(context.task),complete:true};
 const validation=validateEditorial(result.text,context.task);assert.equal(validation.ok,true);
 const directory=await saveRun({request:{messages:context.messages},context,result,validation,profileName:'mock'},root);
 assert.equal((await inspectReview(directory)).approved,false);
 const next=JSON.parse(await readFile(join(directory,'next-session.json'),'utf8'));assert.equal(next.messages.length,2);assert.equal(next.taskId,context.task.id);
 const again=await assembleContext({sessionPath:join(directory,'next-session.json')});assert.equal(again.manifest.history.retainedExchanges,1);
 const reviewPath=join(directory,'review.json'),review=JSON.parse(await readFile(reviewPath,'utf8'));
 review.status='approved';for(const k of Object.keys(review.checks))review.checks[k]=true;review.notes='Automated fixture only; this is not approved prose.';
 await writeFile(reviewPath,JSON.stringify(review));assert.equal((await inspectReview(directory)).approved,true);
 await writeFile(join(directory,'response.json'),JSON.stringify({...result,text:result.text+'changed'}));assert.equal((await inspectReview(directory)).approved,false);
 assert.equal((await stat(join(directory,'request.json'))).mode & 0o077,0);
});
test('incomplete/invalid output stays diagnostic and never creates continuation',async t=>{
 const root=await temporary(t),context=await assembleContext();
 for(const complete of [false,true]){
  const directory=await saveRun({request:{messages:context.messages},context,result:{text:'broken',complete},validation:{ok:false,issues:['bad']},profileName:'mock'},root);
  await assert.rejects(readFile(join(directory,'next-session.json')),{code:'ENOENT'});assert.equal((await inspectReview(directory)).approved,false);
 }
});
test('config and secrets are separate JSON files with strict fields',async t=>{
 const root=await temporary(t),cp=join(root,'config.json'),sp=join(root,'secrets.json');
 const config={schemaVersion:1,defaultProfile:'x',profiles:{x:{format:'google',baseUrl:'',model:'',secretKey:'x'}}};
 await writeFile(cp,JSON.stringify(config));assert.equal((await loadConfig(cp)).defaultProfile,'x');
 assert.deepEqual((await loadSecrets(sp)).keys,{});
 await writeFile(sp,JSON.stringify({schemaVersion:1,keys:{x:'private'},serverToken:''}));assert.equal((await loadSecrets(sp)).keys.x,'private');
 config.profiles.x.apiKey='no-inline-key';await writeFile(cp,JSON.stringify(config));await assert.rejects(loadConfig(cp),{code:'CONFIG'});
});
test('CLI assembles the real task, invokes a local Google mock and saves a reviewable candidate',async t=>{
 const root=await temporary(t),context=await assembleContext();let incoming;
 const server=createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;incoming={headers:req.headers,body:JSON.parse(raw),url:req.url};res.end(JSON.stringify({candidates:[{content:{parts:[{text:candidate(context.task)}]},finishReason:'STOP'}]}));});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));t.after(()=>{server.closeAllConnections();server.close();});
 const cp=join(root,'config.json'),sp=join(root,'keys.json');
 await writeFile(cp,JSON.stringify({schemaVersion:1,defaultProfile:'mock',profiles:{mock:{format:'google',baseUrl:`http://127.0.0.1:${server.address().port}/v1beta`,model:'test',secretKey:'mock'}}}));
 await writeFile(sp,JSON.stringify({schemaVersion:1,keys:{mock:'fixture-secret'}}));
 const out=await new Promise((ok,fail)=>{const p=spawn(process.execPath,[resolve(llmRoot,'src/cli.mjs'),'generate','--config',cp,'--secrets',sp],{cwd:root});let stdout='',stderr='';p.stdout.on('data',c=>stdout+=c);p.stderr.on('data',c=>stderr+=c);p.on('error',fail);p.on('close',code=>ok({code,stdout,stderr}));});
 assert.equal(out.code,0,out.stderr);const report=JSON.parse(out.stdout);t.after(()=>rm(report.directory,{recursive:true,force:true}));
 assert.equal(report.review,'pending');assert.equal(report.validation.ok,true);assert.equal(out.stdout.includes('fixture-secret'),false);
 assert.equal(incoming.url,'/v1beta/models/test:generateContent');assert.equal(incoming.headers['x-goog-api-key'],'fixture-secret');
 assert.match(incoming.body.systemInstruction.parts[0].text,/REFERENCE_SOURCES/);assert.match(incoming.body.contents.at(-1).parts[0].text,/CURRENT_TASK/);
 assert.equal((await inspectReview(report.directory)).approved,false);
});
