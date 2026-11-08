'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {RoomManager}=require('../server/rooms.cjs');
const {serializeRoom,validateSnapshot}=require('../server/room-store.cjs');
test('lobby avatars and reactions persist, deduplicate and enforce membership',()=>{
 let now=10000,fail=false;
 const manager=new RoomManager({currentTime:()=>now,store:{load:()=>[],save:()=>{if(fail)throw Error('offline');}}});
 const {room,player}=manager.create('Host'),guest=manager.join(room.code,'Guest').player;
 manager.setAvatar(room,player,'a30');
 assert.equal(manager.view(room,guest).room.players[0].avatarId,'a30');
 manager.react(room,player,guest.id,'water','request-1');
 manager.react(room,player,guest.id,'water','request-1');
 assert.equal(manager.view(room,guest).room.reactions.length,1);
 assert.throws(()=>manager.react(room,player,guest.id,'brick','request-2'),{code:'REACTION_COOLDOWN'});
 assert.throws(()=>manager.react(room,player,'another-room','rock','request-3'),{code:'INVALID_TARGET'});
 assert.throws(()=>manager.setAvatar(room,guest,'../../private'),{code:'INVALID_AVATAR'});
 assert.throws(()=>manager.setAvatar(room,guest,'a31'),{code:'INVALID_AVATAR'});
 now+=1300;fail=true;
 assert.throws(()=>manager.react(room,player,guest.id,'flowers','request-4'));
 assert.equal(room.social.events.length,1);
 assert.throws(()=>manager.setAvatar(room,guest,'a11'));
 assert.notEqual(room.players.find(p=>p.id===guest.id).avatarId,'a11');
 fail=false;
 const saved=serializeRoom(room),restored=validateSnapshot({version:1,rooms:[saved]});
 const again=new RoomManager({currentTime:()=>now,store:{load:()=>restored,save:()=>{}}});
 assert.equal(again.view(again.getRoom(room.code),guest).room.players[0].avatarId,'a30');
 for(let i=0;i<60;i++){now+=1300;manager.react(room,player,guest.id,'rock','request-'+(100+i));}
 assert.ok(room.social.events.length<=48);
 now+=16000;assert.equal(manager.view(room,guest).room.reactions.length,0);
 for(const kind of ['tomato','egg','snow','confetti','leafstorm','vine','bubbles']){now+=1300;manager.react(room,player,guest.id,kind,'new-'+kind);assert.equal(manager.view(room,guest).room.reactions.at(-1).kind,kind);}
 assert.throws(()=>manager.react(room,player,guest.id,'unknown','new-unknown'),{code:'INVALID_TARGET'});
});

test('two browsers share avatars and keep lobby reactions within the rendering budget',{skip:!process.env.PLAYWRIGHT_MODULE_PATH},async t=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
 const {server,manager}=require('../server/server.cjs');
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const host=await browser.newPage({viewport:{width:1440,height:900}});
  const guest=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const errors=[],avatarResponses=new Map();
  host.on('response',response=>{
   const path=new URL(response.url()).pathname;
   if(path.startsWith('/social/avatars/'))avatarResponses.set(path,Number(response.headers()['content-length']));
  });
  for(const page of [host,guest])page.on('pageerror',e=>errors.push(e.message));
  await host.goto(base);await host.locator('#create-name').fill('Social QA');await host.locator('#form-create button').click();await host.locator('#leave').waitFor();
  const room=[...manager.rooms.values()].find(r=>r.players[0].name==='Social QA');
  await guest.goto(base);await guest.locator('#join-code').fill(room.code);await guest.locator('#join-name').fill('Social guest');await guest.locator('#form-join button').click();await guest.locator('#leave').waitFor();
  const hostId=room.players[0].id,guestId=room.players[1].id;
  const avatar=(page,id)=>page.locator('.lobby-members [data-player-id="'+id+'"] .avatar');
  await avatar(host,hostId).click();
  await host.waitForFunction(()=>document.querySelector('.social-menu img')?.naturalWidth>0);
  const firstAvatar=await host.locator('.social-menu img').first().evaluate(img=>({src:img.currentSrc,width:img.naturalWidth}));
  const pickerBytes=[...avatarResponses.values()].reduce((sum,bytes)=>sum+bytes,0);
  const originalGuestAvatar=await avatar(guest,guestId).elementHandle();
  const choice=await host.getByRole('button',{name:'Avatar a30',exact:true}).getAttribute('aria-pressed')==='true'?'a29':'a30';
  await host.getByRole('button',{name:'Avatar '+choice,exact:true}).click();
  await guest.waitForFunction(({id,choice})=>document.querySelector('[data-player-id="'+id+'"] .avatar img')?.getAttribute('src').endsWith(choice+'.png'),{id:hostId,choice});
  const avatarRetained=await avatar(guest,guestId).evaluate((node,original)=>node===original,originalGuestAvatar);
  await avatar(host,guestId).click();
  const menuEffects=await host.locator('.social-reaction-menu').evaluate(menu=>menu.getAnimations({subtree:true}).length);
  await host.getByRole('button',{name:'Tạt nước',exact:true}).click();
  const water=guest.locator('.social-water-jet');
  await water.waitFor();
  const jet=await water.evaluate(node=>({
   filledShapes:[...node.querySelectorAll('path')].filter(path=>getComputedStyle(path).fill!=='none').length,
   movesAsOne:node.getAnimations().some(animation=>animation.effect.getKeyframes().some(frame=>frame.transform?.includes('rotate')))
  }));
  assert.ok(jet.filledShapes>=3&&jet.movesAsOne,JSON.stringify(jet));
  await guest.waitForFunction(()=>{
   const canvas=document.querySelector('canvas.social-burst-water');
   if(!canvas)return false;
   const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>160&&pixels[i+2]>pixels[i]+40)return true;
   return false;
  },null,{timeout:3000});
  const splashRing=guest.locator('.social-contact-water [data-pulse]');
  await splashRing.waitFor({timeout:1600});
  assert.ok(await splashRing.evaluate(path=>path.getAnimations().length===1),'water should expand a splash ring');
  await guest.waitForFunction(()=>!document.querySelector('.social-water-jet'),null,{timeout:3000});
  const box=await avatar(guest,hostId).boundingBox();
  await guest.mouse.move(box.x+box.width/2,box.y+box.height/2);await guest.mouse.down();await guest.waitForTimeout(470);await guest.mouse.up();
  await guest.getByRole('button',{name:'Tặng hoa',exact:true}).click();
  const bouquet=host.locator('.social-projectile-flowers');
  await bouquet.waitFor();
  const sway=await bouquet.evaluate(node=>node.getAnimations()[0].effect.getKeyframes().map(frame=>
   Number(frame.transform.match(/rotate\(([-\d.]+)deg\)/)[1])
  ));
  assert.ok(Math.min(...sway)<-10&&Math.max(...sway)>10,'bouquet should sway both ways');
  const bloom=host.locator('.social-contact-flowers');
  await bloom.waitFor({timeout:1600});
  const portrait=await avatar(host,hostId).boundingBox();
  assert.ok(await bloom.evaluate((node,portraitWidth)=>{
   const rect=node.getBoundingClientRect();
   const animation=node.getAnimations()[0];
   return rect.width>0&&node.offsetWidth>portraitWidth&&animation?.effect.getTiming().duration>=500;
  },portrait.width),'flower contact should open into a wreath around the portrait');
  assert.ok(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));

  const peers=Array.from({length:10},(_,i)=>manager.join(room.code,'Guest '+i).player);
  await host.waitForFunction(()=>document.querySelectorAll('.lobby-members .person').length===12);
  await host.locator('.lobby-members .people').evaluate(list=>list.scrollIntoView({block:'start'}));
  await host.waitForTimeout(2700);
  await host.evaluate(()=>{
   window.reactionSample=new Promise(resolve=>{
    let flights=0,layers=0,rings=0,particleNodes=0,firstPop=null;
    const started=performance.now(),end=started+540;
    function sample(){
     flights=Math.max(flights,document.querySelectorAll('.social-projectile-confetti').length);
     const bursts=document.querySelectorAll('canvas.social-burst-confetti').length;
     if(bursts&&firstPop===null)firstPop=performance.now()-started;
     layers=Math.max(layers,bursts);
     rings=Math.max(rings,document.querySelectorAll('.social-contact-confetti [data-pulse]').length);
     particleNodes=Math.max(particleNodes,document.querySelectorAll('.social-particle-confetti').length);
     if(performance.now()<end)requestAnimationFrame(sample);
     else{
      const avatarTop=document.querySelector('.lobby-members .avatar').getBoundingClientRect().top;
      const opaquePixels=[...document.querySelectorAll('canvas.social-burst-confetti')].map(canvas=>{
       const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
       let opaque=0;
       const rect=canvas.getBoundingClientRect();
       const rows=Math.max(0,Math.min(canvas.height,Math.floor((avatarTop-6-rect.top)*canvas.height/rect.height)));
       for(let i=3;i<rows*canvas.width*4;i+=4)if(pixels[i]>160)opaque++;
       return opaque;
      });
      resolve({flights,layers,rings,particleNodes,firstPop,opaquePixels});
     }
    }
    requestAnimationFrame(sample);
   });
  });
  peers.forEach((sender,i)=>manager.react(room,sender,i%2===0?hostId:guestId,'confetti','burst-'+i));
  const burst=await host.evaluate(()=>window.reactionSample);
  assert.equal(burst.flights,0);
  assert.ok(burst.firstPop!==null&&burst.firstPop<400,JSON.stringify(burst));
  assert.equal(burst.layers,2);
  assert.equal(burst.rings,2);
  assert.equal(burst.particleNodes,0);
  assert.equal(burst.opaquePixels.length,2);
  assert.ok(burst.opaquePixels.every(pixels=>pixels>100),JSON.stringify(burst));
  for(const page of [host,guest])await page.evaluate(()=>{
   window.rockFlights=[];
   document.addEventListener('click',event=>{
    if(event.target.closest('button')?.getAttribute('aria-label')==='Ném đá')window.rockClickedAt=performance.now();
   },true);
   new MutationObserver(records=>{
    for(const record of records)for(const node of record.addedNodes){
     if(node.matches?.('.social-projectile-rock'))window.rockFlights.push(performance.now());
    }
   }).observe(document.body,{childList:true});
  });
  await avatar(host,guestId).click();
  let releaseAction;
  const actionGate=new Promise(resolve=>{releaseAction=resolve;});
  await host.route('**/api/action',async route=>{await actionGate;await route.continue();});
  let rockDelay;
  try{
   await host.getByRole('button',{name:'Ném đá',exact:true}).click();
   await host.waitForFunction(()=>window.rockFlights.length===1,null,{timeout:500});
   const rock=await host.locator('.social-projectile-rock').evaluate(node=>({
    delay:window.rockFlights[0]-window.rockClickedAt,
    duration:node.getAnimations()[0].effect.getTiming().duration
   }));
   rockDelay=rock.delay;
   assert.ok(rock.duration>=550&&rock.duration<=850,'rock flight should keep its original pace');
   assert.ok(rockDelay<250,'throw should start on click, saw '+rockDelay+'ms');
   assert.equal(await guest.evaluate(()=>window.rockFlights.length),0);
   await host.waitForTimeout(2750);
  }finally{releaseAction();}
  await guest.waitForFunction(()=>window.rockFlights.length===1);
  await host.waitForTimeout(250);
  assert.equal(await host.evaluate(()=>window.rockFlights.length),1,'sender must not replay the confirmed throw');
  t.diagnostic('Rock launch after click with network held: '+Math.round(rockDelay)+'ms');
  for(const [kind,label,sender,targetId] of [
   ['leafstorm','Lốc lá',guest,hostId],['vine','Dây leo',host,guestId],['bubbles','Bong bóng',guest,hostId]
  ]){
   await avatar(sender,targetId).click();
   await sender.getByRole('button',{name:label,exact:true}).click({timeout:5000});
   const effects=[host,guest].map(page=>page.locator('.social-garden-'+kind));
   await Promise.all(effects.map(effect=>effect.waitFor({timeout:3000})));
   assert.equal(manager.view(room,room.players[1]).room.reactions.at(-1).kind,kind);
   assert.ok(await sender.locator('.social-garden-'+kind+' svg').evaluate(svg=>svg.getAnimations({subtree:true}).length>0));
   if(kind==='leafstorm')assert.ok(await sender.locator('.social-garden-leafstorm').evaluate(stage=>{
    const leaf=stage.querySelector('[data-leaf]');
    const frames=leaf.getAnimations()[0]?.effect.getKeyframes()||[];
    const y=frame=>Number(frame?.transform.match(/translate\([^,]+,\s*([-\d.]+)px\)/)?.[1]);
    return stage.offsetHeight>stage.offsetWidth&&y(frames[0])-y(frames.at(-1))>80;
   }),'the funnel should stand upright and lift leaves from its base');
   if(kind==='leafstorm'){
    for(const page of [host,guest]){
     const recipient=avatar(page,targetId);
     assert.ok(await recipient.evaluate(node=>node.getAnimations().some(animation=>{
      const frames=animation.effect.getKeyframes();
      const lift=frame=>Number(frame.transform?.match(/translate\([^,]+,\s*([-\d.]+)px\)/)?.[1]);
      return frames.some(frame=>lift(frame)<-12&&frame.transform.includes('rotate'))
       &&frames.at(-1).transform==='none';
     })),'both players should see the recipient lift, tilt and land');
    }
   }
   if(kind==='vine')await Promise.all([host,guest].map(page=>page.waitForFunction(id=>{
    const recipient=[...document.querySelectorAll('.lobby-members .person')]
     .find(person=>person.dataset.playerId===id)?.querySelector('.avatar');
    if(!recipient)return false;
    const transform=new DOMMatrixReadOnly(getComputedStyle(recipient).transform);
    return transform.m42>=5&&Math.abs(transform.m12)>.1;
   },targetId,{timeout:1500})));
   if(kind==='bubbles')await Promise.all([host,guest].map(async page=>{
    await page.waitForFunction(id=>{
     const target=[...document.querySelectorAll('.lobby-members .person')]
      .find(person=>person.dataset.playerId===id)?.querySelector('.avatar');
     return target&&new DOMMatrixReadOnly(getComputedStyle(target).transform).m42<-12;
    },targetId,{timeout:1600});
    await page.waitForFunction(()=>{
     const shell=document.querySelector('.social-bubble-shell');
     const ring=document.querySelector('.social-garden-bubbles [data-bubble-pop]');
     return shell&&ring&&Number(getComputedStyle(shell).opacity)<.1&&Number(getComputedStyle(ring).opacity)>.3;
    },null,{timeout:1600});
   }));
   await Promise.all(effects.map(effect=>effect.waitFor({state:'detached',timeout:3000})));
   if(kind==='vine'||kind==='bubbles'){
    for(const page of [host,guest]){
     assert.equal(await avatar(page,targetId).evaluate(node=>new DOMMatrixReadOnly(getComputedStyle(node).transform).m42),0,
      'recipient returns to position after the effect releases');
    }
   }
   if(kind==='leafstorm')await host.waitForTimeout(1050);
  }
  assert.deepEqual(errors,[]);
  const budgets={optimizedAvatar:firstAvatar.src.endsWith('.webp')&&firstAvatar.width<=192,avatarRetained,
   pickerUnder500KB:pickerBytes>0&&pickerBytes<500000,menuEffectsUnderFour:menuEffects<4};
  t.diagnostic(JSON.stringify({pickerBytes,menuEffects,burst}));
  assert.ok(Object.values(budgets).every(Boolean),JSON.stringify({budgets,firstAvatar,pickerBytes,menuEffects}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
