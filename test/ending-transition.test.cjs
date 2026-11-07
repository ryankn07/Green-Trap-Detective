'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const engine=require('../engine/dist/index.js'),projects=require('../engine/dist/data/projects.json');

function states(room,winner,prefixTruth=false){
 const alignment=winner==='PROTECTOR'?'PROTECTOR':'SABOTEUR';
 const front=projects.filter(project=>project.alignment===alignment).slice(0,2).map(project=>project.id);
 if(prefixTruth)front.unshift(projects.find(project=>project.verdictLabel==='TRUTH').id);
 const deck=[...front,...projects.filter(project=>!front.includes(project.id)).slice(0,10-front.length).map(project=>project.id)];
 let state=engine.createGame({gameId:'ending-transition-'+room.code,players:room.players.map((player,index)=>({id:player.id,name:player.name,role:index===2?'SABOTEUR':'PROTECTOR'})),projects,deckIds:deck}),before;
 while(state.phase!=='GAME_OVER'){
  for(const player of state.players.filter(player=>player.isAlive))state=engine.submitStatement(state,player.id,'Nhận định test');
  state=engine.openBlindPhase(state);
  for(const player of state.players.filter(player=>player.isAlive))state=engine.lockAction(state,player.id,{invest:winner!=='DRAW'&&(!prefixTruth||state.round>1)&&player.role!==alignment,bankAction:{type:'NONE'}});
  before=state;state=engine.resolveRound(state);if(state.phase!=='GAME_OVER')state=engine.nextRound(state);
 }
 assert.equal(state.outcome.winner,winner);return {before,after:state};
}

async function assertEndingScroll(page,width,height){
 const recordContrast=await page.evaluate(()=>{
  const records=document.querySelector('.ending-records');if(!records)return [];
  const luminance=color=>color.match(/[\d.]+/g).slice(0,3).map(Number).reduce((sum,value,index)=>{const c=value/255;return sum+(c<=.04045?c/12.92:((c+.055)/1.055)**2.4)*[.2126,.7152,.0722][index];},0);
  const background=luminance(getComputedStyle(records).backgroundColor);
  return [...records.querySelectorAll('summary,.ending-last-result p')].map(element=>{const text=luminance(getComputedStyle(element).color);return (Math.max(text,background)+.05)/(Math.min(text,background)+.05);});
 });
 assert.ok(recordContrast.every(ratio=>ratio>=4.5),'ending record text stays readable against its themed panel');
 assert.equal(await page.locator('.ending-projects,.ending-project-strip').count(),0,'the removed ending card gallery stays absent');
 for(const truth of await page.locator('.gi-verdict[data-verdict="TRUTH"]').all())assert.equal(await truth.evaluate(element=>getComputedStyle(element).color),'rgb(141, 250, 183)','Truth is green independently of the ending winner');
 assert.equal(await page.locator('.ending-scan,.ending-qr,[data-ending-qr],script[src*="qr-code"]').count(),0,'ending shows the film directly without a QR flow');
 const cinema=await page.evaluate(()=>{
  const content=document.querySelector('.ending-feature')?.parentElement,frame=document.querySelector('.ending-feature .ending-film-frame');
  if(!content||!frame)return null;const style=getComputedStyle(content);return {available:content.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),width:frame.getBoundingClientRect().width};
 });
 if(cinema)assert.ok(Math.abs(cinema.available-cinema.width)<2,'in-game film uses the full content width');
 await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
 assert.ok(await page.evaluate(()=>document.scrollingElement.scrollHeight>innerHeight),'ending content exceeds the window at '+width+'x'+height);
 await page.mouse.move(10,height/2);await page.mouse.wheel(0,height);
 await page.waitForFunction(()=>scrollY>0,{},{timeout:2000});
 await page.keyboard.press('Control+End');
 await page.waitForFunction(()=>{const box=document.querySelector('.ending-footer').getBoundingClientRect();return box.top>=0&&box.bottom<=innerHeight+1;},{},{timeout:2000});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'ending has no horizontal overflow');
 for(const summary of await page.locator('.ending-records .ending-details>summary').all())await summary.click();
 await page.keyboard.press('Control+End');
 await page.waitForFunction(()=>{const box=document.querySelector('.ending-footer').getBoundingClientRect();return box.top>=0&&box.bottom<=innerHeight+1;},{},{timeout:2000});
}

test('good and bad ending chapters follow the actual winner with distinct motion and preserve the film',{
 skip:!process.env.PLAYWRIGHT_MODULE_PATH
},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH),{server,manager}=require('../server/server.cjs');
 let browser;const errors=[];
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  for(const winner of ['PROTECTOR','SABOTEUR','DRAW']){
   for(const [width,height] of winner==='DRAW'?[[1440,900]]:[[1440,900],[390,844],[320,568],[844,390]]){
    const {room}=manager.create('Ending chapter QA');manager.join(room.code,'Peer A');manager.join(room.code,'Peer B');
    room.players.forEach(player=>manager.connected(room,player));
    const {before,after}=states(room,winner,winner==='SABOTEUR');room.state=before;manager.phaseDeadline(room);manager.changed(room);
    if(winner==='SABOTEUR')assert.ok(after.history.some(turn=>turn.verdictLabel==='TRUTH'),'Bad Ending fixture contains a real Truth result');
    // Test a losing player as well: the faction winner, not my role, chooses the chapter.
    const player=room.players[winner==='PROTECTOR'?2:0];
    const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(request.url().includes('/qr-code.js'))errors.push('Ending requested the removed QR generator');});
    await page.addInitScript(session=>sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(session)),{roomCode:room.code,playerId:player.id,token:player.secret,...(width===320?{transport:'poll'}:{})});
    await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('.gi-phase-header').waitFor();await page.evaluate(()=>document.fonts.ready);
    room.state=after;manager.phaseDeadline(room);manager.changed(room);
    const screen=page.locator('.gi-phase-transition[data-phase=GAME_OVER]');await screen.waitFor();
    if(winner==='DRAW'){
     assert.equal(await screen.getAttribute('data-ending'),null);assert.equal(await page.locator('#ending-video').count(),0);
    }else{
     const good=winner==='PROTECTOR',kind=good?'good':'bad';
     assert.equal(await screen.getAttribute('data-transition'),'ending');assert.equal(await screen.getAttribute('data-ending'),kind);
     assert.equal(await screen.locator('h2').textContent(),good?'GOOD ENDING':'BAD ENDING');
     const motion=await screen.evaluate(element=>({screen:getComputedStyle(element).animationName,sigil:getComputedStyle(element.querySelector('.gi-ending-sigil')).animationName,aura:getComputedStyle(element.querySelector('.gi-ending-aura')).animationName,spark:getComputedStyle(element.querySelector('.gi-phase-sparks i')).animationName,color:getComputedStyle(element).backgroundColor}));
     assert.equal(motion.screen,'gi-phase-screen');assert.equal(motion.sigil,good?'gi-ending-bloom':'gi-ending-fracture');assert.equal(motion.aura,good?'gi-ending-radiance':'gi-ending-rupture');assert.equal(motion.spark,good?'gi-phase-leaf':'gi-ending-ember');assert.equal(motion.color,good?'rgb(7, 53, 37)':'rgb(48, 8, 19)');
     const fits=await screen.locator('.gi-ending-intro').evaluate(element=>{const box=element.getBoundingClientRect();return box.x>=0&&box.y>=0&&box.right<=innerWidth&&box.bottom<=innerHeight;});assert.ok(fits,'ending chapter fits '+width+'x'+height);
     assert.equal(await page.locator('#ending-video source').getAttribute('src'),'/endings/'+kind+'.mp4');
     await page.evaluate(()=>{window.chapter=document.querySelector('.gi-phase-transition');window.film=document.querySelector('#ending-video');});
     assert.equal(manager.rooms.has(room.code),false,'terminal room is immediately retired');
     assert.equal(await page.evaluate(()=>aborter.signal.aborted),true,'ending stops live transport');
     manager.changed(room);
     assert.equal(await page.evaluate(()=>window.chapter===document.querySelector('.gi-phase-transition')&&window.film===document.querySelector('#ending-video')),true,'retirement preserves both the chapter and video');
     if(process.env.ENDING_TRANSITION_ARTIFACT_DIR){
      const fs=require('node:fs'),path=require('node:path');fs.mkdirSync(process.env.ENDING_TRANSITION_ARTIFACT_DIR,{recursive:true});
      await page.evaluate(()=>document.querySelector('.gi-phase-transition').getAnimations({subtree:true}).forEach(animation=>{animation.pause();animation.currentTime=1000;}));
      await page.screenshot({path:path.join(process.env.ENDING_TRANSITION_ARTIFACT_DIR,kind+'-'+width+'x'+height+'.png')});
     }
    }
    await screen.waitFor({state:'detached'});await assertEndingScroll(page,width,height);
    manager.finished.delete(room.code);await page.reload();await page.locator('.gi-ending-screen').waitFor();assert.equal(await page.locator('.gi-phase-transition').count(),0,'cached results survive refresh after server retirement without replaying the chapter');
    await assertEndingScroll(page,width,height);
    if(winner!=='DRAW'){
     await page.goto('http://127.0.0.1:'+server.address().port+'/ending.html?ending='+(winner==='PROTECTOR'?'good':'bad')+'&project=PROJ_01');
     await page.locator('.ending-viewer-card img').waitFor();await page.waitForFunction(()=>document.querySelector('.ending-viewer-card img').naturalWidth>0);await assertEndingScroll(page,width,height);
    }
    await page.close();
   }
  }
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('a host-removed player keeps contained dark-theme pencil marks in both endings',{
 skip:!process.env.PLAYWRIGHT_MODULE_PATH
},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH),{server,manager}=require('../server/server.cjs');
 let browser;await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  for(const winner of ['PROTECTOR','SABOTEUR']){
   const {room,player:host}=manager.create('Mai Anh'),victim=manager.join(room.code,'Bảo An').player;
   manager.join(room.code,'Minh Quân');manager.join(room.code,'Hà Linh');room.players.forEach(player=>manager.connected(room,player));
   room.state=engine.createGame({gameId:'ending-kick-'+room.code,players:room.players.map(player=>({id:player.id,name:player.name,role:(winner==='PROTECTOR'?player.id===victim.id:player.id===host.id)?'SABOTEUR':'PROTECTOR'})),projects,deckIds:projects.slice(0,10).map(project=>project.id)});
   manager.phaseDeadline(room);manager.changed(room);
   if(winner==='SABOTEUR')for(const member of room.players.slice(2))manager.kick(room,host,member.id);
   const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
   await page.addInitScript(session=>sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(session)),{roomCode:room.code,playerId:host.id,token:host.secret});
   await page.goto('http://127.0.0.1:'+server.address().port);
   const playingTile=page.locator('.gi-area-players [data-player-id="'+victim.id+'"]');
   await playingTile.locator('[data-kick-player]').click();await playingTile.locator('.kick-confirm-yes').click();
   await page.locator('.gi-ending-screen').waitFor();await page.locator('.gi-phase-transition').waitFor({state:'detached'});
   assert.equal(room.state.outcome.winner,winner,'real host removal determines the ending');
   await page.locator('.ending-details>summary').filter({hasText:'Vai trò đã được công bố'}).click();
   await page.waitForFunction(()=>kickEffects.size===0);
   const tile=page.locator('.ending-people [data-player-id="'+victim.id+'"]');
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:width===1440?900:844});await tile.scrollIntoViewIfNeeded();
    const effect=await tile.evaluate(element=>{
     const box=element.getBoundingClientRect(),mark=element.querySelector('.kick-scribble').getBoundingClientRect(),style=getComputedStyle(element);
     return {background:style.backgroundColor,opacity:style.opacity,contained:mark.left>=box.left&&mark.right<=box.right&&mark.top>=box.top&&mark.bottom<=box.bottom,stroke:getComputedStyle(element.querySelector('.kick-scribble path')).stroke};
    });
    const rgb=effect.background.match(/[\d.]+/g).slice(0,3).map(Number),luminance=rgb.reduce((sum,value,index)=>{const c=value/255;return sum+(c<=.04045?c/12.92:((c+.055)/1.055)**2.4)*[.2126,.7152,.0722][index];},0);
    assert.ok(luminance<.15,'removed tile remains dark instead of a pale block');assert.equal(effect.opacity,'1');assert.ok(effect.contained,'pencil stays inside the tile');
    assert.notEqual(effect.stroke,'rgb(79, 75, 67)','pencil adapts to the dark ending');
    assert.equal(await tile.locator('.kick-scribble path').count(),1);assert.equal(await tile.locator('.kick-pencil').count(),0,'settled removal never replays');
    assert.equal(await page.locator('.ending-scan,[data-ending-qr]').count(),0);
    if(process.env.BROWSER_ARTIFACT_DIR){const path=require('node:path'),fs=require('node:fs');fs.mkdirSync(process.env.BROWSER_ARTIFACT_DIR,{recursive:true});await tile.screenshot({path:path.join(process.env.BROWSER_ARTIFACT_DIR,'ENDING_KICK_'+winner+'_'+width+'.png')});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(process.env.BROWSER_ARTIFACT_DIR,'ENDING_VIDEO_'+winner+'_'+width+'.png')});}
   }
   await page.reload();await page.locator('.ending-screen,.gi-ending-screen').waitFor();
   await page.locator('.ending-details>summary').filter({hasText:'Vai trò đã được công bố'}).click();
   assert.equal(await tile.locator('.kick-scribble').count(),1);assert.equal(await tile.locator('.kick-pencil').count(),0,'cached result preserves static pencil marks');
   await page.close();
  }
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
