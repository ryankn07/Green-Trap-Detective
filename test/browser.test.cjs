'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const playwrightPath = process.env.PLAYWRIGHT_MODULE_PATH;

test('ending films keep comparable proportions in demo and normal browser viewports', {skip: !playwrightPath}, async () => {
  const {chromium}=require(playwrightPath);
  const {server}=require('../server/server.cjs');
  let browser;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const base='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
    for(const ending of ['good','bad']){
      const ratios=[];
      for(const [width,height] of [[1350,820],[1690,896]]){
        const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1.5,reducedMotion:'reduce'});
        const page=await context.newPage();
        await page.goto(base+'/ending.html?ending='+ending);
        await page.locator('.ending-film-frame video').waitFor();
        await page.evaluate(()=>document.fonts.ready);
        const video=await page.locator('video').boundingBox();
        const home=await page.locator('.ending-home').boundingBox();
        assert.ok(Math.abs(video.width/video.height-16/9)<.002,'film retains native aspect ratio');
        assert.ok(Math.abs(video.x+video.width/2-width/2)<1,'film remains centered');
        assert.ok(Math.abs(home.x+home.width/2-width/2)<1,'home control remains centered');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
        ratios.push(video.width/width);
        await context.close();
      }
      assert.ok(Math.abs(ratios[0]-ratios[1])<.03,'film must not stay at one fixed pixel width as the window grows');
    }
  } finally {
    if(browser)await browser.close();
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
});

async function screenshot(page,name){
  if(!process.env.BROWSER_ARTIFACT_DIR)return;
  const fs=require('node:fs'),path=require('node:path');
  fs.mkdirSync(process.env.BROWSER_ARTIFACT_DIR,{recursive:true});
  await page.screenshot({path:path.join(process.env.BROWSER_ARTIFACT_DIR,name),fullPage:true});
}

test('desktop game adapts its card to the viewport and preserves protected layouts', {skip: !playwrightPath}, async () => {
 const {chromium}=require(playwrightPath),fs=require('node:fs'),path=require('node:path');
 const {server,manager}=require('../server/server.cjs');
 let browser,now=Date.now();manager.currentTime=()=>now;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const {room,player}=manager.create('Desktop QA');
  for(let i=1;i<13;i++)manager.join(room.code,'Player '+i);
  for(const peer of room.players)manager.connected(room,peer);
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.addInitScript(session=>{performance.now=()=>0;sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(session));},{roomCode:room.code,playerId:player.id,token:player.secret});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#start').click();
  await page.locator('.gi-area-project img').waitFor();
  await page.waitForFunction(()=>document.querySelector('.gi-area-project img')?.naturalWidth>0);
  for(const [width,height] of [[1200,800],[1366,768],[1440,900],[1920,1080],[2560,1440],[2560,1080]]){
   await page.setViewportSize({width,height});
   const geometry=await page.evaluate(()=>{
    const rect=selector=>document.querySelector(selector).getBoundingClientRect().toJSON();
    return {frame:rect('.gi-area-project .gi-card-image-viewport'),project:rect('.gi-area-project'),actions:rect('.gi-area-actions'),players:rect('.gi-area-players'),phase:rect('.gi-phase-header'),overflow:document.documentElement.scrollWidth>innerWidth,verticalOverflow:document.documentElement.scrollHeight>innerHeight,font:getComputedStyle(document.querySelector('.phase')).fontFamily};
   });
   assert.equal(geometry.overflow,false,'no horizontal overflow at '+width+'x'+height);
   assert.equal(geometry.verticalOverflow,false,'desktop does not require page scrolling');
   assert.ok(geometry.phase.bottom<=64,'phase band is in the site header');
   assert.ok(geometry.frame.bottom<=height,'full card fits window height');
   assert.ok(geometry.frame.height>=height*.55,'card uses the available play area');
   assert.ok(Math.abs((geometry.frame.left+geometry.frame.right-geometry.project.left-geometry.project.right)/2)<2,'card centered on table');
   assert.ok(geometry.actions.left>=geometry.project.right,'controls beside card');
   assert.ok(geometry.players.left>=geometry.actions.right,'compact participants are at the right');
   assert.ok(geometry.font.includes('Hanken'),'phase uses requested sans-serif font');
   if(width===1440)await screenshot(page,'DESKTOP_NEW_DEBATE.png');
  }
  const roleButton=page.locator('#show-role');
  const privateCard=page.locator('#role .gi-private-role-card');
  const coin=page.locator('.gi-desktop-wallet img');
  assert.equal((await coin.boundingBox()).width,88);
  assert.equal(await privateCard.isVisible(),false);
  await roleButton.hover();
  await page.mouse.down();
  await privateCard.locator('img').waitFor();
  await page.waitForFunction(()=>document.querySelector('#role .gi-private-role-card img')?.naturalWidth>0);
  await screenshot(page,'DESKTOP_ROLE_CARD.png');
  await page.mouse.up();
  await privateCard.waitFor({state:'hidden'});
  await roleButton.focus();
  await page.keyboard.down('Space');
  await privateCard.waitFor();
  await page.keyboard.up('Space');
  await privateCard.waitFor({state:'hidden'});
  // Compare the exact same renderer/state with and without the appended desktop block.
  const css=fs.readFileSync(path.join(__dirname,'../ui/style.css'),'utf8');
  const baseline=css.split('/* Desktop game — Garden table.')[0];
  const fingerprint=()=>page.evaluate(()=>[...document.querySelectorAll('.gi-phase-header,.gi-area-project,.gi-card-image-viewport,.gi-area-actions,.gi-area-discussion')].map(el=>{const box=el.getBoundingClientRect(),s=getComputedStyle(el);return [box.x,box.y,box.width,box.height,s.display,s.fontFamily,s.fontSize,s.backgroundColor,s.padding,s.borderRadius];}));
  for(const width of [390,768,1199]){
   await page.setViewportSize({width,height:900});await page.reload();await page.locator('.gi-card-image-viewport img').waitFor();await page.evaluate(()=>document.fonts.ready);
   const redesigned=await fingerprint();
   await page.route('**/style.css',route=>route.fulfill({contentType:'text/css',body:baseline}));
   await page.reload();await page.locator('.gi-card-image-viewport img').waitFor();await page.evaluate(()=>document.fonts.ready);
   assert.deepEqual(await fingerprint(),redesigned,'protected layout unchanged at '+width);
   await page.unroute('**/style.css');
  }
  await page.setViewportSize({width:1440,height:900});await page.reload();
  for(const phase of ['BLIND_ACTION','REVEAL']){
   now=room.deadline;manager.tick();await page.waitForFunction(expected=>document.querySelector('.phase')?.textContent.includes(expected),phase==='BLIND_ACTION'?'HÀNH ĐỘNG':'CÔNG BỐ');
   await screenshot(page,'DESKTOP_NEW_'+phase+'.png');
  }
  while(room.state.phase!=='GAME_OVER'){now=room.deadline;manager.tick();}
  await page.waitForFunction(()=>document.querySelector('.phase')?.textContent.includes('KẾT THÚC'));
  await screenshot(page,'DESKTOP_NEW_GAME_OVER.png');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('unlocked investment and bank choices survive another player locking an action', {skip: !playwrightPath}, async () => {
  const {chromium} = require(playwrightPath);
  const {server, manager} = require('../server/server.cjs');
  let browser;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const {room, player} = manager.create('A');
    const second = manager.join(room.code, 'B').player;
    const third = manager.join(room.code, 'C').player;
    manager.connected(room, second); manager.connected(room, third);
    browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'msedge', headless:true});
    const page = await browser.newPage();
    await page.addInitScript(session => sessionStorage.setItem('green-impact-multiplayer-session', JSON.stringify(session)), {roomCode:room.code, playerId:player.id, token:player.secret});
    await page.goto(base);
    await page.locator('#start').click();
    await page.locator('[data-game-layout="four-areas"]').waitFor({timeout:1000});
    const deadline = room.deadline;
    manager.currentTime = () => deadline;
    manager.tick();
    await page.locator('#invest').check();
    await page.locator('#bank').selectOption('EXPEL');
    await page.locator('#target').selectOption(third.id);
    manager.submit(room, second, {action:{invest:false,bankAction:{type:'NONE'}}});
    await page.waitForFunction(() => document.querySelector('.people')?.textContent.includes('Đã khóa lệnh'));
    assert.equal(await page.locator('#invest').isChecked(), true);
    assert.equal(await page.locator('#bank').inputValue(), 'EXPEL');
    assert.equal(await page.locator('#target').inputValue(), third.id);
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

test('mobile gameplay follows server time, validates costs and completes ten rounds privately', {skip: !playwrightPath}, async () => {
  const {chromium}=require(playwrightPath);
  const {server,manager}=require('../server/server.cjs');
  let now=Date.now(),browser;
  manager.currentTime=()=>now;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const base='http://127.0.0.1:'+server.address().port;
    const {room,player}=manager.create('Người thử');
    for(let i=1;i<12;i++)manager.join(room.code,'Người '+i);
    for(const p of room.players)manager.connected(room,p);
    manager.join(room.code,'Người thứ 13');
    manager.connected(room,room.players.at(-1));
    assert.equal(room.players.length,13,'the room must not be capped at eight or twelve');
    browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await page.addInitScript(session=>{
      sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(session));
      const realNow=Date.now;Date.now=()=>realNow()+3600000;
    },{roomCode:room.code,playerId:player.id,token:player.secret});
    await page.goto(base);await page.locator('#start').click();
    const projectCard=page.locator('.gi-area-project .gi-card-image-viewport img');
    await projectCard.waitFor();
    await page.waitForFunction(()=>{const image=document.querySelector('.gi-area-project .gi-card-image-viewport img');return image?.complete&&image.naturalWidth>0;});
    const cardGeometry=await projectCard.evaluate(image=>{
      const frame=image.closest('.gi-card-image-viewport'),box=frame.getBoundingClientRect(),button=frame.closest('button').getBoundingClientRect();
      const ratio=getComputedStyle(frame).aspectRatio.split('/').map(Number);
      return {center:(box.left+box.right)/2,buttonCenter:(button.left+button.right)/2,ratio:box.width/box.height,expected:ratio[0]/ratio[1]};
    });
    assert.ok(Math.abs(cardGeometry.center-cardGeometry.buttonCenter)<1,'mobile project card must stay centered');
    assert.ok(Math.abs(cardGeometry.ratio-cardGeometry.expected)<.002,'mobile crop frame must retain its measured artwork ratio');
    await screenshot(page,'EE_MOBILE_CARD_FIXED.png');
    await page.locator('#statement-text').fill('Giữ nguyên nội dung chưa gửi');
    manager.submit(room,room.players[1],{text:'Ý kiến công khai',stance:'SUPPORT'});
    await page.waitForFunction(()=>document.querySelector('.gi-statement')?.textContent.includes('Ý kiến công khai'));
    assert.equal(await page.locator('#statement-text').inputValue(),'Giữ nguyên nội dung chưa gửi');
    assert.ok(parseInt(await page.locator('#clock').textContent(),10)>=118,'client clock skew must not expire the timer');
    for(const width of [320,390,768,1440]){
      await page.setViewportSize({width,height:900});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow at '+width);
      if(width<760){
        const frame=await page.locator('.gi-area-project .gi-card-image-viewport').evaluate(el=>{const box=el.getBoundingClientRect(),ratio=getComputedStyle(el).aspectRatio.split('/').map(Number);return {actual:box.width/box.height,expected:ratio[0]/ratio[1]};});
        assert.ok(Math.abs(frame.actual-frame.expected)<.002,'card aspect ratio preserved at '+width);
      }
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('#toggle-players').click();
    assert.equal(await page.locator('#players-panel').isVisible(),true);
    await page.locator('#close-players').click();
    assert.equal(await page.locator('#players-panel').isVisible(),false);
    const image=page.locator('.gi-area-project .gi-card-image-viewport img');
    await image.waitFor();assert.equal(await image.evaluate(i=>i.complete&&i.naturalWidth>0),true);
    assert.equal(await image.evaluate(i=>getComputedStyle(i).objectFit),'contain');
    assert.ok((await image.boundingBox()).width>=250,'mobile card must remain large');
    assert.notEqual(await image.evaluate(i=>getComputedStyle(i).clipPath),'none','mobile card removes exterior margin');
    await page.locator('.gi-card-button').click();
    const full=page.locator('.gi-card-dialog .gi-card-image-viewport img');
    assert.equal(await full.evaluate(i=>i.complete&&i.naturalWidth>0),true);
    assert.notEqual(await full.evaluate(i=>getComputedStyle(i).clipPath),'none','enlarged card removes exterior margin');
    assert.equal(await full.evaluate(i=>i.currentSrc),await image.evaluate(i=>i.currentSrc),'enlarged card uses the same image');
    await page.locator('.gi-card-dialog button').click();

    const hdImageRoute=/\/cards-hd(?:-webp)?\/PROJ_\d{2}\.(?:png|webp)/;
    await page.route(hdImageRoute,route=>route.abort());
    await page.reload();
    const fallback=page.locator('.gi-card-preview .gi-card-image-viewport img');
    await page.waitForFunction(()=>{const i=document.querySelector('.gi-card-preview .gi-card-image-viewport img');return i?.complete&&i.naturalWidth>0&&i.currentSrc.includes('/cards/');});
    assert.notEqual(await fallback.evaluate(i=>getComputedStyle(i).clipPath),'none','original fallback keeps its own frame');
    await page.locator('.gi-card-button').click();
    const fallbackFull=page.locator('.gi-card-dialog .gi-card-image-viewport img');
    await fallbackFull.waitFor();
    assert.ok((await fallbackFull.evaluate(i=>i.currentSrc)).includes('/cards/'));
    assert.notEqual(await fallbackFull.evaluate(i=>getComputedStyle(i).clipPath),'none');
    await page.locator('.gi-card-dialog button').click();
    await page.unroute(hdImageRoute);
    const projectImageRoute=/\/cards(?:-hd(?:-webp)?)?\/PROJ_\d{2}\.(?:png|webp)/;
    await page.route(projectImageRoute,route=>route.abort());
    await page.reload();
    await page.locator('.gi-project-card-failed').waitFor();
    assert.equal(await page.locator('.gi-project-accessible-copy').evaluate(el=>getComputedStyle(el).position),'static');
    assert.ok((await page.locator('.gi-project-accessible-copy').textContent()).includes(room.state.projects.find(p=>p.id===room.state.deckIds[0]).title));
    await page.unroute(projectImageRoute);await page.reload();
    await page.locator('#mobile-show-role').focus();await page.keyboard.down('Space');
    assert.equal(await page.locator('#mobile-role-value').isVisible(),true);
    const privateCard=page.locator('#mobile-role-value img');
    await privateCard.waitFor({state:'visible'});
    await page.waitForFunction(()=>document.querySelector('#mobile-role-value img')?.naturalWidth>0);
    assert.ok((await privateCard.evaluate(img=>img.currentSrc)).includes('/ROLE_'+manager.view(room,player).game.myPlayer.role),'hold shows only the current player’s original role artwork');
    await screenshot(page,'MOBILE_HOLD_ROLE_CARD.png');
    await page.keyboard.up('Space');assert.equal(await page.locator('#mobile-role-value').isVisible(),false);
    const eyeBox=await page.locator('#mobile-show-role').boundingBox();
    await page.mouse.move(eyeBox.x+eyeBox.width/2,eyeBox.y+eyeBox.height/2);await page.mouse.down();
    assert.equal(await privateCard.isVisible(),true,'a repeated pointer hold also shows the card');
    await page.mouse.up();assert.equal(await privateCard.isVisible(),false,'pointer release hides the card');
    await page.mouse.down();await page.locator('#mobile-show-role').dispatchEvent('pointercancel');
    assert.equal(await privateCard.isVisible(),false,'cancelling the touch hides the card');await page.mouse.up();
    now=room.deadline;manager.tick();
    await page.locator('#bank').selectOption('INSPECT');
    assert.equal(await page.locator('#lock-action').isDisabled(),true);
    await page.locator('#bank').selectOption('EXPEL');await page.locator('#invest').check();
    assert.equal(await page.locator('#lock-action').isEnabled(),true,'1 investment + 1 contribution fits two coins');
    await page.locator('#amount').selectOption('2');
    assert.equal(await page.locator('#lock-action').isDisabled(),true);
    await page.locator('#bank').selectOption('NONE');await page.locator('#invest').uncheck();
    await page.locator('#lock-action').click();
    await page.waitForFunction(()=>!document.querySelector('#action-form'));
    for(const p of room.players.slice(1))manager.submit(room,p,{action:{invest:false,bankAction:{type:'NONE'}}});
    now=room.deadline;manager.tick();
    await page.waitForFunction(()=>document.querySelector('.phase')?.textContent.includes('CÔNG BỐ'));
    assert.equal(await page.locator('#phase-progress').getAttribute('max'),'25');
    await page.evaluate(()=>scrollTo(0,0));await screenshot(page,'EE_MOBILE_REVEAL.png');
    for(const p of room.players){const v=manager.view(room,p).game;assert.ok(v.players.every(other=>!Object.hasOwn(other,'role')&&!Object.hasOwn(other,'coins')));}
    while(room.state.phase!=='GAME_OVER'){now=room.deadline;manager.tick();}
    await page.waitForFunction(()=>document.querySelector('.phase')?.textContent.includes('KẾT THÚC'));
    assert.equal(room.state.round,10);assert.equal(await page.locator('#phase-progress').count(),0);
    assert.ok(manager.view(room,player).game.players.every(p=>Object.hasOwn(p,'role')));
    assert.ok((await page.locator('.gi-action-panel').textContent()).includes('HÒA'));
    await page.setViewportSize({width:1440,height:1000});
    await screenshot(page,'EE_DESKTOP_FINAL.png');
    const expired=await browser.newPage();
    await expired.addInitScript(()=>{if(!sessionStorage.getItem('expired-seeded')){sessionStorage.setItem('expired-seeded','1');sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify({roomCode:'ZZZZZZ',playerId:'old',token:'a'.repeat(64)}));}});
    await expired.goto(base);await expired.locator('#return-home').waitFor();
    await expired.locator('#return-home').click();await expired.locator('#form-create').waitFor();
    await expired.locator('#create-name').fill('Kiểm tra mất mạng');
    await expired.locator('#form-create button').click();
    await expired.locator('#leave').waitFor();
    await expired.route('**/api/action',route=>route.abort());
    await expired.locator('#leave').click();
    await expired.waitForFunction(()=>document.querySelector('#toast')?.classList.contains('show'));
    assert.equal(await expired.locator('#leave').isVisible(),true,'a failed leave must preserve the active session');
  } finally {
    if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
});
