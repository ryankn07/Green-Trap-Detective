'use strict';
const fs=require('node:fs'),path=require('node:path');


// A single-process store. Put this file on a persistent volume in production.
class FileRoomStore {
  constructor(filename){this.filename=path.resolve(filename);}
  load(){
    let source;
    try{source=fs.readFileSync(this.filename,'utf8');}catch(error){if(error.code==='ENOENT')return [];throw error;}
    const snapshot=JSON.parse(source);
    if(snapshot.version!==1||!Array.isArray(snapshot.rooms))throw Error('Unsupported room snapshot');
    const codes=new Set();
    for(const room of snapshot.rooms){
      if(!room||!/^[A-Z2-9]{6}$/.test(room.code)||codes.has(room.code)||!Array.isArray(room.players)||room.players.length<1||
         !Number.isFinite(room.lastActivity)||!Number.isInteger(room.revision)||!(room.deadline===null||Number.isFinite(room.deadline))||
         !room.players.some(p=>p.id===room.hostId)||room.players.some(p=>typeof p.id!=='string'||typeof p.name!=='string'||!/^[a-f0-9]{64}$/.test(p.secret))||
         (room.state&&room.state.version!==1))throw Error('Invalid room snapshot');
      codes.add(room.code);
    }
    return snapshot.rooms;
  }
  save(rooms){
    const records=[...rooms].map(room=>({code:room.code,hostId:room.hostId,
      players:room.players.map(({id,name,secret})=>({id,name,secret})),
      state:room.state,lastActivity:room.lastActivity,deadline:room.deadline,revision:room.revision}));
    fs.mkdirSync(path.dirname(this.filename),{recursive:true,mode:0o700});
    const temporary=this.filename+'.tmp';
    const fd=fs.openSync(temporary,'w',0o600);
    try{fs.writeFileSync(fd,JSON.stringify({version:1,rooms:records}));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(temporary,this.filename);
  }
}
module.exports={FileRoomStore};
