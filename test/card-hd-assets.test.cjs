'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {server}=require('../server/server.cjs');
let base;
test.before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port});
test.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r))});
test('native high-resolution exports exist for all 25 project cards while original URLs stay intact',async()=>{
 for(let i=1;i<=25;i++){
  const id='PROJ_'+String(i).padStart(2,'0');
  const r=await fetch(base+'/cards-hd/'+id+'.png');assert.equal(r.status,200,id);
  assert.equal(r.headers.get('content-type'),'image/png');
  const b=Buffer.from(await r.arrayBuffer());assert.equal(b.subarray(1,4).toString(),'PNG');
  assert.ok(b.readUInt32BE(16)>=1200,id+' needs enough native pixels for the desktop card');
  assert.ok(b.readUInt32BE(20)>=1900,id+' must retain full card height');
 }
 const original=await fetch(base+'/cards/PROJ_01.png');
 assert.deepEqual(Buffer.from(await original.arrayBuffer()),fs.readFileSync(path.join(__dirname,'../ui/cards/PROJ_01.png')));
 for(const bad of ['/cards-hd/PROJ_00.png','/cards-hd/PROJ_26.png','/cards-hd/%2e%2e%2fserver%2fserver.cjs'])assert.equal((await fetch(base+bad)).status,404);
});
