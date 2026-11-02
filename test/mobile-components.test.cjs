'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const sizes=[[320,568],[360,640],[390,844],[430,932],[600,800],[844,390],[390,360]];

test('mobile components work across small phones, landscape, and every game phase',{skip:!process.env.PLAYWRIGHT_MODULE_PATH},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
 const {server,manager}=require('../server/server.cjs');
 let now=Date.now(),browser;manager.currentTime=()=>now;
 const errors=[],checks=[];
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const fits=async(page,label)=>{
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+': no horizontal overflow');
  assert.equal(await page.locator('input:visible,textarea:visible,select:visible,button:visible').evaluateAll(elements=>elements.filter(e=>{const r=e.getBoundingClientRect();return r.width<1||r.left< -1||r.right>innerWidth+1;}).map(e=>e.id||e.tagName)).then(items=>items.length),0,label+': controls fit page width');
  checks.push(label);
 };
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const entry=await browser.newPage({isMobile:true,hasTouch:true});entry.on('pageerror',e=>errors.push(e.message));
  for(const [width,height] of sizes){await entry.setViewportSize({width,height});await entry.goto(base);await entry.locator('#create-name').waitFor();await entry.evaluate(()=>document.fonts.ready);await fits(entry,'entry '+width+'x'+height);}
  await entry.setViewportSize({width:390,height:844});await entry.locator('#create-name').fill('Mobile Audit');await entry.locator('#form-create button').click();await entry.locator('#leave').waitFor();
  // Only disposable local rooms are used, with actual browser create and join.
  const room=[...manager.rooms.values()].find(r=>r.players[0].name==='Mobile Audit'),host=room.players[0];
  for(let n=1;n<13;n++)manager.join(room.code,'Người kiểm tra '+n);
  for(const peer of room.players)manager.connected(room,peer);
  const guest=await browser.newPage({viewport:{width:360,height:640},isMobile:true,hasTouch:true});guest.on('pageerror',e=>errors.push(e.message));
  await guest.goto(base);await guest.locator('#join-code').fill(room.code);await guest.locator('#join-name').fill('Khách Audit');await guest.locator('#form-join button').click();await guest.locator('#leave').waitFor();await fits(guest,'guest lobby');
  for(const [width,height] of sizes){await entry.setViewportSize({width,height});await fits(entry,'host lobby '+width+'x'+height);}
  await entry.locator('#start').click();await entry.locator('.gi-area-project img').waitFor();
  const roleHd=/\/cards-hd(?:-webp)?\/ROLE_(?:PROTECTOR|SABOTEUR)\.(?:png|webp)/;
  await entry.route(roleHd,route=>route.abort());await entry.reload();
  await entry.waitForFunction(()=>{const image=document.querySelector('#mobile-role-value img');return image?.complete&&image.naturalWidth>0&&image.currentSrc.includes('/cards/');});
  checks.push('private role original PNG fallback');await entry.unroute(roleHd);await entry.reload();
  for(const phase of ['DEBATE','BLIND_ACTION','REVEAL','GAME_OVER']){
   if(phase==='GAME_OVER'){while(room.state.phase!=='GAME_OVER'){now=room.deadline;manager.tick();}}
   else if(phase!==room.state.phase){now=room.deadline;manager.tick();}
   await entry.waitForFunction(expected=>document.querySelector('.phase')?.textContent.includes(expected),{DEBATE:'THẢO LUẬN',BLIND_ACTION:'HÀNH ĐỘNG',REVEAL:'CÔNG BỐ',GAME_OVER:'KẾT THÚC'}[phase],{timeout:7000});
   console.log('Mobile matrix:',phase);
   for(const [width,height] of sizes){
    await entry.setViewportSize({width,height});await fits(entry,phase+' '+width+'x'+height);
    if(phase==='GAME_OVER'){
     assert.equal(await entry.locator('.gi-ending-screen').isVisible(),true,'existing ending screen remains available, including a draw without video');
     continue;
    }
    await entry.waitForFunction(()=>{const image=document.querySelector('.gi-area-project img');return image?.complete&&image.naturalWidth>0;});
    if(width<760){
     const eye=entry.locator('#mobile-show-role'),card=entry.locator('#mobile-role-value img');await eye.scrollIntoViewIfNeeded();
     const box=await eye.boundingBox();await entry.mouse.move(box.x+box.width/2,box.y+box.height/2);await entry.mouse.down();
     await card.waitFor({state:'visible'});await entry.waitForFunction(()=>document.querySelector('#mobile-role-value img')?.naturalWidth>0);
     const popup=await entry.locator('#mobile-role-value').boundingBox();
     assert.ok(popup.x>=0&&popup.y>=0&&popup.x+popup.width<=width&&popup.y+popup.height<=height,'private card fits '+width+'x'+height);
     await entry.mouse.up();assert.equal(await card.isVisible(),false,'release conceals private card');
     await entry.mouse.down();await entry.mouse.move(0,Math.min(height-1,100));
     assert.equal(await card.isVisible(),false,'leaving eye conceals private card');
     assert.equal(await eye.getAttribute('aria-pressed'),'false','leaving eye resets pressed state');await entry.mouse.up();
    }
    await entry.locator('.gi-card-button').click();assert.equal(await entry.locator('.gi-card-dialog').isVisible(),true);await entry.locator('.gi-card-dialog button').click();assert.equal(await entry.locator('.gi-card-dialog').count(),0);
    await entry.locator('#toggle-players').click();const panel=entry.locator('#players-panel');assert.equal(await panel.isVisible(),true);const panelBox=await panel.boundingBox();assert.ok(panelBox.x>=0&&panelBox.y>=0&&panelBox.x+panelBox.width<=width+1&&panelBox.y+panelBox.height<=height+1,'drawer fits '+width+'x'+height);
    await entry.locator('#close-players').click();assert.equal(await panel.isVisible(),false);assert.equal(await entry.locator('#toggle-players').getAttribute('aria-expanded'),'false');
   }
   if(phase==='DEBATE'){
    await entry.setViewportSize({width:320,height:568});await entry.locator('#statement-text').fill('Một nhận định kiểm tra luồng mobile.');await entry.locator('#statement button[type=submit]').click();await entry.locator('#statement-choice').waitFor({state:'visible'});await fits(entry,'stance modal');
    await entry.locator('[data-stance=SUPPORT]').click();await entry.locator('#edit-statement').click();assert.equal(await entry.locator('#statement-text').inputValue(),'Một nhận định kiểm tra luồng mobile.');
    await entry.locator('#statement button[type=submit]').click();await entry.locator('#confirm-statement').click();await entry.waitForFunction(()=>!document.querySelector('#statement'));assert.equal(room.state.statements[host.id].stance,'SUPPORT');
   }
   if(phase==='BLIND_ACTION'){
    await entry.setViewportSize({width:320,height:568});await entry.locator('#bank').selectOption('INSPECT');assert.equal(await entry.locator('#lock-action').isDisabled(),true);await entry.locator('#bank').selectOption('EXPEL');await entry.locator('#invest').check();await fits(entry,'bank contribution fields');assert.equal(await entry.locator('#lock-action').isEnabled(),true);await entry.locator('#bank').selectOption('NONE');await entry.locator('#invest').uncheck();await entry.locator('#lock-action').click();await entry.waitForFunction(()=>!document.querySelector('#action-form'));
   }
  }
  assert.deepEqual(errors,[],'no uncaught client errors');
  if(process.env.BROWSER_ARTIFACT_DIR){const fs=require('node:fs'),path=require('node:path');fs.mkdirSync(process.env.BROWSER_ARTIFACT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.BROWSER_ARTIFACT_DIR,'mobile-component-audit.json'),JSON.stringify({checks,pageErrors:errors},null,2));}
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
