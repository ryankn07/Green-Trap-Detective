'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {server,manager}=require('../server/server.cjs');
let base;
test.before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
test('HTTP clients cannot change source ownership using JSON or spoofed forwarding headers',async()=>{
 const {createHash}=require('node:crypto');
 const source=createHash('sha256').update('127.0.0.1').digest('hex');
 const {room}=manager.create('Seed',source);
 for(let i=1;i<299;i++)manager.join(room.code,'Seat '+i,source);
 const join=i=>fetch(base+'/api/join',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'203.0.113.'+i},body:JSON.stringify({roomCode:room.code,name:'Join '+i,admissionSource:null,source:'other-network'})});
 assert.equal((await join(1)).status,200);
 const denied=await join(2);assert.equal(denied.status,429);assert.equal((await denied.json()).error,'ADMISSION_LIMIT');
 const create=await fetch(base+'/api/create',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-For':'203.0.113.99'},body:JSON.stringify({name:'Bypass',admissionSource:'other'})});
 assert.equal(create.status,429);assert.equal(manager.rooms.size,1);
});
