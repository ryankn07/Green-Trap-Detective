'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const playwrightPath=process.env.PLAYWRIGHT_MODULE_PATH;
function trackMotion(session){
 if(session)sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(session));
 window.playedMotion=[];
 const animate=Element.prototype.animate;
 Element.prototype.animate=function(frames,options){window.playedMotion.push({id:options?.id,frames});return animate.call(this,frames,options);};
}

test('card and result motion wait for the chapter, survive presence, and do not replay',{skip:!playwrightPath},async()=>{
 const {chromium}=require(playwrightPath),{server,manager}=require('../server/server.cjs');let browser,now=Date.now();manager.currentTime=()=>now;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const {room,player}=manager.create('Scene coordination');manager.join(room.code,'Peer A');manager.join(room.code,'Peer B');room.players.forEach(peer=>manager.connected(room,peer));
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.addInitScript(trackMotion,{roomCode:room.code,playerId:player.id,token:player.secret});await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(()=>{window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),350);window.cancelAnimationFrame=id=>clearTimeout(id);});
  await page.locator('#start').click();await page.locator('.gi-phase-transition[data-transition=project]').waitFor();
  assert.equal(await page.evaluate(()=>window.playedMotion.filter(m=>m.id==='gt-motion-card').length),0,'card entrance is not spent beneath the full-screen chapter');
  manager.changed(room);await page.waitForFunction(revision=>snapshot.room.revision>=revision,room.revision);
  await page.locator('.gi-phase-transition').waitFor({state:'detached'});await page.waitForFunction(()=>window.playedMotion.some(m=>m.id==='gt-motion-card'));
  assert.equal(await page.evaluate(()=>window.playedMotion.filter(m=>m.id==='gt-motion-card').length),1,'presence retains one pending scene for the current DOM');
  now=room.deadline;manager.tick();await page.locator('#lock-action').waitFor();now=room.deadline;manager.tick();await page.locator('#next').waitFor();
  await page.locator('.gi-phase-transition[data-phase=REVEAL]').waitFor();assert.equal(await page.evaluate(()=>window.playedMotion.filter(m=>m.id==='gt-motion-reveal').length),0);
  manager.changed(room);await page.waitForFunction(revision=>snapshot.room.revision>=revision,room.revision);
  await page.locator('.gi-phase-transition').waitFor({state:'detached'});await page.waitForFunction(()=>window.playedMotion.some(m=>m.id==='gt-motion-reveal'));
  manager.changed(room);await page.waitForFunction(revision=>snapshot.room.revision>=revision,room.revision);
  assert.equal(await page.evaluate(()=>window.playedMotion.filter(m=>m.id==='gt-motion-reveal').length),1);
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('confirmed actions animate once, while presence and replayed snapshots stay quiet',{skip:!playwrightPath},async()=>{
 const {chromium}=require(playwrightPath),{server,manager}=require('../server/server.cjs');
 let browser,now=Date.now();manager.currentTime=()=>now;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const {room,player}=manager.create('Motion host');
  for(let i=1;i<13;i++)manager.join(room.code,'Peer '+i);
  for(const p of room.players)manager.connected(room,p);
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.addInitScript(trackMotion,{roomCode:room.code,playerId:player.id,token:player.secret});
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.locator('#start').click();await page.locator('#statement-text').waitFor();
  await page.waitForFunction(()=>window.playedMotion.filter(m=>m.id==='gt-motion-card').length===1);
  const discussionBefore=await page.locator('.gi-area-discussion').boundingBox();
  await page.locator('#statement-text').fill('Một nhận định để kiểm tra hiệu ứng.');
  await page.locator('#statement button[type=submit]').click();
  await page.locator('#statement').waitFor({state:'detached'});
  await page.waitForFunction(()=>window.playedMotion.some(m=>m.id==='gt-motion-collapse'));
  assert.equal(await page.evaluate(()=>window.playedMotion.filter(m=>m.id==='gt-motion-collapse').length),1);
  await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.id==='gt-motion-collapse').map(a=>a.finished.catch(()=>{}))));
  assert.ok((await page.locator('.gi-area-discussion').boundingBox()).y<discussionBefore.y-100,'confirmation brings public discussion up');
  const before=await page.evaluate(()=>window.playedMotion.length);
  manager.connected(room,room.players[1]);
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>window.playedMotion.length),before,'presence does not restart motion');
  manager.submit(room,room.players[1],{text:'Một nhận định mới của người chơi khác.',stance:'SUPPORT'});
  await page.waitForFunction(()=>window.playedMotion.filter(m=>m.id==='gt-motion-statement').length===2);
  for(const peer of room.players.slice(2,-1))manager.submit(room,peer,{text:'Cần đối chiếu tác động của dự án trước khi đầu tư. '.repeat(7),stance:'UNSURE'});
  await page.waitForFunction(()=>document.querySelectorAll('.gi-statement').length===12);
  const history=page.locator('.gi-area-discussion>.card:first-child>.hist');
  const scrollTop=await history.evaluate(el=>{el.scrollTop=180;return el.scrollTop;});assert.ok(scrollTop>0);
  manager.submit(room,room.players.at(-1),{text:'Nhận định đến khi người đọc đang cuộn.',stance:'OPPOSE'});
  await page.getByText('Nhận định đến khi người đọc đang cuộn.',{exact:true}).waitFor();
  assert.equal(await history.evaluate(el=>el.scrollTop),scrollTop,'a new statement preserves the reading position');
  now=room.deadline;manager.tick();await page.locator('#lock-action').waitFor();
  await page.locator('#invest').check();
  await page.locator('#lock-action').click();await page.locator('#action-form').waitFor({state:'detached'});
  await page.waitForFunction(()=>window.playedMotion.filter(m=>m.id==='gt-motion-collapse').length===2);
  now=room.deadline;manager.tick();await page.locator('#next').waitFor();
  await page.waitForFunction(()=>window.playedMotion.some(m=>m.id==='gt-motion-reveal'));
  await page.waitForFunction(()=>window.playedMotion.some(m=>m.id==='gt-motion-balance'));
  await page.locator('#next').click();await page.locator('#statement-text').waitFor();
  await page.waitForFunction(()=>window.playedMotion.filter(m=>m.id==='gt-motion-card').length===2);
  await page.reload();await page.locator('#statement-text').waitFor();
  assert.equal(await page.evaluate(()=>window.playedMotion.filter(m=>m.id==='gt-motion-card').length),0,'reconnect does not replay the current card entrance');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('reduced motion keeps feedback, preserves failed drafts and releases pending controls',{skip:!playwrightPath},async()=>{
 const {chromium}=require(playwrightPath),{server,manager}=require('../server/server.cjs');
 let browser,release;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const {room,player}=manager.create('Reduced-motion host');
  manager.join(room.code,'A');manager.join(room.code,'B');for(const p of room.players)manager.connected(room,p);
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  await page.addInitScript(trackMotion,{roomCode:room.code,playerId:player.id,token:player.secret});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#start').click();await page.locator('#statement-text').waitFor();
  await page.locator('#statement-text').fill('Nhận định cần được giữ lại khi gửi lỗi.');
  await page.route('**/api/action',async route=>{
   if(route.request().postDataJSON().type!=='submit')return route.continue();
   await new Promise(resolve=>{release=resolve;});
   await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Thử gửi lại nhận định.'})});
  });
  await page.locator('#statement button').click();
  await page.waitForFunction(()=>document.querySelector('#statement button')?.getAttribute('aria-busy')==='true');
  assert.equal(await page.locator('#statement button').isDisabled(),true);
  release();await page.waitForFunction(()=>!document.querySelector('#statement button').disabled);
  assert.equal(await page.locator('#statement-text').inputValue(),'Nhận định cần được giữ lại khi gửi lỗi.');
  await page.waitForFunction(()=>window.playedMotion.some(m=>m.id==='gt-motion-error'));
  assert.ok(await page.evaluate(()=>window.playedMotion.every(m=>m.frames.every(f=>!('transform'in f)&&!('gridTemplateRows'in f)))),'reduced motion has no spatial animation');
 }finally{release?.();if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('home and lobby effects cancel on interruption and mobile privacy stays immediate',{skip:!playwrightPath},async()=>{
 const {chromium}=require(playwrightPath),{server,manager}=require('../server/server.cjs');let browser;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.addInitScript(trackMotion);
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>window.playedMotion.filter(m=>m.id==='gt-motion-home').length===3);
  await page.evaluate(()=>document.getAnimations().filter(a=>a.id.startsWith('gt-motion-')).forEach(a=>a.pause()));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>!document.getAnimations().some(a=>a.id.startsWith('gt-motion-')));
  await page.emulateMedia({reducedMotion:'no-preference'});
  assert.equal(await page.evaluate(()=>window.playedMotion.filter(m=>m.id==='gt-motion-home').length),3,'changing preferences never replays home');
  await page.locator('#create-name').fill('Motion mobile');await page.locator('#form-create button').click();await page.locator('#leave').waitFor();
  const room=[...manager.rooms.values()].find(r=>r.players[0].name==='Motion mobile');
  manager.join(room.code,'Joined once');
  await page.waitForFunction(()=>window.playedMotion.some(m=>m.id==='gt-motion-member'));
  manager.join(room.code,'Third player');for(const peer of room.players)manager.connected(room,peer);
  await page.locator('#start').click();await page.locator('#mobile-show-role').waitFor();
  await page.waitForFunction(()=>window.playedMotion.some(m=>m.id==='gt-motion-card'));
  assert.ok(await page.evaluate(()=>window.playedMotion.filter(m=>m.id==='gt-motion-card').every(m=>m.frames.every(f=>!('transform'in f)))),'mobile card entrance preserves artwork bounds');
  await page.locator('#toggle-players').click();
  await page.waitForFunction(()=>window.playedMotion.some(m=>m.id==='gt-motion-panel'));
  await page.evaluate(()=>{document.getAnimations().filter(a=>a.id.startsWith('gt-motion-')).forEach(a=>a.pause());window.dispatchEvent(new PageTransitionEvent('pagehide'));});
  assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.id.startsWith('gt-motion-')).length),0,'leaving the page cancels running effects');
  await page.locator('#close-players').click();
  const eye=page.locator('#mobile-show-role'),box=await eye.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  assert.equal(await page.locator('#mobile-role-value').isVisible(),true);
  await page.mouse.up();assert.equal(await page.locator('#mobile-role-value').isVisible(),false,'role hides immediately with motion enabled');
  assert.equal(await page.evaluate(()=>window.playedMotion.some(m=>m.id==='gt-motion-collapse')),false,'mobile does not acquire desktop layout animation');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
