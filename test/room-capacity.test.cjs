'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {RoomManager}=require('../server/rooms.cjs');
const {FileRoomStore}=require('../server/room-store.cjs');

test('room size is not hardcoded to 8 or 12; larger rooms restart and play',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gi-capacity-'));
 try{
  const filename=path.join(dir,'rooms.json');
  const manager=new RoomManager({store:new FileRoomStore(filename)});
  const {room,player}=manager.create('Chủ phòng');
  for(let i=2;i<=50;i++)manager.join(room.code,'Người '+i);
  assert.equal(manager.view(room,player).room.maxPlayers,null);
  assert.equal(room.players.length,50);
  const restored=new RoomManager({store:new FileRoomStore(filename)});
  const auth=restored.authenticate(room.code,player.secret);
  assert.equal(auth.room.players.length,50);
  for(const p of auth.room.players)restored.connected(auth.room,p);
  restored.start(auth.room,auth.player);
  assert.equal(restored.view(auth.room,auth.player).game.players.length,50);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('an optional operator limit is enforced without becoming a hardcoded game rule',()=>{
 const manager=new RoomManager({maxPlayers:20}),{room,player}=manager.create('Host');
 for(let i=1;i<20;i++)manager.join(room.code,'Player '+i);
 assert.equal(manager.view(room,player).room.maxPlayers,20);
 const revision=room.revision;
 assert.throws(()=>manager.join(room.code,'Extra'),{code:'ROOM_FULL'});
 assert.equal(room.revision,revision);
});
