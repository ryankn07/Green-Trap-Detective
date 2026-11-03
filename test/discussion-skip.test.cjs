'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const engine=require('../engine/dist/index.js'),projects=require('../engine/dist/data/projects.json');
const {RoomManager}=require('../server/rooms.cjs');
const {FileRoomStore}=require('../server/room-store.cjs');
function state(){return engine.createGame({gameId:'skip-test',players:['a','b','c','d','e'].map(id=>({id,name:id,role:id==='e'?'SABOTEUR':'PROTECTOR'})),projects,deckIds:projects.slice(0,10).map(p=>p.id)});}
function roomFixture(options={}){
 let now=100000;const manager=new RoomManager({currentTime:()=>now,...options}),{room,player}=manager.create('Mai Anh');
 for(const name of ['Minh Quân','Bảo An'])manager.join(room.code,name);
 room.players.forEach(p=>manager.connected(room,p));manager.start(room,player);
 return {manager,room,player,setTime:value=>{now=value;}};
}
test('skip consent counts once, stays separate from statements, and opens the next phase only unanimously',()=>{
 let s=state();s=engine.submitStatement(s,'a','Giữ nguyên ý kiến của tôi.','SUPPORT');
 const original=s;s=engine.skipDiscussion(s,'a');
 assert.equal(original.discussionSkipVotes.length,0);assert.equal(engine.skipDiscussion(s,'a'),s);
 const view=engine.projectForPlayer(s,'b');assert.deepEqual(view.discussionSkip,{count:1,required:5,voted:false,complete:false});
 assert.equal(Object.hasOwn(view,'discussionSkipVotes'),false);assert.equal(view.project.alignment,undefined);
 for(const id of ['b','c','d'])s=engine.skipDiscussion(s,id);
 assert.equal(s.phase,'DEBATE');s=engine.skipDiscussion(s,'e');assert.equal(s.phase,'BLIND_ACTION');
 assert.deepEqual(engine.projectForPlayer(s,'a').discussionSkip,{count:5,required:5,voted:true,complete:true});
 assert.equal(s.statements.a.text,'Giữ nguyên ý kiến của tôi.');assert.equal(s.statements.b.stance,'UNSURE');
 assert.equal(Object.keys(s.statements).length,5);assert.deepEqual(s.lockedActions,{});
 for(const player of s.players)s=engine.lockAction(s,player.id,{invest:false,bankAction:{type:'NONE'}});
 s=engine.nextRound(engine.resolveRound(s));assert.equal(s.phase,'DEBATE');
 assert.deepEqual(engine.projectForPlayer(s,'a').discussionSkip,{count:0,required:5,voted:false,complete:false});
});
test('all submitted statements still wait for the timer; old states, eliminated players and other phases are handled',()=>{
 let s=state();delete s.discussionSkipVotes;delete s.discussionSkipped;
 assert.equal(engine.projectForPlayer(s,'a').discussionSkip.count,0);
 for(const p of s.players)s=engine.submitStatement(s,p.id,'Ý kiến.');assert.equal(s.phase,'DEBATE');
 s=engine.removePlayer(s,'d');assert.throws(()=>engine.skipDiscussion(s,'d'),{code:'PLAYER_ELIMINATED'});
 for(const id of ['a','b','c','e'])s=engine.skipDiscussion(s,id);
 assert.equal(s.phase,'BLIND_ACTION');assert.equal(engine.projectForPlayer(s,'a').discussionSkip.required,4);
 assert.throws(()=>engine.skipDiscussion(s,'a'),{code:'INVALID_PHASE'});
});
test('room skip keeps offline living voters eligible, recomputes after kick and gives the next phase its full deadline',()=>{
 const {manager,room,player}=roomFixture();const oldDeadline=room.deadline;
 manager.disconnected(room,room.players[2]);manager.skipDiscussion(room,player);manager.skipDiscussion(room,room.players[1]);
 assert.equal(room.state.phase,'DEBATE');assert.equal(room.deadline,oldDeadline);
 const revision=room.revision;manager.skipDiscussion(room,player);assert.equal(room.revision,revision);
 const target=room.players.find(p=>p.id!==player.id&&!room.state.discussionSkipVotes.includes(p.id));
 // Ensure removing the non-voter does not itself end the game by faction elimination.
 room.state={...room.state,players:room.state.players.map(p=>({...p,role:p.id===room.players[1].id?'SABOTEUR':'PROTECTOR'}))};
 manager.kick(room,player,target.id);assert.equal(room.state.phase,'BLIND_ACTION');
 assert.equal(room.deadline,160000);assert.equal(manager.view(room,player).game.discussionSkip.count,2);
});
test('skip votes survive file recovery and failed persistence rolls back the last vote and transition',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'discussion-skip-'));
 try{
  const store=new FileRoomStore(path.join(directory,'rooms.json')),{manager,room,player}=roomFixture({store});
  manager.skipDiscussion(room,player);manager.skipDiscussion(room,room.players[1]);
  const restored=new RoomManager({store,currentTime:()=>100000}),copy=restored.getRoom(room.code);
  assert.equal(restored.view(copy,copy.players[0]).game.discussionSkip.count,2);
  restored.skipDiscussion(copy,copy.players[2]);assert.equal(copy.state.phase,'BLIND_ACTION');
  manager.store={save(){throw Error('disk unavailable');}};
  assert.throws(()=>manager.skipDiscussion(room,room.players[2]),/disk unavailable/);
  assert.equal(room.state.phase,'DEBATE');assert.equal(manager.view(room,player).game.discussionSkip.count,2);
 }finally{for(const file of ['rooms.json','rooms.json.tmp'])fs.rmSync(path.join(directory,file),{force:true});fs.rmdirSync(directory);}
});
test('HTTP skip authenticates the voter and rejects commands from an old round or phase',async()=>{
 const {server,manager}=require('../server/server.cjs');await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const {room,player}=manager.create('HTTP host');manager.join(room.code,'Guest A');manager.join(room.code,'Guest B');
  room.players.forEach(p=>manager.connected(room,p));manager.start(room,player);
  const context={gameId:room.state.gameId,round:room.state.round,phase:'DEBATE'},origin='http://127.0.0.1:'+server.address().port;
  const post=(member,body={})=>fetch(origin+'/api/action',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer '+member.secret,'x-room-code':room.code},body:JSON.stringify({type:'skip_discussion',context,...body})});
  assert.equal((await post(player,{context:{...context,round:2}})).status,409);
  assert.equal((await post({...player,secret:'0'.repeat(64)})).status,401);
  assert.equal((await post(player,{playerId:room.players[1].id})).status,200);
  assert.deepEqual(room.state.discussionSkipVotes,[player.id]);
  for(const member of room.players.slice(1))assert.equal((await post(member)).status,200);
  assert.equal(room.state.phase,'BLIND_ACTION');assert.equal((await post(player)).status,409);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('shared skip badges burn the timer for two seconds before the chapter on desktop, mobile and polling',{
 skip:!process.env.PLAYWRIGHT_MODULE_PATH
},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH),{server,manager}=require('../server/server.cjs');
 let browser;await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const errors=[];
  const probe=page=>page.evaluate(()=>{
   window.skipEvents=[];window.skipFrames=[];
   new MutationObserver(records=>{for(const record of records){for(const node of record.addedNodes){
    if(node.nodeType!==1)continue;
    if(node.matches('#skip-discussion[data-complete="true"]'))window.skipEvents.push({type:'complete',time:performance.now(),count:node.querySelector('.gi-skip-count').textContent,animation:getComputedStyle(node).animationName});
    if(node.matches('.gi-clock-fire')){
     window.skipEvents.push({type:'fire',time:performance.now()});
     const sample=()=>{const progress=document.getElementById('phase-progress'),fire=document.querySelector('.gi-clock-fire');if(!progress||!fire)return;const bar=progress.getBoundingClientRect(),tip=fire.getBoundingClientRect();window.skipFrames.push({time:performance.now(),value:progress.value,error:Math.abs(tip.x+tip.width/2-bar.left-bar.width*progress.value/progress.max)});requestAnimationFrame(sample);};requestAnimationFrame(sample);
    }
    if(node.matches('.gi-phase-transition[data-phase="BLIND_ACTION"]'))window.skipEvents.push({type:'chapter',time:performance.now()});
   }for(const node of record.removedNodes)if(node.nodeType===1&&node.matches('.gi-clock-fire'))window.skipEvents.push({type:'fire-end',time:performance.now()});}}).observe(document.body,{subtree:true,childList:true});
  });
  for(const width of [1440,390,320]){
   const {room,player}=manager.create('Mai Anh');manager.join(room.code,'Minh Quân');manager.join(room.code,'Bảo An');
   room.players.forEach(p=>manager.connected(room,p));manager.start(room,player);const pages=[];
   for(const member of room.players){
    const page=await browser.newPage({viewport:{width,height:width===1440?900:844},reducedMotion:width===320?'reduce':'no-preference'});pages.push(page);page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(session=>sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(session)),{roomCode:room.code,playerId:member.id,token:member.secret,...(width===390?{transport:'poll'}:{})});
    await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#skip-discussion').waitFor();
    await probe(page);
   }
   const [host,guest,last]=pages;assert.equal(await host.locator('.gi-skip-count').count(),0);
   await host.locator('#skip-discussion').click();await guest.waitForFunction(()=>document.querySelector('.gi-skip-count')?.textContent==='1/3');
   assert.equal(await host.locator('#skip-discussion').isDisabled(),true);assert.equal(await guest.locator('#skip-discussion').isEnabled(),true);
   await host.locator('#statement-text').fill('Bản nháp vẫn được giữ.');
   await guest.locator('#skip-discussion').click();await host.waitForFunction(()=>document.querySelector('.gi-skip-count')?.textContent==='2/3');
   assert.equal(await host.locator('#statement-text').inputValue(),'Bản nháp vẫn được giữ.');
   if(process.env.BROWSER_ARTIFACT_DIR){fs.mkdirSync(process.env.BROWSER_ARTIFACT_DIR,{recursive:true});await host.locator('.gi-area-discussion>.card:first-child').screenshot({path:path.join(process.env.BROWSER_ARTIFACT_DIR,'SKIP_VOTES_'+width+'.png')});}
   await host.reload();await host.waitForFunction(()=>document.querySelector('.gi-skip-count')?.textContent==='2/3');
   assert.equal(await host.locator('#skip-discussion').isDisabled(),true);
   // Reinstall the event probe after refresh; consent must not be forgotten.
   await probe(host);
   await last.locator('#skip-discussion').click();await last.waitForFunction(()=>snapshot.game.phase==='BLIND_ACTION');
   assert.equal(room.state.phase,'BLIND_ACTION','server advances without waiting on a browser animation');
   await host.waitForFunction(()=>actionBurnHold&&performance.now()-actionBurnHold.started>500);
   if(process.env.BROWSER_ARTIFACT_DIR)await host.locator('.gi-phase-header').screenshot({path:path.join(process.env.BROWSER_ARTIFACT_DIR,'SKIP_FIRE_'+width+'.png')});
   for(const page of pages){
    await page.waitForFunction(()=>window.skipEvents.some(event=>event.type==='chapter'));
    const {events,frames}=await page.evaluate(()=>({events:window.skipEvents,frames:window.skipFrames})),complete=events.filter(e=>e.type==='complete'),chapter=events.filter(e=>e.type==='chapter'),fires=events.filter(e=>e.type==='fire'),ends=events.filter(e=>e.type==='fire-end');
    assert.equal(complete.length,1);assert.equal(complete[0].count,'3/3');assert.equal(complete[0].animation,width===320?'none':'gi-skip-consensus');
    assert.equal(fires.length,1);assert.equal(ends.length,1);assert.ok(ends[0].time-fires[0].time>=1900&&ends[0].time-fires[0].time<2500,'Skip burns for the same two seconds as locked actions');
    assert.ok(frames.length>=5&&new Set(frames.map(f=>Math.round(f.value*10))).size>=5);
    assert.ok(frames.every((f,i)=>f.error<2&&f.value>=0&&(!i||f.value<=frames[i-1].value)),'flame follows the continuously draining discussion timer');
    const empty=frames.find(f=>f.value===0);assert.ok(empty&&ends[0].time-empty.time>=100);
    assert.equal(chapter.length,1);assert.ok(chapter[0].time>=ends[0].time,'the chapter follows the completed burn');
    assert.equal(await page.locator('#skip-discussion').count(),0);assert.equal(await page.evaluate(()=>app.inert),false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.locator('.gi-phase-transition').waitFor({state:'detached'});
   }
   manager.connected(room,player);await host.waitForFunction(revision=>snapshot.room.revision===revision,room.revision);
   assert.equal(await host.evaluate(()=>window.skipEvents.filter(event=>event.type==='complete').length),1,'presence does not replay consent');
   for(const page of pages)await page.close();
  }
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('discussion burn releases on hide, pagehide, refresh or a superseding result without replaying',{
 skip:!process.env.PLAYWRIGHT_MODULE_PATH
},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH),{server,manager}=require('../server/server.cjs');let browser;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  for(const mode of ['hidden','pagehide','refresh','supersede']){
   const {room,player}=manager.create('Mai Anh');manager.join(room.code,'Minh Quân');manager.join(room.code,'Bảo An');room.players.forEach(p=>manager.connected(room,p));manager.start(room,player);
   manager.skipDiscussion(room,room.players[1]);manager.skipDiscussion(room,room.players[2]);
   const page=await browser.newPage({viewport:{width:1440,height:900}});
   await page.addInitScript(s=>sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(s)),{roomCode:room.code,playerId:player.id,token:player.secret});
   await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#skip-discussion').click();await page.locator('.gi-clock-fire').waitFor();
   const started=await page.evaluate(()=>actionBurnHold.started);manager.connected(room,player);await page.waitForFunction(revision=>snapshot.room.revision===revision,room.revision);
   assert.equal(await page.evaluate(()=>actionBurnHold.started),started,'presence must not restart the discussion burn');
   if(mode==='hidden')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
   else if(mode==='pagehide')await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
   else if(mode==='refresh')await page.reload();
   else for(const member of room.players)manager.submit(room,member,{action:{invest:false,bankAction:{type:'NONE'}}});
   await page.locator(mode==='supersede'?'#next':'#lock-action').waitFor();assert.equal(await page.evaluate(()=>app.inert),false);assert.equal(await page.locator('.gi-clock-fire,.gi-clock-burn-layer').count(),0);
   if(mode==='hidden'||mode==='pagehide'||mode==='refresh')assert.equal(await page.locator('.gi-phase-transition').count(),0);
   if(mode==='supersede')assert.equal(await page.locator('.gi-phase-transition[data-phase=REVEAL]').count(),1);
   await page.close();
  }
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
