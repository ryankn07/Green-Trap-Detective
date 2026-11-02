'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {spawn}=require('node:child_process');
const path=require('node:path');
const once=require('node:events').once;
async function listen(server){server.listen(0,'127.0.0.1');await once(server,'listening');return server.address().port;}
async function freePort(){const s=http.createServer();const p=await listen(s);await new Promise(r=>s.close(r));return p;}
test('HTTP room survives restart; a failed CAS stops stale reads and writes',async t=>{
 let revision=0,snapshot={version:1,rooms:[]},fail=false,gate=null,started=null,writer=null;
 const rest=http.createServer(async(req,res)=>{let data='';for await(const part of req)data+=part;const body=JSON.parse(data);res.setHeader('content-type','application/json');if(req.url.endsWith('/game_snapshot_claim')){writer=body.writer_token;return res.end(JSON.stringify({revision,snapshot}));}if(req.url.endsWith('/game_snapshot_verify')){if(writer!==body.writer_token||revision!==body.expected_revision)return res.end('null');return res.end(JSON.stringify({revision}));}if(gate){started();await gate;}if(fail||body.writer_token!==writer||body.expected_revision!==revision){res.statusCode=409;return res.end('{}');}snapshot=body.new_snapshot;revision++;res.end(JSON.stringify({revision}));});
 const restPort=await listen(rest);t.after(()=>rest.close());
 let child; t.after(()=>child?.kill());
 async function start(){const port=await freePort();child=spawn(process.execPath,['--require',path.join(__dirname,'fixtures/redirect-fetch.cjs'),path.join(__dirname,'../server/server.cjs')],{env:{...process.env,PORT:String(port),GAME_SUPABASE_URL:'https://example.test',GAME_SUPABASE_SERVICE_KEY:'test-key',TEST_REST_ORIGIN:`http://127.0.0.1:${restPort}`},stdio:['ignore','pipe','pipe']});await Promise.race([new Promise((resolve,reject)=>{child.stdout.on('data',chunk=>{if(String(chunk).includes('listening'))resolve();});child.stderr.on('data',x=>process.stderr.write(x));child.once('exit',()=>reject(Error('server exited')));}),new Promise((_,reject)=>setTimeout(()=>reject(Error('startup timeout')),5000))]);return `http://127.0.0.1:${port}`;}
 async function stop(){const exit=once(child,'exit');child.kill();await exit;}
 let origin=await start();
 const created=await (await fetch(origin+'/api/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Host'})})).json();
 assert.match(created.token,/^[a-f0-9]{64}$/);assert.equal(snapshot.rooms[0].players[0].secret,created.token);
 const old=child;const oldOrigin=origin;origin=await start();
 assert.equal((await fetch(oldOrigin+'/health')).status,503);old.kill();
 await stop();origin=await start();
 const state=await (await fetch(origin+'/api/state?room='+created.roomCode,{headers:{authorization:'Bearer '+created.token}})).json();
 assert.equal(state.room.code,created.roomCode);assert.equal(JSON.stringify(state).includes(created.token),false);
 const streamUrl=origin+'/api/stream?room='+created.roomCode, auth={authorization:'Bearer '+created.token};
 const firstAbort=new AbortController();const first=await fetch(streamUrl,{headers:auth,signal:firstAbort.signal});assert.equal(first.status,200);
 let releaseStream;gate=new Promise(r=>{releaseStream=r;});const enteredStream=new Promise(r=>{started=r;});
 const secondAbort=new AbortController();const second=fetch(streamUrl,{headers:auth,signal:secondAbort.signal}).catch(()=>null);await enteredStream;secondAbort.abort();releaseStream();await second;gate=null;
 await new Promise(r=>setTimeout(r,150));const online=await (await fetch(origin+'/api/state?room='+created.roomCode,{headers:auth})).json();assert.equal(online.room.players[0].online,true);
 let releaseReplacement;gate=new Promise(r=>{releaseReplacement=r;});const enteredReplacement=new Promise(r=>{started=r;});
 const replacementAbort=new AbortController();const replacement=fetch(streamUrl,{headers:auth,signal:replacementAbort.signal});await enteredReplacement;firstAbort.abort();releaseReplacement();assert.equal((await replacement).status,200);gate=null;
 await new Promise(r=>setTimeout(r,150));const reconnected=await (await fetch(origin+'/api/state?room='+created.roomCode,{headers:auth})).json();assert.equal(reconnected.room.players[0].online,true);replacementAbort.abort();
 let release;gate=new Promise(r=>{release=r;});const entered=new Promise(r=>{started=r;});let acknowledged=false;
 const pending=fetch(origin+'/api/join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({roomCode:created.roomCode,name:'Delayed'})}).then(r=>{acknowledged=true;return r;});await entered;assert.equal(acknowledged,false);assert.equal(snapshot.rooms[0].players.length,1);release();assert.equal((await pending).status,200);gate=null;assert.equal(snapshot.rooms[0].players.length,2);
 revision++; // Simulate another writer winning the compare-and-swap.
 const join=await fetch(origin+'/api/join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({roomCode:created.roomCode,name:'Guest'})});assert.equal(join.status,503);
 const stale=await fetch(origin+'/api/state?room='+created.roomCode,{headers:{authorization:'Bearer '+created.token}});assert.equal(stale.status,503);
 assert.equal(snapshot.rooms[0].players.length,2);
});

