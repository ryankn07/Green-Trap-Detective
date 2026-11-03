'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {RoomManager}=require('../server/rooms.cjs'),{FileRoomStore}=require('../server/room-store.cjs');
const {createGame}=require('../engine/dist/index.js'),projects=require('../engine/dist/data/projects.json');
function prepare(manager,room){
 while(room.players.length<3)manager.join(room.code,'Bot '+room.players.length);
 for(const player of room.players)manager.connected(room,player);
 manager.start(room,room.players[0]);
}
test('game over immediately releases the room and admission slots even with online bots',()=>{
 let now=Date.now(),saved=[];const source='a'.repeat(64);
 const manager=new RoomManager({currentTime:()=>now,store:{load:()=>[],save:rooms=>{saved=[...rooms].map(room=>room.code);}}});
 const {room,player}=manager.create('Host',source);
 for(let i=0;i<9;i++)manager.create('Other '+i,source);
 assert.throws(()=>manager.create('Blocked',source),{code:'ADMISSION_LIMIT'});
 prepare(manager,room);
 while(room.state.phase!=='GAME_OVER'){now=room.deadline;manager.tick();}
 assert.equal(manager.rooms.has(room.code),false);assert.equal(manager.rooms.size,9);assert.ok(!saved.includes(room.code));
 assert.ok(room.players.some(player=>player.online),'online flags do not retain completed rooms');
 assert.equal(manager.authenticate(room.code,player.secret).room.state.phase,'GAME_OVER');
 assert.throws(()=>manager.authenticate(room.code,'0'.repeat(64)),{code:'UNAUTHORIZED'});
 assert.throws(()=>manager.join(room.code,'Too late'),{code:'GAME_STARTED'});
 manager.create('Replacement',source);assert.equal(manager.rooms.size,10);
 now+=15*60*1000+1;assert.throws(()=>manager.getRoom(room.code),{code:'ROOM_NOT_FOUND'});
});
test('startup removes legacy completed rooms from disk while preserving unfinished rooms',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'green-trap-completion-')),filename=path.join(directory,'rooms.json');
 t.after(()=>{fs.rmSync(filename,{force:true});fs.rmdirSync(directory);});
 let now=Date.now();const store=new FileRoomStore(filename),manager=new RoomManager({store,currentTime:()=>now});
 const {room,player}=manager.create('Finished');prepare(manager,room);
 while(room.state.phase!=='GAME_OVER'){now=room.deadline;manager.tick();}
 const active=manager.create('Keep this lobby').room;
 // Simulate an older saved snapshot that retained terminal games.
 store.save([room,active]);
 const restored=new RoomManager({store});
 assert.equal(restored.rooms.size,1);assert.equal(restored.rooms.has(active.code),true);
 assert.equal(restored.authenticate(room.code,player.secret).room.state.phase,'GAME_OVER');
 assert.deepEqual(store.load().map(room=>room.code),[active.code]);
});
test('failed completion persistence restores the active game and never exposes an uncommitted result',()=>{
 let fail=false;const manager=new RoomManager({store:{load:()=>[],save:()=>{if(fail)throw Error('disk unavailable');}}});
 const {room,player}=manager.create('Host');manager.join(room.code,'Protector');const saboteur=manager.join(room.code,'Saboteur').player;
 room.state=createGame({gameId:'rollback-completion',players:room.players.map((p,i)=>({id:p.id,name:p.name,role:i===2?'SABOTEUR':'PROTECTOR'})),projects,deckIds:projects.slice(0,10).map(p=>p.id)});manager.phaseDeadline(room);manager.changed(room);
 fail=true;assert.throws(()=>manager.kick(room,player,saboteur.id),/disk unavailable/);
 assert.equal(manager.rooms.has(room.code),true);assert.equal(manager.finished.has(room.code),false);assert.equal(room.state.phase,'DEBATE');
 fail=false;manager.kick(room,player,saboteur.id);assert.equal(manager.rooms.has(room.code),false);assert.equal(manager.finished.has(room.code),true);
});

test('SSE delivers the terminal projection before closing and health no longer counts the room',async()=>{
 const {server,manager}=require('../server/server.cjs');let now=Date.now();manager.currentTime=()=>now;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 try{
  const {room,player}=manager.create('SSE cleanup');prepare(manager,room);
  const response=await fetch(origin+'/api/stream?room='+room.code,{headers:{Authorization:'Bearer '+player.secret},signal:AbortSignal.timeout(5000)});
  assert.equal(response.status,200);const reader=response.body.getReader();let text='';
  while(room.state.phase!=='GAME_OVER'){now=room.deadline;manager.tick();}
  while(true){const {done,value}=await reader.read();if(done)break;text+=Buffer.from(value).toString('utf8');}
  assert.match(text,/"phase":"GAME_OVER"/);assert.equal(manager.rooms.has(room.code),false);
  assert.equal((await (await fetch(origin+'/health')).json()).activeRooms,0);
  const final=await fetch(origin+'/api/state?room='+room.code,{headers:{Authorization:'Bearer '+player.secret}});
  assert.equal(final.status,200);assert.equal((await final.json()).game.phase,'GAME_OVER');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
