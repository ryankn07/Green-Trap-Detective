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
 for(const kind of ['tomato','egg','snow','confetti']){now+=1300;manager.react(room,player,guest.id,kind,'new-'+kind);assert.equal(manager.view(room,guest).room.reactions.at(-1).kind,kind);}
 assert.throws(()=>manager.react(room,player,guest.id,'unknown','new-unknown'),{code:'INVALID_TARGET'});
});

test('two browsers share avatars and lobby throws',{skip:!process.env.PLAYWRIGHT_MODULE_PATH},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);
 const {server,manager}=require('../server/server.cjs');
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const host=await browser.newPage({viewport:{width:1440,height:900}});
  const guest=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const errors=[];for(const page of [host,guest])page.on('pageerror',e=>errors.push(e.message));
  await host.goto(base);await host.locator('#create-name').fill('Social QA');await host.locator('#form-create button').click();await host.locator('#leave').waitFor();
  const room=[...manager.rooms.values()].find(r=>r.players[0].name==='Social QA');
  await guest.goto(base);await guest.locator('#join-code').fill(room.code);await guest.locator('#join-name').fill('Social guest');await guest.locator('#form-join button').click();await guest.locator('#leave').waitFor();
  const hostId=room.players[0].id,guestId=room.players[1].id;
  const avatar=(page,id)=>page.locator('.lobby-members [data-player-id="'+id+'"] .avatar');
  await avatar(host,hostId).click();
  await host.getByRole('button',{name:'Avatar a30',exact:true}).click();
  await guest.waitForFunction(id=>document.querySelector('[data-player-id="'+id+'"] .avatar img')?.getAttribute('src').endsWith('a30.png'),hostId);
  await avatar(host,guestId).click();await host.getByRole('button',{name:'Tạt nước',exact:true}).click();
  await guest.waitForFunction(()=>!!document.querySelector('.social-water-jet'),null,{polling:20});
  await guest.waitForFunction(()=>!document.querySelector('.social-water-jet'),null,{timeout:3000});
  const box=await avatar(guest,hostId).boundingBox();
  await guest.mouse.move(box.x+box.width/2,box.y+box.height/2);await guest.mouse.down();await guest.waitForTimeout(470);await guest.mouse.up();
  await guest.getByRole('button',{name:'Tặng hoa',exact:true}).click();
  await host.waitForFunction(()=>!!document.querySelector('.social-projectile-flowers'),null,{polling:20});
  assert.ok(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
