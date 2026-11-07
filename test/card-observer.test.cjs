'use strict';
const test=require('node:test'),assert=require('node:assert/strict');

test('clock flames and input text do not rescan already-enhanced cards',{skip:!process.env.PLAYWRIGHT_MODULE_PATH},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH),{server,manager}=require('../server/server.cjs');
 let browser;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const {room,player}=manager.create('Card observer QA');manager.join(room.code,'A');manager.join(room.code,'B');
  for(const peer of room.players)manager.connected(room,peer);manager.start(room,player);
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.addInitScript(session=>{
   sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(session));
   window.pictureScans=0;
   const query=Element.prototype.querySelectorAll;
   Element.prototype.querySelectorAll=function(selector){
    if(this.id==='app'&&selector.startsWith('picture'))window.pictureScans++;
    return query.call(this,selector);
   };
  },{roomCode:room.code,playerId:player.id,token:player.secret});
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>document.querySelector('.gi-area-project .gi-card-image-viewport img')?.naturalWidth>0);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{pictureScans=0;resolve();})));
  await page.locator('#statement-text').fill('Nhận định có đủ thông tin để gửi.');
  await page.waitForFunction(()=>document.getElementById('statement-counter')?.textContent.startsWith('33'));
  assert.equal(await page.evaluate(()=>pictureScans),0,'typing text must not reprocess images');
  await page.evaluate(()=>{
   pictureScans=0;window.burnSamples=[];
   const sample=()=>{
    if(document.querySelector('.gi-clock-fire'))burnSamples.push({scans:pictureScans,time:document.querySelector('#clock').textContent});
    if(!document.querySelector('#lock-action'))requestAnimationFrame(sample);
   };
   requestAnimationFrame(sample);
  });
  for(const peer of room.players)manager.skipDiscussion(room,peer);
  await page.locator('#lock-action').waitFor();
  const samples=await page.evaluate(()=>burnSamples);
  assert.ok(samples.length>10,'the actual two-second flame was sampled across animation frames');
  assert.ok(new Set(samples.map(sample=>sample.time)).size>1,'the timer changed during the flame');
  assert.ok(Math.max(...samples.map(sample=>sample.scans))<=2,'clock frames do not repeatedly scan card subtrees');
  assert.equal(await page.locator('.gi-area-project .gi-card-preview').count(),1,'phase updates keep one enhanced project card');
  const eye=page.locator('#show-role');await eye.hover();await page.mouse.down();
  await page.locator('#role .gi-private-role-card').waitFor({state:'visible'});await page.mouse.up();
  await page.locator('#role .gi-private-role-card').waitFor({state:'hidden'});
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
