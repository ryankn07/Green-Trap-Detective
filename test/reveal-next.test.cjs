'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {RoomManager}=require('../server/rooms.cjs');

function revealRoom(){
 let now=100000;
 const manager=new RoomManager({currentTime:()=>now});
 const {room,player}=manager.create('Host');
 manager.join(room.code,'Guest');manager.join(room.code,'Third');
 for(const p of room.players)manager.connected(room,p);
 manager.start(room,player);
 now=room.deadline;manager.tick();
 now=room.deadline;manager.tick();
 assert.equal(room.state.phase,'REVEAL');
 return {manager,room,player,setTime:value=>{now=value;}};
}

test('host can advance during reveal before its automatic deadline',()=>{
 const {manager,room,player}=revealRoom();
 manager.next(room,player);
 assert.equal(manager.view(room,player).game.round,2);
 assert.equal(manager.view(room,player).game.phase,'DEBATE');
 assert.throws(()=>manager.next(room,player),{code:'INVALID_PHASE'});
});

test('guests cannot skip reveal and its deadline still advances automatically',()=>{
 const {manager,room,player,setTime}=revealRoom();
 assert.throws(()=>manager.next(room,room.players[1]),{code:'HOST_ONLY'});
 assert.equal(manager.view(room,player).game.round,1);
 setTime(room.deadline);manager.tick();
 assert.equal(manager.view(room,player).game.round,2);
 assert.equal(manager.view(room,player).game.phase,'DEBATE');
});
