'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {server,manager}=require('../server/server.cjs');
const playwrightPath=process.env.PLAYWRIGHT_MODULE_PATH;
let base;
test.before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});

test('tutorial is seekable media on exact public routes',async()=>{
 const filename='/tutorials/how-to-play-fast.mp4';
 const bytes=fs.readFileSync(path.join(__dirname,'../ui',filename));
 let response=await fetch(base+filename,{method:'HEAD'});
 assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'video/mp4');
 assert.equal(response.headers.get('content-length'),String(bytes.length));assert.equal((await response.arrayBuffer()).byteLength,0);
 for(const [range,start,end] of [['bytes=1024-2047',1024,2048],['bytes=-64',bytes.length-64,bytes.length],['bytes='+ (bytes.length-64)+'-',bytes.length-64,bytes.length]]){
  response=await fetch(base+filename,{headers:{Range:range}});
  assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),`bytes ${start}-${end-1}/${bytes.length}`);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes.subarray(start,end));
 }
 for(const range of ['bytes=1-0','bytes=-0','bytes=-','bytes=999999999-','bytes=0-1,4-5','items=0-10']){
  response=await fetch(base+filename,{headers:{Range:range}});assert.equal(response.status,416,range);
  assert.equal(response.headers.get('content-range'),'bytes */'+bytes.length);await response.arrayBuffer();
 }
 for(const file of ['/tutorial.css','/tutorial-ui.js','/tutorials/how-to-play-fast-poster.jpg']){
  response=await fetch(base+file);assert.equal(response.status,200,file);await response.arrayBuffer();
 }
 for(const file of ['/tutorials/private.mp4','/tutorials/how-to-play-fast.mp4.bak','/tutorials/../../server/server.cjs','/tutorials/%2e%2e%2fserver%2fserver.cjs']){
  response=await fetch(base+file);assert.equal(response.status,404,file);await response.arrayBuffer();
 }
 response=await fetch(base+filename,{method:'POST'});assert.equal(response.status,404);await response.arrayBuffer();
});

test('guide opens from right masthead without initial video download, plays/seeks and closes accessibly', {skip:!playwrightPath},async()=>{
 const {chromium}=require(playwrightPath);let browser;
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  const requests=[],errors=[];page.on('request',request=>requests.push(request.url()));page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await page.evaluate(()=>document.fonts.ready);
  assert.equal(requests.some(url=>url.includes('/tutorials/')),false,'no video or poster downloaded on entry');
  assert.equal(await page.locator('#tutorial-video').getAttribute('src'),null);
  for(const [width,height] of [[320,700],[390,844],[568,320],[390,300],[768,1024],[844,390],[1440,900],[1920,1080],[2560,1440],[2560,1080]]){
   await page.setViewportSize({width,height});
   const trigger=await page.locator('#tutorial-open').boundingBox(),brand=await page.locator('.brand').boundingBox();
   assert.ok(trigger.width>=44&&trigger.height>=44,'touch target at '+width);
   assert.ok(brand.x+brand.width<=trigger.x,'guide is to the right of the identity at '+width);
   assert.ok(brand.x<=40,'identity remains at its original left gutter at '+width);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no entry overflow at '+width);
   await page.locator('#tutorial-open').click();await page.locator('#tutorial-dialog[open]').waitFor();
   const dialog=await page.locator('#tutorial-dialog').boundingBox();
   assert.ok(dialog.x>=0&&dialog.y>=0&&dialog.x+dialog.width<=width&&dialog.y+dialog.height<=height,'dialog fits '+width);
   assert.equal(await page.locator('#tutorial-dialog').evaluate(node=>node.scrollHeight>node.clientHeight+1),false,'chapters are fully visible without a clipped footer at '+width+'x'+height);
   const film=await page.locator('#tutorial-video').boundingBox();
   const heading=await page.locator('.tutorial-heading').boundingBox();
   const navigation=await page.locator('#tutorial-navigation').boundingBox();
   assert.ok(Math.abs(film.width/film.height-16/9)<.005,'player matches the film ratio without letterboxing at '+width);
   assert.ok(Math.abs(film.width-(dialog.width-2))<1,'video fills the frame width');
   assert.ok(Math.abs(dialog.height-heading.height-film.height-navigation.height-2)<2,'dialog hugs video and chapters without an empty lower panel at '+width);
   assert.equal(await page.locator('[data-tutorial-chapter]').count(),16,'all source chapters are available');
   if(width>=1200){assert.ok(dialog.width<=width-60,'frame leaves a little more space around it');assert.ok(dialog.height<=height-60,'frame fits without forcing a mismatched video height');}
   assert.equal(await page.locator('#tutorial-close').evaluate(node=>node===document.activeElement),true);
   await page.keyboard.press('Escape');await page.locator('#tutorial-dialog[open]').waitFor({state:'detached'});
   assert.equal(await page.locator('#tutorial-open').evaluate(node=>node===document.activeElement),true,'focus returns');
  }
  await page.setViewportSize({width:1440,height:900});await page.locator('#tutorial-open').click();
  await page.waitForFunction(()=>document.getElementById('tutorial-video').readyState>=1);
  const metadata=await page.locator('#tutorial-video').evaluate(video=>({duration:video.duration,width:video.videoWidth,height:video.videoHeight,paused:video.paused,rate:video.playbackRate,defaultRate:video.defaultPlaybackRate}));
  assert.equal(metadata.defaultRate,1.25,'guide defaults to the requested 1.25×');assert.equal(metadata.rate,1.25,'guide actually starts at 1.25×');
  assert.ok(metadata.duration>177&&metadata.duration<179);assert.equal(metadata.width,1920);assert.equal(metadata.height,1080);assert.equal(metadata.paused,true,'no autoplay with sound');
  await page.locator('#tutorial-video').evaluate(video=>video.play());
  await page.waitForFunction(()=>document.getElementById('tutorial-video').currentTime>.2);
  await page.locator('#tutorial-video').evaluate(video=>{video.currentTime=75;});
  await page.waitForFunction(()=>!document.getElementById('tutorial-video').seeking&&document.getElementById('tutorial-video').currentTime>=75);
  await page.locator('#tutorial-close').click();
  assert.equal(await page.locator('#tutorial-video').evaluate(video=>video.paused),true,'closing pauses audio');
  await page.locator('#tutorial-open').click();
  assert.ok(await page.locator('#tutorial-video').evaluate(video=>video.currentTime)>=75,'reopening retains position');
  await page.mouse.click(2,2);assert.equal(await page.locator('#tutorial-dialog').evaluate(dialog=>dialog.open),false,'backdrop closes');
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();}
});

test('in-match guide seeks to the phase, stops at its boundary and follows real phase updates', {skip:!playwrightPath},async()=>{
 const {chromium}=require(playwrightPath);let browser,now=Date.now();const originalTime=manager.currentTime;manager.currentTime=()=>now;
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  for(const width of [1440,390]){
   const {room,player}=manager.create('Guide phase '+width);manager.join(room.code,'Peer A');manager.join(room.code,'Peer B');room.players.forEach(peer=>manager.connected(room,peer));manager.start(room,player);
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[],media=[];
   page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('/tutorials/'))media.push(request.url());});
   await page.addInitScript(session=>sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(session)),{roomCode:room.code,playerId:player.id,token:player.secret});
   await page.goto(base);await page.waitForFunction(()=>snapshot?.game?.phase==='DEBATE');assert.equal(media.length,0,'no automatic guide download in a match');
   const guide=page.locator('#tutorial-open:visible,[data-tutorial-open]:visible');
   await guide.click();
   await page.waitForFunction(()=>{const v=document.getElementById('tutorial-video');return v.currentTime>=37.13&&v.currentTime<42&&!v.paused&&!v.seeking;});
   assert.equal(await page.locator('#tutorial-video').evaluate(video=>video.playbackRate),1.25);
   assert.equal(await page.locator('[data-tutorial-chapter=debate]').getAttribute('aria-current'),'true');
   await page.locator('#tutorial-video').evaluate(video=>{video.currentTime=57.30;});
   await page.waitForFunction(()=>document.getElementById('tutorial-dialog').dataset.tutorialWaiting==='true');
   const stopped=await page.locator('#tutorial-video').evaluate(video=>({time:video.currentTime,paused:video.paused}));
   assert.equal(stopped.paused,true);assert.ok(stopped.time>57.35&&stopped.time<57.478,'stops before voting audio or pictures');
   assert.match(await page.locator('#tutorial-context').textContent(),/Chờ bình chọn/);
   manager.submit(room,room.players[1],{text:'Cùng trao đổi dự án.',stance:'UNSURE'});await page.waitForFunction(()=>snapshot?.game?.currentStatements?.length>0);
   await page.waitForTimeout(300);assert.ok(Math.abs(await page.locator('#tutorial-video').evaluate(video=>video.currentTime)-stopped.time)<.03,'presence/statement updates do not restart a completed chapter');
   room.players.forEach(peer=>manager.skipDiscussion(room,peer));
   await page.waitForFunction(()=>{const v=document.getElementById('tutorial-video');return v.currentTime>=57.478&&v.currentTime<62&&!v.paused;});
   assert.equal(await page.locator('#tutorial-dialog').getAttribute('data-tutorial-following'),'true');
   await page.waitForFunction(()=>!actionBurnHold);
   await page.locator('#tutorial-video').evaluate(video=>{video.currentTime=68.32;});
   await page.waitForFunction(()=>document.getElementById('tutorial-dialog').dataset.tutorialWaiting==='true');
   assert.match(await page.locator('#tutorial-context').textContent(),/Chờ công bố/);
   now=room.deadline;manager.tick();
   await page.waitForFunction(()=>{const v=document.getElementById('tutorial-video');return v.currentTime>=146.597&&v.currentTime<152&&!v.paused;});
   assert.equal(await page.locator('#tutorial-dialog').evaluate(dialog=>dialog.open),true);
   await page.locator('[data-tutorial-chapter=inspect]').click();
   await page.waitForFunction(()=>{const v=document.getElementById('tutorial-video');return v.currentTime>=92.203&&v.currentTime<96&&!v.paused;});
   assert.equal(await page.locator('#tutorial-dialog').getAttribute('data-tutorial-following'),'false','manual chapter selection opts into free viewing');
   now=room.deadline;manager.tick();await page.waitForFunction(()=>snapshot?.game?.phase==='DEBATE');
   assert.ok(await page.locator('#tutorial-video').evaluate(video=>video.currentTime)<110,'free viewing survives a real phase change');
   await page.locator('#tutorial-mode').click();
   await page.waitForFunction(()=>{const v=document.getElementById('tutorial-video');return v.currentTime>=37.13&&v.currentTime<42&&!v.paused;});
   await page.locator('#tutorial-video').evaluate(video=>{video.pause();video.playbackRate=1.5;});
   now=room.deadline;manager.tick();await page.waitForFunction(()=>snapshot?.game?.phase==='BLIND_ACTION');
   await page.waitForFunction(()=>{const v=document.getElementById('tutorial-video');return !v.seeking&&v.currentTime>=57.478;});
   assert.equal(await page.locator('#tutorial-video').evaluate(video=>video.paused),true,'a deliberate pause is respected');
   assert.equal(await page.locator('#tutorial-video').evaluate(video=>video.playbackRate),1.5,'phase changes retain a user-selected speed');
   await page.keyboard.press('Escape');now=room.deadline;manager.tick();await page.waitForFunction(()=>snapshot?.game?.phase==='REVEAL');
   assert.equal(await page.locator('#tutorial-video').evaluate(video=>video.paused),true,'closed guide never starts playing on a phase update');
   await guide.click();
   await page.waitForFunction(()=>{const v=document.getElementById('tutorial-video');return v.currentTime>=146.597&&v.currentTime<152&&!v.paused;});
   const geometry=await page.locator('#tutorial-dialog').boundingBox();assert.ok(geometry.x>=0&&geometry.x+geometry.width<=width&&geometry.y+geometry.height<=900);
   const hostRole=room.state.players.find(peer=>peer.id===player.id).role;
   for(const target of room.state.players.filter(peer=>peer.role!==hostRole))manager.kick(room,player,target.id);
   await page.waitForFunction(()=>snapshot?.game?.phase==='GAME_OVER');
   await page.waitForFunction(()=>{const v=document.getElementById('tutorial-video');return v.currentTime>=155.29&&v.currentTime<161&&!v.paused;});
   assert.match(await page.locator('#tutorial-context').textContent(),/Kết thúc ván/);
   await page.locator('#tutorial-close').click();assert.equal(await page.locator('#tutorial-video').evaluate(video=>video.paused),true);
   assert.deepEqual(errors,[]);await page.close();
  }
 }finally{manager.currentTime=originalTime;if(browser)await browser.close();}
});

test('guide and desktop clock remain separate through live game phases', {skip:!playwrightPath},async()=>{
 const {chromium}=require(playwrightPath);let browser,now=Date.now();const originalTime=manager.currentTime;manager.currentTime=()=>now;
 try{
  const {room,player}=manager.create('Tutorial QA');manager.join(room.code,'Peer A');manager.join(room.code,'Peer B');room.players.forEach(peer=>manager.connected(room,peer));
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  await page.addInitScript(session=>sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(session)),{roomCode:room.code,playerId:player.id,token:player.secret});
  await page.goto(base);await page.locator('#start').click();await page.locator('.gi-phase-header').waitFor();await page.evaluate(()=>document.fonts.ready);
  for(const phase of ['DEBATE','BLIND_ACTION','REVEAL']){
   await page.waitForFunction(expected=>snapshot?.game?.phase===expected,phase);
   for(const width of [1200,1440,2560]){
    await page.setViewportSize({width,height:900});
    const brand=await page.locator('.brand').boundingBox(),clock=await page.locator('.gi-phase-header').boundingBox(),trigger=await page.locator('#tutorial-open').boundingBox();
    assert.ok(brand.x+brand.width<=clock.x,phase+' masthead does not overlap clock at '+width);
    assert.ok(clock.x+clock.width<=trigger.x,phase+' clock does not overlap guide at '+width);
    assert.ok(clock.y+clock.height<=64);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   }
   if(phase!=='REVEAL'){
    await page.locator('#tutorial-open').click();
    await page.locator('#tutorial-video').evaluate(video=>{window.guideVideo=video;});
    now=room.deadline;manager.tick();
    await page.waitForFunction(previous=>snapshot?.game?.phase!==previous,phase);
    assert.equal(await page.locator('#tutorial-dialog').evaluate(dialog=>dialog.open),true,'phase rerender keeps guide open');
    assert.equal(await page.locator('#tutorial-video').evaluate(video=>video===window.guideVideo),true,'video element survives');
    await page.keyboard.press('Escape');
   }
  }
 }finally{manager.currentTime=originalTime;if(browser)await browser.close();}
});
