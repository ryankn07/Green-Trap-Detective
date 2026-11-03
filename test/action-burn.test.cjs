'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const engine=require('../engine/dist/index.js'),projects=require('../engine/dist/data/projects.json');
const {RoomManager}=require('../server/rooms.cjs');
const none={invest:false,bankAction:{type:'NONE'}};
function prepare(manager,mode='normal'){
 const {room,player}=manager.create('Mai Anh');manager.join(room.code,'Minh Quân');manager.join(room.code,'Bảo An');
 room.players.forEach(p=>manager.connected(room,p));
 let s=engine.createGame({gameId:'burn-'+room.code,players:room.players.map((p,index)=>({id:p.id,name:p.name,role:index===2?'SABOTEUR':'PROTECTOR'})),projects,deckIds:projects.slice(0,mode==='draw'?1:10).map(p=>p.id),roundLimit:mode==='draw'?1:10});
 if(mode==='vote')s={...s,players:s.players.map(p=>({...p,coins:5}))};
 for(const p of s.players)s=engine.submitStatement(s,p.id,'Nhận định.');
 room.state=engine.openBlindPhase(s);manager.phaseDeadline(room);manager.changed(room);
 return {room,player};
}
test('the final valid lock resolves once with a public fast-forward marker; an offline voter still counts',()=>{
 const manager=new RoomManager({currentTime:()=>100000}),{room,player}=prepare(manager),deadline=room.deadline;
 manager.disconnected(room,room.players[2]);manager.submit(room,player,{action:none});manager.submit(room,room.players[1],{action:none});
 assert.equal(room.state.phase,'BLIND_ACTION');assert.equal(room.deadline,deadline);
 assert.throws(()=>manager.submit(room,room.players[2],{action:{invest:true,bankAction:{type:'INSPECT',targetId:player.id}}}),{code:'INSUFFICIENT_COINS'});
 assert.equal(room.state.phase,'BLIND_ACTION');
 manager.submit(room,room.players[2],{action:none});assert.equal(room.state.phase,'REVEAL');assert.equal(room.deadline,125000);
 const view=manager.view(room,player).game;assert.equal(view.history.at(-1).fastForward,true);assert.equal(view.history.length,1);
 assert.ok(view.players.every(p=>!Object.hasOwn(p,'coins')&&!Object.hasOwn(p,'role')));
 assert.equal(Object.hasOwn(view,'lockedActions'),false);
 assert.throws(()=>manager.submit(room,player,{action:none}),{code:'INVALID_PHASE'});assert.equal(room.state.history.length,1);
});
test('timeout defaults keep their regular transition; kick consensus and write rollback are atomic',()=>{
 let now=100000;const manager=new RoomManager({currentTime:()=>now}),timed=prepare(manager);
 manager.submit(timed.room,timed.player,{action:none});now=timed.room.deadline;manager.tick();
 assert.equal(timed.room.state.phase,'REVEAL');assert.equal(timed.room.state.history.at(-1).fastForward,undefined);
 const kicked=prepare(manager);kicked.room.state={...kicked.room.state,players:kicked.room.state.players.map((p,index)=>({...p,role:index===1?'SABOTEUR':'PROTECTOR'}))};
 manager.submit(kicked.room,kicked.player,{action:none});manager.submit(kicked.room,kicked.room.players[1],{action:none});
 manager.kick(kicked.room,kicked.player,kicked.room.players[2].id);assert.equal(kicked.room.state.phase,'REVEAL');assert.equal(kicked.room.state.history.at(-1).fastForward,true);
 const rollback=prepare(manager);manager.submit(rollback.room,rollback.player,{action:none});manager.submit(rollback.room,rollback.room.players[1],{action:none});
 const deadline=rollback.room.deadline;manager.store={save(){throw Error('disk unavailable');}};
 assert.throws(()=>manager.submit(rollback.room,rollback.room.players[2],{action:none}),/disk unavailable/);
 assert.equal(rollback.room.state.phase,'BLIND_ACTION');assert.equal(rollback.room.deadline,deadline);
 assert.equal(rollback.room.state.history.length,0);assert.equal(Object.keys(rollback.room.state.lockedActions).length,2);
});
test('flame follows a rapidly shrinking bar before reveal/expulsion/ending on PC and phones',{
 skip:!process.env.PLAYWRIGHT_MODULE_PATH
},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH),{server,manager}=require('../server/server.cjs');
 let browser;const errors=[];await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  for(const [width,mode]of [[1440,'normal'],[390,'normal'],[320,'vote']]){
   const {room,player}=prepare(manager,mode),target=room.players[2].id;
   const page=await browser.newPage({viewport:{width,height:width===1440?900:844}});page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(s=>sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(s)),{roomCode:room.code,playerId:player.id,token:player.secret,...(width===390?{transport:'poll'}:{})});
   await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#lock-action').waitFor();
   manager.submit(room,room.players[1],{action:mode==='vote'?{invest:false,bankAction:{type:'EXPEL',targetId:target,amount:2}}:none});
   assert.equal(room.state.phase,'BLIND_ACTION');assert.equal(await page.locator('.gi-clock-fire').count(),0);
   manager.submit(room,room.players[2],{action:none});
   await page.waitForFunction(()=>snapshot.game.players.filter(p=>p.hasLockedAction).length===2);
   if(mode==='vote'){await page.locator('#bank').selectOption('EXPEL');await page.locator('#target').selectOption(target);await page.locator('#amount').selectOption('3');}
   await page.evaluate(()=>{
    window.burnFrames=[];window.burnEvents=[];
    new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes){
     if(node.nodeType!==1)continue;
     if(node.matches('.gi-clock-fire')){window.burnEvents.push({type:'fire',time:performance.now()});const sample=()=>{const progress=document.querySelector('#phase-progress'),fire=document.querySelector('.gi-clock-fire');if(!fire)return;const bar=progress.getBoundingClientRect(),tip=fire.getBoundingClientRect();window.burnFrames.push({time:performance.now(),value:progress.value,error:Math.abs(tip.x+tip.width/2-bar.left-bar.width*progress.value/progress.max)});requestAnimationFrame(sample);};requestAnimationFrame(sample);}
     if(node.matches('.gi-phase-transition'))window.burnEvents.push({type:node.dataset.phase,time:performance.now()});
    }for(const record of records)for(const node of record.removedNodes)if(node.nodeType===1&&node.matches('.gi-clock-fire'))window.burnEvents.push({type:'fire-end',time:performance.now()});}).observe(document.body,{subtree:true,childList:true});
   });
   await page.locator('#lock-action').click();await page.locator('.gi-clock-fire').waitFor();
   const started=await page.evaluate(()=>actionBurnHold.started);assert.equal(await page.evaluate(()=>app.inert),true);
   if(mode==='vote'){
    assert.equal(room.state.phase,'GAME_OVER');assert.equal(manager.rooms.has(room.code),false);
    assert.equal(await page.evaluate(()=>snapshot.game.phase),'GAME_OVER');assert.equal(await page.evaluate(()=>aborter.signal.aborted),true);
    assert.equal(await page.locator('.gi-ending-screen,[data-elimination-state=running]').count(),0);
   }else{
    assert.equal(room.state.phase,'REVEAL');manager.connected(room,room.players[1]);
    if(width!==390){await page.waitForFunction(revision=>snapshot.room.revision===revision,room.revision);assert.equal(await page.evaluate(()=>actionBurnHold.started),started,'presence must not rewind the accelerated clock');}
   }
   await page.waitForFunction(()=>actionBurnHold&&performance.now()-actionBurnHold.started>=650);
   const burnedPixels=await page.locator('.gi-clock-burn-layer').evaluate(canvas=>{
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let ash=0,heat=0;
    for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]<180)continue;if(pixels[i]<90&&pixels[i+1]<80&&pixels[i+2]<70)ash++;if(pixels[i]>200&&pixels[i+1]>80&&pixels[i+2]<180)heat++;}
    return {ash,heat};
   });
   assert.ok(burnedPixels.heat>50,'the draining bar retains visible fuel and live fire');
   assert.equal(burnedPixels.ash,0,'the consumed bar leaves no black ash trail');
   if(process.env.BROWSER_ARTIFACT_DIR){fs.mkdirSync(process.env.BROWSER_ARTIFACT_DIR,{recursive:true});await page.locator('.gi-phase-header').screenshot({path:path.join(process.env.BROWSER_ARTIFACT_DIR,'ACTION_FIRE_'+width+'.png')});}
   await page.locator('.gi-clock-fire').waitFor({state:'detached'});
   const frames=await page.evaluate(()=>window.burnFrames);assert.ok(frames.length>=4,'flame has live animation frames');
   assert.ok(frames.every((frame,i)=>frame.value>=0&&frame.error<2&&(!i||frame.value<=frames[i-1].value)),'flame remains on the shrinking fill edge');
   if(mode==='vote'){
    await page.locator('[data-elimination-state=running]').waitFor();await page.locator('.gi-ending-screen').waitFor();await page.locator('.gi-phase-transition[data-phase=GAME_OVER]').waitFor();
   }else{
    await page.locator('.gi-phase-transition[data-phase=REVEAL]').waitFor();assert.equal(await page.locator('#phase-progress').getAttribute('max'),'25');
    assert.ok(await page.locator('#phase-progress').evaluate(el=>el.value>20&&el.value<=25));
   }
   const events=await page.evaluate(()=>window.burnEvents),burnStart=events.find(e=>e.type==='fire'),burnEnd=events.find(e=>e.type==='fire-end');
   assert.equal(events.filter(e=>e.type==='fire').length,1);
   assert.ok(burnEnd.time-burnStart.time>=1900&&burnEnd.time-burnStart.time<2400,'the accelerated bar lasts two seconds');
   const empty=frames.filter(frame=>frame.value===0);assert.ok(empty.length>=3&&burnEnd.time-empty[0].time>=100,'the empty bar remains visible briefly before the chapter');
   assert.equal(await page.locator('.gi-clock-burn-layer').count(),0,'the burn layer is removed with the effect');
   assert.ok(events.find(e=>!['fire','fire-end'].includes(e.type)).time>=burnEnd.time,'the chapter follows the completed burn');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.reload();await page.locator(mode==='vote'?'.gi-ending-screen':'#next').waitFor();assert.equal(await page.locator('.gi-clock-fire').count(),0,'refresh never replays a completed burn');
   await page.close();
  }
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('three UI-created players see a full burn after real discussion votes and final lock, including reduced motion',{
 skip:!process.env.PLAYWRIGHT_MODULE_PATH
},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH),{server}=require('../server/server.cjs');let browser;
 const errors=[];await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});const pages=[];
  const idle=page=>page.waitForFunction(()=>!requesting&&!actionBurnHold&&!phaseScreen);
  for(const [index,width]of [1440,390,1366].entries()){
   const page=await browser.newPage({viewport:{width,height:width===390?844:900},reducedMotion:index===2?'reduce':'no-preference'});pages.push(page);
   page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);
   await page.evaluate(()=>{
    window.realBurnEvents=[];window.realBurnFrames=[];
    new MutationObserver(records=>{for(const record of records){for(const node of record.addedNodes){
     if(node.nodeType!==1||!node.matches('.gi-clock-fire'))continue;
     const fromPhase=actionBurnHold.previous.game.phase;
     window.realBurnEvents.push({type:'start',fromPhase,time:performance.now(),animation:getComputedStyle(node.querySelector('svg')).animationName});
     const sample=()=>{const p=document.getElementById('phase-progress');if(!document.querySelector('.gi-clock-fire')||!p)return;window.realBurnFrames.push({fromPhase,time:performance.now(),value:p.value});requestAnimationFrame(sample);};requestAnimationFrame(sample);
    }for(const node of record.removedNodes)if(node.nodeType===1&&node.matches('.gi-clock-fire'))window.realBurnEvents.push({type:'end',time:performance.now()});}}).observe(document.body,{subtree:true,childList:true});
   });
  }
  const [host,guest,last]=pages;
  await host.locator('#create-name').fill('Mai Anh');await host.locator('#form-create button').click();const code=(await host.locator('.code').textContent()).trim();
  for(const [index,page]of [guest,last].entries()){
   await page.locator('#join-code').fill(code);await page.locator('#join-name').fill(['Minh Quân','Bảo An'][index]);await page.locator('#form-join button').click();await page.locator('.code').waitFor();
  }
  await host.waitForFunction(()=>snapshot.room.players.length===3&&snapshot.room.players.every(p=>p.online));await host.locator('#start').click();
  for(const page of pages){
   await page.locator('#statement-text').waitFor();await idle(page);await page.locator('#statement-text').fill('Cần cân nhắc tác động lâu dài.');await page.locator('#statement button').click();
   if(await page.locator('#statement-choice[open]').count())await page.locator('#confirm-statement').click();
   await page.locator('#statement-text').waitFor({state:'detached'});await idle(page);
  }
  for(const page of pages){await page.locator('#skip-discussion').click();await page.waitForFunction(()=>!requesting);}
  for(const page of pages){await page.locator('#lock-action').waitFor();await idle(page);}
  await guest.locator('#invest').check();
  for(const page of pages){await page.locator('#lock-action').click();await page.waitForFunction(()=>!requesting);}
  // The last submitter sees the same effect as peers receiving the result through live transport.
  await Promise.all(pages.map(page=>page.waitForFunction(()=>actionBurnHold&&performance.now()-actionBurnHold.started>500)));
  assert.equal(await last.locator('.gi-clock-fire svg').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.equal(await last.evaluate(()=>actionBurnHold.particles.length),0,'reduced motion removes decorative particles');
  for(const page of pages){
   await page.waitForFunction(()=>snapshot.game.phase==='REVEAL'&&!actionBurnHold);await idle(page);
   const result=await page.evaluate(()=>({events:window.realBurnEvents,frames:window.realBurnFrames,fastForward:snapshot.game.history.at(-1).fastForward,inert:app.inert}));
   assert.equal(result.events.length,4,'discussion Skip and all actions each burn once');
   for(const [index,fromPhase]of ['DEBATE','BLIND_ACTION'].entries()){
    const [start,end]=result.events.slice(index*2,index*2+2),frames=result.frames.filter(f=>f.fromPhase===fromPhase);assert.equal(start.type,'start');assert.equal(start.fromPhase,fromPhase);assert.equal(end.type,'end');
    assert.ok(end.time-start.time>=1900&&end.time-start.time<2500,'every client keeps each functional countdown for two seconds');
    assert.ok(frames.length>=5&&new Set(frames.map(f=>Math.round(f.value*10))).size>=5,'reduced motion must not jump directly to zero');
    assert.ok(frames.every((f,i)=>f.value>=0&&(!i||f.value<=frames[i-1].value)));
    const empty=frames.find(f=>f.value===0);assert.ok(empty&&end.time-empty.time>=100,'fully burned bar is visible before the chapter');
   }
   assert.equal(result.fastForward,true);assert.equal(result.inert,false);assert.equal(await page.locator('.gi-clock-burn-layer').count(),0);
  }
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('hidden pages and reduced motion release a final clock hold without leaving an inert board',{
 skip:!process.env.PLAYWRIGHT_MODULE_PATH
},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH),{server,manager}=require('../server/server.cjs');let browser;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  for(const mode of ['hidden','reduce','next','pagehide']){
   const {room,player}=prepare(manager,mode==='next'?'normal':mode==='pagehide'?'vote':'draw'),page=await browser.newPage({reducedMotion:mode==='reduce'?'reduce':'no-preference'});
   await page.addInitScript(s=>sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(s)),{roomCode:room.code,playerId:player.id,token:player.secret});
   await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#lock-action').waitFor();
   manager.submit(room,room.players[1],{action:mode==='pagehide'?{invest:false,bankAction:{type:'EXPEL',targetId:room.players[2].id,amount:2}}:none});manager.submit(room,room.players[2],{action:none});
   if(mode==='pagehide'){await page.locator('#bank').selectOption('EXPEL');await page.locator('#target').selectOption(room.players[2].id);await page.locator('#amount').selectOption('3');}
   await page.locator('#lock-action').click();await page.locator('.gi-clock-fire').waitFor();
   if(mode==='next'){
    manager.next(room,player);await page.locator('#statement-text').waitFor();assert.equal(await page.evaluate(()=>app.inert),false);
    assert.equal(await page.locator('.gi-clock-fire').count(),0);assert.equal(await page.evaluate(()=>snapshot.game.phase),'DEBATE');
    assert.equal(await page.locator('.gi-phase-transition[data-transition=project]').count(),1);await page.close();continue;
   }
   if(mode==='pagehide')await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
   else if(mode==='hidden')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
   else assert.equal(await page.locator('.gi-clock-fire svg').evaluate(el=>getComputedStyle(el).animationName),'none');
   await page.locator('.gi-ending-screen').waitFor();assert.equal(await page.evaluate(()=>app.inert),false);assert.equal(await page.locator('.gi-clock-fire').count(),0);
   if(mode==='hidden'||mode==='pagehide')assert.equal(await page.locator('.gi-phase-transition').count(),0);
   if(mode==='pagehide'){await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));assert.equal(await page.locator('.gi-ending-screen').count(),1,'BFCache restoration cannot retain the stale board');}
   assert.equal(await page.evaluate(()=>aborter.signal.aborted),true);await page.close();
  }
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
