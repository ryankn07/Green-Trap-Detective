'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {RoomManager}=require('../server/rooms.cjs');
test('a restarted room manager restores sessions, phase and locked choices without exposing private data',()=>{
 const {FileRoomStore}=require('../server/room-store.cjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'green-impact-store-'));
 const filename=path.join(dir,'rooms.json');
 try{
  let now=Date.now();const store=new FileRoomStore(filename);
  const first=new RoomManager({store,currentTime:()=>now});
  const {room,player}=first.create('A');
  const b=first.join(room.code,'B').player,c=first.join(room.code,'C').player;
  for(const p of room.players)first.connected(room,p);
  first.start(room,player);now=room.deadline;first.tick();
  first.submit(room,player,{action:{invest:true,bankAction:{type:'NONE'}}});
  const restarted=new RoomManager({store:new FileRoomStore(filename),currentTime:()=>now});
  const restored=restarted.authenticate(room.code,player.secret);
  const view=restarted.view(restored.room,restored.player);
  assert.equal(view.game.phase,'BLIND_ACTION');assert.equal(view.game.round,1);
  assert.equal(view.game.myPlayer.lockedAction.invest,true);
  assert.ok(view.room.players.every(p=>p.online===false));
  assert.ok(view.game.players.every(p=>!Object.hasOwn(p,'role')&&!Object.hasOwn(p,'coins')));
  assert.throws(()=>restarted.submit(restored.room,restored.player,{action:{invest:false,bankAction:{type:'NONE'}}}),{code:'ACTION_ALREADY_LOCKED'});
  for(const old of [b,c]){const auth=restarted.authenticate(room.code,old.secret);restarted.submit(auth.room,auth.player,{action:{invest:false,bankAction:{type:'NONE'}}});}
  now=restored.room.deadline;restarted.tick();assert.equal(restored.room.state.phase,'REVEAL');
 }finally{fs.rmSync(filename,{force:true});fs.rmdirSync(dir);}
});

test('closed lobby rooms do not reappear after restart and corrupt snapshots fail visibly',()=>{
 const {FileRoomStore}=require('../server/room-store.cjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'green-impact-empty-')),filename=path.join(dir,'rooms.json');
 try{
  const first=new RoomManager({store:new FileRoomStore(filename)}),{room,player}=first.create('A');
  first.leaveLobby(room,player);
  assert.equal(new RoomManager({store:new FileRoomStore(filename)}).rooms.size,0);
  fs.writeFileSync(filename,'broken snapshot');
  assert.throws(()=>new RoomManager({store:new FileRoomStore(filename)}),/snapshot|JSON/i);
 }finally{fs.rmSync(filename,{force:true});fs.rmdirSync(dir);}
});

test('a failed persistence write does not leave an unacknowledged join in memory',()=>{
 let broken=false;
 const manager=new RoomManager({store:{load:()=>[],save:()=>{if(broken)throw Error('disk unavailable');}}});
 const {room,player}=manager.create('Host');const revision=room.revision;
 broken=true;
 assert.throws(()=>manager.join(room.code,'Not saved'),/disk unavailable/);
 assert.equal(room.players.length,1);assert.equal(room.revision,revision);
  assert.throws(()=>manager.join(room.code,'Still not saved'),/disk unavailable/);
  assert.equal(room.players.length,1);
 assert.equal(manager.view(room,player).room.players.length,1);
 assert.throws(()=>manager.leaveLobby(room,player),/disk unavailable/);
 assert.equal(manager.getRoom(room.code),room);
});
test('saving another room cannot publish a failed kick; removals survive restart',()=>{
 const {FileRoomStore}=require('../server/room-store.cjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'green-impact-multi-')),filename=path.join(dir,'rooms.json');
 const rename=fs.renameSync;
 try{
  const store=new FileRoomStore(filename),manager=new RoomManager({store});
  const first=manager.create('First'),target=manager.join(first.room.code,'Keep me').player,second=manager.create('Second');
  fs.renameSync=()=>{throw Error('rename failed');};
  assert.throws(()=>manager.kickLobby(first.room,first.player,target.id),/rename failed/);
  fs.renameSync=rename;manager.join(second.room.code,'New guest');
  let restored=new RoomManager({store:new FileRoomStore(filename)});
  assert.equal(restored.authenticate(first.room.code,target.secret).player.id,target.id);
  assert.equal(restored.getRoom(second.room.code).players.length,2);
  manager.kickLobby(first.room,first.player,target.id);manager.leaveLobby(first.room,first.player);
  restored=new RoomManager({store:new FileRoomStore(filename)});
  assert.throws(()=>restored.getRoom(first.room.code),{code:'ROOM_NOT_FOUND'});assert.equal(restored.getRoom(second.room.code).players.length,2);
 }finally{fs.renameSync=rename;fs.rmSync(filename,{force:true});fs.rmSync(filename+'.tmp',{force:true});fs.rmdirSync(dir);}
});
