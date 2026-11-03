'use strict';
const test=require('node:test'),assert=require('node:assert/strict');

test('countdown drains continuously and never refills on a same-phase snapshot',{skip:!process.env.PLAYWRIGHT_MODULE_PATH},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH),{server,manager}=require('../server/server.cjs');
 let browser,now=Date.now();manager.currentTime=()=>now;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const {room,player}=manager.create('Clock QA');manager.join(room.code,'A');manager.join(room.code,'B');
  for(const peer of room.players)manager.connected(room,peer);
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.addInitScript(session=>sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(session)),{roomCode:room.code,playerId:player.id,token:player.secret});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#start').click();await page.locator('#phase-progress').waitFor();
  const sample=()=>page.evaluate(()=>new Promise(resolve=>{
   const values=[],start=performance.now();
   function frame(now){values.push(document.querySelector('#phase-progress').value);if(now-start<650)requestAnimationFrame(frame);else resolve(values);}
   requestAnimationFrame(frame);
  }));
  const values=await sample();
  assert.ok(new Set(values.map(value=>value.toFixed(2))).size>=8,'the bar changes between integer-second ticks');
  assert.ok(values.some(value=>value%1!==0),'progress retains fractional seconds');
  const before=await page.locator('#phase-progress').evaluate(el=>el.value);
  // A delayed/stale timestamp in a new presence revision must not refill time.
  manager.connected(room,room.players[1]);await page.waitForTimeout(120);
  assert.ok(await page.locator('#phase-progress').evaluate(el=>el.value)<=before,'same-phase sync cannot run backwards');
  now=room.deadline;manager.tick();await page.locator('#lock-action').waitFor();
  assert.equal(await page.locator('#phase-progress').getAttribute('max'),'60');
  assert.ok(await page.locator('#phase-progress').evaluate(el=>el.value)>59,'a new phase gets its full authoritative duration');
  now=room.deadline;manager.tick();await page.locator('#next').waitFor();
  assert.equal(await page.locator('#phase-progress').getAttribute('max'),'25');
  while(room.state.phase!=='GAME_OVER'){now=room.deadline;manager.tick();}
  await page.locator('.gi-ending-screen').waitFor();assert.equal(await page.locator('#phase-progress').count(),0);
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('unchanged polling snapshots keep the countdown connected',{skip:!process.env.PLAYWRIGHT_MODULE_PATH},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH),{server,manager}=require('../server/server.cjs');let browser;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const {room,player}=manager.create('Polling clock QA');manager.join(room.code,'A');manager.join(room.code,'B');
  for(const peer of room.players)manager.connected(room,peer);manager.start(room,player);
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});const page=await browser.newPage();
  await page.addInitScript(s=>sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(s)),{roomCode:room.code,playerId:player.id,token:player.secret,transport:'poll'});
  let reads=0;const repeatedPoll=new Promise(resolve=>page.on('response',response=>{if(response.url().includes('/api/state?')&&++reads===2)resolve();}));
  await page.goto('http://127.0.0.1:'+server.address().port);await repeatedPoll;
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#connection').textContent(),'● Trực tuyến','an unchanged response must not break the polling loop');
  assert.ok(await page.locator('#phase-progress').evaluate(el=>el.value%1!==0));
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
