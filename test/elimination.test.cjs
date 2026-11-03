'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const engine=require('../engine/dist/index.js'),projects=require('../engine/dist/data/projects.json');

function eliminationRound(players=[{id:'a',name:'Mai Anh'},{id:'b',name:'Minh Quân'},{id:'c',name:'Bảo An'},{id:'d',name:'Hà Linh'},{id:'e',name:'Ngọc Lan'}],amounts=[3,2],removeContributor=false){
 const first=projects.find(project=>project.alignment==='SABOTEUR');
 let state=engine.createGame({gameId:'elimination-test',players:players.map((player,index)=>({id:player.id,name:player.name,role:index===3?'SABOTEUR':'PROTECTOR'})),projects,deckIds:[first.id,...projects.filter(project=>project.id!==first.id).slice(0,9).map(project=>project.id)]});
 state={...state,players:state.players.map((player,index)=>({...player,coins:index===2||index===4?1:5}))};
 for(const player of state.players)state=engine.submitStatement(state,player.id,'Nhận định.');
 state=engine.openBlindPhase(state);
 for(const [index,player]of state.players.entries())state=engine.lockAction(state,player.id,{invest:index===2||index===4,bankAction:index<2&&amounts[index]>0?{type:'EXPEL',targetId:players[2].id,amount:amounts[index]}:{type:'NONE'}});
 if(removeContributor)state=engine.removePlayer(state,players[1].id);
 const before=state;return {before,after:engine.resolveRound(state)};
}

test('successful expulsion records every eligible contributor and preserves bankruptcy precedence',()=>{
 const {before,after}=eliminationRound();
 const expelled=after.players.find(player=>player.id==='c'),bankrupt=after.players.find(player=>player.id==='e');
 assert.equal(expelled.eliminatedReason,'EXPELLED');assert.equal(expelled.coins,0);assert.deepEqual(expelled.eliminatedByPlayerIds,['a','b']);
 assert.equal(bankrupt.eliminatedReason,'BANKRUPT');assert.equal(bankrupt.eliminatedByPlayerIds,undefined);
 assert.equal(before.players.find(player=>player.id==='c').isAlive,true,'input state stays immutable');
});

test('an insufficient pool and a removed contributor are never falsely credited',()=>{
 const insufficient=eliminationRound(undefined,[2,2]).after.players.find(player=>player.id==='c');
 assert.equal(insufficient.eliminatedReason,'BANKRUPT');assert.equal(insufficient.eliminatedByPlayerIds,undefined);
 const removed=eliminationRound(undefined,[5,2],true).after.players.find(player=>player.id==='c');
 assert.equal(removed.eliminatedReason,'EXPELLED');assert.deepEqual(removed.eliminatedByPlayerIds,['a']);
});

test('contributor identities stay private until game over and survive later rounds and JSON storage',()=>{
 let {after}=eliminationRound();
 for(const phase of ['REVEAL','DEBATE']){
  if(phase==='DEBATE')after=engine.nextRound(after);
  for(const player of after.players){
   const view=engine.projectForPlayer(after,player.id);
   assert.ok(view.players.every(peer=>!Object.hasOwn(peer,'eliminatedByPlayerIds')&&!Object.hasOwn(peer,'eliminatedReason')));
   assert.equal(Object.hasOwn(view.myPlayer,'eliminatedByPlayerIds'),false);
  }
 }
 after=JSON.parse(JSON.stringify(after));after=engine.removePlayer(after,'d');assert.equal(after.phase,'GAME_OVER');
 const view=engine.projectForPlayer(after,'a'),victim=view.players.find(player=>player.id==='c');
 assert.deepEqual(victim.eliminatedByPlayerIds,['a','b']);assert.equal(victim.eliminatedReason,'EXPELLED');
 victim.eliminatedByPlayerIds.push('edited-client-copy');assert.deepEqual(after.players.find(player=>player.id==='c').eliminatedByPlayerIds,['a','b']);
 assert.equal(view.players.find(player=>player.id==='e').eliminatedReason,'BANKRUPT');
});

test('older final snapshots without attribution keep an honest empty contributor list',()=>{
 let {after}=eliminationRound();after=engine.removePlayer(after,'d');
 delete after.players.find(player=>player.id==='c').eliminatedByPlayerIds;
 assert.deepEqual(engine.projectForPlayer(after,'a').players.find(player=>player.id==='c').eliminatedByPlayerIds,[]);
});

test('ending roster strikes only eliminated names and shows real causes and all expellers',{
 skip:!process.env.PLAYWRIGHT_MODULE_PATH
},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH),{server,manager}=require('../server/server.cjs');
 let browser;await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const {room,player:host}=manager.create('Mai Anh');for(const name of ['Minh Quân','Bảo An','Hà Linh','Ngọc Lan'])manager.join(room.code,name);
  room.players.forEach(player=>manager.connected(room,player));
  room.state=eliminationRound(room.players).after;manager.phaseDeadline(room);manager.changed(room);
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(session=>sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(session)),{roomCode:room.code,playerId:host.id,token:host.secret});
  await page.goto('http://127.0.0.1:'+server.address().port);
  const target=page.locator('[data-player-id="'+room.players[2].id+'"]');await target.waitFor();
  assert.equal(await target.locator('.player-name').evaluate(element=>getComputedStyle(element).textDecorationLine),'line-through');
  assert.doesNotMatch(await target.locator('.person-info small').textContent(),/Mai Anh|Minh Quân/,'contributors remain hidden during reveal');
  manager.kick(room,host,room.players[3].id);await page.locator('.gi-ending-screen').waitFor();await page.locator('.gi-phase-transition').waitFor({state:'detached'});
  await page.locator('.ending-details>summary').filter({hasText:'Vai trò đã được công bố'}).click();
  await page.waitForFunction(()=>kickEffects.size===0);
  const finalTarget=page.locator('.ending-people [data-player-id="'+room.players[2].id+'"]'),bankrupt=page.locator('.ending-people [data-player-id="'+room.players[4].id+'"]'),kicked=page.locator('.ending-people [data-player-id="'+room.players[3].id+'"]');
  assert.match(await finalTarget.locator('.person-info small').textContent(),/Bị trục xuất bởi Mai Anh, Minh Quân/);
  assert.match(await bankrupt.locator('.person-info small').textContent(),/Bị loại do hết xu/);
  assert.match(await kicked.locator('.person-info small').textContent(),/Bị chủ phòng Mai Anh kick khỏi phòng/);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===1440?900:844});await finalTarget.scrollIntoViewIfNeeded();
   assert.equal(await finalTarget.locator('.player-name').evaluate(element=>getComputedStyle(element).textDecorationLine),'line-through');
   assert.equal(await finalTarget.locator('.person-info small').evaluate(element=>getComputedStyle(element).textDecorationLine),'none','cause text is not crossed out');
   assert.equal(await kicked.locator('.player-name').evaluate(element=>getComputedStyle(element).textDecorationLine),'none','host removal keeps the pencil treatment');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(process.env.BROWSER_ARTIFACT_DIR){const path=require('node:path'),fs=require('node:fs');fs.mkdirSync(process.env.BROWSER_ARTIFACT_DIR,{recursive:true});await page.locator('.ending-people').screenshot({path:path.join(process.env.BROWSER_ARTIFACT_DIR,'ELIMINATION_ROSTER_'+width+'.png')});}
  }
  await page.reload();await page.locator('.gi-ending-screen').waitFor();await page.locator('.ending-details>summary').filter({hasText:'Vai trò đã được công bố'}).click();
  assert.match(await finalTarget.locator('.person-info small').textContent(),/Bị trục xuất bởi Mai Anh, Minh Quân/,'cached results retain attribution');
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
