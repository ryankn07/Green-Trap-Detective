'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {server,manager}=require('../server/server.cjs');
let base;
test.before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
const headers=(room,player)=>({'Content-Type':'application/json',Authorization:'Bearer '+player.secret,'x-room-code':room.code});
const action=(room,player,body)=>fetch(base+'/api/action',{method:'POST',headers:headers(room,player),body:JSON.stringify(body)});
function lobby(){const {room,player:host}=manager.create('Chủ phòng');const guest=manager.join(room.code,'Khách').player;const other=manager.join(room.code,'Người khác').player;const offline=manager.join(room.code,'Mất kết nối').player;for(const p of [host,guest,other])manager.connected(room,p);return {room,host,guest,other,offline};}
test('host can remove an offline lobby seat, revoke its token and start with remaining players',async()=>{
 const {room,host,offline}=lobby();
 const response=await action(room,host,{type:'kick',targetId:offline.id});assert.equal(response.status,200);
 const state=await (await fetch(base+'/api/state?room='+room.code,{headers:headers(room,host)})).json();
 assert.equal(state.room.players.length,3);assert.ok(!state.room.players.some(p=>p.id===offline.id));assert.equal(state.room.hostId,host.id);
 assert.equal((await fetch(base+'/api/state?room='+room.code,{headers:headers(room,offline)})).status,401);
 assert.equal((await action(room,offline,{type:'start'})).status,401);
 assert.equal((await action(room,host,{type:'start'})).status,200);
});
test('kick is host-only, lobby-only and cannot target the host, another room or an absent seat',async()=>{
 const {room,host,guest,offline}=lobby();const elsewhere=manager.create('Khác');
 for(const [actor,targetId,code] of [[guest,offline.id,'HOST_ONLY'],[host,host.id,'INVALID_TARGET'],[host,elsewhere.player.id,'INVALID_TARGET'],[host,null,'INVALID_TARGET'],[host,{},'INVALID_TARGET']]){
  const revision=room.revision;const r=await action(room,actor,{type:'kick',targetId});assert.equal(r.status,400);assert.equal((await r.json()).error,code);assert.equal(room.revision,revision);
 }
 manager.connected(room,offline);manager.start(room,host);const revision=room.revision;
 const r=await action(room,host,{type:'kick',targetId:guest.id});assert.equal((await r.json()).error,'GAME_STARTED');assert.equal(room.revision,revision);
});
test('online target receives kicked event and loses stream access; remaining roster is broadcast',async()=>{
 const {room,host,guest}=lobby(),a=new AbortController(),b=new AbortController();
 const read=async(player,signal)=>{const r=await fetch(base+'/api/stream?room='+room.code,{headers:headers(room,player),signal});assert.equal(r.status,200);return r.body.getReader();};
 const target=await read(guest,a.signal),watcher=await read(host,b.signal);const decoder=new TextDecoder();
 try{
  await target.read();await watcher.read();
  assert.equal((await action(room,host,{type:'kick',targetId:guest.id})).status,200);
  let text='';while(true){const {done,value}=await target.read();if(done)break;text+=decoder.decode(value,{stream:true});}assert.match(text,/event: kicked/);
  const end=Date.now()+3000;let latest;
  while(Date.now()<end){const part=await watcher.read();const value=decoder.decode(part.value);for(const frame of value.split('\n\n'))if(frame.startsWith('event: snapshot\n'))latest=JSON.parse(frame.slice(frame.indexOf('data: ')+6));if(latest&&!latest.room.players.some(p=>p.id===guest.id))break;}
  assert.ok(latest&&!latest.room.players.some(p=>p.id===guest.id));
  assert.equal((await fetch(base+'/api/stream?room='+room.code,{headers:headers(room,guest)})).status,401);
 }finally{a.abort();b.abort();await Promise.allSettled([target.cancel(),watcher.cancel()]);}
});
test('failed persistence does not revoke or disconnect the target',async()=>{
 const {room,host,guest}=lobby(),previous=manager.store,revision=room.revision;manager.store={save(){throw Error('simulated disk failure');}};
 try{assert.equal((await action(room,host,{type:'kick',targetId:guest.id})).status,500);assert.equal(room.revision,revision);assert.equal(manager.authenticate(room.code,guest.secret).player.id,guest.id);assert.equal(guest.online,true);}
 finally{manager.store=previous;}
});
test('a kicked notification survives an already-backpressured response',async()=>{
 const {room,host,guest}=lobby();
 const backpressure=(req,res)=>{if(req.url.startsWith('/api/stream')&&req.headers.authorization==='Bearer '+guest.secret){const write=res.write;res.write=function(...args){write.apply(this,args);return false;};}};
 server.prependListener('request',backpressure);
 const controller=new AbortController();let reader;
 try{
  const response=await fetch(base+'/api/stream?room='+room.code,{headers:headers(room,guest),signal:controller.signal});reader=response.body.getReader();await reader.read();
  assert.equal((await action(room,host,{type:'kick',targetId:guest.id})).status,200);
  let text='';const decoder=new TextDecoder();while(true){const part=await reader.read();if(part.done)break;text+=decoder.decode(part.value,{stream:true});}
  assert.match(text,/event: kicked/);
 }finally{server.removeListener('request',backpressure);controller.abort();if(reader)await reader.cancel().catch(()=>{});}
});
