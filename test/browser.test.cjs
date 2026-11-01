'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const playwrightPath = process.env.PLAYWRIGHT_MODULE_PATH;
async function screenshot(page,name){
  if(!process.env.BROWSER_ARTIFACT_DIR)return;
  const fs=require('node:fs'),path=require('node:path');
  fs.mkdirSync(process.env.BROWSER_ARTIFACT_DIR,{recursive:true});
  await page.screenshot({path:path.join(process.env.BROWSER_ARTIFACT_DIR,name),fullPage:true});
}

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
    await page.locator('#statement-text').fill('Giữ nguyên nội dung chưa gửi');
    manager.submit(room,room.players[1],{text:'Ý kiến công khai',stance:'SUPPORT'});
    await page.waitForFunction(()=>document.querySelector('.gi-statement')?.textContent.includes('Ý kiến công khai'));
    assert.equal(await page.locator('#statement-text').inputValue(),'Giữ nguyên nội dung chưa gửi');
    assert.ok(parseInt(await page.locator('#clock').textContent(),10)>=118,'client clock skew must not expire the timer');
    for(const width of [320,390,768,1440]){
      await page.setViewportSize({width,height:900});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow at '+width);
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('#toggle-players').click();
    assert.equal(await page.locator('#players-panel').isVisible(),true);
    await page.locator('#close-players').click();
    assert.equal(await page.locator('#players-panel').isVisible(),false);
    const image=page.locator('.gi-card-image-viewport img');
    await image.waitFor();assert.equal(await image.evaluate(i=>i.complete&&i.naturalWidth>0),true);
    assert.equal(await image.evaluate(i=>getComputedStyle(i).objectFit),'contain');
    assert.ok((await image.boundingBox()).width>=250,'mobile card must remain large');
    const projectImageRoute=/\/cards(?:-hd)?\/PROJ_\d{2}\.png/;
    await page.route(projectImageRoute,route=>route.abort());
    await page.reload();
    await page.locator('.gi-project-card-failed').waitFor();
    assert.equal(await page.locator('.gi-project-accessible-copy').evaluate(el=>getComputedStyle(el).position),'static');
    assert.ok((await page.locator('.gi-project-accessible-copy').textContent()).includes(room.state.projects.find(p=>p.id===room.state.deckIds[0]).title));
    await page.unroute(projectImageRoute);await page.reload();
    await page.locator('#show-role').focus();await page.keyboard.down('Space');
    assert.notEqual(await page.locator('#role-value').textContent(),'••••••');
    await page.keyboard.up('Space');assert.equal(await page.locator('#role-value').textContent(),'••••••');
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
