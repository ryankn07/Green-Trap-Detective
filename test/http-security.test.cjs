'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {server,manager}=require('../server/server.cjs');
test('write origins can explicitly allow the shared Vercel frontend without allowing impostors',async()=>{
 const previous=process.env.PUBLIC_ORIGINS;process.env.PUBLIC_ORIGINS=base+',https://green-impact-mobile-demo.vercel.app';
 try{
  assert.equal((await post('/api/create',{name:'Vercel allowed'},{Origin:'https://green-impact-mobile-demo.vercel.app'})).status,200);
  assert.equal((await post('/api/create',{name:'Impostor'},{Origin:'https://green-impact-mobile-demo.vercel.app.attacker.invalid'})).status,403);
  assert.equal((await post('/api/create',{name:'Foreign'},{Origin:'https://attacker.invalid'})).status,403);
 }finally{if(previous===undefined)delete process.env.PUBLIC_ORIGINS;else process.env.PUBLIC_ORIGINS=previous;}
});
let base;
test.before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
async function post(route,body,headers={}){return fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});}
test('malformed, non-object and oversized JSON return typed errors without killing the server',async()=>{
 for(const value of ['null','[]','"text"','{bad'])assert.equal((await post('/api/create',value)).status,400);
 const big=await post('/api/create',{name:'á'.repeat(4100)});assert.equal(big.status,413);
 assert.equal((await fetch(base+'/health')).status,200);
});
test('foreign Origin cannot create rooms, and private files cannot be downloaded',async()=>{
 const before=manager.rooms.size;
 assert.equal((await post('/api/create',{name:'x'},{Origin:'https://attacker.invalid'})).status,403);
 assert.equal(manager.rooms.size,before);
 assert.equal((await post('/api/create',{name:'same origin'},{Origin:base})).status,200);
 for(const route of ['/.env','/data/rooms.json','/.git/config','/cards-hd/%2e%2e%2fserver%2frooms.cjs'])assert.equal((await fetch(base+route)).status,404);
});
test('sessions cannot impersonate a host or another room; stale submit cannot affect next round',async()=>{
 const {room,player}=manager.create('Host');
 const second=manager.join(room.code,'Second').player;manager.join(room.code,'Third');
 for(const p of room.players)manager.connected(room,p);
 const headers={Authorization:'Bearer '+second.secret,'x-room-code':room.code};
 assert.equal((await post('/api/action',{type:'start',playerId:player.id},headers)).status,400);
 const other=manager.create('Other');
 assert.equal((await fetch(base+'/api/state?room='+other.room.code,{headers})).status,401);
 manager.start(room,player);
 const context={gameId:room.state.gameId,round:room.state.round,phase:room.state.phase};
 const command={type:'submit',context,payload:{text:'Một nhận định',stance:'UNSURE'}};
 const revisionBeforeSubmit=room.revision;
 const raced=await Promise.all([post('/api/action',command,headers),post('/api/action',command,headers)]);
 assert.deepEqual(raced.map(r=>r.status).sort(),[200,400]);
 assert.equal(room.revision,revisionBeforeSubmit+1);
 const oldTime=manager.currentTime;let time=room.deadline;manager.currentTime=()=>time;
 try{
  manager.tick();time=room.deadline;manager.tick();time=room.deadline;manager.tick();
  assert.equal(room.state.round,2);
  const revision=room.revision;
  const stale=await post('/api/action',command,headers);assert.equal(stale.status,409);
  assert.equal((await stale.json()).error,'STALE_ACTION');assert.equal(room.revision,revision);
 }finally{manager.currentTime=oldTime;}
});

test('raw snapshots hide private data and invalid bank actions cannot change state',async()=>{
 const {room,player}=manager.create('<img src=x onerror=alert(1)>');
 manager.join(room.code,'Second');manager.join(room.code,'Third');
 for(const p of room.players)manager.connected(room,p);manager.start(room,player);
 const headers={Authorization:'Bearer '+player.secret,'x-room-code':room.code};
 async function state(){const r=await fetch(base+'/api/state?room='+room.code,{headers});assert.equal(r.status,200);return r.json();}
 let view=await state();assert.ok(!('alignment'in view.game.project));
 assert.ok(view.room.players.every(p=>!('secret'in p)));
 assert.ok(view.game.players.every(p=>!('role'in p)&&!('coins'in p)&&!('lockedAction'in p)&&!('inspections'in p)));
 const previousTime=manager.currentTime;manager.currentTime=()=>room.deadline;
 try{manager.tick();}finally{manager.currentTime=previousTime;}
 view=await state();const context={gameId:view.game.gameId,round:view.game.round,phase:view.game.phase};
 for(const action of [null,{invest:'true',bankAction:{type:'NONE'}},{invest:true,bankAction:{type:'INSPECT',targetId:room.players[1].id}},{invest:false,bankAction:{type:'EXPEL',targetId:player.id,amount:1}},{invest:false,bankAction:{type:'EXPEL',targetId:'missing',amount:1}},{invest:false,bankAction:{type:'EXPEL',targetId:room.players[1].id,amount:1.5}}]){
  const revision=room.revision;
  assert.equal((await post('/api/action',{type:'submit',context,payload:{action}},headers)).status,400);
  assert.equal(room.revision,revision);
 }
 assert.equal((await state()).game.myPlayer.coins,2);
});

test('session spam receives 429 and Retry-After despite spoofed forwarding IPs',async()=>{
 const {room,player}=manager.create('Spam check');const revision=room.revision;
 let limited;
 for(let i=0;i<65;i++){
  const r=await post('/api/action',{type:'invalid'},{Authorization:'Bearer '+player.secret,'x-room-code':room.code,'X-Forwarded-For':'203.0.113.'+i});
  if(r.status===429){limited=r;break;}
  assert.equal(r.status,400);
 }
 assert.ok(limited);assert.ok(Number(limited.headers.get('retry-after'))>0);assert.equal(room.revision,revision);
});

test('byte limit accepts 8000 bytes, rejects 8001 including chunked UTF8 bodies',async()=>{
 const prefix=JSON.stringify({name:'Boundary',padding:''});
 const body=prefix.replace('"padding":""','"padding":"'+'x'.repeat(8000-Buffer.byteLength(prefix))+'"');
 assert.equal(Buffer.byteLength(body),8000);
 assert.equal((await post('/api/create',body)).status,200);
 assert.equal((await post('/api/create',body+' ')).status,413);
 const http=require('node:http');
 const status=await new Promise((resolve,reject)=>{
  const req=http.request(base+'/api/create',{method:'POST',headers:{'Content-Type':'application/json'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
  req.on('error',reject);req.write('{"name":"');req.write('á'.repeat(4001));req.end('"}');
 });
 assert.equal(status,413);
});

test('unexpected storage errors return a generic 500 without exposing paths or adding a room',async()=>{
 const store=manager.store;const before=manager.rooms.size;
 manager.store={save:()=>{throw Error('private path /data/secret-file token=do-not-leak');}};
 try{
  const r=await post('/api/create',{name:'Storage error'});assert.equal(r.status,500);
  const body=await r.text();assert.ok(!body.includes('secret-file'));assert.ok(!body.includes('do-not-leak'));
  assert.equal(manager.rooms.size,before);
 }finally{manager.store=store;}
});

test('concurrent joins respect an explicitly configured room limit atomically',async()=>{
 const original=manager.maxPlayers;manager.maxPlayers=15;
 try{
  const {room}=manager.create('Join race');for(let i=1;i<14;i++)manager.join(room.code,'Existing '+i);
  const revision=room.revision;
  const results=await Promise.all(Array.from({length:20},(_,i)=>post('/api/join',{roomCode:room.code,name:'Joining '+i})));
  assert.equal(results.filter(r=>r.status===200).length,1);
  assert.equal(room.players.length,15);assert.equal(room.revision,revision+1);
 }finally{manager.maxPlayers=original;}
});

test('replacing an SSE connection keeps the player online until the final connection closes',async()=>{
 const {room,player}=manager.create('Reconnect');
 const headers={Authorization:'Bearer '+player.secret};
 const first=await fetch(base+'/api/stream?room='+room.code,{headers});const firstReader=first.body.getReader();
 await firstReader.read();
 const second=await fetch(base+'/api/stream?room='+room.code,{headers});const secondReader=second.body.getReader();
 await secondReader.read();
 let text='';for(let i=0;i<8&&!text.includes('superseded');i++){const {value,done}=await firstReader.read();if(done)break;text+=Buffer.from(value).toString();}
 assert.ok(text.includes('superseded'));
 const view=async()=>{const r=await fetch(base+'/api/state?room='+room.code,{headers});return r.json();};
 assert.equal((await view()).room.players[0].online,true);
 await secondReader.cancel();
 const until=Date.now()+2000;let online=true;
 while(online&&Date.now()<until){online=(await view()).room.players[0].online;if(online)await new Promise(r=>setTimeout(r,25));}
 assert.equal(online,false);
});
