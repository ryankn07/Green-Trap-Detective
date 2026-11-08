'use strict';
const {randomUUID}=require('node:crypto');
const AVATARS=Array.from({length:30},(_,i)=>'a'+String(i+1).padStart(2,'0'));
const ITEMS=['rock','brick','flowers','water','tomato','egg','snow','confetti','leafstorm','vine','bubbles'];
function avatarFor(player){
  return AVATARS.includes(player.avatarId)?player.avatarId:AVATARS[parseInt(player.id.replace(/-/g,'').slice(-4),16)%AVATARS.length||0];
}
function updateAvatar(manager,room,player,avatarId){
  if(room.state)managerError('INVALID_PHASE','Đổi avatar trong phòng chờ nhé.');
  if(!AVATARS.includes(avatarId))managerError('INVALID_AVATAR','Avatar không hợp lệ.');
  room.players=room.players.map(p=>p.id===player.id?{...p,avatarId}:p);
  manager.changed(room);
}
function managerError(code,message){const error=Error(message);Object.assign(error,{code,public:true});throw error;}
function react(manager,room,player,targetId,kind,requestId){
  if(room.state)managerError('INVALID_PHASE','Tương tác này dành cho phòng chờ.');
  if(!ITEMS.includes(kind)||targetId===player.id||!room.players.some(p=>p.id===targetId&&!p.removed))
    managerError('INVALID_TARGET','Chọn một người khác trong phòng.');
  if(typeof requestId!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(requestId))
    managerError('INVALID_REQUEST','Thiếu mã tương tác.');
  const now=manager.currentTime(),social=room.social||{events:[],last:{}};
  const previous=social.last[player.id];
  if(previous?.requestId===requestId){
    if(previous.targetId!==targetId||previous.kind!==kind)managerError('INVALID_REQUEST','Mã tương tác đã được sử dụng.');
    return;
  }
  if(previous&&now-previous.at<1200)managerError('REACTION_COOLDOWN','Chờ một chút rồi tương tác tiếp nhé.');
  const event={id:randomUUID(),from:player.id,to:targetId,kind,at:now};
  const members=new Set(room.players.filter(p=>!p.removed).map(p=>p.id));
  const last=Object.fromEntries(Object.entries(social.last).filter(([id])=>members.has(id)));
  room.social={
    events:[...social.events.filter(e=>now-e.at<15000),event].slice(-48),
    last:{...last,[player.id]:{requestId,targetId,kind,at:now}}
  };
  manager.changed(room);
}
module.exports={AVATARS,ITEMS,avatarFor,updateAvatar,react};
