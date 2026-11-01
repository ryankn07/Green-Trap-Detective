'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {server}=require('../server/server.cjs');
let base;
test.before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port});
test.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r))});
test('Vietnamese display and body fonts load locally; unrelated files stay private',async()=>{
 for(const family of ['vollkorn','hanken-grotesk']){
  for(const subset of ['latin','vietnamese']){
   const response=await fetch(base+'/fonts/'+family+'-'+subset+'-wght-normal.woff2');
   assert.equal(response.status,200);
   assert.equal(response.headers.get('content-type'),'font/woff2');
   assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0,4).toString(),'wOF2');
  }
 }
 for(const pathname of ['/fonts/missing.woff2','/fonts/%2e%2e%2fserver%2fserver.cjs','/fonts/.env']){
  assert.equal((await fetch(base+pathname)).status,404);
 }
});
