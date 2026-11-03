'use strict';
const crypto = require('node:crypto');
const {MIN_PLAYERS,MAX_PLAYERS,MAX_ROOMS,MAX_STREAMS,SOURCE_ROOMS,SOURCE_SEATS}=require('./limits.cjs');
const {assignBaseRoles,selectProjectDeck,createGame,submitStatement,skipDiscussion,openBlindPhase,lockAction,resolveRound,nextRound,removePlayer,activePlayers,projectForPlayer}=require('../engine/dist/index.js');
const projects=require('../engine/dist/data/projects.json');
const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const clampName=raw=>typeof raw==='string'?raw.trim().replace(/\s+/g,' ').slice(0,24):'';
const now=()=>Date.now();
const PHASE_TIMES=Object.freeze({DEBATE:120000,BLIND_ACTION:60000,REVEAL:25000});
const RESULT_TTL=2*60*1000;
const uid=()=>crypto.randomUUID();
const token=()=>crypto.randomBytes(32).toString('hex');
const fail=(code,message)=>{const err=Error(message);err.code=code;err.public=true;throw err;};
class RoomManager {
  constructor({onUpdate=()=>{},randomInt=crypto.randomInt,currentTime=now,store=null,maxPlayers=MAX_PLAYERS}={}){if(maxPlayers!==null&&(!Number.isSafeInteger(maxPlayers)||maxPlayers<MIN_PLAYERS))throw Error('Invalid room player limit');this.maxPlayers=maxPlayers;this.store=store;this.rooms=new Map((store?.load()||[]).map(room=>[room.code,{...room,players:room.players.map(p=>({...p,online:false})),connections:new Map()}]));this.finished=new Map();this.onUpdate=onUpdate;this.randomInt=randomInt;this.currentTime=currentTime;this.saved=new WeakMap();let retired=false;for(const room of this.rooms.values()){this.remember(room);if(room.state?.phase==='GAME_OVER'){this.rooms.delete(room.code);this.cacheResult(room);retired=true;}}if(retired)this.persist();}
  cacheResult(room){for(const [code,result] of this.finished)if(result.expires<=this.currentTime())this.finished.delete(code);const previous=this.finished.get(room.code);this.finished.set(room.code,{room,expires:previous?.expires||this.currentTime()+RESULT_TTL});while(this.finished.size>MAX_ROOMS)this.finished.delete(this.finished.keys().next().value);}
  findRoom(code){code=String(code||'').toUpperCase();const active=this.rooms.get(code);if(active)return active;const result=this.finished.get(code);if(result&&result.expires>this.currentTime())return result.room;this.finished.delete(code);}
  remember(room){this.saved.set(room,{fields:{...room,players:room.players.slice()},online:room.players.map(p=>p.online)});}
  checkSlots(){let count=0;for(const room of this.rooms.values())count+=room.players.filter(p=>!p.removed).length;if(count>=MAX_STREAMS)fail('SERVER_BUSY','Máy chủ đang đầy người chơi. Hãy thử lại sau.');}
  checkAdmission(source,creating=false){
    if(source===null)return; // Trusted in-process callers have no HTTP admission source.
    if(typeof source!=='string'||!/^[a-f0-9]{64}$/.test(source))throw Error('Invalid admission source');
    let rooms=0,seats=0;
    for(const room of this.rooms.values()){
      if(room.admissionSource===source)rooms++;
      for(const player of room.players)if(!player.removed&&player.admissionSource===source)seats++;
    }
    if(seats>=SOURCE_SEATS||(creating&&rooms>=SOURCE_ROOMS))fail('ADMISSION_LIMIT','Đã đạt giới hạn tạo hoặc tham gia phòng. Vui lòng thử lại sau.');
  }
  removeRoom(room){this.rooms.delete(room.code);try{this.persist();}catch(error){this.rooms.set(room.code,room);throw error;}}
  persist(changedRoom=null){this.store?.save(this.rooms.values(),changedRoom);}
  create(name,source=null){this.checkAdmission(source,true);this.checkSlots();if(this.rooms.size>=MAX_ROOMS)fail('SERVER_BUSY','Máy chủ đang đầy phòng. Hãy thử lại sau.');name=clampName(name);if(name.length<1)fail('INVALID_NAME','Nhập tên người chơi (1–24 ký tự).');let code;do{code=Array.from({length:6},()=>CODE_CHARS[this.randomInt(CODE_CHARS.length)]).join('');}while(this.findRoom(code));const player={id:uid(),name,secret:token(),online:false,admissionSource:source};const room={code,hostId:player.id,players:[player],state:null,lastActivity:this.currentTime(),deadline:null,revision:1,connections:new Map(),admissionSource:source};this.rooms.set(code,room);this.changed(room);return{room,player};}
  getRoom(code){const room=this.findRoom(code);if(!room)fail('ROOM_NOT_FOUND','Không tìm thấy phòng.');return room;}
  join(code,name,source=null){this.checkAdmission(source);this.checkSlots();const room=this.getRoom(code);if(room.state)fail('GAME_STARTED','Ván đang diễn ra. Chỉ người chơi cũ được kết nối lại.');if(this.maxPlayers!==null&&room.players.length>=this.maxPlayers)fail('ROOM_FULL',`Phòng đã đủ ${this.maxPlayers} người.`);name=clampName(name);if(!name)fail('INVALID_NAME','Nhập tên người chơi.');const player={id:uid(),name,secret:token(),online:false,admissionSource:source};room.players.push(player);this.changed(room);return{room,player};}
  authenticate(code,rawToken){const room=this.getRoom(code);if(typeof rawToken!=='string'||!/^[a-f0-9]{64}$/.test(rawToken))fail('UNAUTHORIZED','Thiếu hoặc sai phiên chơi.');const digest=Buffer.from(rawToken,'hex');const player=room.players.find(p=>!p.removed&&crypto.timingSafeEqual(Buffer.from(p.secret,'hex'),digest));if(!player)fail('UNAUTHORIZED','Không có quyền điều khiển người chơi này.');return{room,player};}
  view(room,player){return{room:{code:room.code,hostId:room.hostId,minPlayers:MIN_PLAYERS,maxPlayers:this.maxPlayers,players:room.players.map(p=>({id:p.id,name:p.name,online:p.online,...(p.removed?{removed:true}:{})})),status:room.state?'PLAYING':'LOBBY',revision:room.revision},game:room.state?projectForPlayer(room.state,player.id):null,serverTime:this.currentTime(),deadline:room.deadline};}
  changed(room){
    const previous=this.saved.get(room),wasActive=this.rooms.has(room.code);room.revision++;room.lastActivity=this.currentTime();
    if(room.state?.phase==='GAME_OVER')this.rooms.delete(room.code);
    try{this.persist(room);}catch(error){
      if(wasActive)this.rooms.set(room.code,room);
      if(previous){Object.assign(room,{...previous.fields,players:previous.fields.players.slice()});room.players.forEach((p,i)=>{p.online=previous.online[i];});}
      else this.rooms.delete(room.code);
      throw error;
    }
    if(room.state?.phase==='GAME_OVER')this.cacheResult(room);
    this.remember(room);this.onUpdate(room);
  }
  connected(room,player){if(room.state?.phase==='GAME_OVER')return;player.online=true;this.changed(room);}
  disconnected(room,player){if(room.state?.phase==='GAME_OVER')return;player.online=false;this.changed(room);}
  phaseDeadline(room){room.deadline=room.state&&room.state.phase!=='GAME_OVER'?this.currentTime()+PHASE_TIMES[room.state.phase]:null;}
  start(room,player){if(room.state)fail('GAME_STARTED','Phòng đang chơi.');if(player.id!==room.hostId)fail('HOST_ONLY','Chỉ chủ phòng được bắt đầu.');if(room.players.length<MIN_PLAYERS)fail('NOT_ENOUGH_PLAYERS','Cần ít nhất 3 người chơi.');if(!room.players.every(p=>p.online))fail('PLAYERS_OFFLINE','Tất cả người chơi cần kết nối trước khi bắt đầu.');const assigned=assignBaseRoles(room.players.map(p=>({id:p.id,name:p.name})),this.randomInt);const deck=selectProjectDeck(projects,10,this.randomInt);room.state=createGame({gameId:uid(),players:assigned,projects,deckIds:deck,roundLimit:10});this.phaseDeadline(room);this.changed(room);}
  submit(room,player,payload){if(!room.state)fail('NOT_STARTED','Chưa bắt đầu ván.');const state=room.state;if(state.phase==='DEBATE'){const text=String(payload.text??'');room.state=submitStatement(state,player.id,text,payload.stance);}else if(state.phase==='BLIND_ACTION'){room.state=lockAction(state,player.id,payload.action);this.finishLockedActions(room);}else fail('INVALID_PHASE','Không có hành động hợp lệ ở pha này.');this.changed(room);}
  finishLockedActions(room){
    if(room.state?.phase!=='BLIND_ACTION'||!activePlayers(room.state).every(p=>Object.hasOwn(room.state.lockedActions,p.id)))return;
    room.state=resolveRound(room.state,{fastForward:true});this.phaseDeadline(room);
  }
  next(room,player){if(!room.state||room.state.phase!=='REVEAL')fail('INVALID_PHASE','Chưa thể sang lượt mới.');if(player.id!==room.hostId)fail('HOST_ONLY','Chỉ chủ phòng được điều khiển lượt mới.');room.state=nextRound(room.state);this.phaseDeadline(room);this.changed(room);}
  skipDiscussion(room,player){
    if(!room.state)fail('NOT_STARTED','Chưa bắt đầu ván.');
    const previous=room.state,next=skipDiscussion(previous,player.id);
    if(next===previous)return;
    room.state=next;if(next.phase!==previous.phase)this.phaseDeadline(room);this.changed(room);
  }
  kickLobby(room,player,targetId){
    if(player.id!==room.hostId)fail('HOST_ONLY','Chỉ chủ phòng được kick người chơi.');
    if(room.state)fail('GAME_STARTED','Chỉ có thể kick người trong phòng chờ.');
    const target=room.players.find(p=>p.id===targetId);
    if(!target||target.id===player.id)fail('INVALID_TARGET','Chọn một người chơi khác trong phòng.');
    room.players=room.players.filter(p=>p.id!==target.id);
    this.changed(room);
    return target;
  }
  kick(room,player,targetId){
    if(!room.state)return this.kickLobby(room,player,targetId);
    if(player.id!==room.hostId)fail('HOST_ONLY','Chỉ chủ phòng được kick người chơi.');
    if(room.state.phase==='GAME_OVER')fail('GAME_OVER','Ván đã kết thúc.');
    const index=room.players.findIndex(p=>p.id===targetId&&!p.removed);
    if(index<0||targetId===player.id)fail('INVALID_TARGET','Chọn một người chơi khác trong phòng.');
    const target=room.players[index];
    const previousPhase=room.state.phase;
    room.state=removePlayer(room.state,targetId);
    room.players=room.players.map((p,i)=>i===index?{...p,removed:true,online:false}:p);
    if(room.state.phase==='GAME_OVER')room.deadline=null;
    else if(room.state.phase!==previousPhase)this.phaseDeadline(room);
    this.finishLockedActions(room);
    this.changed(room);
    return target;
  }
  leaveLobby(room,player){if(room.state)fail('GAME_STARTED','Khi ván đã bắt đầu, vị trí chơi được giữ lại.');room.players=room.players.filter(p=>p.id!==player.id);if(!room.players.length){try{this.removeRoom(room);}catch(error){const previous=this.saved.get(room);if(previous)Object.assign(room,{...previous.fields,players:previous.fields.players.slice()});throw error;}return;}if(player.id===room.hostId)room.hostId=room.players[0].id;this.changed(room);}
  tick(){for(const room of this.rooms.values()){if(this.currentTime()-room.lastActivity>14400000&&!room.players.some(p=>p.online)){this.removeRoom(room);continue;}if(!room.state||room.deadline===null||this.currentTime()<room.deadline)continue;if(room.state.phase==='DEBATE'){let s=room.state;for(const p of activePlayers(s))if(!Object.hasOwn(s.statements,p.id))s=submitStatement(s,p.id,'Không gửi ý kiến.','UNSURE');room.state=openBlindPhase(s);}else if(room.state.phase==='BLIND_ACTION'){let s=room.state;for(const p of activePlayers(s))if(!Object.hasOwn(s.lockedActions,p.id))s=lockAction(s,p.id,{invest:false,bankAction:{type:'NONE'}});room.state=resolveRound(s);}else if(room.state.phase==='REVEAL')room.state=nextRound(room.state);else{room.deadline=null;continue;}this.phaseDeadline(room);this.changed(room);}}
}
module.exports={RoomManager,fail};
