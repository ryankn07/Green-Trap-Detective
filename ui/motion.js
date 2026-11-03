(function(){
 'use strict';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),desktop=matchMedia('(min-width:1200px)');
 const rootStyle=getComputedStyle(document.documentElement);
 const timing=name=>parseFloat(rootStyle.getPropertyValue('--gi-motion-'+name));
 const ease=rootStyle.getPropertyValue('--gi-motion-ease').trim()||'ease-out';
 const running=new Set();let queued=0,generation=0,homePlayed=false;

 function stop(){
  generation++;cancelAnimationFrame(queued);
  for(const animation of running)animation.cancel();
  running.clear();
 }
 function visible(element){return element?.isConnected&&element.getClientRects().length>0;}
 function play(element,key,frames,milliseconds=timing('feedback')||140){
  if(document.hidden||!visible(element)||!element.animate)return;
  if(reduced.matches){frames=frames.map(frame=>({opacity:frame.opacity??1}));milliseconds=Math.min(milliseconds,120);}
  try{
   const animation=element.animate(frames,{id:'gt-motion-'+key,duration:milliseconds,easing:ease});
   running.add(animation);animation.finished.catch(()=>{}).finally(()=>running.delete(animation));
   return animation;
  }catch{/* Motion must never prevent a game action on an unsupported browser. */}
 }
 const rect=selector=>document.querySelector(selector)?.getBoundingClientRect();
 function facts(snapshot){
  if(!snapshot)return null;
  const game=snapshot.game,me=game?.myPlayer;
  return {room:snapshot.room.code,game:game?.gameId,round:game?.round,phase:game?.phase,
   coins:me?.coins,ready:game?.phase==='DEBATE'?Boolean(game.players.find(p=>p.id===me?.id)?.hasStatement):Boolean(me?.lockedAction),
   people:snapshot.room.players.map(p=>p.id),statements:(game?.currentStatements||[]).map(s=>s.playerId)};
 }
 function capture(snapshot){
  const frame={previous:facts(snapshot),panel:rect('.gi-action-panel')};
  stop();return frame;
 }
 function arrive(element,key,distance=8,duration=180){
  play(element,key,[{opacity:.5,transform:`translateY(${distance}px)`},{opacity:1,transform:'none'}],duration);
 }
 function commit(snapshot,frame){
  const next=facts(snapshot),previous=frame?.previous,version=generation;
  if(!previous||previous.room!==next.room||next.phase==='GAME_OVER')return;
  queued=requestAnimationFrame(()=>{
   if(version!==generation||document.hidden)return;
   const sameRound=previous.game===next.game&&previous.round===next.round;
   if(sameRound&&previous.phase===next.phase&&!previous.ready&&next.ready&&desktop.matches&&!reduced.matches){
    const panel=rect('.gi-action-panel'),actions=document.querySelector('.gi-area-actions');
    if(panel&&frame.panel&&Math.abs(frame.panel.height-panel.height)>4&&getComputedStyle(actions).display==='grid'){
     const extra=actions.querySelector('.gi-profile-panel>.rule')?' auto':'';
     play(actions,'collapse',[{gridTemplateRows:frame.panel.height+'px'+extra},{gridTemplateRows:panel.height+'px'+extra}],timing('layout')||260);
    }
   }
   if(next.phase==='DEBATE'&&(!sameRound||!previous.game)){
    const card=document.querySelector('.gi-area-project .project');
    play(card,'card',[{opacity:.6,transform:'translate(12px,-10px) rotate(1.2deg)'},{opacity:1,transform:'none'}],timing('scene')||340);
   }
   if(next.phase==='REVEAL'&&previous.phase!=='REVEAL'){
    const result=document.querySelector('.gi-action-panel .summary');
    play(result,'reveal',[{opacity:.55,transform:'translateY(6px)',outline:'2px solid transparent',outlineOffset:'-2px'},{opacity:1,transform:'none',outline:'2px solid currentColor',outlineOffset:'-2px'},{opacity:1,outline:'2px solid transparent',outlineOffset:'-2px'}],420);
   }
   if(previous.game&&previous.game===next.game&&Number.isFinite(previous.coins)&&previous.coins!==next.coins){
    for(const coin of document.querySelectorAll('.gi-desktop-wallet,.gi-top-wallet'))
     play(coin,'balance',[{opacity:.6,transform:'scale(.97)'},{opacity:1,transform:'scale(1.035)'},{opacity:1,transform:'none'}],200);
   }
   if(sameRound&&next.phase==='DEBATE'&&previous.phase==='DEBATE'){
    for(const id of next.statements.filter(id=>!previous.statements.includes(id)))
     arrive(document.querySelector('.gi-statement[data-player-id="'+CSS.escape(id)+'"]'),'statement',6,160);
   }
   if(!previous.game&&!next.game){
    for(const id of next.people.filter(id=>!previous.people.includes(id)))
     arrive(document.querySelector('.person[data-player-id="'+CSS.escape(id)+'"]'),'member',6,160);
   }
  });
 }
 function pending(button){
  if(!button)return ()=>{};
  const disabled=button.disabled;button.disabled=true;button.setAttribute('aria-busy','true');
  return success=>{
   button.removeAttribute('aria-busy');
   if(button.isConnected){button.disabled=disabled;if(!success)play(button,'error',[{opacity:.55},{opacity:1}],140);}
  };
 }
 function drawer(panel){play(panel,'panel',[{opacity:.5},{opacity:1}],180);}
 function home(){
  if(homePlayed||!document.querySelector('#form-create'))return;
  homePlayed=true;
  queued=requestAnimationFrame(()=>{
   for(const card of document.querySelectorAll('.welcome-card')){
    const base=getComputedStyle(card).transform;
    play(card,'home',[{opacity:.5,transform:(base==='none'?'':base)+' translateY(10px)'},{opacity:1,transform:base}],420);
   }
  });
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 window.addEventListener('pagehide',stop);reduced.addEventListener('change',stop);
 document.addEventListener('pointerdown',event=>{
  const button=event.target.closest('button');
  if(!button||button.disabled||button.closest('.gi-ending-screen')||document.body.classList.contains('gi-ending')||['show-role','mobile-show-role'].includes(button.id))return;
  const base=getComputedStyle(button).transform;
  play(button,'press',[{transform:(base==='none'?'':base)+' scale(.985)'},{transform:base}],120);
 });
 window.GreenTrapMotion={capture,commit,pending,drawer,home};
})();
