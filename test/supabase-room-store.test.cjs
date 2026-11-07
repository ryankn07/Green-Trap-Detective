'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SupabaseRoomStore } = require('../server/supabase-room-store.cjs');
test('trial RPCs use server-only auth, typed rate errors and a shared invocation deadline', async () => {
  const calls = [];
  const store = new SupabaseRoomStore({ url: 'https://database.invalid', key: 'test-key-not-a-secret', budgetMs: 50, fetch: async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    assert.equal(options.headers.Authorization, 'Bearer test-key-not-a-secret');
    return { ok: true, json: async () => url.endsWith('_limit') ? { allowed: false } : { record: null, now: 123 } };
  } });
  await assert.rejects(store.limit('a'.repeat(64), 'create'), error => error.code === 'RATE_LIMITED' && error.status === 429);
  assert.equal((await store.read(null, null, null)).now, 123);
  assert.ok(calls.every(call => call.url.startsWith('https://database.invalid/rest/v1/rpc/game_trial_')));
  await new Promise(resolve => setTimeout(resolve, 60));
  await assert.rejects(store.read(null, null, null), error => error.name === 'TimeoutError');
  assert.equal(calls.length, 2, 'expired invocation must not start another database call');
});

test('limited read uses one RPC and falls back only when the optional migration is missing',async()=>{
 const input={code:'AAAAAA',scope:'b'.repeat(64),source:'a'.repeat(64),sourceOperation:'api',sessionOperation:'state'};
 for(const missing of [false,true]){
  const calls=[];const store=new SupabaseRoomStore({url:'https://database.invalid',key:'fake',fetch:async(url,options)=>{
   calls.push({url,body:JSON.parse(options.body)});
   if(url.endsWith('_read_limited'))return missing?{ok:false,status:404,json:async()=>({code:'PGRST202'})}:{ok:true,json:async()=>({allowed:true,now:123,record:null})};
   return {ok:true,json:async()=>url.endsWith('_limit')?{allowed:true}:{now:123,record:null}};
  }});
  assert.equal((await store.readLimited(input)).now,123);
  assert.equal(calls.length,missing?4:1);
  if(missing){assert.equal(calls[1].body.operation,'api');assert.equal(calls[2].body.operation,'state');}
 }
});

test('limited read does not bypass denied quotas, unavailable storage or missing permissions',async()=>{
 const input={code:'AAAAAA',scope:'b'.repeat(64),source:'a'.repeat(64),sourceOperation:'api',sessionOperation:'state'};
 for(const response of [
  {ok:true,json:async()=>({allowed:false})},
  {ok:false,status:403,json:async()=>({code:'42501'})},
  {ok:false,status:503,json:async()=>({code:'PGRST202'})},
  {ok:false,status:404,json:async()=>({code:'unrelated'})}
 ]){
  let calls=0;const store=new SupabaseRoomStore({url:'https://database.invalid',key:'fake',fetch:async()=>{calls++;return response;}});
  await assert.rejects(store.readLimited(input),error=>response.ok?error.code==='RATE_LIMITED':error.status===response.status);
  assert.equal(calls,1);
 }
});
