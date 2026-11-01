'use strict';
// Opt-in local HTTP/SSE load check, using temporary persistence and real game rules.
const assert=require('node:assert/strict'),os=require('node:os'),fs=require('node:fs'),path=require('node:path');
const {performance,monitorEventLoopDelay}=require('node:perf_hooks');
const {server,manager}=require('../server/server.cjs');
const {FileRoomStore}=require('../server/room-store.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gi-load-'));
manager.store=new FileRoomStore(path.join(dir,'rooms.json'));
let now=Date.now();manager.currentTime=()=>now;
let base;const controllers=[],readers=[];let bytes=0;
async function post(route,body,session){
 const response=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.token,'x-room-code':session.roomCode}:{})},body:JSON.stringify(body)});
 const value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;
}
function privacy(s){
 assert.ok(s.room.players.every(p=>!('secret'in p)));
 assert.ok(s.game.players.every(p=>!('coins'in p)&&!('lockedAction'in p)&&!('inspections'in p)));
 if(s.game.phase!=='GAME_OVER')assert.ok(s.game.players.every(p=>!('role'in p)));
 if(['DEBATE','BLIND_ACTION'].includes(s.game.phase))assert.equal('alignment'in s.game.project,false);
}
async function waitFor(check){const end=performance.now()+10000;while(!check()){assert.ok(performance.now()<end,'snapshot timeout');await new Promise(r=>setTimeout(r,1));}}
async function connect(session){
 const controller=new AbortController();controllers.push(controller);
 const response=await fetch(base+'/api/stream?room='+session.roomCode,{headers:{Authorization:'Bearer '+session.token},signal:controller.signal});
 assert.equal(response.status,200);const client={session,latest:null};
 const reading=(async()=>{let buffer='';const decoder=new TextDecoder();try{for await(const chunk of response.body){bytes+=chunk.byteLength;buffer+=decoder.decode(chunk,{stream:true});let end;while((end=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=frame.match(/^data: (.+)$/m);if(data&&frame.includes('event: snapshot')){client.latest=JSON.parse(data[1]);if(client.latest.game)privacy(client.latest);}}}}catch(e){if(!controller.signal.aborted)throw e;}})();reading.catch(()=>{});readers.push(reading);
 await waitFor(()=>client.latest);return client;
}
async function scenario(count,players){
 const lag=monitorEventLoopDelay({resolution:10});lag.enable();const cpu=process.cpuUsage(),start=performance.now(),startBytes=bytes;
 const groups=[];
 for(let r=0;r<count;r++){
  const sessions=[await post('/api/create',{name:'Host '+r})];
  for(let p=1;p<players;p++)sessions.push(await post('/api/join',{roomCode:sessions[0].roomCode,name:'Player '+p}));
  const clients=[];for(const s of sessions)clients.push(await connect(s));
  await post('/api/action',{type:'start'},sessions[0]);
  await waitFor(()=>clients.every(c=>c.latest.game?.phase==='DEBATE'));
  groups.push(clients);
 }
 const timings=[];
 async function submit(client,payload){
  const g=client.latest.game,context={gameId:g.gameId,round:g.round,phase:g.phase},begin=performance.now();
  await post('/api/action',{type:'submit',context,payload},client.session);
  await waitFor(()=>context.phase==='DEBATE'?client.latest.game.currentStatements.some(s=>s.playerId===client.session.playerId):client.latest.game.myPlayer.lockedAction!==null);
  timings.push(performance.now()-begin);
 }
 for(let round=1;round<=10;round++){
  await Promise.all(groups.flatMap(cs=>cs.map(c=>submit(c,{text:'Nhận định kiểm thử '+round,stance:'UNSURE'}))));
  now=Math.max(...groups.map(cs=>manager.getRoom(cs[0].session.roomCode).deadline));manager.tick();
  await waitFor(()=>groups.every(cs=>cs.every(c=>c.latest.game.phase==='BLIND_ACTION')));
  await Promise.all(groups.flatMap(cs=>cs.map(c=>submit(c,{action:{invest:false,bankAction:{type:'NONE'}}}))));
  now=Math.max(...groups.map(cs=>manager.getRoom(cs[0].session.roomCode).deadline));manager.tick();
  await waitFor(()=>groups.every(cs=>cs.every(c=>['REVEAL','GAME_OVER'].includes(c.latest.game.phase))));
  for(const cs of groups)for(const c of cs){assert.equal(c.latest.game.history.at(-1).requiredVotes,Math.ceil(players/2));assert.equal(c.latest.game.myPlayer.coins,2);}
  if(round<10){now=Math.max(...groups.map(cs=>manager.getRoom(cs[0].session.roomCode).deadline));manager.tick();await waitFor(()=>groups.every(cs=>cs.every(c=>c.latest.game.phase==='DEBATE'&&c.latest.game.round===round+1)));}
 }
 for(const cs of groups)assert.ok(cs.every(c=>c.latest.game.phase==='GAME_OVER'&&c.latest.game.history.length===10));
 // HD asset traffic, alongside connected players; source must retain native size.
 await Promise.all(Array.from({length:12},async(_,i)=>{const r=await fetch(base+'/cards-hd/PROJ_'+String(i+1).padStart(2,'0')+'.png');assert.equal(r.status,200);const b=Buffer.from(await r.arrayBuffer());assert.equal(b.readUInt32BE(16),1414);}));
 timings.sort((a,b)=>a-b);lag.disable();const used=process.cpuUsage(cpu);
 return {rooms:count,players:count*players,playersPerRoom:players,rounds:10,commands:timings.length,seconds:(performance.now()-start)/1000,p50Ms:timings[Math.floor(timings.length*.5)],p95Ms:timings[Math.floor(timings.length*.95)],eventLoopP95Ms:lag.percentile(95)/1e6,rssMiB:process.memoryUsage().rss/1048576,cpuMs:(used.user+used.system)/1000,sseBytes:bytes-startBytes};
}
(async()=>{
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
  const results=[];
  const sizes=process.env.LOAD_SIZES?JSON.parse(process.env.LOAD_SIZES):[[1,12],[5,12]];
  for(const [count,players] of sizes){
   results.push(await scenario(count,players));
   controllers.splice(0).forEach(c=>c.abort());await Promise.all(readers.splice(0));
  }
  const report={node:process.version,platform:process.platform,cpus:os.cpus().length,cpu:os.cpus()[0].model,persistence:'temporary synchronous FileRoomStore, fsync enabled',results};
  console.log(JSON.stringify(report,null,2));
  if(process.env.LOAD_REPORT)fs.writeFileSync(process.env.LOAD_REPORT,JSON.stringify(report,null,2));
  assert.ok(results.every(r=>r.p95Ms<1000),'p95 must remain below one second');
 }finally{controllers.forEach(c=>c.abort());await Promise.allSettled(readers);server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
