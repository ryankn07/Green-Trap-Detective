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
