'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {RoomManager}=require('../server/rooms.cjs');
const source=name=>createHash('sha256').update(name).digest('hex');
const a=source('network-a'),b=source('network-b');

test('one admission source cannot reserve the global room budget',()=>{
 const m=new RoomManager();
 for(let i=0;i<10;i++)m.create('Host '+i,a);
 assert.throws(()=>m.create('Overflow',a),{code:'ADMISSION_LIMIT'});
 assert.equal(m.rooms.size,10);
 assert.ok(m.create('Other network',b).room);
});

test('join and create share the source seat budget without a per-room player cap',()=>{
 const m=new RoomManager(),{room}=m.create('Host',a);
 for(let i=1;i<300;i++)m.join(room.code,'Player '+i,a);
 assert.throws(()=>m.join(room.code,'Overflow',a),{code:'ADMISSION_LIMIT'});
 assert.throws(()=>m.create('Another room',a),{code:'ADMISSION_LIMIT'});
 m.join(room.code,'Other network',b);
 assert.equal(room.players.length,301);
 assert.equal(m.view(room,room.players[0]).room.maxPlayers,null);
});

test('fifty shared-network players can connect and start, without exposing admission ownership',()=>{
 const m=new RoomManager(),{room,player}=m.create('Class host',a);
 for(let i=1;i<50;i++)m.join(room.code,'Student '+i,a);
 for(const p of room.players)m.connected(room,p);
 m.start(room,player);
 const v=m.view(room,player);
 assert.equal(v.game.players.length,50);
 assert.ok(!JSON.stringify(v).includes(a));
});

test('kick, leave and expiry release quotas, but persistence failure does not release a seat',()=>{
 let broken=false,now=0;
 const m=new RoomManager({currentTime:()=>now,store:{load:()=>[],save:()=>{if(broken)throw Error('disk unavailable');}}});
 const {room,player}=m.create('Host',a);
 for(let i=1;i<300;i++)m.join(room.code,'Seat '+i,a);
 broken=true;assert.throws(()=>m.kickLobby(room,player,room.players[1].id),/disk unavailable/);
 assert.throws(()=>m.join(room.code,'Still full',a),{code:'ADMISSION_LIMIT'});
 broken=false;m.kickLobby(room,player,room.players[1].id);m.join(room.code,'Replacement',a);
 m.leaveLobby(room,room.players[1]);m.join(room.code,'Replacement2',a);
 now=14400001;m.tick();assert.ok(m.create('After expiry',a).room);
});

test('admission ownership survives restart and legacy snapshots remain readable',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const {FileRoomStore}=require('../server/room-store.cjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gi-admission-')),filename=path.join(dir,'rooms.json');
 try{
  let m=new RoomManager({store:new FileRoomStore(filename)});
  for(let i=0;i<10;i++)m.create('Host '+i,a);
  m=new RoomManager({store:new FileRoomStore(filename)});
  assert.throws(()=>m.create('After restart',a),{code:'ADMISSION_LIMIT'});
  assert.ok(m.create('Other',b).room);
  const snapshot=JSON.parse(fs.readFileSync(filename,'utf8'));
  for(const room of snapshot.rooms){delete room.admissionSource;for(const p of room.players)delete p.admissionSource;}
  fs.writeFileSync(filename,JSON.stringify(snapshot));
  assert.equal(new RoomManager({store:new FileRoomStore(filename)}).rooms.size,11);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
