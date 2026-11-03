'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {server}=require('../server/server.cjs');
const ending=require('../ui/ending-ui.js');
const {createGame,submitStatement,openBlindPhase,lockAction,resolveRound,nextRound,projectForPlayer}=require('../engine/dist/index.js');
const projects=require('../engine/dist/data/projects.json');
let base;
test.before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});

test('ending media streams exact partial bytes, seeks and bounds malformed ranges',async()=>{
 for(const name of ['good','bad']){
  const bytes=fs.readFileSync(path.join(__dirname,'../ui/endings',name+'.mp4'));
  let response=await fetch(base+'/endings/'+name+'.mp4',{headers:{Range:'bytes=1024-2047'}});
  assert.equal(response.status,206);assert.equal(response.headers.get('content-type'),'video/mp4');assert.equal(response.headers.get('content-length'),'1024');
  assert.equal(response.headers.get('content-range'),`bytes 1024-2047/${bytes.length}`);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes.subarray(1024,2048));
  response=await fetch(base+'/endings/'+name+'.mp4',{headers:{Range:'bytes=-32'}});assert.equal(response.status,206);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes.subarray(-32));
  response=await fetch(base+'/endings/'+name+'.mp4',{headers:{Range:`bytes=${bytes.length-32}-`}});assert.equal(response.status,206);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes.subarray(-32));
  response=await fetch(base+'/endings/'+name+'.mp4',{method:'HEAD'});assert.equal(response.status,200);assert.equal(response.headers.get('content-length'),String(bytes.length));assert.equal((await response.arrayBuffer()).byteLength,0);
  for(const range of ['bytes=1-0','bytes=-0','bytes=-','bytes=999999999-','bytes=0-1,4-5','items=0-10']){
   response=await fetch(base+'/endings/'+name+'.mp4',{headers:{Range:range}});assert.equal(response.status,416,range);assert.equal(response.headers.get('content-range'),'bytes */'+bytes.length);await response.arrayBuffer();
  }
 }
});
test('ending page and posters are public; removed QR assets and private files stay inaccessible',async()=>{
 for(const file of ['/ending.html','/ending-ui.js','/ending.css','/endings/good-poster.jpg','/endings/bad-poster.jpg']){
  const response=await fetch(base+file);assert.equal(response.status,200,file);await response.arrayBuffer();
 }
 for(const file of ['/qr-code.js','/endings/secret.mp4','/endings/good.mp4.bak','/endings/../server/server.cjs','/endings/%2e%2e%2fserver%2fserver.cjs','/endings/rooms.json']){
  const response=await fetch(base+file);assert.equal(response.status,404,file);await response.arrayBuffer();
 }
});
function terminal(winner){
 const alignment=winner==='PROTECTOR'?'PROTECTOR':'SABOTEUR';
 const front=projects.filter(p=>p.alignment===alignment).slice(0,2).map(p=>p.id),deck=[...front,...projects.filter(p=>!front.includes(p.id)).slice(0,8).map(p=>p.id)];
 let state=createGame({gameId:'ending-test',players:[{id:'a',name:'A',role:'PROTECTOR'},{id:'b',name:'B',role:'PROTECTOR'},{id:'c',name:'C',role:'SABOTEUR'}],projects,deckIds:deck});
 while(state.phase!=='GAME_OVER'){
  for(const p of state.players.filter(p=>p.isAlive))state=submitStatement(state,p.id,'Nhận định');state=openBlindPhase(state);
  for(const p of state.players.filter(p=>p.isAlive))state=lockAction(state,p.id,{invest:winner!=='DRAW'&&p.role!==alignment,bankAction:{type:'NONE'}});
  state=resolveRound(state);if(state.phase!=='GAME_OVER')state=nextRound(state);
 }
 return {room:{players:state.players},game:projectForPlayer(state,'a')};
}
test('film follows authoritative faction winner, including a good ending with tied approval totals',()=>{
 for(const [winner,film] of [['PROTECTOR','good'],['SABOTEUR','bad']]){
  const snapshot=terminal(winner);assert.equal(snapshot.game.outcome.winner,winner);if(winner==='PROTECTOR'){assert.equal(snapshot.game.approvedProtectorCount,0);assert.equal(snapshot.game.approvedSaboteurCount,0);}
  const html=ending.render(snapshot,'');assert.ok(html.includes(`src="/endings/${film}.mp4"`));assert.ok(!html.includes(`src="/endings/${film==='good'?'bad':'good'}.mp4"`));assert.doesNotMatch(html,/data-ending-qr|ending-scan|ending-qr|Quét mã|camera/i);
  for(const turn of snapshot.game.history)assert.equal(turn.alignment,winner);
  assert.doesNotMatch(html,/ending-projects|DẤU VẾT CỦA VÁN CHƠI|Những lá thẻ cùng tương lai/);
  const explanation=snapshot.game.history.at(-1).explanation.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));assert.ok(html.includes(explanation));
 }
 const draw=ending.render(terminal('DRAW'),'');assert.ok(draw.includes('HÒA'));assert.ok(!draw.includes('<video'));assert.ok(!draw.includes('data-ending-qr'));
});
test('catalog ending links follow all 25 original project alignments and remain absent from pre-reveal projection',()=>{
 assert.equal(projects.length,25);
 for(const p of projects)assert.equal(p.endingVideoUrl,`/ending.html?ending=${p.alignment==='PROTECTOR'?'good':'bad'}&project=${p.id}`);
 const snapshot=terminal('PROTECTOR');snapshot.game.history[0].projectTitle='<img src=x onerror=alert(1)>';
 const html=ending.render(snapshot,'');assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img src=x'));
 const state=createGame({gameId:'private',players:[{id:'a',name:'A',role:'PROTECTOR'},{id:'b',name:'B',role:'PROTECTOR'},{id:'c',name:'C',role:'SABOTEUR'}],projects,deckIds:projects.slice(0,10).map(p=>p.id)});
 assert.equal(Object.hasOwn(projectForPlayer(state,'a').project,'endingVideoUrl'),false);
});
