'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {SupabaseSnapshotStore}=require('../server/supabase-snapshot.cjs');
test('remote store loads and commits snapshots using revision compare-and-swap',async()=>{
 let revision=0,snapshot={version:1,rooms:[]};
 const fetch=async(url,options)=>{const body=JSON.parse(options.body);assert.equal(options.headers.apikey,'secret');if(url.endsWith('/game_snapshot_load'))return Response.json({revision,snapshot});assert.equal(body.expected_revision,revision);revision++;snapshot=body.new_snapshot;return Response.json({revision});};
 const store=new SupabaseSnapshotStore({url:'https://example.test',key:'secret',fetch});
 assert.deepEqual(await store.load(),{version:1,rooms:[]});
 await store.commit({version:1,rooms:[{code:'ABCDEF'}]});
 assert.equal(store.revision,1);assert.equal(snapshot.rooms[0].code,'ABCDEF');
});
test('remote failures and malformed responses fail closed without advancing revision',async()=>{
 const store=new SupabaseSnapshotStore({url:'https://example.test',key:'secret',fetch:async()=>new Response('',{status:409})});
 await assert.rejects(store.load());assert.equal(store.revision,null);
});
test('CAS conflict does not advance revision',async()=>{
 let call=0;
 const store=new SupabaseSnapshotStore({url:'https://example.test',key:'secret',fetch:async()=>++call===1?Response.json({revision:3,snapshot:{version:1,rooms:[]}}):new Response('',{status:400})});
 await store.load();await assert.rejects(store.commit({version:1,rooms:[]}));assert.equal(store.revision,3);
});
test('invalid revision or snapshot is rejected',async()=>{
 const store=new SupabaseSnapshotStore({url:'https://example.test',key:'secret',fetch:async()=>Response.json({revision:0,snapshot:{version:1,rooms:'bad'}})});
 await assert.rejects(store.load(),/Invalid remote snapshot/);assert.equal(store.revision,null);
});
