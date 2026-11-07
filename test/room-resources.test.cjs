'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {RoomManager}=require('../server/rooms.cjs');
test('process resource guards bound abandoned rooms and free them at expiry',()=>{
 let time=0;const manager=new RoomManager({currentTime:()=>time});
 for(let i=0;i<100;i++)manager.create('Room '+i);
 assert.throws(()=>manager.create('Overflow'),{code:'SERVER_BUSY'});
 time=14400001;manager.tick();assert.equal(manager.rooms.size,0);
 assert.ok(manager.create('After expiry').room);
});
test('the process roster budget is independent of the optional per-room policy',()=>{
 const manager=new RoomManager(),{room}=manager.create('Host');
 for(let i=1;i<1200;i++)manager.join(room.code,'Player '+i);
 assert.throws(()=>manager.join(room.code,'Overflow'),{code:'SERVER_BUSY'});
 assert.equal(manager.view(room,room.players[0]).room.maxPlayers,null);
 assert.equal(room.players.length,1200);
});

test('due-work check includes phase deadlines and abandoned lobbies without marking idle rooms dirty',()=>{
 let time=100000,saves=0;const manager=new RoomManager({currentTime:()=>time,store:{load:()=>[],save:()=>saves++}});
 assert.equal(manager.hasDueWork(),false);
 const {room,player}=manager.create('Host');
 manager.connected(room,player);const initial=saves,revision=room.revision;
 manager.connected(room,player);assert.equal(saves,initial);assert.equal(room.revision,revision);
 manager.disconnected(room,player);const offline=saves;
 manager.disconnected(room,player);assert.equal(saves,offline);
 assert.equal(manager.hasDueWork(),false);
 time+=14400001;assert.equal(manager.hasDueWork(),true);manager.tick();assert.equal(manager.hasDueWork(),false);
 const next=manager.create('Active');manager.join(next.room.code,'One');manager.join(next.room.code,'Two');
 for(const member of next.room.players)manager.connected(next.room,member);
 manager.start(next.room,next.player);time=next.room.deadline-1;assert.equal(manager.hasDueWork(),false);
 time++;assert.equal(manager.hasDueWork(),true);manager.tick();assert.equal(next.room.state.phase,'BLIND_ACTION');assert.equal(manager.hasDueWork(),false);
});
