import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLlmServer} from '../src/server.mjs';
const token='local-test-token-0123456789',config={defaultProfile:'writer',profiles:{writer:{format:'google',baseUrl:'https://proxy.example/v1beta',model:'test',secretKey:'writer'}},server:{allowedOrigins:['http://127.0.0.1:5176']}},secrets={keys:{writer:'upstream-secret'},serverToken:token};
async function start(t,generateImpl){
 const server=createLlmServer({config,secrets,env:{},generateImpl});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));t.after(()=>{server.closeAllConnections();server.close();});
 return(body,headers={})=>fetch(`http://127.0.0.1:${server.address().port}/v1/generate`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`,...headers},body:JSON.stringify(body)});
}
test('authenticated request works; callers cannot override endpoint or keys',async t=>{
 let calls=0;const post=await start(t,async args=>{calls++;assert.equal(args.apiKey,'upstream-secret');assert.equal(args.request.messages[0].content,'hello');return{text:'reply',complete:true};});
 const good=await post({request:{messages:[{role:'user',content:'hello'}]}});assert.equal(good.status,200);assert.equal((await good.json()).result.text,'reply');
 assert.equal((await post({request:{},baseUrl:'http://attacker'})).status,400);
 assert.equal((await post({request:{}},{authorization:'Bearer wrong'})).status,401);
 assert.equal((await post({request:{}},{origin:'https://attacker.example'})).status,403);assert.equal(calls,1);
});
test('allowlisted browser origin and safe errors',async t=>{
 const post=await start(t,async()=>{throw Error('upstream-secret');});const r=await post({request:{}},{origin:'http://127.0.0.1:5176'});
 assert.equal(r.headers.get('access-control-allow-origin'),'http://127.0.0.1:5176');assert.equal((await r.text()).includes('upstream-secret'),false);
});
test('server requires an independent token',()=>assert.throws(()=>createLlmServer({config,secrets:{keys:{}},env:{}}),{code:'AUTH_CONFIG'}));
