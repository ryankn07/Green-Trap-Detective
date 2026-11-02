'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {SSEParser,options,run}=require('../scripts/soak-http.cjs');
test('SSE handles UTF8, CRLF, comments, multiline and arbitrary chunks',()=>{
 const frames=[],p=new SSEParser(x=>frames.push(x));
 const b=Buffer.from(': heartbeat\r\nevent: snapshot\r\ndata: {"text":\r\ndata: "Việt"}\r\n\r\n');
 for(const byte of b)p.push(Buffer.from([byte]));
 assert.equal(frames.length,1);assert.equal(JSON.parse(frames[0].data).text,'Việt');
});
test('defaults and external target require explicit consent',()=>{
 assert.equal(options([]).duration,600);assert.equal(options([]).sessions,50);
 assert.throws(()=>options(['--base-url','https://example.com']));
 assert.throws(()=>options(['--duration','0']));
});
test('real child survives restart; steady duration excludes setup; report redacts state', {timeout:30000}, async()=>{
 const r=await run({duration:2,sessions:3,restartAt:0.7,interval:100,timeout:4000,backoff:30,retries:3});
 assert.equal(r.ok,true);assert.ok(r.steadySeconds>=2);assert.equal(r.restarts,1);
 assert.equal(r.recoveryVerified,3);assert.ok(r.snapshots>=3);assert.ok(r.operations.submit>=3);
 assert.ok(!/token|Bearer|Nhận định|myPlayer|secret/.test(JSON.stringify(r)));
});
for(const fault of ['stream','health'])test(fault+' failure cannot false-pass',{timeout:15000},async()=>{
 const r=await run({duration:1,sessions:3,interval:50,timeout:500,backoff:10,retries:1,testFault:fault});
 assert.equal(r.ok,false);assert.ok(r.failures.length>0);
});
