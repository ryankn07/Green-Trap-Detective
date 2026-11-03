'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const engine=require('../engine/dist/index.js'),projects=require('../engine/dist/data/projects.json');

function resolve(players,mode='vote'){
 const first=projects.find(project=>project.alignment==='SABOTEUR');
 let state=engine.createGame({gameId:'vote-effect-'+players[0].id,players:players.map((player,index)=>({id:player.id,name:player.name,role:index===3?'SABOTEUR':'PROTECTOR'})),projects,deckIds:[first.id,...projects.filter(project=>project.id!==first.id).slice(0,9).map(project=>project.id)]});
 state={...state,players:state.players.map((player,index)=>({...player,coins:mode==='bankrupt'&&index===2?1:10}))};
 for(const player of state.players)state=engine.submitStatement(state,player.id,'Nhận định test.');state=engine.openBlindPhase(state);
 for(const [index,player]of state.players.entries())state=engine.lockAction(state,player.id,{invest:mode==='bankrupt'&&index===2,bankAction:mode==='bankrupt'||index>0&&!(mode==='multiple'&&index===1)?{type:'NONE'}:{type:'EXPEL',targetId:players[mode==='terminal'?3:mode==='multiple'&&index===1?4:2].id,amount:5}});
 return {before:state,after:engine.resolveRound(state)};
}

test('public resolution exposes successful vote targets without contributor identities or amounts',()=>{
 const players=['a','b','c','d','e','f','g'].map(id=>({id,name:id}));
 const {before,after}=resolve(players,'multiple'),view=engine.projectForPlayer(after,'f');
 assert.equal(after.phase,'REVEAL');assert.deepEqual(view.history.at(-1).expelledPlayerIds,['c','e']);
 assert.deepEqual(engine.projectForPlayer(before,'f').history,[]);
 assert.ok(view.players.every(player=>!Object.hasOwn(player,'eliminatedByPlayerIds')&&!Object.hasOwn(player,'eliminatedReason')));
 assert.ok(!JSON.stringify(view.history).includes('eliminatedByPlayerIds'));
 const bankrupt=resolve(players,'bankrupt').after;assert.deepEqual(engine.projectForPlayer(bankrupt,'f').history.at(-1).expelledPlayerIds,[]);
});

test('vote-out motion runs on the live board after reveal, once per result, on PC and mobile',{
 skip:!process.env.PLAYWRIGHT_MODULE_PATH
},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH),{server,manager}=require('../server/server.cjs');
 let browser;const errors=[];await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const create=async(width,mode='vote')=>{
   const {room,player:host}=manager.create('Mai Anh');for(const name of ['Minh Quân','Bảo An','Hà Linh','Ngọc Lan','Thanh','Linh'])manager.join(room.code,name);room.players.forEach(player=>manager.connected(room,player));
   const states=resolve(room.players,mode);room.state=states.before;manager.phaseDeadline(room);manager.changed(room);
   const page=await browser.newPage({viewport:{width,height:width===1440?900:844},reducedMotion:'reduce'});page.on('pageerror',error=>errors.push(error.message));
   await page.addInitScript(session=>sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(session)),{roomCode:room.code,playerId:host.id,token:host.secret});
   await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('.gi-area-project').waitFor();
   return {page,room,host,...states};
  };
  for(const width of [1440,390]){
   const {page,room,host,after}=await create(width,'multiple'),ids=[room.players[2].id,room.players[4].id];
   const heights=await page.evaluate(ids=>ids.map(id=>document.querySelector('[data-player-id="'+id+'"]').offsetHeight),ids);
   room.state=after;manager.phaseDeadline(room);manager.changed(room);
   await page.locator('.gi-phase-transition[data-phase=REVEAL]').waitFor();
   assert.equal(await page.locator('.gi-elimination-fx').count(),2);
   assert.equal(await page.locator('[data-elimination-state=running]').count(),0,'phase introduction does not hide the vote-out motion');
   await page.locator('.gi-phase-transition').waitFor({state:'detached'});await page.locator('[data-elimination-state=running]').first().waitFor();
   assert.equal(await page.locator('[data-elimination-state=running]').count(),2);
   const started=await page.evaluate(()=>[...eliminationEffects.values()].map(effect=>effect.started));
   for(const [index,id]of ids.entries()){
    const tile=page.locator('.gi-area-players [data-player-id="'+id+'"]');
    assert.equal(await tile.locator('.gi-elim-strike path').evaluate(element=>getComputedStyle(element).animationName),'gi-elim-line');
    assert.ok(await tile.evaluate((element,height)=>element.offsetHeight>=height,heights[index]),'the animated player row never collapses or clips its controls');
    assert.doesNotMatch(await tile.locator('.person-info small').textContent(),/bởi|Mai Anh|Minh Quân/,'vote-out animation never identifies contributors');
   }
   if(width===390){assert.equal(await page.locator('#players-panel').getAttribute('data-open'),'true');assert.equal(await page.locator(':focus').getAttribute('id'),'close-players');}
   await page.waitForTimeout(350);manager.changed(room);await page.waitForFunction(revision=>snapshot.room.revision>=revision,room.revision);
   assert.deepEqual(await page.evaluate(()=>[...eliminationEffects.values()].map(effect=>effect.started)),started,'presence resumes the same effect instead of replaying it');
   assert.ok(await page.locator('.gi-elimination-fx').first().evaluate(element=>parseFloat(element.style.getPropertyValue('--elim-elapsed'))<0));
   if(process.env.BROWSER_ARTIFACT_DIR){const fs=require('node:fs'),path=require('node:path');fs.mkdirSync(process.env.BROWSER_ARTIFACT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.BROWSER_ARTIFACT_DIR,'VOTE_IN_GAME_'+width+'.png')});}
   await page.waitForFunction(()=>eliminationEffects.size===0);assert.equal(await page.locator('.gi-elimination-fx').count(),0);
   assert.equal(await page.locator('.gi-area-players .player-name.is-eliminated').first().evaluate(element=>getComputedStyle(element).textDecorationLine),'line-through');
   await page.reload();await page.locator('.gi-area-project').waitFor();assert.equal(await page.locator('.gi-elimination-fx').count(),0,'refresh into reveal never replays an old vote');
   await page.close();
  }
  const terminal=await create(390,'terminal');
  terminal.room.state=terminal.after;manager.phaseDeadline(terminal.room);manager.changed(terminal.room);
  await terminal.page.locator('[data-elimination-state=running]').waitFor();
  assert.equal(terminal.room.state.phase,'GAME_OVER');assert.equal(manager.rooms.has(terminal.room.code),false,'presentation does not hold the finished room open');
  assert.equal(await terminal.page.evaluate(()=>snapshot.game.phase),'GAME_OVER','client accepts the terminal state immediately');
  assert.equal(await terminal.page.locator('#app').evaluate(element=>element.inert),true,'finished board cannot submit stale actions');
  assert.equal(await terminal.page.locator('.gi-ending-screen').count(),0,'last vote animates in the match before the ending');
  assert.equal(await terminal.page.locator('.gi-phase-transition').count(),0,'ending chapter follows the vote-out effect');
  assert.equal(await terminal.page.evaluate(()=>aborter.signal.aborted),true,'terminal transport stops immediately');
  await terminal.page.locator('.gi-ending-screen').waitFor();await terminal.page.locator('.gi-phase-transition[data-phase=GAME_OVER]').waitFor();
  assert.equal(await terminal.page.locator('#app').evaluate(element=>element.inert),false);await terminal.page.locator('.gi-phase-transition').waitFor({state:'detached'});
  await terminal.page.reload();await terminal.page.locator('.gi-ending-screen').waitFor();assert.equal(await terminal.page.locator('.gi-elimination-fx,.gi-phase-transition').count(),0);await terminal.page.close();
  const hidden=await create(390,'terminal');hidden.room.state=hidden.after;manager.phaseDeadline(hidden.room);manager.changed(hidden.room);
  await hidden.page.locator('[data-elimination-state=running]').waitFor();
  await hidden.page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await hidden.page.locator('.gi-ending-screen').waitFor();assert.equal(await hidden.page.locator('#app').evaluate(element=>element.inert),false);
  assert.equal(await hidden.page.evaluate(()=>eliminationEffects.size),0,'hiding the page flushes a terminal presentation without leaving an inert board');
  assert.equal(await hidden.page.locator('.gi-phase-transition').count(),0);await hidden.page.close();
  for(const mode of ['bankrupt','vote']){
   const state=await create(1440,mode);state.room.state=state.after;manager.phaseDeadline(state.room);manager.changed(state.room);await state.page.locator('.gi-phase-transition[data-phase=REVEAL]').waitFor();
   if(mode==='bankrupt')assert.equal(await state.page.locator('.gi-elimination-fx').count(),0,'bankruptcy is not presented as a vote-out');
   else {manager.next(state.room,state.host);await state.page.locator('.gi-phase-transition[data-transition=project]').waitFor();assert.equal(await state.page.locator('.gi-elimination-fx').count(),0,'rapid next-round skips stale pending motion');}
   await state.page.close();
  }
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
