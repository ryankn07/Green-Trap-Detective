'use strict';
const test=require('node:test'),assert=require('node:assert/strict');

test('resizing keeps the current design, drafts and privacy; a resumed tab accepts real phase updates',{skip:!process.env.PLAYWRIGHT_MODULE_PATH},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH),{server,manager}=require('../server/server.cjs');let browser,now=Date.now();const originalTime=manager.currentTime;manager.currentTime=()=>now;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const {room,player}=manager.create('Resize QA');for(const name of ['An','Hà','Linh','Quân'])manager.join(room.code,name);room.players.forEach(peer=>manager.connected(room,peer));manager.start(room,player);
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(session=>sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(session)),{roomCode:room.code,playerId:player.id,token:player.secret});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#statement').waitFor();await page.evaluate(()=>document.fonts.ready);
  const draft='Cần đối chiếu tác động dài hạn.';await page.locator('#statement-text').fill(draft);await page.locator('#stance').selectOption('SUPPORT');
  await page.evaluate(()=>{window.resizeStatement=document.getElementById('statement');});
  for(const [width,height] of [[1440,900],[1199,800],[1040,1050],[1000,650],[900,620],[768,1024],[760,600],[759,800],[390,844],[1440,900]]){
   await page.setViewportSize({width,height});
   assert.equal(await page.locator('#statement').evaluate(node=>node===window.resizeStatement),true,'CSS changes do not remount the form');
   assert.equal(await page.locator('#statement-text').inputValue(),draft);assert.equal(await page.locator('#stance').inputValue(),'SUPPORT');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow at '+width);
   if(width>=760){
    const layout=await page.evaluate(()=>{const box=selector=>document.querySelector(selector).getBoundingClientRect().toJSON();return {card:box('.gi-card-image-viewport'),project:box('.gi-area-project'),action:box('.gi-action-panel'),phase:box('.gi-phase-header'),profile:getComputedStyle(document.querySelector('.gi-profile-panel>.flex')).display,vertical:document.documentElement.scrollHeight>innerHeight};});
    assert.equal(layout.profile,'none','compact sizes never return to the legacy profile');assert.equal(layout.vertical,false);
    assert.ok(layout.card.bottom<=height+1);assert.ok(layout.action.x>=layout.project.right,'controls remain beside the card');
    if(width<1200){
     assert.ok(layout.phase.bottom<=layout.project.top,'compact phase row is above the board');
     assert.equal(await page.locator('#players-panel').isVisible(),false);
     const council=await page.locator('#toggle-players').boundingBox(),guide=await page.locator('#tutorial-open').boundingBox();assert.ok(council.y+council.height<=64&&council.x+council.width<=guide.x,'council fits in the toolbar without covering form controls');
    }else assert.ok(layout.phase.bottom<=64);
   }
  }
  await page.locator('#show-role').hover();await page.mouse.down();await page.locator('#role .gi-private-role-card').waitFor({state:'visible'});
  await page.evaluate(()=>{window.roleHiddenAtResize=null;addEventListener('resize',()=>{if(innerWidth===1000)window.roleHiddenAtResize=document.querySelector('#role .gi-private-role-card').hidden;},{once:true});});
  await page.setViewportSize({width:1000,height:700});await page.waitForFunction(()=>window.roleHiddenAtResize!==null);assert.equal(await page.evaluate(()=>window.roleHiddenAtResize),true,'the resize event immediately conceals a held role');await page.mouse.up();
  await page.locator('#toggle-players').click();assert.equal(await page.locator('#players-panel').isVisible(),true);
  await page.setViewportSize({width:1440,height:900});await page.waitForFunction(()=>document.getElementById('players-panel').dataset.open==='false');assert.equal(await page.locator('#players-panel').isVisible(),true,'returning to desktop closes the drawer and shows the inline council');
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Page.setWebLifecycleState',{state:'frozen'});manager.submit(room,room.players[1],{text:'Cần thêm bằng chứng.',stance:'UNSURE'});await cdp.send('Page.setWebLifecycleState',{state:'active'});
  await page.waitForFunction(()=>snapshot?.game?.currentStatements?.some(item=>item.text==='Cần thêm bằng chứng.'));
  assert.equal(await page.locator('#statement-text').inputValue(),draft,'resuming the same phase preserves the draft');
  now=room.deadline;manager.tick();await page.locator('#action-form').waitFor();await page.locator('#invest').check();await page.locator('#bank').selectOption('EXPEL');await page.locator('#amount').selectOption('1');const target=await page.locator('#target').inputValue();
  for(const width of [1199,768,390,1440]){await page.setViewportSize({width,height:800});assert.equal(await page.locator('#invest').isChecked(),true);assert.equal(await page.locator('#bank').inputValue(),'EXPEL');assert.equal(await page.locator('#target').inputValue(),target);assert.equal(await page.locator('#amount').inputValue(),'1');}
  await cdp.send('Page.setWebLifecycleState',{state:'frozen'});manager.submit(room,room.players[1],{action:{invest:false,bankAction:{type:'NONE'}}});await cdp.send('Page.setWebLifecycleState',{state:'active'});
  await page.waitForFunction(()=>snapshot?.game?.players?.some(peer=>peer.hasLockedAction));assert.equal(await page.locator('#bank').inputValue(),'EXPEL','presence/lock updates after resume preserve the bank draft');
  await cdp.send('Page.setWebLifecycleState',{state:'frozen'});now=room.deadline;manager.tick();await cdp.send('Page.setWebLifecycleState',{state:'active'});
  await page.waitForFunction(()=>snapshot?.game?.phase==='REVEAL');await page.locator('#next').waitFor();assert.equal(await page.locator('#phase-progress').getAttribute('max'),'25');
  await page.setViewportSize({width:1000,height:700});assert.equal(await page.locator('#action-form').count(),0,'expired drafts do not survive into reveal');assert.equal(await page.locator('#role .gi-private-role-card').isVisible(),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
 }finally{manager.currentTime=originalTime;if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
