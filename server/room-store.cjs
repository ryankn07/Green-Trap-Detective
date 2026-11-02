'use strict';
const fs=require('node:fs'),path=require('node:path');


// A single-process store. Put this file on a persistent volume in production.
class FileRoomStore {
  constructor(filename){this.filename=path.resolve(filename);this.encodedRooms=new WeakMap();this.directoryReady=false;}
  load(){
    let source;
    try{source=fs.readFileSync(this.filename,'utf8');}catch(error){if(error.code==='ENOENT')return [];throw error;}
    const snapshot=JSON.parse(source);
    if(snapshot.version!==1||!Array.isArray(snapshot.rooms))throw Error('Unsupported room snapshot');
    const codes=new Set();
    const validSource=value=>value===undefined||value===null||(typeof value==='string'&&/^[a-f0-9]{64}$/.test(value));
    for(const room of snapshot.rooms){
      if(!room||!/^[A-Z2-9]{6}$/.test(room.code)||codes.has(room.code)||!Array.isArray(room.players)||room.players.length<1||
         !Number.isFinite(room.lastActivity)||!Number.isInteger(room.revision)||!(room.deadline===null||Number.isFinite(room.deadline))||
         !validSource(room.admissionSource)||!room.players.some(p=>p.id===room.hostId)||room.players.some(p=>typeof p.id!=='string'||typeof p.name!=='string'||!/^[a-f0-9]{64}$/.test(p.secret)||!validSource(p.admissionSource)||(p.removed!==undefined&&typeof p.removed!=='boolean'))||
         (room.state&&room.state.version!==1))throw Error('Invalid room snapshot');
      codes.add(room.code);
    }
    return snapshot.rooms;
  }
  save(rooms,changedRoom=null){
    const pending=[],records=[];
    for(const room of rooms){
      let encoded=changedRoom&&room!==changedRoom?this.encodedRooms.get(room):null;
      if(!encoded){encoded=JSON.stringify({code:room.code,hostId:room.hostId,admissionSource:room.admissionSource,
        players:room.players.map(({id,name,secret,admissionSource,removed})=>({id,name,secret,admissionSource,...(removed?{removed:true}:{})})),
        state:room.state,lastActivity:room.lastActivity,deadline:room.deadline,revision:room.revision});pending.push([room,encoded]);}
      records.push(encoded);
    }
    const directory=path.dirname(this.filename);
    if(!this.directoryReady){fs.mkdirSync(directory,{recursive:true,mode:0o700});this.directoryReady=true;}
    const temporary=this.filename+'.tmp';
    let fd;
    try{fd=fs.openSync(temporary,'w',0o600);}catch(error){
      if(error.code!=='ENOENT')throw error;
      fs.mkdirSync(directory,{recursive:true,mode:0o700});fd=fs.openSync(temporary,'w',0o600);
    }
    try{fs.writeFileSync(fd,'{"version":1,"rooms":['+records.join(',')+']}');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(temporary,this.filename);
    // Publish cached encodings only after the durable atomic replacement succeeds.
    for(const [room,encoded] of pending)this.encodedRooms.set(room,encoded);
  }
}
module.exports={FileRoomStore};
