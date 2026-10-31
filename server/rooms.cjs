'use strict';
const crypto = require('node:crypto');
const {assignBaseRoles,selectProjectDeck,createGame,submitStatement,openBlindPhase,lockAction,resolveRound,nextRound,activePlayers,projectForPlayer}=require('../engine/dist/index.js');
const projects=require('../engine/dist/data/projects.json');
const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const clampName=raw=>typeof raw==='string'?raw.trim().replace(/\s+/g,' ').slice(0,24):'';
const now=()=>Date.now();
const PHASE_TIMES=Object.freeze({DEBATE:120000,BLIND_ACTION:60000,REVEAL:25000});
const uid=()=>crypto.randomUUID();
const token=()=>crypto.randomBytes(32).toString('hex');
const fail=(code,message)=>{const err=Error(message);err.code=code;throw err;};
class RoomManager {
  constructor({onUpdate=()=>{},randomInt=crypto.randomInt,currentTime=now,store=null}={}){this.store=store;this.rooms=new Map((store?.load()||[]).map(room=>[room.code,{...room,players:room.players.map(p=>({...p,online:false})),connections:new Map()}]));this.onUpdate=onUpdate;this.randomInt=randomInt;this.currentTime=currentTime;}
  persist(){this.store?.save(this.rooms.values());}
  create(name){name=clampName(name);if(name.length<1)fail('INVALID_NAME','Nhập tên người chơi (1–24 ký tự).');let code;do{code=Array.from({length:6},()=>CODE_CHARS[this.randomInt(CODE_CHARS.length)]).join('');}while(this.rooms.has(code));const player={id:uid(),name,secret:token(),online:false};const room={code,hostId:player.id,players:[player],state:null,lastActivity:this.currentTime(),deadline:null,revision:1,connections:new Map()};this.rooms.set(code,room);this.changed(room);return{room,player};}
  getRoom(code){const room=this.rooms.get(String(code||'').toUpperCase());if(!room)fail('ROOM_NOT_FOUND','Không tìm thấy phòng.');return room;}
  join(code,name){const room=this.getRoom(code);if(room.state)fail('GAME_STARTED','Ván đang diễn ra. Chỉ người chơi cũ được kết nối lại.');if(room.players.length>=8)fail('ROOM_FULL','Phòng đã đủ 8 người.');name=clampName(name);if(!name)fail('INVALID_NAME','Nhập tên người chơi.');const player={id:uid(),name,secret:token(),online:false};room.players.push(player);this.changed(room);return{room,player};}
  authenticate(code,rawToken){const room=this.getRoom(code);if(typeof rawToken!=='string'||!/^[a-f0-9]{64}$/.test(rawToken))fail('UNAUTHORIZED','Thiếu hoặc sai phiên chơi.');const digest=Buffer.from(rawToken,'hex');const player=room.players.find(p=>crypto.timingSafeEqual(Buffer.from(p.secret,'hex'),digest));if(!player)fail('UNAUTHORIZED','Không có quyền điều khiển người chơi này.');return{room,player};}
  view(room,player){return{room:{code:room.code,hostId:room.hostId,players:room.players.map(p=>({id:p.id,name:p.name,online:p.online})),status:room.state?'PLAYING':'LOBBY',revision:room.revision},game:room.state?projectForPlayer(room.state,player.id):null,serverTime:this.currentTime(),deadline:room.deadline};}
  changed(room){room.revision++;room.lastActivity=this.currentTime();this.persist();this.onUpdate(room);}
  connected(room,player){player.online=true;this.changed(room);}
  disconnected(room,player){player.online=false;this.changed(room);}
  phaseDeadline(room){room.deadline=room.state&&room.state.phase!=='GAME_OVER'?this.currentTime()+PHASE_TIMES[room.state.phase]:null;}
  start(room,player){if(room.state)fail('GAME_STARTED','Phòng đang chơi.');if(player.id!==room.hostId)fail('HOST_ONLY','Chỉ chủ phòng được bắt đầu.');if(room.players.length<3)fail('NOT_ENOUGH_PLAYERS','Cần ít nhất 3 người chơi.');if(!room.players.every(p=>p.online))fail('PLAYERS_OFFLINE','Tất cả người chơi cần kết nối trước khi bắt đầu.');const assigned=assignBaseRoles(room.players.map(p=>({id:p.id,name:p.name})),this.randomInt);const deck=selectProjectDeck(projects,10,this.randomInt);room.state=createGame({gameId:uid(),players:assigned,projects,deckIds:deck,roundLimit:10});this.phaseDeadline(room);this.changed(room);}
  submit(room,player,payload){if(!room.state)fail('NOT_STARTED','Chưa bắt đầu ván.');const state=room.state;if(state.phase==='DEBATE'){const text=String(payload.text??'');room.state=submitStatement(state,player.id,text,payload.stance);}else if(state.phase==='BLIND_ACTION'){room.state=lockAction(state,player.id,payload.action);}else fail('INVALID_PHASE','Không có hành động hợp lệ ở pha này.');this.changed(room);}
  next(room,player){if(!room.state||room.state.phase!=='REVEAL')fail('INVALID_PHASE','Chưa thể sang lượt mới.');if(player.id!==room.hostId)fail('HOST_ONLY','Chỉ chủ phòng được điều khiển lượt mới.');if(room.deadline!==null&&this.currentTime()<room.deadline)fail('TIMER_ACTIVE','Chưa hết thời gian công bố. Hãy chờ đồng hồ về 0.');room.state=nextRound(room.state);this.phaseDeadline(room);this.changed(room);}
  leaveLobby(room,player){if(room.state)fail('GAME_STARTED','Khi ván đã bắt đầu, vị trí chơi được giữ lại.');room.players=room.players.filter(p=>p.id!==player.id);if(!room.players.length){this.rooms.delete(room.code);this.persist();return;}if(player.id===room.hostId)room.hostId=room.players[0].id;this.changed(room);}
  tick(){for(const room of this.rooms.values()){if(this.currentTime()-room.lastActivity>14400000&&!room.players.some(p=>p.online)){this.rooms.delete(room.code);this.persist();continue;}if(!room.state||room.deadline===null||this.currentTime()<room.deadline)continue;if(room.state.phase==='DEBATE'){let s=room.state;for(const p of activePlayers(s))if(!Object.hasOwn(s.statements,p.id))s=submitStatement(s,p.id,'Không phát biểu.','UNSURE');room.state=openBlindPhase(s);}else if(room.state.phase==='BLIND_ACTION'){let s=room.state;for(const p of activePlayers(s))if(!Object.hasOwn(s.lockedActions,p.id))s=lockAction(s,p.id,{invest:false,bankAction:{type:'NONE'}});room.state=resolveRound(s);}else if(room.state.phase==='REVEAL')room.state=nextRound(room.state);else{room.deadline=null;continue;}this.phaseDeadline(room);this.changed(room);}}
}
module.exports={RoomManager,fail};
