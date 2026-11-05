'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const playwrightPath=process.env.PLAYWRIGHT_MODULE_PATH;

test('full rules are readable from the lobby, survive room updates and keep keyboard focus', {skip:!playwrightPath},async()=>{
 const {chromium}=require(playwrightPath),{server,manager}=require('../server/server.cjs');let browser;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const {room,player:host}=manager.create('Chủ phòng QA'),viewer=manager.join(room.code,'Người đọc luật').player;
  manager.join(room.code,'Bạn cùng phòng');room.players.forEach(player=>manager.connected(room,player));
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(session=>sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(session)),{roomCode:room.code,playerId:viewer.id,token:viewer.secret});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('.lobby-rules [data-open-rules]').waitFor();await page.evaluate(()=>document.fonts.ready);
  const dialog=page.locator('#rules-dialog'),content=page.locator('#rules-content');
  assert.equal(await page.locator('.lobby-rules #leave').innerText(),'Rời phòng');
  assert.equal(await page.locator('.lobby-rules [data-open-rules]').innerText(),'Xem toàn bộ luật chơi');
  await page.locator('[data-open-rules]').click();
  assert.equal(await dialog.evaluate(node=>node.open),true);assert.equal(await page.locator('#rules-close').evaluate(node=>node===document.activeElement),true);
  assert.equal(await page.locator('.rules-content section').count(),8);
  assert.ok((await page.locator('.rules-note').innerText()).includes('kể cả khi dự án không được thông qua'));
  assert.equal(room.state,null,'reading the rules never starts a match');
  await page.evaluate(()=>{window.savedRulesDialog=document.getElementById('rules-dialog');window.originalRulesTrigger=document.querySelector('[data-open-rules]');});
  await page.locator('.rules-index a[href="#rules-winning"]').click();
  assert.equal(await page.evaluate(()=>location.hash),'','contents navigation does not change the room URL');
  const scroll=await content.evaluate(node=>node.scrollTop);assert.ok(scroll>0);
  const peer=manager.join(room.code,'Bạn mới').player;manager.connected(room,peer);
  await page.waitForFunction(revision=>snapshot.room.revision>=revision,room.revision);
  assert.equal(await dialog.evaluate(node=>node===window.savedRulesDialog&&node.open),true);
  assert.equal(await page.evaluate(()=>window.originalRulesTrigger.isConnected),false,'the lobby trigger was replaced by a live update');
  assert.ok(Math.abs(await content.evaluate(node=>node.scrollTop)-scroll)<2,'presence keeps reading position');
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.getElementById('rules-dialog').open);
  await page.waitForFunction(()=>document.querySelector('[data-open-rules]')===document.activeElement);
  assert.equal(await page.locator('[data-open-rules]').evaluate(node=>node===document.activeElement),true,'focus returns to the current trigger');

  for(const [width,height] of [[320,700],[390,844],[768,1024],[844,390],[1440,900],[1920,1080]]){
   await page.setViewportSize({width,height});await page.locator('[data-open-rules]').click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no page overflow at '+width);
   const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height,'rules fit '+width);
   const layout=await content.evaluate(node=>({height:node.clientHeight,total:node.scrollHeight,overflow:node.scrollWidth>node.clientWidth}));
   assert.ok(layout.total>layout.height,'long rules scroll inside the dialog');assert.equal(layout.overflow,false,'rules do not scroll sideways');
   await content.evaluate(node=>{node.scrollTop=node.scrollHeight;});
   const close=await page.locator('#rules-close').boundingBox();assert.ok(close.width>=44&&close.height>=44&&close.y>=0&&close.y+close.height<=height,'close remains reachable after scrolling');
   await page.locator('#rules-winning').evaluate(node=>node.scrollIntoView({block:'start'}));
   assert.equal(await page.locator('#rules-winning').isVisible(),true);
   if(process.env.BROWSER_ARTIFACT_DIR&&(width===390||width===1440)){
    fs.mkdirSync(process.env.BROWSER_ARTIFACT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.BROWSER_ARTIFACT_DIR,'RULES_'+width+'.png')});
   }
   await page.locator('#rules-close').click();await page.waitForFunction(()=>!document.getElementById('rules-dialog').open);
  }
  await page.setViewportSize({width:1440,height:900});await page.locator('[data-open-rules]').click();await page.mouse.click(2,2);
  assert.equal(await dialog.evaluate(node=>node.open),false,'backdrop closes');
  await page.locator('[data-open-rules]').click();manager.start(room,host);
  await page.waitForFunction(()=>snapshot.game?.phase==='DEBATE');
  assert.equal(await dialog.evaluate(node=>node.open),true,'starting the match does not interrupt reading');
  await page.locator('#rules-close').click();await page.waitForFunction(()=>!document.documentElement.classList.contains('rules-showing'));
  assert.equal(await page.evaluate(()=>document.activeElement!==document.body),true,'closing after the lobby is gone still restores a usable focus');
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
