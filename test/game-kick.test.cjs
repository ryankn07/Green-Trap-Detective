'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {RoomManager}=require('../server/rooms.cjs');
function game(){
 let now=0;const m=new RoomManager({currentTime:()=>now});
 const {room,player:host}=m.create('Host');for(let i=1;i<8;i++)m.join(room.code,'Player '+i);
 for(const p of room.players)m.connected(room,p);m.start(room,host);
 return {m,room,host,expire:()=>{now=room.deadline;m.tick();}};
}

test('host can kick an offline player during play, revoke access and continue the round',()=>{
 const {m,room,host,expire}=game(),target=room.players[1];
 m.disconnected(room,target);const secret=target.secret;
 m.kick(room,host,target.id);
 assert.throws(()=>m.authenticate(room.code,secret),{code:'UNAUTHORIZED'});
 const v=m.view(room,host);
 assert.equal(v.game.players.find(p=>p.id===target.id).isAlive,false);
 assert.equal(v.room.players.find(p=>p.id===target.id).removed,true);
 expire();expire();assert.equal(room.state.phase,'REVEAL');
 assert.equal(room.state.history[0].eligibleCount,7);
});

test('game kick remains host-only, cannot target self or another room, and is durable on failure',()=>{
 const {m,room,host}=game(),target=room.players[1],foreign=m.create('Elsewhere');
 for(const [actor,id,code] of [[target,room.players[2].id,'HOST_ONLY'],[host,host.id,'INVALID_TARGET'],[host,foreign.player.id,'INVALID_TARGET']])
  assert.throws(()=>m.kick(room,actor,id),{code});
 const original=room.state;m.store={save:()=>{throw Error('disk unavailable');}};
 assert.throws(()=>m.kick(room,host,target.id),/disk unavailable/);
 assert.equal(room.state,original);assert.equal(m.authenticate(room.code,target.secret).player.id,target.id);
});

test('kicking after reveal preserves prior results and ending a faction uses the existing win condition',()=>{
 const {m,room,host,expire}=game();expire();expire();
 const history=JSON.stringify(room.state.history);
 const hostRole=room.state.players.find(p=>p.id===host.id).role;
 for(const target of room.state.players.filter(p=>p.role!==hostRole))m.kick(room,host,target.id);
 assert.equal(JSON.stringify(room.state.history),history);
 assert.equal(room.state.phase,'GAME_OVER');
 assert.equal(room.state.outcome.winner,hostRole);
 assert.equal(room.deadline,null);
});

test('a kicked actor cannot execute a locked investment and removal survives restart',()=>{
 const {m,room,host,expire}=game(),target=room.players[1];
 expire();m.submit(room,target,{action:{invest:true,bankAction:{type:'NONE'}}});
 m.kick(room,host,target.id);
 assert.throws(()=>m.kick(room,host,target.id),{code:'INVALID_TARGET'});
 expire();assert.equal(room.state.history[0].investorCount,0);
 const {FileRoomStore}=require('../server/room-store.cjs');
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gi-gamekick-')),filename=path.join(dir,'rooms.json');
 try{
  new FileRoomStore(filename).save(m.rooms.values());
  const restored=new RoomManager({store:new FileRoomStore(filename)});
  assert.throws(()=>restored.authenticate(room.code,target.secret),{code:'UNAUTHORIZED'});
  assert.equal(restored.view(restored.getRoom(room.code),host).game.players.find(p=>p.id===target.id).isAlive,false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
