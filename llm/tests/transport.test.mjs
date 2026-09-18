import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {generate} from '../src/client.mjs';
import {encodeRequest,decodeResponse} from '../src/adapters.mjs';
import {validateProfile,resolveKey} from '../src/config.mjs';
import {publicError} from '../src/errors.mjs';
const request={messages:[{role:'system',content:'Setting'},{role:'user',content:'First scene'},{role:'assistant',content:'Previous draft'},{role:'user',content:'Revise'}]};
export const fixtures={
 oai:{id:'chat-1',choices:[{message:{content:'draft'},finish_reason:'stop'}],usage:{prompt_tokens:20,completion_tokens:10,total_tokens:30}},
 'oai-res':{id:'resp-1',status:'completed',output:[{type:'reasoning',summary:[]},{type:'message',content:[{type:'output_text',text:'draft'}]}],usage:{input_tokens:20,output_tokens:10,total_tokens:30}},
 anthropic:{id:'msg-1',content:[{type:'thinking',thinking:'private'},{type:'text',text:'draft'}],stop_reason:'end_turn',usage:{input_tokens:20,output_tokens:10}},
 google:{responseId:'gem-1',candidates:[{content:{parts:[{thought:true,text:'private'},{text:'draft'}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:20,candidatesTokenCount:10,totalTokenCount:30}}
};
async function mock(t,handler){
 const requests=[];const server=createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;requests.push({url:req.url,headers:req.headers,body:body?JSON.parse(body):undefined});handler(req,res,requests.length);});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));t.after(()=>{server.closeAllConnections();server.close();});
 return{baseUrl:`http://127.0.0.1:${server.address().port}/proxy/v1`,requests};
}
const profile=(baseUrl,format='oai',extra={})=>validateProfile({baseUrl,format,model:'test-model',maxOutputTokens:4096,maxRetries:0,timeoutMs:2000,...extra});
for(const format of Object.keys(fixtures))test(`HTTP protocol and normalization: ${format}`,async t=>{
 const m=await mock(t,(_q,r)=>r.end(JSON.stringify(fixtures[format])));
 const result=await generate({profile:profile(m.baseUrl,format),apiKey:'private-key',request});
 assert.equal(result.text,'draft');assert.equal(result.complete,true);assert.equal(result.usage.totalTokens,30);assert.equal(JSON.stringify(result).includes('private'),false);
 const{url,headers,body}=m.requests[0];assert.equal(m.requests.length,1);assert.equal(url.includes('private-key'),false);
 if(format==='oai'){assert.equal(url,'/proxy/v1/chat/completions');assert.equal(headers.authorization,'Bearer private-key');assert.equal(body.max_completion_tokens,4096);assert.deepEqual(body.messages,request.messages);}
 if(format==='oai-res'){assert.equal(url,'/proxy/v1/responses');assert.equal(body.store,false);assert.equal(body.instructions,'Setting');assert.deepEqual(body.input[1],{role:'assistant',content:'Previous draft'});assert.equal(body.max_output_tokens,4096);}
 if(format==='anthropic'){assert.equal(url,'/proxy/v1/messages');assert.equal(headers['x-api-key'],'private-key');assert.equal(headers['anthropic-version'],'2023-06-01');assert.equal(body.system,'Setting');assert.equal(body.max_tokens,4096);}
 if(format==='google'){assert.equal(url,'/proxy/v1/models/test-model:generateContent');assert.equal(headers['x-goog-api-key'],'private-key');assert.equal(body.contents[1].role,'model');assert.equal(body.systemInstruction.parts[0].text,'Setting');assert.equal(body.generationConfig.maxOutputTokens,4096);}
});
test('proxy paths, bearer auth override and chat token compatibility',()=>{
 const p=profile('https://proxy.example/api/v1/','oai',{outputTokenField:'max_tokens'});const w=encodeRequest(p,'key',request);
 assert.equal(w.url,'https://proxy.example/api/v1/chat/completions');assert.equal(w.body.max_tokens,4096);
 assert.equal(encodeRequest(profile('https://proxy.example/v1beta','google',{auth:'bearer'}),'key',request).headers.authorization,'Bearer key');
 assert.throws(()=>encodeRequest(profile('https://proxy.example/v1','oai-res'),'key',{...request,stop:['END']}),{code:'REQUEST'});
});
test('input budgets and invalid requests fail before fetch',async()=>{
 let calls=0;const run=r=>generate({profile:profile('https://proxy.example/v1'),apiKey:'key',request:r,fetchImpl:async()=>{calls++;}});
 await assert.rejects(run({messages:[{role:'user',content:'x'.repeat(120001)}]}),{code:'CONTEXT_BUDGET'});
 await assert.rejects(run({...request,maxOutputTokens:8192}),{code:'REQUEST'});
 await assert.rejects(run({messages:[{role:'user',content:'x'},{role:'system',content:'late'}]}),{code:'REQUEST'});assert.equal(calls,0);
});
test('429 retries within budget and honors Retry-After',async t=>{
 const m=await mock(t,(_q,r,n)=>{if(n===1){r.writeHead(429,{'retry-after':'0'});r.end('secret');}else r.end(JSON.stringify(fixtures.oai));});
 const r=await generate({profile:profile(m.baseUrl,'oai',{maxRetries:1}),apiKey:'key',request});assert.equal(r.attempts,2);
});
test('401 is never retried or printed with the upstream body',async t=>{
 const m=await mock(t,(_q,r)=>{r.writeHead(401);r.end('LEAK-ME');});
 try{await generate({profile:profile(m.baseUrl,'oai',{maxRetries:3}),apiKey:'LEAK-ME',request});assert.fail();}catch(e){assert.equal(e.code,'HTTP');assert.equal(e.details.status,401);assert.equal(JSON.stringify(publicError(e)).includes('LEAK-ME'),false);}
 assert.equal(m.requests.length,1);
});
test('redirects do not forward credentials',async t=>{
 const m=await mock(t,(_q,r)=>{r.writeHead(302,{location:'/other'});r.end();});
 await assert.rejects(generate({profile:profile(m.baseUrl,'oai',{maxRetries:2}),apiKey:'key',request}),{code:'NETWORK'});assert.equal(m.requests.length,1);
});
test('timeout covers response reading; no retry on uncertain transport failure',async t=>{
 const m=await mock(t,(_q,r)=>{r.writeHead(200,{'content-type':'application/json'});r.write('{');});
 await assert.rejects(generate({profile:profile(m.baseUrl,'oai',{timeoutMs:100,maxRetries:2}),apiKey:'key',request}),{code:'TIMEOUT'});assert.equal(m.requests.length,1);
});
test('cancellation before dispatch sends nothing',async()=>{
 const abort=new AbortController();abort.abort();let calls=0;
 await assert.rejects(generate({profile:profile('https://proxy.example/v1'),apiKey:'key',request,signal:abort.signal,fetchImpl:async()=>{calls++;}}),{code:'CANCELLED'});assert.equal(calls,0);
});
test('truncation is incomplete; refusal, tools and empty output fail',()=>{
 const c=structuredClone(fixtures.oai);c.choices[0].finish_reason='length';assert.equal(decodeResponse('oai',c).complete,false);
 const r={...fixtures['oai-res'],status:'incomplete',incomplete_details:{reason:'max_output_tokens'}};assert.equal(decodeResponse('oai-res',r).complete,false);
 assert.throws(()=>decodeResponse('google',{promptFeedback:{blockReason:'SAFETY'}}),{code:'REFUSED'});
 assert.throws(()=>decodeResponse('anthropic',{content:[{type:'tool_use'}]}),{code:'PROTOCOL'});
 assert.throws(()=>decodeResponse('oai',{choices:[]}),{code:'EMPTY_OUTPUT'});
 assert.deepEqual(decodeResponse('oai',{...fixtures.oai,usage:undefined}).usage,{inputTokens:null,outputTokens:null,totalTokens:null});
});
test('oversized and HTML responses fail clearly',async t=>{
 const m=await mock(t,(_q,r)=>r.end('x'.repeat(2*1024*1024+1)));
 await assert.rejects(generate({profile:profile(m.baseUrl),apiKey:'key',request}),{code:'RESPONSE_SIZE'});
 const h=await mock(t,(_q,r)=>r.end('<html>gateway</html>'));await assert.rejects(generate({profile:profile(h.baseUrl),apiKey:'key',request}),{code:'PROTOCOL'});
});
test('keys stay separate, environment wins and credential URLs are forbidden',()=>{
 const p=profile('https://proxy.example/v1','oai',{secretKey:'writer',apiKeyEnv:'WRITER_KEY'});
 assert.equal(resolveKey(p,{keys:{writer:'file'}},{WRITER_KEY:'env'}),'env');assert.equal(resolveKey(p,{keys:{writer:'file'}},{}),'file');
 assert.throws(()=>resolveKey(p,{keys:{}},{}),{code:'AUTH_CONFIG'});
 for(const baseUrl of ['https://key:secret@proxy.example/v1','https://proxy.example/v1?key=secret','http://remote.example/v1','https://proxy.example/v1/responses'])assert.throws(()=>profile(baseUrl),{code:'CONFIG'});
 assert.throws(()=>validateProfile({...p,apiKey:'inline'}),{code:'CONFIG'});
});
test('malformed vendor arrays yield protocol errors, never TypeError or leaked input',()=>{
 for(const format of Object.keys(fixtures)){
  const malformed={output:[null,{type:'message',content:[null]}],content:[null],candidates:[{content:{parts:[null]}}],choices:[null]};
  assert.throws(()=>decodeResponse(format,malformed),e=>['PROTOCOL','EMPTY_OUTPUT'].includes(e.code));
 }
 assert.equal(publicError({code:404,message:'secret'}).code,'INTERNAL');
});
