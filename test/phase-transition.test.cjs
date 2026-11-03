'use strict';
const test=require('node:test'),assert=require('node:assert/strict');

test('phase chapter screens follow real snapshots once, keep inputs live and adapt to mobile',{
 skip:!process.env.PLAYWRIGHT_MODULE_PATH
},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
 const {server,manager}=require('../server/server.cjs');
 let browser,now=Date.now();manager.currentTime=()=>now;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const errors=[];
 const makePage=async(viewport,reducedMotion='no-preference')=>{
  const {room,player}=manager.create('Transition QA');
  manager.join(room.code,'Peer A');manager.join(room.code,'Peer B');
  room.players.forEach(peer=>manager.connected(room,peer));
  const page=await browser.newPage({viewport,reducedMotion});
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(session=>sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(session)),{roomCode:room.code,playerId:player.id,token:player.secret});
  await page.goto(base);await page.locator('#start').waitFor();
  await page.evaluate(()=>{
   window.chapterLifetimes=[];const starts=new WeakMap();
   new MutationObserver(records=>{for(const record of records){
    for(const node of record.addedNodes)if(node.nodeType===1&&node.matches('.gi-phase-transition'))starts.set(node,performance.now());
    for(const node of record.removedNodes)if(starts.has(node))window.chapterLifetimes.push(performance.now()-starts.get(node));
   }}).observe(document.body,{childList:true});
  });
  assert.equal(await page.locator('.gi-phase-transition').count(),0,'lobby has no chapter screen');
  return {page,room};
 };
 const screenFor=async(page,phase)=>{
  const screen=page.locator('.gi-phase-transition[data-phase="'+phase+'"]');
  await screen.waitFor({state:'attached'});
  assert.equal(await page.locator('.gi-phase-transition').count(),1,'only the latest chapter is present');
  const geometry=await screen.evaluate(element=>{
   const rect=element.getBoundingClientRect(),title=element.querySelector('h2').getBoundingClientRect();
   return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,viewportWidth:innerWidth,viewportHeight:innerHeight,titleWidth:title.width,pointerEvents:getComputedStyle(element).pointerEvents};
  });
  assert.equal(geometry.x,0);assert.equal(geometry.y,0);
  assert.equal(geometry.width,geometry.viewportWidth);assert.equal(geometry.height,geometry.viewportHeight);
  assert.ok(geometry.titleWidth<=geometry.width);
  assert.equal(geometry.pointerEvents,'none','decoration does not block a timed action');
  return screen;
 };
 const projectFor=async(page,expected)=>{
  const screen=await screenFor(page,'DEBATE');
  assert.equal(await screen.getAttribute('data-transition'),'project','a fresh card uses the branded project chapter');
  assert.equal(await screen.getAttribute('data-project'),expected.id);
  assert.equal(await screen.locator('h2').textContent(),'Green Trap Detective');
  assert.equal(await screen.locator('.gi-project-name').textContent(),expected.title);
  assert.equal(await screen.locator('.gi-project-label').textContent(),'Dự án mới');
  await page.waitForFunction(()=>document.querySelector('.gi-project-card img')?.naturalWidth>0);
  assert.equal(await screen.locator('.gi-project-card').count(),3,'branded cards fan out around the original logo');
  const deal=await screen.locator('.gi-project-card--front').evaluate(element=>({name:getComputedStyle(element).animationName,running:element.getAnimations().some(animation=>animation.playState==='running')}));
  assert.equal(deal.name,'gi-project-deal');assert.equal(deal.running,true);
  assert.equal(await screen.evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(11, 52, 37)','green leads the project chapter');
 };
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   const {page,room}=await makePage(viewport);
   await page.locator('#start').click();await screenFor(page,'DEBATE');
   const firstProject=manager.view(room,room.players[0]).game.project;
   await projectFor(page,firstProject);
   await page.locator('.gi-phase-transition').waitFor({state:'detached'});
   const lifetime=await page.evaluate(()=>window.chapterLifetimes.at(-1));
   assert.ok(lifetime>=1850&&lifetime<2600,'normal chapter stays around 2 seconds: '+lifetime);
   await page.locator('#statement-text').fill('Nhận định đang viết dở.');
   manager.changed(room);
   await page.waitForFunction(revision=>snapshot.room.revision>=revision,room.revision);
   assert.equal(await page.locator('.gi-phase-transition').count(),0,'presence does not replay the phase');
   assert.equal(await page.locator('#statement-text').inputValue(),'Nhận định đang viết dở.');
   await page.locator('.gi-card-button').click();await page.locator('.gi-card-dialog').waitFor({state:'visible'});
   now=room.deadline;manager.tick();
   await screenFor(page,'BLIND_ACTION');
   await page.locator('.gi-card-dialog').waitFor({state:'detached'});
   await page.locator('#invest').check();
   assert.equal(await page.locator('#invest').isChecked(),true,'new phase is interactive before animation completes');
   await page.evaluate(()=>{window.chapterNode=document.querySelector('.gi-phase-transition');});
   manager.changed(room);
   await page.waitForFunction(revision=>snapshot.room.revision>=revision,room.revision);
   assert.equal(await page.evaluate(()=>window.chapterNode===document.querySelector('.gi-phase-transition')),true,'same-phase snapshots retain the running animation');
   // Advance again before the previous chapter finishes: replace, never queue.
   now=room.deadline;manager.tick();await screenFor(page,'REVEAL');
   await page.locator('#next').click();await screenFor(page,'DEBATE');
   const secondProject=manager.view(room,room.players[0]).game.project;
   assert.notEqual(secondProject.id,firstProject.id);
   await projectFor(page,secondProject);
   assert.equal(await page.locator('.gi-phase-round').textContent(),'LƯỢT 2 / 10');
   while(room.state.phase!=='GAME_OVER'){now=room.deadline;manager.tick();}
   await screenFor(page,'GAME_OVER');
   assert.equal(await page.locator('.gi-ending-screen').count(),1,'ending is already rendered under the chapter');
   await page.locator('.gi-phase-transition').waitFor({state:'detached'});
   await page.close();
  }
  const {page,room}=await makePage({width:320,height:568},'reduce');
  await page.locator('#start').click();
  const reduced=await screenFor(page,'DEBATE');
  await projectFor(page,manager.view(room,room.players[0]).game.project);
  assert.equal(await reduced.evaluate(element=>getComputedStyle(element).animationName),'gi-phase-screen','owner-requested screen wipe also runs under reduced motion');
  const movingElements=await reduced.evaluate(element=>[element,element.querySelector('.gi-phase-intro'),element.querySelector('.gi-phase-orbit'),element.querySelector('.gi-phase-sparks i')].map(node=>({name:getComputedStyle(node).animationName,duration:getComputedStyle(node).animationDuration,running:node.getAnimations().some(animation=>animation.playState==='running')})));
  assert.deepEqual(movingElements.map(element=>element.name),['gi-phase-screen','gi-phase-arrive','gi-phase-orbit','gi-phase-leaf']);
  assert.ok(movingElements.every(element=>element.duration==='2s'&&element.running),'all demo layers animate for two seconds');
  await page.waitForFunction(()=>document.querySelector('.gi-phase-intro')?.getAnimations().some(animation=>animation.currentTime>=200));
  assert.equal(await page.locator('#toast').evaluate(element=>getComputedStyle(element).transitionDuration),'0s','other surfaces still respect reduced motion');
  assert.equal(await page.locator('.gi-phase-orbit').first().isVisible(),true,'reduced motion retains the decorative rings');
  assert.equal(await page.locator('.gi-phase-sparks').isVisible(),true,'reduced motion retains the leaf accents');
  for(const viewport of [{width:320,height:568},{width:390,height:360},{width:844,height:390}]){
   await page.setViewportSize(viewport);await screenFor(page,'DEBATE');
   const fits=await page.locator('.gi-phase-intro').evaluate(element=>{
    const box=element.getBoundingClientRect();return box.x>=0&&box.y>=0&&box.right<=innerWidth&&box.bottom<=innerHeight;
   });
   assert.equal(fits,true,'chapter content fits short and landscape phones');
  }
  await page.locator('.gi-phase-transition').waitFor({state:'detached'});
  const reducedLifetime=await page.evaluate(()=>window.chapterLifetimes.at(-1));
  assert.ok(reducedLifetime>=1850&&reducedLifetime<2600,'reduced chapter also stays around 2 seconds: '+reducedLifetime);
  await page.reload();await page.locator('#statement-text').waitFor();
  assert.equal(await page.locator('.gi-phase-transition').count(),0,'refresh into an active phase does not replay an introduction');
  now=room.deadline;manager.tick();await screenFor(page,'BLIND_ACTION');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.locator('.gi-phase-transition').count(),0,'hiding the page cancels the current chapter');
  now=room.deadline;manager.tick();
  await page.waitForFunction(()=>snapshot.game.phase==='REVEAL');
  assert.equal(await page.locator('.gi-phase-transition').count(),0,'background snapshots do not queue an introduction');
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.locator('.gi-phase-transition').count(),0,'returning to the tab does not replay a missed chapter');
  await page.locator('#next').click();await screenFor(page,'DEBATE');
  await page.evaluate(()=>recoverSession({code:'ROOM_NOT_FOUND'}));
  assert.equal(await page.locator('.gi-phase-transition').count(),0,'session recovery removes any outstanding chapter');
  assert.deepEqual(errors,[]);
 }finally{
  if(browser)await browser.close();
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 }
});
