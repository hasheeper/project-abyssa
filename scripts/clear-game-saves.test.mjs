import test from 'node:test';
import assert from 'node:assert/strict';
import {clearSaveHints,deleteGameDatabase,deleteSaveSlotDatabase,GAME_DATABASE,SAVE_SLOT_DATABASE} from './clear-game-saves.mjs';

const storage=entries=>{
  const data=new Map(entries);
  return {data,get length(){return data.size;},key:index=>[...data.keys()][index],removeItem:key=>data.delete(key)};
};
test('clears only exact game-save hints, preserving preferences and unrelated sessions',()=>{
  const local=storage([['abyssa:recent-save:v1','save'],['abyssa:archived-saves:v1','old'],['abyssa:scene-reading:v1:old','cursor'],['abyssa.ai-connection.v1','keep'],['abyssa:ui-motion:v1','reduced'],['audio-volume','0.5']]);
  const session=storage([['abyssa:new-save:opening-v1','pending'],['abyssa:import-save:v1:signature','x'],['abyssa:continue:guided:x:1','x'],['abyssa:pending:v4:old:epoch','x'],['abyssa:departure-loadout:v1:old','x'],['other-app','keep']]);
  clearSaveHints(local,session);
  assert.deepEqual([...local.data.keys()],['abyssa.ai-connection.v1','abyssa:ui-motion:v1','audio-volume']);
  assert.deepEqual([...session.data.keys()],['other-app']);
});
test('waits for deletion of the exact game database, including blocked requests',async()=>{
  const request={};let blocked=0;
  const promise=deleteGameDatabase({deleteDatabase:name=>{assert.equal(name,GAME_DATABASE);return request;}},()=>blocked++);
  request.onblocked();assert.equal(blocked,1);
  let done=false;promise.then(()=>{done=true;});await Promise.resolve();assert.equal(done,false);
  request.onsuccess();await promise;assert.equal(done,true);
});
test('reports deletion errors instead of claiming success',async()=>{
  const request={error:Error('storage unavailable')};
  const promise=deleteGameDatabase({deleteDatabase:()=>request},()=>{});
  request.onerror();await assert.rejects(promise,/storage unavailable/);
});
test('slot cleanup targets only the dedicated metadata database',async()=>{
  const request={};
  const promise=deleteSaveSlotDatabase({deleteDatabase:name=>{assert.equal(name,SAVE_SLOT_DATABASE);return request;}},()=>{});
  request.onsuccess();await promise;
});
