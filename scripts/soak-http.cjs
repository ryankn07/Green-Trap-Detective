'use strict';
// No application modules are imported: all gameplay goes through HTTP/SSE.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process'),net=require('node:net');
const {performance}=require('node:perf_hooks');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
class SSEParser {
 constructor(emit){this.emit=emit;this.decoder=new TextDecoder();this.buffer='';this.event='message';this.data=[];}
 push(chunk){this.buffer+=this.decoder.decode(chunk,{stream:true});if(this.buffer.length>2e6)throw Error('SSE_FRAME_LIMIT');
 let m;while((m=/\r\n|\r(?!$)|\n/.exec(this.buffer))){const line=this.buffer.slice(0,m.index);this.buffer=this.buffer.slice(m.index+m[0].length);
 if(!line){if(this.data.length)this.emit({event:this.event,data:this.data.join('\n')});this.event='message';this.data=[];continue;}
 if(line.startsWith(':'))continue;const i=line.indexOf(':');const key=i<0?line:line.slice(0,i),v=i<0?'':line.slice(i+1).replace(/^ /,'');if(key==='event')this.event=v;if(key==='data')this.data.push(v);
 }}
}
function options(args){const o={duration:600,sessions:50,interval:1000,timeout:10000,retries:4,backoff:250};
 const keys={'--duration':'duration','--sessions':'sessions','--restart-at':'restartAt','--base-url':'baseURL','--report':'report'};
 for(let i=0;i<args.length;i++){if(args[i]==='--allow-external'){o.allowExternal=true;continue;}const k=keys[args[i]];if(!k||!args[i+1])throw Error('INVALID_OPTION');o[k]=['baseURL','report'].includes(k)?args[++i]:Number(args[++i]);}
 for(const k of ['duration','sessions'])if(!Number.isFinite(o[k])||o[k]<=0)throw Error('INVALID_'+k);
 if(!Number.isInteger(o.sessions)||o.sessions<3)throw Error('INVALID_sessions');
 if(o.restartAt!==undefined&&(!Number.isFinite(o.restartAt)||o.restartAt<=0||o.restartAt>=o.duration))throw Error('INVALID_RESTART_TIME');
 if(o.baseURL&&(!o.allowExternal||o.restartAt!==undefined))throw Error('EXTERNAL_REQUIRES_OPT_IN_NO_RESTART');
 if(o.baseURL&&!/^https?:$/.test(new URL(o.baseURL).protocol))throw Error('INVALID_URL');return o;
}
const quantiles=a=>{const b=a.slice().sort((x,y)=>x-y);return{count:b.length,p50Ms:b.length?b[Math.floor((b.length-1)*.5)]:null,p95Ms:b.length?b[Math.floor((b.length-1)*.95)]:null,maxMs:b.length?b.at(-1):null};};
async function run(config={}){
 const o={...options([]),...config},r={ok:false,sessions:o.sessions,requestedSeconds:o.duration,steadySeconds:0,operations:{},snapshots:0,reconnects:0,unexpectedDisconnects:0,intentionalDisconnects:0,revisionRegressions:0,restarts:0,recoveryVerified:0,healthChecks:0,failures:[]};
 const http=[],confirm=[],clients=[];let base=o.baseURL,child,dir,stopping=false,start,paused=0;
 const fail=code=>{if(!r.failures.includes(code))r.failures.push(code);};
 async function request(route,body,session){const begin=performance.now();try{
 const res=await fetch(base+route,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(session?{Authorization:'Bearer '+session.token,'x-room-code':session.roomCode}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(o.timeout)});
 if(!res.ok)throw Error('HTTP_'+res.status);return await res.json();
 }finally{http.push(performance.now()-begin);}}
 async function wait(check,code){const until=performance.now()+o.timeout;while(!check()){if(performance.now()>until||r.failures.length)throw Error(code);await delay(10);}}
 // Only a narrowly constructed child environment is passed; no credentials/Supabase bindings.
 async function startChild(){child=spawn(process.execPath,[path.resolve(__dirname,'../server/server.cjs')],{env:{PATH:process.env.PATH,PORT:String(o.port),ROOM_STORE_PATH:path.join(dir,'rooms.json')},stdio:'ignore'});child.on('error',()=>fail('CHILD_SPAWN'));const until=performance.now()+o.timeout;for(;;){try{await request('/health');return;}catch{if(performance.now()>until||child.exitCode!==null)throw Error('CHILD_START');await delay(50);}}}
 async function killChild(){if(!child||child.exitCode!==null)return;const proc=child;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{proc.kill('SIGKILL');reject(Error('CHILD_STOP_TIMEOUT'));},o.timeout);proc.once('exit',()=>{clearTimeout(timer);resolve();});proc.kill('SIGTERM');});}
 async function stream(c){let attempts=0;
 while(!stopping&&!c.closed){const controller=new AbortController();c.controller=controller;c.live=false;let timer;
 try{
 timer=setTimeout(()=>controller.abort(),o.timeout);
 const res=await fetch(base+'/api/stream?room='+c.session.roomCode,{headers:{Authorization:'Bearer '+c.session.token},signal:controller.signal});clearTimeout(timer);
 if(!res.ok)throw Error('STREAM_HTTP');c.live=true;c.lastByte=performance.now();
 const parser=new SSEParser(frame=>{if(frame.event!=='snapshot')return;const s=JSON.parse(frame.data),rev=s.room.revision;
 if(!Number.isInteger(rev))throw Error('REVISION_MISSING');if(c.revision!==undefined&&rev<c.revision){r.revisionRegressions++;throw Error('REVISION_REGRESSION');}
 c.revision=rev;c.latest=s;r.snapshots++;});
 for await(const b of res.body){c.lastByte=performance.now();parser.push(b);if(o.testFault==='stream'&&start)throw Error('INJECTED_STREAM');}
 throw Error('STREAM_EOF');
 }catch{if(!stopping&&!c.closed){r.unexpectedDisconnects++;if(++attempts>o.retries){fail('STREAM_RETRIES_EXHAUSTED');break;}r.reconnects++;await delay(o.backoff*2**(attempts-1));}}
 finally{clearTimeout(timer);controller.abort();c.live=false;}
 }}
 async function connect(c){c.closed=false;c.latest=null;c.task=stream(c);await wait(()=>c.live&&c.latest,'STREAM_READY');}
 async function closeStreams(){for(const c of clients){c.closed=true;r.intentionalDisconnects++;c.controller?.abort();}await Promise.all(clients.map(c=>c.task));}
 async function act(c){const g=c.latest?.game;if(!g)return;const key=g.gameId+':'+g.round+':'+g.phase;if(c.sent===key)return;
 let payload,predicate;if(g.phase==='DEBATE'&&!g.currentStatements.some(s=>s.playerId===c.session.playerId)){
 payload={text:'Nhận định kiểm thử tải',stance:'UNSURE'};predicate=s=>s?.game?.currentStatements.some(x=>x.playerId===c.session.playerId);
 }else if(g.phase==='BLIND_ACTION'&&g.myPlayer.lockedAction===null){payload={action:{invest:false,bankAction:{type:'NONE'}}};predicate=s=>s?.game?.myPlayer.lockedAction!==null;
 }else return;
 const begin=performance.now();await request('/api/action',{type:'submit',context:{gameId:g.gameId,round:g.round,phase:g.phase},payload},c.session);r.operations.submit=(r.operations.submit||0)+1;c.sent=key;
 await wait(()=>c.live&&c.latest?.game?.gameId===g.gameId&&c.latest.game.round===g.round&&predicate(c.latest),'SENDER_CONFIRMATION_TIMEOUT');confirm.push(performance.now()-begin);
 }
 try{
 if(!base){dir=fs.mkdtempSync(path.join(os.tmpdir(),'ee-soak-'));o.port=await new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});base='http://127.0.0.1:'+o.port;await startChild();}
 // One room avoids room-creation admission quotas; all sessions use the same real game.
 const host=await request('/api/create',{name:'Soak host'});clients.push({session:host});
 for(let i=1;i<o.sessions;i++)clients.push({session:await request('/api/join',{roomCode:host.roomCode,name:'Soak '+i})});
 for(const c of clients)await connect(c);
 await request('/api/action',{type:'start'},host);await wait(()=>clients.every(c=>c.latest?.game),'GAME_START');
 start=performance.now();
 while(performance.now()-start-paused<o.duration*1000){
 if(r.failures.length)throw Error('STREAM_FAILURE');
 if(o.restartAt!==undefined&&!r.restarts&&(performance.now()-start)/1000>=o.restartAt){
 const pauseStart=performance.now();const before=clients.map(c=>({revision:c.revision,gameId:c.latest.game.gameId,round:c.latest.game.round,phase:c.latest.game.phase,locked:JSON.stringify(c.latest.game.myPlayer.lockedAction)}));
 await closeStreams();await killChild();await startChild();
 for(let i=0;i<clients.length;i++){const c=clients[i],s=await request('/api/state',null,c.session),b=before[i];if(s.room.revision<b.revision||s.game.gameId!==b.gameId||s.game.round!==b.round||s.game.phase!==b.phase||JSON.stringify(s.game.myPlayer.lockedAction)!==b.locked)throw Error('RECOVERY_STATE_MISMATCH');r.recoveryVerified++;await connect(c);r.reconnects++;}
 r.restarts++;paused+=performance.now()-pauseStart;
 }
 if(o.testFault==='stream')for(const c of clients)c.controller.abort();
 if(o.testFault==='health')throw Error('HEALTH_FAILURE');
 const health=await request('/health');r.healthChecks++;if(health.status!=='ok')throw Error('HEALTH_FAILURE');
 for(const c of clients)if(!c.live||performance.now()-c.lastByte>20000)throw Error('STREAM_NOT_LIVE');
 await Promise.all(clients.map(act));
 await delay(Math.min(o.interval,Math.max(0,o.duration*1000-(performance.now()-start-paused))));
 }
 // End-of-window liveness is mandatory, including a fresh authenticated snapshot.
 if(r.failures.length||clients.some(c=>!c.live))throw Error('FINAL_STREAM_NOT_LIVE');
 await Promise.all(clients.map(c=>request('/api/state',null,c.session)));
 r.steadySeconds=(performance.now()-start-paused)/1000;r.ok=r.failures.length===0&&r.steadySeconds>=o.duration;
 }catch(e){fail(/^[A-Z][A-Z_0-9]+$/.test(e.message)?e.message:'TRANSPORT_OR_PROTOCOL_FAILURE');if(start)r.steadySeconds=(performance.now()-start-paused)/1000;}
 finally{stopping=true;await closeStreams();try{await killChild();}catch{fail('CLEANUP_FAILURE');}if(dir)fs.rmSync(dir,{recursive:true,force:true});if(r.failures.length)r.ok=false;}
 r.httpLatency=quantiles(http);r.senderSnapshotLatency=quantiles(confirm);return r;
}
module.exports={SSEParser,options,run};
if(require.main===module)(async()=>{try{const o=options(process.argv.slice(2)),r=await run(o),json=JSON.stringify(r,null,2);if(o.report)fs.writeFileSync(o.report,json+'\n',{flag:'wx'});console.log(json);if(!r.ok)process.exitCode=1;}catch{console.error(JSON.stringify({ok:false,failures:['CONFIGURATION_OR_REPORT_ERROR']}));process.exitCode=1;}})();
