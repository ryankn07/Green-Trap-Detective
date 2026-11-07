(function(){
 'use strict';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const flying=new Set(),animations=new Set(),locked=new Set(),inspected=new Set(),pendingInspections=new Set();
 let context=null,view=null,draft=null,layer=null,queued=0,peekCard=null,peekTicket=0;
 const peekAnimations=new Set();
 const icons={inspect:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',expel:'<circle cx="12" cy="12" r="7"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5m-8-8 6 6m0-6-6 6"/>'};
 const identity=value=>value?.game?JSON.stringify([value.room.code,value.game.gameId,value.game.myPlayer.id]):null;
 const turnKey=value=>JSON.stringify([identity(value),value?.game?.round]);
 const inspectionKey=item=>item.round+':'+item.targetId;
 function onScreen(node){
  if(!node?.isConnected||!node.getClientRects().length)return false;
  const box=node.getBoundingClientRect();let left=Math.max(0,box.left),right=Math.min(innerWidth,box.right),top=Math.max(0,box.top),bottom=Math.min(innerHeight,box.bottom);
  for(let parent=node.parentElement;parent&&parent!==document.body;parent=parent.parentElement){
   const style=getComputedStyle(parent);
   if(/auto|scroll|hidden|clip/.test(style.overflowY+style.overflowX)){
    const clip=parent.getBoundingClientRect();left=Math.max(left,clip.left);right=Math.min(right,clip.right);top=Math.max(top,clip.top);bottom=Math.min(bottom,clip.bottom);
   }
  }
  return right-left>4&&bottom-top>4;
 }
 const firstVisible=selector=>[...document.querySelectorAll(selector)].find(onScreen);
 function point(node){if(!onScreen(node))return null;const box=node.getBoundingClientRect();return {x:box.left+box.width/2,y:box.top+box.height/2};}
 function track(node,key,frames,duration=700,delay=0,easing='cubic-bezier(.2,.8,.2,1)',allowInvestmentMotion=false){
  if(document.hidden||!node?.animate)return null;
  if(reduced.matches&&!allowInvestmentMotion){frames=frames.map(frame=>({opacity:frame.opacity??1}));duration=Math.min(duration,160);delay=0;}
  try{
   const animation=node.animate(frames,{id:'gt-action-'+key,duration,delay,easing,fill:'both'});
   animations.add(animation);animation.finished.catch(()=>{}).finally(()=>animations.delete(animation));return animation;
  }catch{return null;}
 }
 function pulse(node,key='choice',color='#8fac6d'){
  if(!onScreen(node))return;
  const animation=track(node,key,[{opacity:.72,boxShadow:'0 0 0 0 '+color+'00'},{opacity:1,boxShadow:'0 0 0 4px '+color+'55',offset:.35},{opacity:1,boxShadow:'0 0 0 0 '+color+'00'}],650);
  animation?.finished.catch(()=>{}).finally(()=>animation.cancel());
 }
 function overlay(){
  if(!layer?.isConnected){layer=document.createElement('div');layer.className='gi-action-fx-layer';layer.setAttribute('aria-hidden','true');document.body.append(layer);}return layer;
 }
 function transient(node,key,frames,duration,delay=0,easing,allowInvestmentMotion=false){
  overlay().append(node);flying.add(node);const animation=track(node,key,frames,duration,delay,easing,allowInvestmentMotion);
  if(!animation){node.remove();flying.delete(node);return;}
  animation.finished.catch(()=>{}).finally(()=>{node.remove();flying.delete(node);animation.cancel();if(layer&&!layer.childElementCount){layer.remove();layer=null;}});
 }
 function ripple(destination,kind){
  if(!destination||reduced.matches)return;
  const ring=document.createElement('span');ring.className='gi-action-fx-ring';ring.dataset.kind=kind;ring.style.left=destination.x+'px';ring.style.top=destination.y+'px';
  transient(ring,'ripple',[{opacity:0,transform:'translate(-50%,-50%) scale(.2)'},{opacity:.8,transform:'translate(-50%,-50%) scale(.65)',offset:.18},{opacity:0,transform:'translate(-50%,-50%) scale(1.7)'}],850);
 }
 function seal(destination,kind){
  if(!destination||reduced.matches)return;
  const badge=document.createElement('span');badge.className='gi-action-fx-seal';badge.dataset.kind=kind;badge.style.left=destination.x+'px';badge.style.top=destination.y+'px';
  badge.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icons[kind]+'</svg>';
  transient(badge,'seal-'+kind,[{opacity:0,transform:'translate(-50%,-50%) scale(.45) rotate(-18deg)'},{opacity:.95,transform:'translate(-50%,-50%) scale(1.1) rotate(0deg)',offset:.3},{opacity:.9,transform:'translate(-50%,-50%) scale(1)',offset:.7},{opacity:0,transform:'translate(-50%,-58%) scale(1.15)'}],1000);
 }
 function coinPicture(){
  const picture=document.createElement('picture');picture.className='gi-brand-picture';
  const source=document.createElement('source');source.type='image/webp';source.srcset='/brand/green-coin.webp';
  const image=document.createElement('img');image.src='/brand/green-coin.png';image.alt='';
  picture.append(source,image);return picture;
 }
 function coins(origin,destination,count,kind){
  if(!origin||document.hidden)return;
  if(kind==='invest'){investment(origin,destination);return;}
  if(!destination||reduced.matches)return;
  for(let i=0;i<Math.min(count,5);i++){
   const token=document.createElement('span');token.className='gi-action-fx-coin';token.dataset.kind=kind;
   token.append(coinPicture());
   const x=origin.x-22+(i%2?7:-7),y=origin.y-22,tx=destination.x-22+(i-count/2)*7,ty=destination.y-22;
   const midX=(x+tx)/2,midY=Math.min(y,ty)-55-i*8;
   transient(token,'coin-'+kind,[{opacity:0,transform:`translate3d(${x}px,${y}px,0) rotateY(0deg) scale(.6)`},{opacity:1,transform:`translate3d(${x-7}px,${y-18}px,0) rotateY(80deg) scale(1)`,offset:.15},{opacity:1,transform:`translate3d(${midX}px,${midY}px,0) rotateY(220deg) scale(1.05)`,offset:.52},{opacity:1,transform:`translate3d(${tx}px,${ty}px,0) rotateY(360deg) scale(.7)`,offset:.88},{opacity:0,transform:`translate3d(${tx}px,${ty+9}px,0) rotateY(380deg) scale(.25)`}],760,i*60);
  }
  ripple(destination,kind);
 }
 function investment(origin,fallback){
  // Owner-requested investment feedback also runs in Codex's reduced-motion browser.
  overlay().classList.add('gi-investment-active');
  const duration=2600,size=Math.min(136,innerWidth*.28,innerHeight*.24),source=document.querySelector('.gi-area-project .gi-card-image-viewport');
  const original=source?.querySelector('img'),rect=source?.getBoundingClientRect();
  const fullyVisible=rect&&onScreen(source)&&rect.left>=8&&rect.right<=innerWidth-8&&rect.top>=12&&rect.bottom<=innerHeight-12;
  let target=null,destination=fallback||{x:innerWidth/2,y:innerHeight*.4},stage={x:innerWidth*.56,y:Math.max(90,innerHeight*.38)},preview=null;
  if(fullyVisible){
   target={left:rect.left-6,top:rect.top-6,width:rect.width+12,height:rect.height+12};destination={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
  }else if(original?.naturalWidth){
   const height=Math.min(260,innerHeight*.4,innerWidth*.58*original.naturalHeight/original.naturalWidth),width=height*original.naturalWidth/original.naturalHeight;
   target={left:(innerWidth-width)/2,top:Math.max(12,innerHeight*.1),width,height};destination={x:innerWidth/2,y:target.top+height/2};
   stage={x:innerWidth/2,y:Math.min(innerHeight-size*.7,target.top+height+size*.75)};
   preview=document.createElement('div');preview.className='gi-investment-preview';const image=document.createElement('img');image.src=original.currentSrc||original.src;image.alt='';preview.append(image);
  }
  const focus=document.createElement('div');focus.className='gi-investment-focus';
  if(target&&!preview){
   const l=target.left,t=target.top,r=l+target.width,b=t+target.height,k=12;
   focus.style.clipPath=`path(evenodd, "M0 0H${innerWidth}V${innerHeight}H0Z M${l+k} ${t}H${r-k}Q${r} ${t} ${r} ${t+k}V${b-k}Q${r} ${b} ${r-k} ${b}H${l+k}Q${l} ${b} ${l} ${b-k}V${t+k}Q${l} ${t} ${l+k} ${t}Z")`;
  }
  const fade=[{opacity:0},{opacity:1,offset:.09},{opacity:1,offset:.74},{opacity:0}];
  transient(focus,'investment-focus',fade,duration,0,'linear',true);
  if(target){
   const position=node=>{Object.assign(node.style,{left:target.left+'px',top:target.top+'px',width:target.width+'px',height:target.height+'px'});};
   if(preview){position(preview);transient(preview,'investment-preview',fade,duration,0,'linear',true);}
   const halo=document.createElement('div');halo.className='gi-investment-target';position(halo);
   transient(halo,'investment-target',[{opacity:0},{opacity:.5,offset:.14},{opacity:.6,offset:.62},{opacity:1,boxShadow:'0 0 0 4px #d4dd8655,0 0 54px #b2dc8588',offset:.75},{opacity:0}],duration,0,'linear',true);
  }
  const token=document.createElement('span');token.className='gi-action-fx-coin gi-investment-coin';token.dataset.kind='invest';token.style.width=token.style.height=size+'px';
  token.append(coinPicture());
  const pose=(p,scale,turn,lift=0,tilt=0)=>`translate3d(${p.x-size/2}px,${p.y-size/2+lift}px,0) perspective(850px) rotateY(${turn}deg) rotateZ(${tilt}deg) scale(${scale})`;
  const middle={x:(stage.x+destination.x)/2,y:Math.min(stage.y,destination.y)-60};
  transient(token,'coin-invest',[
   {opacity:0,transform:pose(origin,.32,0,0,-18)},
   {opacity:1,transform:pose(stage,.8,0,22,-12),offset:.12},
   {opacity:1,transform:pose(stage,1.12,0,-15),offset:.2},
   {opacity:1,transform:pose(stage,1.16,180,-30,4),offset:.32},
   {opacity:1,transform:pose(stage,1.12,360,-10),offset:.42},
   {opacity:1,transform:pose(stage,1.12,360),offset:.47},
   {opacity:1,transform:pose(middle,1,450),offset:.57},
   {opacity:1,transform:pose(destination,.55,680,-20),offset:.67},
   {opacity:1,transform:pose(destination,.32,720),offset:.72},
   {opacity:0,transform:pose(destination,.07,720),offset:.8},
   {opacity:0,transform:pose(destination,.07,720)}
  ],duration,0,'linear',true);
 }
 function clearTransient(){
  cancelAnimationFrame(queued);queued=0;
  for(const animation of animations)animation.cancel();animations.clear();
  for(const node of flying)node.remove();flying.clear();layer?.remove();layer=null;
 }
 function clearDraft(){
  for(const row of document.querySelectorAll('[data-action-target]'))row.removeAttribute('data-action-target');
  const panel=document.querySelector('.gi-action-panel');if(panel){delete panel.dataset.actionKind;delete panel.dataset.actionAffordable;}
 }
 function preview(value,animate=false){
  const form=document.getElementById('action-form');
  if(!form||value?.game?.phase!=='BLIND_ACTION'){clearDraft();draft=null;return;}
  const bank=form.querySelector('#bank').value,invest=form.querySelector('#invest').checked,target=form.querySelector('#target').value,amount=Number(form.querySelector('#amount').value);
  const cost=Number(invest)+(bank==='INSPECT'?3:bank==='EXPEL'?amount:0),affordable=cost<=value.game.myPlayer.coins;
  const next={key:turnKey(value),bank,invest,target,amount,cost};
  const previous=draft;draft=next;clearDraft();
  const panel=form.closest('.gi-action-panel');panel.dataset.actionKind=bank.toLowerCase();panel.dataset.actionAffordable=String(affordable);
  if(bank!=='NONE')for(const row of document.querySelectorAll('.gi-area-players .person[data-player-id]'))if(row.dataset.playerId===target)row.dataset.actionTarget=bank.toLowerCase();
  if(!animate||!previous||previous.key!==next.key||JSON.stringify(previous)===JSON.stringify(next))return;
  if(!affordable){pulse(form.querySelector('#action-cost'),'unaffordable','#c27b68');return;}
  if(previous.invest!==invest){pulse(form.querySelector('.choice'),'invest','#8fac6d');pulse(firstVisible('.gi-desktop-wallet img,.gi-top-wallet img'),'wallet');}
  if(bank!=='NONE'&&(previous.bank!==bank||previous.target!==target)){
   pulse(form.querySelector('#target'),'target-'+bank.toLowerCase(),bank==='EXPEL'?'#c78f73':'#75aa9c');
   const row=[...document.querySelectorAll('[data-action-target]')].find(onScreen);pulse(row,'target-row',bank==='EXPEL'?'#c78f73':'#75aa9c');
  }
  if(bank==='EXPEL'&&previous.amount!==amount)pulse(form.querySelector('#amount'),'amount','#c9a35e');
  pulse(form.querySelector('#action-cost'),'cost','#bea05f');
 }
 function confirmed(value,action,origin){
  const key=turnKey(value),privateAction={invest:action.invest,bank:{...action.bankAction}};
  queued=requestAnimationFrame(()=>{
   queued=0;if(document.hidden||turnKey(view)!==key||document.querySelector('.gi-phase-transition'))return;
   const panel=firstVisible('.gi-action-panel'),center=point(panel),wallet=origin||point(firstVisible('.gi-desktop-wallet img,.gi-top-wallet img'))||center||{x:innerWidth/2,y:Math.min(60,innerHeight/3)};
   pulse(panel,'locked');
   if(privateAction.invest){
    const project=point(firstVisible('.gi-area-project .gi-card-image-viewport,.gi-area-project'))||center;
    coins(wallet,project,1,'invest');
   }
   if(privateAction.bank.type!=='NONE'){
    const kind=privateAction.bank.type.toLowerCase();
    const row=[...document.querySelectorAll('.gi-area-players .person[data-player-id]')].find(row=>row.dataset.playerId===privateAction.bank.targetId&&onScreen(row));
    const destination=point(row)||center;
    coins(wallet,destination,kind==='inspect'?3:privateAction.bank.amount,kind);seal(destination,kind);pulse(row,'committed-target',kind==='expel'?'#c78f73':'#75aa9c');
   }
  });
 }
 function receive(value,previous){
  const nextContext=identity(value),changed=context!==nextContext;
  if(changed){clearTransient();clearDraft();locked.clear();inspected.clear();pendingInspections.clear();context=nextContext;draft=null;}
  else if(view?.game?.round!==value?.game?.round){clearTransient();clearDraft();pendingInspections.clear();draft=null;}
  view=value;if(!value?.game)return;
  const game=value.game,my=game.myPlayer,key=turnKey(value),same=!changed&&identity(previous)===context&&previous?.game?.round===game.round;
  if(my.lockedAction&&!locked.has(key)){
   locked.add(key);
   if(same&&previous.game.phase==='BLIND_ACTION'&&!previous.game.myPlayer.lockedAction&&!document.hidden){
    const origin=point(firstVisible('.gi-desktop-wallet img,.gi-top-wallet img'));
    confirmed(value,my.lockedAction,origin);
   }
  }
  for(const result of my.inspections||[]){
   const resultKey=inspectionKey(result);if(inspected.has(resultKey))continue;
   inspected.add(resultKey);
   if(same&&!document.hidden&&!(previous.game.myPlayer.inspections||[]).some(item=>inspectionKey(item)===resultKey))pendingInspections.add(resultKey);
  }
 }
 function resume(){
  if(document.hidden||document.querySelector('.gi-phase-transition,.gi-clock-fire,dialog[open]'))return;
  for(const row of document.querySelectorAll('.gi-inspection-result')){
   const key=row.dataset.inspectionRound+':'+row.dataset.inspectionTarget;
   if(!pendingInspections.has(key)||!onScreen(row))continue;
   pendingInspections.delete(key);
   row.classList.add('gi-inspection-revealing');
   const animation=track(row,'inspection-result',[{opacity:.25,transform:'perspective(700px) rotateX(-18deg) translateY(12px)',boxShadow:'0 0 0 0 #71ad9700'},{opacity:1,transform:'perspective(700px) rotateX(0deg) translateY(0)',boxShadow:'0 0 0 4px #71ad9744',offset:.45},{opacity:1,transform:'none',boxShadow:'0 0 0 0 #71ad9700'}],1000);
   if(animation)animation.finished.catch(()=>{}).finally(()=>{animation.cancel();row.classList.remove('gi-inspection-revealing');});
   else row.classList.remove('gi-inspection-revealing');
   pulse(row.querySelector('.gi-inspection-eye'),'inspection-eye','#75aa9c');
  }
 }
 function hideRolePeek(){peekTicket++;peekCard=null;for(const animation of peekAnimations)animation.cancel();peekAnimations.clear();}
 function rolePeek(){
  const card=[...document.querySelectorAll('.gi-private-role-card')].find(node=>!node.hidden&&node.getClientRects().length);
  if(!card||card===peekCard||document.hidden)return;
  hideRolePeek();peekCard=card;const ticket=peekTicket,image=card.querySelector('img');if(!image)return;
  const start=()=>requestAnimationFrame(()=>{
   if(ticket!==peekTicket||card.hidden||document.hidden||!onScreen(image))return;
   const animation=track(image,'role-peek',[{opacity:0,transform:'perspective(1100px) rotateY(-52deg) translateY(20px) scale(.9)'},{opacity:1,transform:'perspective(1100px) rotateY(4deg) translateY(-3px) scale(1.01)',offset:.65},{opacity:1,transform:'none'}],430);
   if(animation){peekAnimations.add(animation);animation.finished.catch(()=>{}).finally(()=>{peekAnimations.delete(animation);animation.cancel();});}
  });
  if(image.complete&&image.naturalWidth)start();else image.decode().then(start).catch(()=>{});
 }
 function rendered(value){view=value;preview(value);resume();}
 document.addEventListener('scroll',resume,{capture:true,passive:true});
 document.addEventListener('close',resume,true);
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-kick-player]');if(!button)return;
  const row=[...document.querySelectorAll('.person[data-player-id]')].find(node=>node.dataset.playerId===button.dataset.kickPlayer);
  const confirmation=row?.querySelector('.kick-confirmation');if(!confirmation)return;
  const animation=track(confirmation,'kick-confirm',[{opacity:.25,transform:'scale(.96)'},{opacity:1,transform:'none'}],230);
  animation?.finished.catch(()=>{}).finally(()=>animation.cancel());
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden){hideRolePeek();clearTransient();pendingInspections.clear();}});
 window.addEventListener('blur',hideRolePeek);
 window.addEventListener('resize',()=>{hideRolePeek();clearTransient();resume();});
 window.addEventListener('pagehide',()=>{hideRolePeek();clearTransient();pendingInspections.clear();});
 reduced.addEventListener('change',()=>{hideRolePeek();clearTransient();resume();});
 window.GreenTrapActionFX={preview,receive,rendered,resume,rolePeek,hideRolePeek,clear:clearTransient};
})();
