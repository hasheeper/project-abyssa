// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { expect, it } from 'vitest';
const workerSource=readFileSync(new URL('./cache-worker.js',import.meta.url),'utf8');
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
type Asset={url:string;bytes:number;revision:string};
function worker(assets:Asset[],network:(url:string)=>Promise<Response>,saved=new Map<string,Response>()) {
  const handlers=new Map<string,(event:any)=>void>();
  const cache={match:async(key:string)=>saved.get(key)?.clone(),put:async(key:string,value:Response)=>{saved.set(key,value);},keys:async()=>[...saved.keys()].map(url=>({url})),delete:async(key:string)=>saved.delete(key)};
  vm.runInNewContext('const GAME_ASSETS='+JSON.stringify({version:'test',assets})+';\n'+workerSource,{
    URL,Response,Uint8Array,AbortController,setTimeout,clearTimeout,crypto:webcrypto,
    fetch:(url:URL)=>network(url.href),caches:{open:async()=>cache},
    self:{location:{href:'https://example.test/abyssa/game-cache.js'},addEventListener:(type:string,handler:(event:any)=>void)=>handlers.set(type,handler),skipWaiting:async()=>{},clients:{claim:async()=>{},matchAll:async()=>[]}},
  });
  return {
    saved,
    prepare:async(version='test')=>{const messages:any[]=[];let task:Promise<void>|undefined;handlers.get('message')!({data:{type:'prepare',version},ports:[{postMessage:(m:any)=>messages.push(m),close:()=>{}}],waitUntil:(p:Promise<void>)=>{task=p;}});await task;return messages;},
    request:async(path:string,method='GET',mode='cors')=>{let reply:Promise<Response>|undefined;handlers.get('fetch')!({request:{url:'https://example.test/abyssa/'+path,method,mode},respondWith:(p:Promise<Response>)=>{reply=p;}});return reply;},
  };
}
const asset=(name:string,body=name)=>({url:'./'+name,bytes:body.length,revision:hash(body)});
it('can revisit the deployment directory itself while offline',async()=>{
  let online=true;
  const runtime=worker([asset('index.html','<main>title</main>')],async()=>{if(!online)throw new Error('offline');return new Response('<main>title</main>');});
  await runtime.prepare();online=false;
  expect(await(await runtime.request('','GET','navigate'))!.text()).toBe('<main>title</main>');
});
it('deduplicates concurrent preparation and runtime requests, then serves a new page from disk',async()=>{
  let count=0;let release!:()=>void;
  const wait=new Promise<void>(resolve=>{release=resolve;});
  const runtime=worker([asset('a.webp')],async()=>{count++;await wait;return new Response('a.webp');});
  const loading=runtime.prepare(),request=runtime.request('a.webp');
  await new Promise(resolve=>setTimeout(resolve,0));expect(count).toBe(1);release();
  expect((await loading).at(-1)).toEqual({type:'ready'});expect(await(await request)!.text()).toBe('a.webp');
  const next=worker([asset('a.webp')],async()=>{throw new Error('Must not fetch again');},runtime.saved);
  expect((await next.prepare()).at(-1)).toEqual({type:'ready'});
  expect(await(await next.request('a.webp'))!.text()).toBe('a.webp');
  expect(await next.request('api/game')).toBeUndefined();
  expect(await next.request('a.webp','POST')).toBeUndefined();
});
it('rejects HTML fallbacks and retains successful files for an incomplete-load retry',async()=>{
  let failing=true;const requests:string[]=[];
  const runtime=worker([asset('ok.png'),asset('missing.png')],async url=>{
    requests.push(url);return new Response(failing&&url.endsWith('missing.png')?'<html>404 fallback</html>':url.split('/').at(-1));
  });
  expect((await runtime.prepare()).at(-1)?.type).toBe('error');failing=false;
  expect((await runtime.prepare()).at(-1)).toEqual({type:'ready'});
  expect(requests.filter(url=>url.endsWith('ok.png'))).toHaveLength(1);
  expect(requests.filter(url=>url.endsWith('missing.png'))).toHaveLength(3);
});
it('reuses unchanged content across revisions and rejects a mismatched worker',async()=>{
  const old=worker([asset('old.png','same')],async()=>new Response('same'));await old.prepare();
  let requests=0;
  const next=worker([asset('renamed.png','same'),asset('changed.png','new')],async()=>{requests++;return new Response('new');},old.saved);
  expect((await next.prepare()).at(-1)?.type).toBe('ready');expect(requests).toBe(1);
  expect((await next.prepare('obsolete'))[0]).toEqual({type:'error',message:'version-mismatch'});
});
it('bounds network concurrency while preparing the complete manifest',async()=>{
  let active=0,peak=0;
  const assets=Array.from({length:15},(_,i)=>asset(`${i}.png`));
  const runtime=worker(assets,async url=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,2));active--;return new Response(url.split('/').at(-1));});
  const messages=await runtime.prepare();expect(peak).toBeLessThanOrEqual(6);
  expect(messages.at(-2)).toMatchObject({completed:15,loadedBytes:assets.reduce((sum,a)=>sum+a.bytes,0)});
});
