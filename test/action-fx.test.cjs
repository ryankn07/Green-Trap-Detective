'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const playwrightPath=process.env.PLAYWRIGHT_MODULE_PATH;
function prepare(manager){
 const E=require('../engine/dist/index.js'),projects=require('../engine/dist/data/projects.json');
 const {room,player}=manager.create('Motion host');for(const name of ['Target A','Peer B','Peer C','Peer D'])manager.join(room.code,name);
 room.players.forEach(peer=>manager.connected(room,peer));
 const roles=['PROTECTOR','SABOTEUR','PROTECTOR','PROTECTOR','SABOTEUR'],front=['PROJ_20','PROJ_23','PROJ_25'];
 room.state=E.createGame({gameId:'fx-'+room.code,players:room.players.map((peer,index)=>({id:peer.id,name:peer.name,role:roles[index]})),projects,deckIds:[...front,...projects.filter(p=>!front.includes(p.id)).slice(0,7).map(p=>p.id)]});
 for(let round=0;round<2;round++){
  for(const peer of room.players)manager.submit(room,peer,{text:'Nhận định.',stance:'UNSURE'});
  for(const peer of room.players)manager.skipDiscussion(room,peer);
  for(const [index,peer]of room.players.entries())manager.submit(room,peer,{action:{invest:roles[index]==='PROTECTOR',bankAction:{type:'NONE'}}});
  manager.next(room,player);
 }
 for(const peer of room.players)manager.submit(room,peer,{text:'Nhận định.',stance:'UNSURE'});for(const peer of room.players)manager.skipDiscussion(room,peer);
 assert.equal(room.state.players[0].coins,4);return {room,player};
}
function initialize(session){
 sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(session));window.actionAnimations=[];
 const animate=Element.prototype.animate;Element.prototype.animate=function(frames,options){if(options?.id?.startsWith('gt-action-'))window.actionAnimations.push({id:options.id,frames,duration:options.duration});return animate.call(this,frames,options);};
}
const sessionFor=(room,player)=>({roomCode:room.code,playerId:player.id,token:player.secret});
const none={invest:false,bankAction:{type:'NONE'}};

test('private action effects follow accepted locks, preserve drafts on failure and reveal only authorized roles', {skip:!playwrightPath},async()=>{
 const {chromium}=require(playwrightPath),{server,manager}=require('../server/server.cjs');let browser;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});const base='http://127.0.0.1:'+server.address().port;
  for(const width of [1440,390]){
   const {room,player}=prepare(manager),target=room.players[1],errors=[];
   const page=await browser.newPage({viewport:{width,height:width===1440?900:844}}),observer=await browser.newPage({viewport:{width:1440,height:900}});
   for(const [tab,peer]of [[page,player],[observer,room.players[2]]]){tab.on('pageerror',error=>errors.push(error.message));await tab.addInitScript(initialize,sessionFor(room,peer));await tab.goto(base);await tab.locator('#lock-action').waitFor();}
   await page.locator('#bank').selectOption('EXPEL');await page.locator('#target').selectOption(target.id);await page.locator('#amount').selectOption('5');
   assert.equal(await page.locator('#lock-action').isDisabled(),true);assert.equal(await page.locator('.gi-action-fx-coin').count(),0);
   assert.equal(await observer.locator('[data-action-target]').count(),0,'the other browser never receives this private target');
   await page.locator('#bank').selectOption('INSPECT');await page.locator('#invest').check();
   await page.route('**/api/action',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'SERVER_BUSY',message:'Thử lại'})}));
   await page.locator('#lock-action').click();await page.waitForFunction(()=>!requesting);
   assert.equal(await page.locator('#invest').isChecked(),true);assert.equal(await page.locator('#bank').inputValue(),'INSPECT');
   assert.equal(await page.locator('.gi-action-fx-coin').count(),0,'rejected requests never spend animated coins');assert.equal(room.state.lockedActions[player.id],undefined);
   await page.unroute('**/api/action');await page.locator('#lock-action').click();await page.locator('.gi-action-fx-coin').first().waitFor();
   assert.equal(await page.locator('.gi-action-fx-coin').count(),4,'one investment plus three inspection coins');
   assert.equal(room.state.players[0].coins,4,'animation does not deduct a speculative wallet balance');
   assert.equal(await observer.locator('.gi-action-fx-coin').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const count=await page.evaluate(()=>window.actionAnimations.filter(a=>a.id.startsWith('gt-action-coin-')).length);assert.equal(count,4);
   manager.changed(room);await page.waitForFunction(revision=>snapshot.room.revision>=revision,room.revision);
   assert.equal(await page.evaluate(()=>window.actionAnimations.filter(a=>a.id.startsWith('gt-action-coin-')).length),count,'presence does not replay confirmed coins');
   if(width===390)assert.equal(await page.locator('#players-panel').getAttribute('data-open'),'false','private choice does not open the mobile council');
   for(const peer of room.players.slice(1))manager.submit(room,peer,{action:none});
   await page.locator('.gi-inspection-result').waitFor();await page.waitForFunction(()=>!phaseScreen&&!actionBurnHold);
   await page.locator('.gi-inspection-result').scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>window.actionAnimations.some(a=>a.id==='gt-action-inspection-result'));
   assert.ok((await page.locator('.gi-inspection-result').innerText()).includes('Target A — Người Phá Hoại'));
   assert.equal(await observer.locator('.gi-inspection-result').count(),0,'inspection remains private to its actual owner');
   manager.changed(room);await page.waitForFunction(revision=>snapshot.room.revision>=revision,room.revision);
   assert.equal(await page.evaluate(()=>window.actionAnimations.filter(a=>a.id==='gt-action-inspection-result').length),1);
   await page.reload();await page.locator('.gi-inspection-result').waitFor();
   assert.equal(await page.evaluate(()=>window.actionAnimations.filter(a=>a.id==='gt-action-inspection-result'||a.id.startsWith('gt-action-coin-')).length),0,'refresh presents settled facts without replaying actions');
   const eye=page.locator(width===1440?'#show-role':'#mobile-show-role');await eye.hover();await page.mouse.down();
   await page.waitForFunction(()=>window.actionAnimations.some(a=>a.id==='gt-action-role-peek'));
   await page.mouse.up();
   assert.equal(await page.locator(width===1440?'#role .gi-private-role-card':'#mobile-role-value').isVisible(),false,'release hides the role immediately, even during its entrance');
   assert.equal(await page.evaluate(()=>document.getAnimations().some(a=>a.id==='gt-action-role-peek')),false);
   assert.deepEqual(errors,[]);await page.close();await observer.close();
  }
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('expulsion coins never predict an elimination and reduced motion keeps feedback without flights', {skip:!playwrightPath},async()=>{
 const {chromium}=require(playwrightPath),{server,manager}=require('../server/server.cjs');let browser;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  for(const preference of ['no-preference','reduce']){
   const {room,player}=prepare(manager),target=room.players[1],page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:preference});
   await page.addInitScript(initialize,sessionFor(room,player));await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#lock-action').waitFor();
   await page.locator('#bank').selectOption('EXPEL');await page.locator('#target').selectOption(target.id);await page.locator('#amount').selectOption('3');await page.locator('#lock-action').click();
   await page.waitForFunction(()=>Boolean(snapshot.game.myPlayer.lockedAction));
   if(preference==='no-preference'){await page.locator('.gi-action-fx-coin').first().waitFor();assert.equal(await page.locator('.gi-action-fx-coin[data-kind="expel"]').count(),3);}
   else{
    assert.equal(await page.locator('.gi-action-fx-coin').count(),0);
    assert.equal(await page.locator('.gi-investment-focus').count(),0,'an expulsion-only action does not start investment focus');
    assert.ok(await page.evaluate(()=>window.actionAnimations.every(a=>a.frames.every(frame=>!('transform' in frame)))),'reduced motion contains no spatial keyframes');
   }
   assert.equal(room.state.players[1].isAlive,true,'a personal contribution does not predict that the target is out');
   for(const [index,peer]of room.players.entries())if(index!==0)manager.submit(room,peer,{action:index===2?{invest:false,bankAction:{type:'EXPEL',targetId:target.id,amount:2}}:none});
   await page.locator('[data-player-id="'+target.id+'"][data-elimination-state="running"]').waitFor();
   assert.equal(room.state.players[1].eliminatedReason,'EXPELLED');assert.equal(await page.locator('.gi-action-fx-coin').count(),0);
   await page.close();
  }
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('investment flips in focus for 2.6 seconds, stays private and clears before phase chapters', {skip:!playwrightPath},async()=>{
 const {chromium}=require(playwrightPath),{server,manager}=require('../server/server.cjs');let browser;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});const base='http://127.0.0.1:'+server.address().port;
  for(const [width,preference] of [[1440,'no-preference'],[390,'no-preference'],[1040,'reduce'],[390,'reduce']]){
   const {room,player}=prepare(manager),page=await browser.newPage({viewport:{width,height:width===1440?900:width===1040?871:844},reducedMotion:preference,isMobile:width===390,hasTouch:width===390,deviceScaleFactor:width===390?3:1.5});
   await page.addInitScript(initialize,sessionFor(room,player));await page.goto(base);await page.locator('#lock-action').waitFor();await page.locator('.gi-card-image-viewport img').evaluate(image=>image.decode());
   await page.locator('#invest').check();await page.locator('#lock-action').click();await page.locator('.gi-investment-focus').waitFor();
   const motion=await page.evaluate(()=>({coin:window.actionAnimations.find(a=>a.id==='gt-action-coin-invest'),size:parseFloat(getComputedStyle(document.querySelector('.gi-investment-coin')).width),blur:getComputedStyle(document.querySelector('.gi-investment-focus')).backdropFilter,pointers:getComputedStyle(document.querySelector('.gi-action-fx-layer')).pointerEvents,display:getComputedStyle(document.querySelector('.gi-action-fx-layer')).display}));
   assert.equal(motion.coin.duration,2600);assert.ok(motion.size>=100,'coin is larger than its old 44px size');assert.ok(motion.coin.frames.some(frame=>frame.transform.includes('rotateY(360deg)')));assert.match(motion.blur,/blur\(7px\)/);assert.equal(motion.pointers,'none');
   assert.equal(motion.display,'block','Codex reduced-motion rendering does not hide explicit investment feedback');
   assert.equal(room.state.players[0].coins,4,'focus does not spend speculative coins');assert.equal(room.state.phase,'BLIND_ACTION');
   if(width===390){assert.equal(await page.locator('.gi-investment-preview img').getAttribute('src'),await page.locator('.gi-area-project img').evaluate(image=>image.currentSrc));assert.equal(await page.locator('#players-panel').getAttribute('data-open'),'false');}
   const count=await page.evaluate(()=>window.actionAnimations.filter(a=>a.id==='gt-action-coin-invest').length);manager.changed(room);await page.waitForFunction(revision=>snapshot.room.revision>=revision,room.revision);assert.equal(await page.evaluate(()=>window.actionAnimations.filter(a=>a.id==='gt-action-coin-invest').length),count);
   await page.waitForFunction(()=>!document.querySelector('.gi-investment-focus'));assert.equal(await page.locator('.gi-action-fx-layer').count(),0,'the backdrop fully cleans up after the animation');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.close();
  }
  const {room,player}=prepare(manager),page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});await page.addInitScript(initialize,sessionFor(room,player));await page.goto(base);await page.locator('#lock-action').waitFor();
  for(const peer of room.players.slice(1))manager.submit(room,peer,{action:none});await page.locator('#invest').check();await page.locator('#lock-action').click();await page.locator('.gi-investment-focus').waitFor();
  assert.equal(room.state.phase,'REVEAL','a final lock resolves on the server without waiting for the animation');
  await page.locator('.gi-phase-transition[data-phase=REVEAL]').waitFor();assert.equal(await page.locator('.gi-investment-focus').count(),0,'investment never obscures the next phase chapter');
  await page.close();
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('touch investment still appears when scrolling hides both the project and action panel before confirmation', {skip:!playwrightPath},async()=>{
 const {chromium}=require(playwrightPath),{server,manager}=require('../server/server.cjs');let browser;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const {room,player}=prepare(manager);browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:390,height:360},deviceScaleFactor:3,isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  await page.addInitScript(initialize,sessionFor(room,player));await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#lock-action').waitFor();await page.locator('.gi-card-image-viewport img').evaluate(image=>image.decode());
  await page.route('**/api/action',async route=>{await new Promise(resolve=>setTimeout(resolve,700));await route.continue();});
  await page.locator('#invest').tap();await page.locator('#lock-action').tap();
  await page.evaluate(()=>scrollTo(0,document.querySelector('.gi-area-discussion').getBoundingClientRect().top+scrollY));
  await page.waitForFunction(()=>Boolean(snapshot?.game?.myPlayer?.lockedAction));
  const boxes=await page.evaluate(()=>({projectBottom:document.querySelector('.gi-area-project .gi-card-image-viewport').getBoundingClientRect().bottom,actionTop:document.querySelector('.gi-action-panel').getBoundingClientRect().top,height:innerHeight,scrollY}));
  assert.ok(boxes.projectBottom<0&&boxes.actionTop>boxes.height,'both original destinations are outside the mobile viewport');
  await page.locator('.gi-investment-focus').waitFor();await page.locator('.gi-investment-preview img').waitFor();
  assert.equal(await page.locator('.gi-investment-preview img').getAttribute('src'),await page.locator('.gi-area-project img').evaluate(image=>image.currentSrc));
  assert.equal(await page.locator('.gi-investment-coin').count(),1);assert.equal(await page.locator('#players-panel').getAttribute('data-open'),'false');
  assert.equal(await page.evaluate(()=>scrollY),boxes.scrollY,'the overlay does not move the page to find a target');
  assert.equal(room.state.players[0].coins,4);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.evaluate(()=>{window.focusAfterResize=null;addEventListener('resize',()=>{if(innerHeight===400)window.focusAfterResize=document.querySelectorAll('.gi-investment-focus').length;},{once:true});});
  await page.setViewportSize({width:390,height:400});await page.waitForFunction(()=>window.focusAfterResize!==null);assert.equal(await page.evaluate(()=>window.focusAfterResize),0,'the resize event immediately cleans up the old focus geometry');
  await page.close();
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
