'use strict';
const app=document.getElementById('app'), statusEl=document.getElementById('connection'),toast=document.getElementById('toast');
let session=null,snapshot=null,aborter=null,delay=750,clock=null,requesting=false,statementDraft=null,actionDraft=null;
let clockAnchor=null,peopleOpen=false,endingLeaveSent=false;
let kickConfirmationId=null,kickSubmittingId=null;
const kickEffects=new Map();
const eliminationEffects=new Map();
let eliminationTimer,eliminationHold=null;
const phaseSeconds={DEBATE:120,BLIND_ACTION:60,REVEAL:25};
let phaseScreen=null,phaseScreenTimer;
const phaseIntroductions={
 DEBATE:{title:'Thảo luận',hint:'Cùng tìm sự thật phía sau dự án.',step:0,icon:'<path d="M17 19h46v31H37L23 62V50h-6z"/><path d="M28 30h24M28 39h16"/>'},
 BLIND_ACTION:{title:'Hành động bí mật',hint:'Đầu tư và chọn hành động của bạn.',step:1,icon:'<rect x="21" y="33" width="38" height="31" rx="7"/><path d="M29 33V23a11 11 0 0 1 22 0v10M40 46v7"/>'},
 REVEAL:{title:'Công bố kết quả',hint:'Sự thật của dự án được hé lộ.',step:2,icon:'<path d="m40 12 7 18 19 7-19 7-7 19-7-19-19-7 19-7zM64 12v12M58 18h12"/>'},
 GAME_OVER:{title:'Kết thúc ván',hint:'Cùng nhìn lại tương lai đã chọn.',step:3,icon:'<path d="M26 15h28v19a14 14 0 0 1-28 0zM26 21H15v9a13 13 0 0 0 13 13M54 21h11v9a13 13 0 0 1-13 13M40 48v14M28 65h24"/>'}
};
function clearPhaseTransition(){clearTimeout(phaseScreenTimer);phaseScreen?.remove();phaseScreen=null;}
function showPhaseTransition(previous,current){
 const before=previous?.game,next=current.game,info=phaseIntroductions[next?.phase];
 if(!next||!info){clearPhaseTransition();return;}
 // A first snapshot (including refresh/reconnect into a game) is not a phase change.
 if(!previous||previous.room.code!==current.room.code)return;
 const newProject=next.phase==='DEBATE'&&Boolean(next.project?.id)&&(!before||before.gameId!==next.gameId||before.round!==next.round||before.project?.id!==next.project.id);
 if(before?.gameId===next.gameId&&before.round===next.round&&before.phase===next.phase&&!newProject)return;
 window.GreenTrapActionFX?.clear();
 clearPhaseTransition();
 if(document.hidden)return;
 const remaining=current.deadline?current.deadline-current.serverTime:Infinity;
 if(remaining<1000)return;
 // Pure presentation: render immediately and keep the server clock running.
 const duration=Math.min(2000,remaining-350);
 const screen=document.createElement('div');screen.className='gi-phase-transition';screen.dataset.phase=next.phase;
 if(next.phase==='GAME_OVER')screen.dataset.winner=next.outcome?.winner||'DRAW';
 screen.setAttribute('role','status');screen.setAttribute('aria-live','polite');screen.setAttribute('aria-atomic','true');
 screen.style.setProperty('--phase-duration',duration+'ms');
 screen.innerHTML='<div class="gi-phase-orbit" aria-hidden="true"></div><div class="gi-phase-orbit gi-phase-orbit--outer" aria-hidden="true"></div><div class="gi-phase-sparks" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="gi-phase-intro"><span class="gi-phase-round"></span><div class="gi-phase-emblem" aria-hidden="true"><svg viewBox="0 0 80 80" fill="none">'+info.icon+'</svg></div><h2></h2><p></p><div class="gi-phase-steps" aria-hidden="true"><span>Thảo luận</span><i></i><span>Quyết định</span><i></i><span>Công bố</span></div></div><span class="gi-phase-signature" aria-hidden="true">Green Trap Detective</span>';
 if(newProject){
  screen.dataset.transition='project';screen.dataset.project=next.project.id;
  const intro=screen.querySelector('.gi-phase-intro');intro.classList.add('gi-project-intro');
  intro.innerHTML='<span class="gi-phase-round"></span><div class="gi-project-brand"><div class="gi-project-seal" aria-hidden="true"><span class="gi-project-card gi-project-card--left"></span><span class="gi-project-card gi-project-card--right"></span><span class="gi-project-card gi-project-card--front"><picture class="gi-brand-picture"><source type="image/webp" srcset="/brand/green-trap-detective.webp"><img src="/brand/green-trap-detective.png" alt="" decoding="async"></picture></span></div><h2><span>Green Trap</span> <span>Detective</span></h2></div><p class="gi-project-label">Dự án mới</p><p class="gi-project-name"></p>';
  intro.querySelector('.gi-project-name').textContent=next.project.title||'Cùng khám phá dự án tiếp theo.';
 }else if(next.phase==='GAME_OVER'&&['PROTECTOR','SABOTEUR'].includes(next.outcome?.winner)){
  const good=next.outcome.winner==='PROTECTOR';screen.dataset.transition='ending';screen.dataset.ending=good?'good':'bad';
  const icon=good?'<path d="M40 65V38M40 46C17 46 13 28 16 17c18 0 28 12 24 29Zm0-9c0-20 14-29 27-27 3 18-8 29-27 27Z"/>':'<path d="M29 12a29 29 0 1 0 23 0M20 26h15m12 0h14M13 43h20m14 0h20M40 9l-7 19 15 7-13 16 8 19"/>';
  const scene=good?'<path d="M0 160Q180 45 360 135T720 115T1080 135T1440 100V260H0Z"/><path d="M0 205Q220 95 460 195T920 175T1440 175V260H0Z"/>':'<path d="M0 260V190h50V120h50v65h45V90h60v120h55V45h38v170h80v-70h65v115h550V155h60v60h60V60h38v135h55V105h65v105h55v-65h55v115Z"/><path class="gi-ending-crack" d="m650 0 35 60-35 35 65 50-30 50 50 65m-60-120-60 15-25 45m112-115 50 20 30-35"/>';
  screen.insertAdjacentHTML('afterbegin','<div class="gi-ending-aura" aria-hidden="true"></div><svg class="gi-ending-scenery" viewBox="0 0 1440 260" preserveAspectRatio="none" aria-hidden="true">'+scene+'</svg>');
  const intro=screen.querySelector('.gi-phase-intro');intro.classList.add('gi-ending-intro');
  intro.innerHTML='<span class="gi-phase-round"></span><div class="gi-ending-sigil" aria-hidden="true"><svg viewBox="0 0 80 80" fill="none">'+icon+'</svg></div><h2><span>'+(good?'GOOD':'BAD')+'</span> <span>ENDING</span></h2><p class="gi-ending-faction"></p><p class="gi-ending-motto"></p>';
  intro.querySelector('.gi-ending-faction').textContent=good?'Phe Bảo vệ chiến thắng':'Phe Phá hoại chiến thắng';
  intro.querySelector('.gi-ending-motto').textContent=good?'Mầm xanh được giữ lại.':'Màu xanh chỉ còn là ký ức.';
 }else{
  screen.querySelector('h2').textContent=info.title;screen.querySelector('p').textContent=info.hint;
 }
 screen.querySelector('.gi-phase-round').textContent=next.phase==='GAME_OVER'?'HÀNH TRÌNH KHÉP LẠI':'LƯỢT '+next.round+' / '+next.roundLimit;
 screen.querySelectorAll('.gi-phase-steps span').forEach((step,index)=>{step.dataset.state=index<info.step?'done':index===info.step?'active':'next';});
 // Close old top-layer card previews before covering the new phase.
 document.querySelectorAll('dialog[open]:not(#tutorial-dialog):not(#rules-dialog)').forEach(dialog=>dialog.close());
 phaseScreen=screen;document.body.appendChild(screen);
 const dismiss=()=>{if(phaseScreen===screen){clearPhaseTransition();window.GreenTrapMotion?.resumeScene?.();window.GreenTrapActionFX?.resume();playEliminationEffects();}};
 screen.addEventListener('animationend',event=>{if(event.target===screen&&event.animationName==='gi-phase-screen')dismiss();});
 phaseScreenTimer=setTimeout(dismiss,duration);
}
let actionBurnHold=null;
function cancelActionBurn(){
 if(!actionBurnHold)return;
 clearTimeout(actionBurnHold.timer);actionBurnHold.fire.remove();actionBurnHold.burnCanvas.remove();actionBurnHold.header.classList.remove('gi-clock-burning');
 actionBurnHold=null;app.inert=false;
}
function finishActionBurn(){
 const hold=actionBurnHold;if(!hold)return;
 const value=snapshot;cancelActionBurn();snapshot=hold.previous;acceptSnapshot(value,false,false);
}
function startActionBurn(previous,value){
 const progress=document.getElementById('phase-progress'),header=progress?.closest('.gi-phase-header');if(!header)return false;
 // Keep the functional countdown visible; reduced motion only removes flicker/particles.
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,duration=2000;
 const burnCanvas=document.createElement('canvas');burnCanvas.className='gi-clock-burn-layer';burnCanvas.setAttribute('aria-hidden','true');
 const fire=document.createElement('span');fire.className='gi-clock-fire';fire.setAttribute('aria-hidden','true');
 fire.innerHTML='<svg viewBox="0 0 28 34"><path class="gi-fire-outer" d="M15 1c2 9-7 11-4 18-4-1-5-5-4-8C-4 22 3 33 14 33s18-12 9-23c1 6-2 8-3 8C23 10 16 7 15 1Z"/><path class="gi-fire-inner" d="M14 16c2 5-3 7-2 10-2 0-3-2-3-3-3 6 1 10 5 10 6 0 9-7 5-11 0 3-2 4-2 4 1-4-2-7-3-10Z"/></svg><i></i><i></i>';
 actionBurnHold={previous,header,fire,burnCanvas,context:burnCanvas.getContext('2d'),particles:[],lastPaint:performance.now(),from:Math.max(0,progress.value),started:performance.now(),duration,reduced};
 snapshot=value;clearPhaseTransition();document.querySelectorAll('dialog[open]:not(#tutorial-dialog):not(#rules-dialog)').forEach(dialog=>dialog.close());
 header.classList.add('gi-clock-burning');header.append(burnCanvas,fire);app.inert=true;
 actionBurnHold.timer=setTimeout(()=>{
  if(!actionBurnHold)return;
  paintActionBurn();
  if(actionBurnHold)actionBurnHold.timer=setTimeout(finishActionBurn,200);
 },duration+80);finishClientSession(value);paintActionBurn();return true;
}
function paintActionBurn(){
 const hold=actionBurnHold,progress=document.getElementById('phase-progress');if(!hold||!progress){finishActionBurn();return;}
 const elapsed=performance.now()-hold.started,t=Math.min(1,elapsed/hold.duration),burnT=Math.min(1,elapsed/(hold.duration-180)),remaining=hold.from*(1-burnT);
  progress.value=Math.max(0,remaining);const label=document.getElementById('clock'),text=Math.ceil(remaining)+'s';if(label&&label.textContent!==text)label.textContent=text;
 const bar=progress.getBoundingClientRect(),header=hold.header.getBoundingClientRect();
 hold.fire.style.left=(bar.left-header.left+bar.width*progress.value/progress.max)+'px';hold.fire.style.top=(bar.top-header.top+bar.height/2)+'px';
 hold.fire.classList.toggle('is-spent',burnT>=1);drawActionBurn(hold,bar,header,progress,burnT);
  if(burnT>=1&&hold.emptiedAt===undefined)hold.emptiedAt=performance.now();
  if(t>=1&&hold.emptiedAt!==undefined&&performance.now()-hold.emptiedAt>=120)finishActionBurn();else scheduleClock();
}
function drawActionBurn(hold,bar,header,progress,burnT){
 const ctx=hold.context;if(!ctx)return;
 const dpr=Math.min(devicePixelRatio||1,2),canvas=hold.burnCanvas,width=Math.ceil(header.width*dpr),height=Math.ceil(header.height*dpr);
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,header.width,header.height);
 const left=bar.left-header.left,y=bar.top-header.top+bar.height/2,tip=left+bar.width*progress.value/progress.max,end=left+bar.width*hold.from/progress.max,burned=Math.max(0,end-tip);
 // Only the remaining fuel is painted; the consumed section clears to the normal track.
 const fuel=ctx.createLinearGradient(left,0,Math.max(left+1,tip),0);fuel.addColorStop(0,'#e4bb4d');fuel.addColorStop(.82,'#ffad37');fuel.addColorStop(1,'#fff6bb');
 ctx.fillStyle=fuel;ctx.fillRect(left,y-3.5,Math.max(0,tip-left),7);
 const time=performance.now()/1000,dt=Math.min(.05,Math.max(0,time-hold.lastPaint/1000));hold.lastPaint=time*1000;
 if(!hold.reduced&&burnT<1){
  const glow=ctx.createRadialGradient(tip+12,y-7,1,tip+12,y-7,48);glow.addColorStop(0,'#ffca6bb3');glow.addColorStop(.4,'#ff6b2570');glow.addColorStop(1,'#ff5a0000');ctx.fillStyle=glow;ctx.fillRect(tip-36,y-55,96,64);
  for(let i=0;i<10;i++){
   const x=tip+Math.min(burned,7+i*6),fade=1-i/12,h=(12+15*(.5+.5*Math.sin(time*28+i*2.1)))*fade,w=4+fade*3,sway=Math.sin(time*20+i)*5;
   const flame=ctx.createLinearGradient(x,y-h,x,y+2);flame.addColorStop(0,'#ff4b1b00');flame.addColorStop(.2,'#ff5e1bcc');flame.addColorStop(.6,'#ffc342');flame.addColorStop(1,'#fff6bc');ctx.fillStyle=flame;
   ctx.beginPath();ctx.moveTo(x-w,y+3);ctx.bezierCurveTo(x-w*1.3,y-h*.4,x+w*.2,y-h*.6,x+sway,y-h);ctx.bezierCurveTo(x+w*.4,y-h*.3,x+w*1.3,y-h*.3,x+w,y+3);ctx.closePath();ctx.fill();
  }
  for(let i=0;i<3;i++)hold.particles.push({x:tip+Math.random()*Math.min(26,burned),y:y-3,vx:25+Math.random()*65,vy:-30-Math.random()*90,life:.22+Math.random()*.32,size:1+Math.random()*2,smoke:false});
  hold.particles.push({x:tip+Math.min(15,burned),y:y-14,vx:12,vy:-18,life:.45,size:4,smoke:true});
 }
 hold.particles=hold.particles.filter(p=>(p.life-=dt)>0).slice(-120);
 for(const p of hold.particles){
  p.x+=p.vx*dt;p.y+=p.vy*dt;
  if(p.smoke){p.size+=dt*12;ctx.fillStyle='rgba(99,86,75,'+Math.min(.24,p.life*.5)+')';ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}
  else{p.vy+=dt*60;ctx.fillStyle='rgba(255,'+(160+Math.round(p.life*160))+',83,'+Math.min(1,p.life*4)+')';ctx.fillRect(p.x,p.y,p.size,p.size);}
 }
}
function discussionSkipButton(game,complete=false){
 const vote=game.discussionSkip;if(!vote)return '';
 const label=complete?'Đủ lượt Skip, chuyển sang bình chọn':vote.voted?'Bạn đã chọn Skip':'Skip thảo luận';
 return `<button id="skip-discussion" type="button" class="gi-discussion-skip" aria-pressed="${vote.voted}" aria-label="${label} · ${vote.count}/${vote.required}" title="${label}" ${!game.myPlayer.isAlive||vote.voted||complete?'disabled':''} ${complete?'data-complete="true"':''}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m3 5 6 5-6 5Zm6 0 6 5-6 5M17 5v10"/></svg><span>Skip</span>${vote.count?`<span class="gi-skip-count" role="status" aria-label="${vote.count} trên ${vote.required} người đã chọn Skip">${vote.count}/${vote.required}</span>`:''}</button>`;
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){finishActionBurn();clearPhaseTransition();clearEliminationState(true);}});
window.addEventListener('pagehide',()=>{finishActionBurn();clearPhaseTransition();clearEliminationState(true);});
function acceptSnapshot(value,skipFeedback=true,burnFeedback=true){
 if(snapshot&&snapshot.room.code===value.room.code&&snapshot.room.revision>value.room.revision)return;
 synchronizeClock(value);
 if(snapshot?.room.code===value.room.code&&typeof value.room.revision==='number'&&snapshot.room.revision===value.room.revision){snapshot.serverTime=value.serverTime;snapshot.deadline=value.deadline;return;}
 window.GreenTrapSocial?.receive(value,snapshot);
 window.GreenTrapActionFX?.receive(value,snapshot);
 window.GreenTrapTutorial?.receive(value);
 if(actionBurnHold){
  if(snapshot.room.code===value.room.code&&snapshot.game.gameId===value.game?.gameId&&snapshot.game.round===value.game.round&&snapshot.game.phase===value.game.phase){snapshot=value;finishClientSession(value);return;}
  cancelActionBurn();
  // A newer phase supersedes the held board; never burn its stale timer again.
  skipFeedback=false;burnFeedback=false;
 }
 if(burnFeedback&&!document.hidden&&snapshot?.game&&value.game&&snapshot.room.code===value.room.code&&snapshot.game.gameId===value.game.gameId&&snapshot.game.round===value.game.round&&snapshot.game.phase==='BLIND_ACTION'&&['REVEAL','GAME_OVER'].includes(value.game.phase)&&value.game.history.at(-1)?.round===value.game.round&&value.game.history.at(-1)?.fastForward){
  if(startActionBurn(snapshot,value))return;
 }
 if(skipFeedback&&!document.hidden&&snapshot?.game&&value.game&&snapshot.room.code===value.room.code&&snapshot.game.gameId===value.game.gameId&&snapshot.game.round===value.game.round&&snapshot.game.phase==='DEBATE'&&value.game.phase==='BLIND_ACTION'&&value.game.discussionSkip?.complete&&app.querySelector('#skip-discussion')&&value.deadline-value.serverTime>2000){
  captureStatementDraft();
  app.querySelector('#skip-discussion').outerHTML=discussionSkipButton(value.game,true);
  if(startActionBurn(snapshot,value))return;
 }
 if(eliminationHold&&snapshot?.game?.gameId===value.game?.gameId&&snapshot.room.code===value.room.code&&value.game.phase==='GAME_OVER'){
  snapshot=value;refreshPlayerLists();finishClientSession(value);return;
 }
 if(snapshot?.room.code===value.room.code)for(const player of value.room.players){
  if(player.removed&&snapshot.room.players.some(previous=>previous.id===player.id&&!previous.removed))rememberKick(player,value.room.code,false);
 }
 if(kickConfirmationId&&(!value.room.players.some(player=>player.id===kickConfirmationId&&!player.removed)||value.game?.phase==='GAME_OVER'))kickConfirmationId=null;
 // Presence updates after game over must not recreate or restart the film.
 if(snapshot?.game?.phase==='GAME_OVER'&&value.game?.phase==='GAME_OVER'&&snapshot.game.gameId===value.game.gameId&&snapshot.game.outcome?.winner===value.game.outcome?.winner&&app.querySelector('.gi-ending-screen')){
  snapshot=value;refreshPlayerLists();finishClientSession(value);return;
 }
 const sameRound=snapshot?.game&&snapshot.room.code===value.room.code&&snapshot.game.gameId===value.game?.gameId&&snapshot.game.round===value.game?.round;
 const scrollSelectors=['.people','#players-panel',...(sameRound?['.gi-center-column','.gi-area-discussion>.card:first-child>.hist','.gi-history .hist']:[])];
 const scrolls=scrollSelectors.flatMap(selector=>{const el=app.querySelector(selector);return el?[{selector,left:el.scrollLeft,top:el.scrollTop,focused:document.activeElement===el}]:[];});
 const choiceOpen=app.querySelector('#statement-choice')?.open,choiceFocus=document.activeElement?.id,drawerFocused=peopleOpen&&app.querySelector('#players-panel')?.contains(document.activeElement);
 const previous=snapshot;
 const motionFrame=window.GreenTrapMotion?.capture(snapshot);
 const newlyExpelled=rememberEliminations(previous,value);
 if(newlyExpelled.length&&value.game.phase==='GAME_OVER'&&app.querySelector('.gi-area-players')&&!document.hidden){
  captureStatementDraft();snapshot=value;clearStatementDraft();actionDraft=null;
  window.GreenTrapMotion?.commit(value,motionFrame);
  clearPhaseTransition();document.querySelectorAll('dialog[open]:not(#tutorial-dialog):not(#rules-dialog)').forEach(dialog=>dialog.close());
  eliminationHold={previous};app.inert=true;refreshPlayerLists();
  const label=app.querySelector('.gi-phase-header .phase');if(label)label.textContent='Công bố · Trục xuất';
  playEliminationEffects();finishClientSession(value);return;
 }
  const kickFocus=document.activeElement?.closest('.kick-confirmation')?document.activeElement.id:null;
  const historyOpen=app.querySelector('.gi-history')?.open;
  const focusedNode=app.contains(document.activeElement)?document.activeElement:null;
  const focusedControl=focusedNode?.id;
  // Own submission changes the form, but not its project. Retain the decoded
  // image so a confirmed coin flight never races a newly mounted image decode.
  const retainedProject=sameRound&&previous.game.phase===value.game.phase&&JSON.stringify(previous.game.project)===JSON.stringify(value.game.project)?app.querySelector('.gi-area-project'):null;
  captureStatementDraft();snapshot=value;render(previous);
  const renderedProject=app.querySelector('.gi-area-project');
  if(retainedProject&&renderedProject&&retainedProject!==renderedProject)renderedProject.replaceWith(retainedProject);
  if(previous?.game?.gameId===value.game?.gameId){
   const history=app.querySelector('.gi-history');if(history&&historyOpen!==undefined)history.open=historyOpen;
   if(focusedNode?.isConnected&&document.activeElement!==focusedNode)focusedNode.focus({preventScroll:true});
   else if(focusedControl&&document.activeElement.id!==focusedControl)document.getElementById(focusedControl)?.focus({preventScroll:true});
  }
 if(choiceOpen){openStatementChoice();if(choiceFocus)document.getElementById(choiceFocus)?.focus();}
 if(drawerFocused)(document.getElementById(choiceFocus)||document.getElementById('close-players'))?.focus();
 for(const saved of scrolls){const el=app.querySelector(saved.selector);if(el){el.scrollLeft=saved.left;el.scrollTop=saved.top;if(saved.focused)el.focus({preventScroll:true});}}
 applyKickEffects();applyEliminationEffects();if(kickFocus)document.getElementById(kickFocus)?.focus({preventScroll:true});
 window.GreenTrapMotion?.commit(value,motionFrame);
 showPhaseTransition(previous,value);
 window.GreenTrapActionFX?.rendered(value);
 playEliminationEffects();
 finishClientSession(value);
}
function finishClientSession(value){if(value.game?.phase!=='GAME_OVER'||!session)return;try{sessionStorage.setItem('green-impact-finished-game',JSON.stringify({roomCode:session.roomCode,playerId:session.playerId,view:value}));}catch{}aborter?.abort();statusEl.textContent='Ván đã kết thúc';}
function remainingMilliseconds(){return clockAnchor?Math.max(0,clockAnchor.remaining-(performance.now()-clockAnchor.at)):0;}
function remainingSeconds(){return Math.ceil(remainingMilliseconds()/1000);}
function scheduleClock(){if(!clock&&(clockAnchor||actionBurnHold)&&!document.hidden)clock=requestAnimationFrame(paintClock);}
function synchronizeClock(value){
 if(!value.deadline||value.game?.phase==='GAME_OVER'){clockAnchor=null;cancelAnimationFrame(clock);clock=null;return;}
 const key=[value.room.code,value.game?.gameId,value.game?.round,value.game?.phase,value.deadline].join(':');
 const remaining=Math.max(0,value.deadline-value.serverTime);
 clockAnchor={key,remaining:clockAnchor?.key===key?Math.min(remaining,remainingMilliseconds()):remaining,at:performance.now()};
 scheduleClock();
}
function paintClock(){
 clock=null;if(document.hidden)return;if(actionBurnHold){paintActionBurn();return;}if(!clockAnchor||!snapshot?.deadline)return;
 const remaining=remainingMilliseconds(),label=Math.ceil(remaining/1000)+'s',el=document.getElementById('clock'),progress=document.getElementById('phase-progress');
 if(el&&el.textContent!==label)el.textContent=label;
 if(progress)progress.value=remaining/1000;
 if(remaining>0)scheduleClock();
}
const draftStorageKey='green-impact-statement-draft';
const storeKey='green-impact-multiplayer-session';
const escapeHTML=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labelRole=r=>r==='PROTECTOR'?'Người Bảo Vệ':r==='SABOTEUR'?'Người Phá Hoại':'Hòa';
const phaseText={DEBATE:'Thảo luận',BLIND_ACTION:'Hành động bí mật',REVEAL:'Công bố',GAME_OVER:'Kết thúc'};
const outcomeText={TEN_ROUNDS:'Đã hoàn thành 10 lượt',FACTION_ELIMINATED:'Một phe đã bị loại toàn bộ',MUTUAL_ELIMINATION:'Hai phe cùng bị loại'};
let toastTimer;
function showToast(message,kind='error',duration=4700){
 clearTimeout(toastTimer);toast.textContent=message;toast.dataset.kind=kind;toast.classList.add('show');
 document.body.classList.remove('copy-confirmed');
 if(kind==='success'){void document.body.offsetWidth;document.body.classList.add('copy-confirmed');}
 toastTimer=setTimeout(()=>{toast.classList.remove('show');document.body.classList.remove('copy-confirmed');},duration);
}
const gameError=e=>showToast(e.message||'Đã xảy ra lỗi');
const save=()=>{if(session)sessionStorage.setItem(storeKey,JSON.stringify(session));else{sessionStorage.removeItem(storeKey);sessionStorage.removeItem('green-impact-finished-game');}};
const statementDraftKey=(game,player)=>[game?.gameId||'',game?.round??'',player?.id||''].join(':');
function persistStatementDraft(){
 if(!snapshot?.game||snapshot.game.phase!=='DEBATE')return;
 const field=app.querySelector('#statement-text');if(!field)return;
 const player=snapshot.game.myPlayer;
 const draft={key:statementDraftKey(snapshot.game,player),text:field.value,stance:document.getElementById('stance')?.value||'UNSURE',selectionStart:field.selectionStart,selectionEnd:field.selectionEnd,focused:document.activeElement===field};
 statementDraft=draft;try{sessionStorage.setItem(draftStorageKey,JSON.stringify(draft));}catch{}
}
function captureStatementDraft(){
 persistStatementDraft();
 if(snapshot?.game?.phase==='BLIND_ACTION'&&app.querySelector('#action-form')){
  actionDraft={key:statementDraftKey(snapshot.game,snapshot.game.myPlayer),invest:document.getElementById('invest').checked,bank:document.getElementById('bank').value,target:document.getElementById('target').value,amount:document.getElementById('amount').value};
 }
}
function restoreActionDraft(game,player){
 if(!actionDraft||actionDraft.key!==statementDraftKey(game,player)||!app.querySelector('#action-form'))return;
 document.getElementById('invest').checked=actionDraft.invest;
 document.getElementById('bank').value=actionDraft.bank;
 document.getElementById('target').value=actionDraft.target;
 document.getElementById('amount').value=actionDraft.amount;
}
function restoreStatementDraft(game,player){
 const key=statementDraftKey(game,player);let draft=statementDraft;
 if(!draft||draft.key!==key){try{draft=JSON.parse(sessionStorage.getItem(draftStorageKey)||'null');}catch{draft=null;}}
 if(!draft||draft.key!==key)return;
 const field=app.querySelector('#statement-text');if(!field)return;
 field.value=String(draft.text||'');
 updateStatementCounter();
 const stance=document.getElementById('stance');if(stance)stance.value=draft.stance||'UNSURE';
 statementDraft=draft;
 if(draft.focused){field.focus({preventScroll:true});try{field.setSelectionRange(draft.selectionStart??field.value.length,draft.selectionEnd??field.value.length);}catch{}}
}
function clearStatementDraft(){statementDraft=null;try{sessionStorage.removeItem(draftStorageKey);}catch{}}
function recoverSession(error){
 if(!session)return;
 cancelActionBurn();
 clearPhaseTransition();
 clearKickState();
 clearEliminationState(false);
 const expiredRoom=error.code==='ROOM_NOT_FOUND',kicked=error.code==='KICKED';
 peopleOpen=false;document.body.classList.remove('gi-drawer-open','gi-gameplay','gi-ending');
 aborter?.abort();session=null;snapshot=null;save();clearStatementDraft();
 window.GreenTrapTutorial?.receive(null);
 window.GreenTrapActionFX?.clear();
 try{const url=new URL(location.href);url.searchParams.delete('room');history.replaceState({},'',url.pathname+url.search+url.hash);}catch{}
 statusEl.textContent=kicked?'Đã rời phòng':expiredRoom?'Phòng không còn tồn tại':'Phiên chơi hết hạn';
 app.innerHTML=`<section class="card welcome"><h1>${kicked?'Bạn đã được đưa ra khỏi phòng':expiredRoom?'Phòng đã kết thúc hoặc hết hạn':'Phiên chơi không còn hợp lệ'}.</h1><p>${kicked?'Chủ phòng đã kick bạn khỏi phòng.':expiredRoom?'Phòng này không còn trên máy chủ. Phòng có thể đã bị đóng hoặc hết thời gian lưu.':'Phiên xác thực đã hết hạn hoặc không còn hợp lệ.'} Bạn có thể quay về trang đầu để tạo phòng mới hoặc nhập mã phòng khác.</p><div class="actions"><button id="return-home" class="primary">Tạo hoặc tham gia phòng khác <span aria-hidden="true">→</span></button></div></section>`;
}
function handleSessionError(error){if(error?.code==='ROOM_NOT_FOUND'||error?.code==='UNAUTHORIZED'){recoverSession(error);return;}gameError(error);}
const pendingRequests=new Map();
const api=async(path,data,authenticated=false,keepalive=false)=>{const headers={'Content-Type':'application/json','x-game-result-cache':'1'};if(authenticated){headers.Authorization=`Bearer ${session.token}`;headers['x-room-code']=session.roomCode;}
 const key=JSON.stringify([authenticated?session.playerId:'entry',path,data]);
 const requestId=pendingRequests.get(key)||crypto.randomUUID();pendingRequests.set(key,requestId);
 if(pendingRequests.size>20)pendingRequests.delete(pendingRequests.keys().next().value);
 const r=await fetch(path,{method:'POST',headers,body:JSON.stringify({...data,requestId}),keepalive,signal:keepalive?undefined:AbortSignal.timeout(15000)});const value=await r.json().catch(()=>({}));if(r.ok||r.status<500)pendingRequests.delete(key);if(!r.ok){const error=Error(value.message||value.error||`HTTP ${r.status}`);error.code=value.error;error.status=r.status;throw error;}return value;};
function leaveFinishedRoom(){
 if(endingLeaveSent||!session||snapshot?.transport!=='poll'||snapshot.game?.phase!=='GAME_OVER')return;
 endingLeaveSent=true;
 void api('/api/action',{type:'finish_leave'},true,true).catch(()=>{});
}
const readState=async(signal)=>{const current=session;if(!current)return;if(snapshot?.room.code===current.roomCode&&snapshot.game?.phase==='GAME_OVER')return snapshot;const r=await fetch(`/api/state?room=${current.roomCode}`,{headers:{Authorization:`Bearer ${current.token}`,'x-game-result-cache':'1'},cache:'no-store',signal:signal||AbortSignal.timeout(12000)});const value=await r.json().catch(()=>({}));if(!r.ok){if(snapshot?.room.code===current.roomCode&&snapshot.game?.phase==='GAME_OVER')return snapshot;const error=Error(value.message||value.error||'Không thể tải trạng thái phòng');error.code=value.error;error.status=r.status;throw error;}if(session!==current)return;acceptSnapshot(value);return value;};
const copyRoom=async()=>{const url=`${location.origin}/?room=${session.roomCode}`;try{await navigator.clipboard.writeText(url);showToast('Đã sao chép','success',3000);}catch{gameError({message:'Không thể sao chép. Hãy thử lại.'});}};
function onSession(s) {
 const url=new URL(location.href);
 if(url.searchParams.has('room')&&url.searchParams.get('room')!==s.roomCode){
  url.searchParams.set('room',s.roomCode);
  history.replaceState(history.state,'',url);
 }
 session=s;save();app.innerHTML='';try{const result=JSON.parse(sessionStorage.getItem('green-impact-finished-game')||'null');if(result?.roomCode===s.roomCode&&result.playerId===s.playerId&&result.view?.game?.phase==='GAME_OVER'){acceptSnapshot(result.view);return;}}catch{}if(s.transport==='poll')connectPoll();else readState().then(value=>{if(session!==s||value?.game?.phase==='GAME_OVER')return;if(value?.transport==='poll'){s.transport='poll';save();connectPoll();}else connectStream();}).catch(handleSessionError);}
async function connectPoll(){
 if(snapshot?.game?.phase==='GAME_OVER')return;
 aborter?.abort();const active=new AbortController();aborter=active;let backoff=1500;statusEl.textContent='Đang kết nối';
 active.signal.addEventListener('abort',()=>clearTimeout(active.pollTimer),{once:true});
 const poll=async()=>{
  if(active.signal.aborted||!session)return;
  try{await readState(AbortSignal.any([active.signal,AbortSignal.timeout(12000)]));if(active.signal.aborted)return;statusEl.textContent='● Trực tuyến';backoff=1500;}
  catch(error){if(active.signal.aborted)return;if(error.code==='UNAUTHORIZED'||error.code==='ROOM_NOT_FOUND'){recoverSession(error);return;}statusEl.textContent='Đang kết nối lại';backoff=Math.min(backoff*2,15000);}
  if(active.signal.aborted||!session)return;
  const interval=document.hidden?Math.max(backoff,10000):backoff;
  active.pollTimer=setTimeout(poll,interval+Math.random()*250);
 };
 await poll();
}
async function connectStream(){if(!session)return;aborter?.abort();aborter=new AbortController();const active=aborter;statusEl.textContent='Đang kết nối';try{
 const res=await fetch(`/api/stream?room=${session.roomCode}`,{signal:active.signal,headers:{Authorization:`Bearer ${session.token}`},cache:'no-store'});
 if(!res.ok){const value=await res.json().catch(()=>({}));const error=Error(value.message||value.error||'Mất kết nối tới phòng');error.code=value.error;error.status=res.status;throw error;}delay=750;statusEl.textContent='● Trực tuyến';
 let buffer='';const reader=res.body.getReader();const decoder=new TextDecoder();
 while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let i;
 while((i=buffer.indexOf('\n\n'))>=0){const part=buffer.slice(0,i).replace(/\r/g,'');buffer=buffer.slice(i+2);const event=part.match(/^event: (.+)$/m)?.[1];const data=part.match(/^data: (.+)$/m)?.[1];if(event==='kicked'){recoverSession({code:'KICKED'});return;}if(event==='snapshot'&&data){acceptSnapshot(JSON.parse(data));}if(event==='superseded'){statusEl.textContent='Đã mở ở thiết bị khác';active.abort();return;}}}
 }catch(e){if(!active.signal.aborted){if(e.code==='ROOM_NOT_FOUND'||e.code==='UNAUTHORIZED'){recoverSession(e);return;}statusEl.textContent='● Mất kết nối';console.error(e);}}
 if(!active.signal.aborted&&session){statusEl.textContent='Đang kết nối lại';setTimeout(()=>{if(session&&aborter===active)connectStream()},delay);delay=Math.min(delay*1.8,9000);}
}
function clearKickState(){kickConfirmationId=null;kickSubmittingId=null;for(const effect of kickEffects.values())clearTimeout(effect.timer);kickEffects.clear();}
function rememberKick(player,roomCode,transient,index=0){
 const key=roomCode+':'+player.id;if(kickEffects.has(key))return;
 const effect={player:{id:player.id,name:player.name,online:false,removed:true},roomCode,transient,index,started:performance.now()};
 effect.timer=setTimeout(()=>{kickEffects.delete(key);if(snapshot?.room.code===roomCode)refreshPlayerLists();},2400);kickEffects.set(key,effect);
}
function applyKickEffects(){
 if(!snapshot)return;
 for(const row of app.querySelectorAll('.person[data-player-id]')){
  const effect=kickEffects.get(snapshot.room.code+':'+row.dataset.playerId);
  if(effect)row.style.setProperty('--kick-elapsed',-(performance.now()-effect.started)+'ms');
 }
}
function refreshPlayerLists(){
 if(!snapshot)return;const focused=document.activeElement?.id;
 for(const list of app.querySelectorAll('.lobby-members .people,.gi-area-players .people,.ending-people')){
  const left=list.scrollLeft,top=list.scrollTop,wasFocused=document.activeElement===list;
  list.innerHTML=playerList(snapshot);list.scrollLeft=left;list.scrollTop=top;if(wasFocused)list.focus({preventScroll:true});
 }
 applyKickEffects();applyEliminationEffects();if(focused)document.getElementById(focused)?.focus({preventScroll:true});
}
function eliminationKey(s,id){return s.room.code+':'+s.game.gameId+':'+id;}
function clearEliminationState(flush){
 clearTimeout(eliminationTimer);eliminationEffects.clear();const held=eliminationHold;eliminationHold=null;app.inert=false;
 const announcement=document.getElementById('elimination-announcement');if(announcement)announcement.textContent='';
 if(flush&&snapshot){if(held){render();}else refreshPlayerLists();}
}
function rememberEliminations(previous,current){
 const before=previous?.game,next=current.game;
 if(document.hidden||!before||!next||previous.room.code!==current.room.code||before.gameId!==next.gameId||before.round!==next.round||!['REVEAL','GAME_OVER'].includes(next.phase)||(next.phase==='GAME_OVER'&&!app.querySelector('.gi-area-players'))){
  clearEliminationState(false);return [];
 }
 const latest=next.history.at(-1),ids=latest?.round===next.round?new Set(latest.expelledPlayerIds||[]):new Set(),added=[];
 for(const player of next.players){
  const old=before.players.find(peer=>peer.id===player.id),member=current.room.players.find(peer=>peer.id===player.id),key=eliminationKey(current,player.id);
  if(member?.removed){eliminationEffects.delete(key);continue;}
  if(!ids.has(player.id)||player.isAlive||!old?.isAlive||eliminationEffects.has(key))continue;
  eliminationEffects.set(key,{roomCode:current.room.code,gameId:next.gameId,round:next.round,id:player.id,name:member?.name||player.name,beforeStatus:old.hasLockedAction?'Đã chốt hành động':old.hasStatement?'Đã gửi ý kiến':'Đang chơi',started:null});added.push(player.id);
 }
 if(next.phase==='GAME_OVER'&&!added.length)clearEliminationState(false);
 return added;
}
function eliminationFor(s,player){return !player.removed&&s.game?eliminationEffects.get(eliminationKey(s,player.id)):null;}
function applyEliminationEffects(){
 if(!snapshot?.game)return;
 for(const row of app.querySelectorAll('.gi-area-players .person[data-player-id]')){
  const effect=eliminationEffects.get(eliminationKey(snapshot,row.dataset.playerId));if(!effect)continue;
  row.dataset.eliminationState=effect.started===null?'pending':'running';
  row.style.setProperty('--elim-elapsed',effect.started===null?'0ms':-(performance.now()-effect.started)+'ms');
 }
}
function playEliminationEffects(){
 if(document.hidden||phaseScreen||!snapshot?.game||!app.querySelector('.gi-area-players'))return;
 const pending=[...eliminationEffects.values()].filter(effect=>effect.started===null);if(!pending.length)return;
 if(innerWidth<1200)setPlayersOpen(true,!peopleOpen&&!eliminationHold);
 const row=[...app.querySelectorAll('.gi-area-players .person[data-player-id]')].find(element=>element.dataset.playerId===pending[0].id),list=row?.closest('.people');
 if(row&&list){const box=row.getBoundingClientRect(),area=list.getBoundingClientRect();if(box.top<area.top)list.scrollTop+=box.top-area.top;else if(box.bottom>area.bottom)list.scrollTop+=box.bottom-area.bottom;if(box.left<area.left)list.scrollLeft+=box.left-area.left;else if(box.right>area.right)list.scrollLeft+=box.right-area.right;}
 const started=performance.now();pending.forEach(effect=>{effect.started=started;});applyEliminationEffects();
 let announcement=document.getElementById('elimination-announcement');if(!announcement){announcement=document.createElement('div');announcement.id='elimination-announcement';announcement.className='gi-elimination-announcement';announcement.setAttribute('role','status');document.body.appendChild(announcement);}
 announcement.textContent=pending.map(effect=>effect.name).join(', ')+' đã bị trục xuất.';
 clearTimeout(eliminationTimer);eliminationTimer=setTimeout(()=>{
  const held=eliminationHold;eliminationHold=null;eliminationEffects.clear();app.inert=false;
  if(!snapshot)return;
  if(held){render();applyKickEffects();if(!document.hidden)showPhaseTransition(held.previous,snapshot);}
  else refreshPlayerLists();
 },2000);
}
function eliminationStrike(){return '<svg class="gi-elim-strike" viewBox="0 0 220 14" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M2 8Q57 5 112 7T218 6"/></svg>';}
function eliminationParticles(){return '<span class="gi-elim-ring" aria-hidden="true"></span>'+Array.from({length:6},()=>'<i class="gi-elim-particle" aria-hidden="true"></i>').join('');}
function kickConfirmation(player){
 const busy=kickSubmittingId===player.id;
 return '<div class="kick-confirmation" role="group" aria-label="Bạn chắc chắn muốn kick '+escapeHTML(player.name)+'?" aria-busy="'+busy+'"><p>Kick <strong>“'+escapeHTML(player.name)+'”</strong>?</p><div class="kick-confirm-actions"><button type="button" class="kick-cancel" aria-label="Không kick, quay lại" id="kick-cancel-'+escapeHTML(player.id)+'" data-kick-cancel="'+escapeHTML(player.id)+'" '+(busy?'disabled':'')+'><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 4-5 5 5 5M4 9h9a7 7 0 0 1 7 7v3"/></svg></button><button type="button" class="kick-confirm-yes" aria-label="'+(busy?'Đang kick ':'Kick ')+escapeHTML(player.name)+'" id="kick-confirm-'+escapeHTML(player.id)+'" data-kick-confirm="'+escapeHTML(player.id)+'" '+(busy?'disabled':'')+'><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div></div>';
}
function kickScribble(animated){return '<svg class="kick-scribble" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="m8 20 163-10L13 34 184 22 8 49 190 36 9 65 185 52 13 81 189 67 29 92 184 82"/></svg>'+(animated?'<span class="kick-pencil" aria-hidden="true">✎</span>':'');}
function playerList(s){
 const players=s.room.players.slice();
 for(const effect of kickEffects.values())if(effect.roomCode===s.room.code&&effect.transient&&!players.some(player=>player.id===effect.player.id))players.splice(Math.min(effect.index,players.length),0,effect.player);
 return players.map(p=>{const g=s.game?.players.find(x=>x.id===p.id);let info=!g?'Trong phòng':g.isAlive?(g.hasLockedAction?'Đã chốt hành động':g.hasStatement?'Đã gửi ý kiến':'Đang chơi'):'Đã bị loại';
 if(p.removed){const owner=s.room.players.find(member=>member.id===s.room.hostId);info=s.game?.phase==='GAME_OVER'?'Bị chủ phòng '+(owner?.name||'')+' kick khỏi phòng':'Đã bị kick khỏi phòng';}
 else if(g&&!g.isAlive&&s.game.phase==='GAME_OVER'){
  if(g.eliminatedReason==='BANKRUPT')info='Bị loại do hết xu';
  else if(g.eliminatedReason==='EXPELLED'){
   const actors=[...new Set(g.eliminatedByPlayerIds||[])].map(id=>s.room.players.find(member=>member.id===id)?.name).filter(Boolean);
   info=actors.length?'Bị trục xuất bởi '+actors.join(', '):'Đã bị trục xuất';
  }
 }
 if(g?.role&&s.game.phase==='GAME_OVER')info+=' · '+labelRole(g.role);
 const canKick=session?.playerId===s.room.hostId&&p.id!==s.room.hostId&&!p.removed&&s.game?.phase!=='GAME_OVER';
 const effect=kickEffects.get(s.room.code+':'+p.id),confirming=canKick&&kickConfirmationId===p.id,elimination=eliminationFor(s,p);
 if(elimination)info='Đã bị trục xuất';
 return `<div class="person ${g&&!g.isAlive?'dead':''}${p.id===s.game?.myPlayer.id?' gi-person-self':''} ${p.removed?'is-kicked':''} ${effect?'kick-animating':''} ${effect?.transient?'kick-tombstone':''} ${elimination?'gi-elimination-fx':''}" data-player-id="${escapeHTML(p.id)}" data-kick-confirming="${confirming}"><div class="avatar" ${!s.game?'role="button" tabindex="0" aria-label="'+escapeHTML(p.id===session.playerId?'Đổi avatar của bạn':'Tương tác với '+p.name)+'"':''}>${p.avatarId?'<img src="/social/avatars/'+(/^a(?:0[1-9]|[12][0-9]|30)$/.test(p.avatarId)?p.avatarId:'a01')+'.png" alt="" width="44" height="44">':escapeHTML(p.name.charAt(0).toUpperCase())}${elimination?eliminationParticles():''}</div><div class="person-info"><b><span class="player-name${g&&!g.isAlive&&!p.removed?' is-eliminated':''}">${escapeHTML(p.name)}${elimination?eliminationStrike():''}</span> ${p.id===s.room.hostId?'★':''} ${p.id===s.game?.myPlayer.id?'(Bạn)':''}</b><small>${elimination?`<span class="gi-elim-before" aria-hidden="true">${escapeHTML(elimination.beforeStatus)}</span><span class="gi-elim-after">${escapeHTML(info)}</span>`:escapeHTML(info)}</small></div><span class="pill">${p.online?'● Online':'○ Offline'}</span>${canKick?`<button type="button" class="kick-player" id="kick-open-${escapeHTML(p.id)}" data-kick-player="${escapeHTML(p.id)}" aria-label="Kick ${escapeHTML(p.name)} khỏi phòng" ${confirming?'aria-hidden="true" tabindex="-1" disabled':''}>Kick</button>`:''}${confirming?kickConfirmation(p):''}${p.removed?kickScribble(Boolean(effect)):''}${elimination?'<span class="gi-elim-hit" aria-hidden="true"></span>':''}</div>`;
 }).join('');}

function lobbyExpeditionArt(){return `<div class="lobby-expedition" aria-hidden="true"><svg viewBox="0 0 640 340" fill="none" focusable="false">
<defs><linearGradient id="lobby-land" x1="320" y1="150" x2="320" y2="320" gradientUnits="userSpaceOnUse"><stop stop-color="#e5ead2"/><stop offset="1" stop-color="#cfdcb0"/></linearGradient><linearGradient id="lobby-glass" x1="260" y1="110" x2="340" y2="205" gradientUnits="userSpaceOnUse"><stop stop-color="#dce8ce" stop-opacity=".7"/><stop offset="1" stop-color="#a9c7a1" stop-opacity=".35"/></linearGradient><filter id="lobby-paper-shadow" x="-40%" y="-40%" width="180%" height="200%"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#314b30" flood-opacity=".12"/></filter></defs>
<circle cx="462" cy="84" r="38" fill="#e9d8a5" opacity=".65"/><circle cx="462" cy="84" r="49" stroke="#dfd0a1" stroke-dasharray="2 8"/>
<path d="M35 223Q85 124 190 174T368 164T591 201L611 269H28Z" fill="#e9eddc"/><path d="M38 243Q124 155 218 204T411 184Q520 156 605 231L606 284H33Z" fill="#dce5c9"/>
<g opacity=".65" fill="#b4c9a1"><path d="m117 180 24-58 24 58h-10l13 27h-53l12-27ZM416 161l19-46 20 46h-8l11 22h-46l12-22ZM504 192l23-58 25 58h-12l13 27h-52l13-27Z"/></g>
<ellipse cx="329" cy="276" rx="274" ry="42" fill="url(#lobby-land)"/>
<path d="M381 185q-87 14-37 44t-17 28q-79 9-153 33" stroke="#bbcfa9" stroke-width="28" stroke-linecap="round"/><path d="M381 185q-87 14-37 44t-17 28q-79 9-153 33" stroke="#eff0d8" stroke-width="17" stroke-linecap="round"/>
<g transform="translate(118 75)"><path d="M34 142V80" stroke="#927e54" stroke-width="8" stroke-linecap="round"/><path d="M35 112 17 95m18 1 19-16" stroke="#927e54" stroke-width="4" stroke-linecap="round"/><path d="M4 80q-18-25 8-41-1-29 27-27 19-25 38-5 31-1 29 29 28 18 6 43-2 34-33 28-28 21-47-3-31 3-28-24Z" fill="#b4c991"/><path d="M13 72q-10-19 12-31 1-25 26-24" stroke="#d8e2b5" stroke-width="5" stroke-linecap="round"/><path d="M42 96q28 17 49-6" stroke="#99b67c" stroke-width="4" stroke-linecap="round"/></g>
<g transform="translate(477 124) scale(.73)"><path d="M34 142V80" stroke="#927e54" stroke-width="8" stroke-linecap="round"/><path d="M4 80q-18-25 8-41-1-29 27-27 19-25 38-5 31-1 29 29 28 18 6 43-2 34-33 28-28 21-47-3-31 3-28-24Z" fill="#94b385"/><path d="M13 72q-10-19 12-31 1-25 26-24" stroke="#c1d29e" stroke-width="5" stroke-linecap="round"/></g>
<g filter="url(#lobby-paper-shadow)" transform="rotate(-9 340 233)"><path d="m221 176 190-4 19 115-198 5Z" fill="#fffaf0" stroke="#c9c6a6" stroke-width="1.4"/><path d="m238 191 67 3 11 75-65 4Z" fill="#e6ebd4"/><path d="m258 191 11 80m10-79 11 77m14-69-65 4m68 15-66 4m69 14-67 4m69 12-68 4" stroke="#bccba2" stroke-width="1"/><path d="M258 249q10-38 34-29t36-18" stroke="#879d71" stroke-width="2" stroke-dasharray="3 5"/><path d="m339 195 55-1m-52 11 45-1m-43 20 53-1m-49 11 39-1" stroke="#babda1" stroke-width="2" stroke-linecap="round"/><circle cx="326" cy="203" r="5" fill="#b5c789" stroke="#6e8c5a"/><path d="m395 260 28 18" stroke="#a66d50" stroke-width="5" stroke-linecap="round"/><path d="m423 278 7 1-4-6" fill="#365740"/></g>
<g transform="rotate(16 302 164)" filter="url(#lobby-paper-shadow)"><path d="m328 196 45 44" stroke="#375941" stroke-width="15" stroke-linecap="round"/><path d="m331 197 39 39" stroke="#6f8b5b" stroke-width="6" stroke-linecap="round"/><circle cx="298" cy="156" r="50" fill="#faf6e7" stroke="#638358" stroke-width="5"/><circle cx="298" cy="156" r="42" fill="url(#lobby-glass)" stroke="#c6b77c" stroke-width="2"/><path d="M277 177q-13-46 36-53 20 38-27 58" fill="#9ab480"/><path d="m283 182 22-43m-12 22-10-9" stroke="#557847" stroke-width="2" stroke-linecap="round"/><path d="M263 145q6-18 22-23" stroke="#fffdf0" stroke-width="4" stroke-linecap="round"/></g>
<g stroke="#6e8d5c" stroke-width="2" stroke-linecap="round"><path d="M86 290q12-27 7-53m0 27q-24-4-22-22 22 2 22 22Zm1-12q25-4 26-24-23 3-26 24Z" fill="#a9c18c"/><path d="M551 283q-10-30 0-55m-3 29q-20-4-22-20 22-1 22 20Zm2-14q22-4 24-22-22 2-24 22Z" fill="#9bb77d"/></g>
<path d="M55 297q45-13 80 0m321 5q50-12 108-3" stroke="#9cb681" stroke-width="2" stroke-linecap="round"/><g fill="#d6b977"><circle cx="206" cy="102" r="3"/><circle cx="403" cy="130" r="2"/><circle cx="581" cy="181" r="2.5"/></g><path d="M225 87h10m-5-5v10M423 73h8m-4-4v8" stroke="#b7aa77" stroke-width="1.4" stroke-linecap="round"/>
</svg></div>`;}

function timer(s){if(!s.deadline)return '';const remain=remainingSeconds();return `<span class="countdown" id="clock">${remain}s</span>`;}
window.GreenTrapSocial?.setup({getState:()=>snapshot,getPlayerId:()=>session?.playerId,send:data=>api('/api/action',data,true),notify:message=>showToast(message)});
function statementMarkup(statement,members){
 const name=members.get(statement.playerId)?.name||'Người chơi';
 const stance={SUPPORT:'Ủng hộ',OPPOSE:'Phản đối',UNSURE:'Chưa chắc chắn'};
 return '<div class="gi-statement" data-player-id="'+escapeHTML(statement.playerId)+'"><span class="gi-chat-avatar" aria-hidden="true">'+escapeHTML(name.charAt(0).toUpperCase())+'</span><div class="gi-chat-bubble"><b>'+escapeHTML(name)+'</b><span class="pill">'+escapeHTML(stance[statement.stance]||'Ý kiến')+'</span><p>'+escapeHTML(statement.text)+'</p></div></div>';
}
function updateGameInPlace(previous,current){
 const before=previous?.game,next=current.game;
 if(!before||!next||next.phase==='GAME_OVER'||previous.room.code!==current.room.code||!app.querySelector('.gi-game-grid'))return false;
 // These fields determine the board, form and available targets. A change to any
 // of them still uses the complete renderer; peer readiness/presence does not.
 const structure=s=>({
  room:[s.room.code,s.room.hostId,s.room.maxPlayers,s.room.players.map(({online,...member})=>member)],
  game:{...s.game,currentStatements:undefined,discussionSkip:undefined,
   players:s.game.players.map(({hasStatement,hasLockedAction,...player})=>player)},
  ownReadiness:s.game.players.find(player=>player.id===s.game.myPlayer.id)
 });
 if(JSON.stringify(structure(previous))!==JSON.stringify(structure(current)))return false;
 const members=new Map(current.room.players.map(player=>[player.id,player]));
 const peers=new Map(next.players.map(player=>[player.id,player]));
 for(const row of app.querySelectorAll('.gi-area-players .person[data-player-id]')){
  const member=members.get(row.dataset.playerId),peer=peers.get(row.dataset.playerId);if(!member)continue;
  const presence=row.querySelector(':scope>.pill'),label=member.online?'● Online':'○ Offline';
  if(presence&&presence.textContent!==label)presence.textContent=label;
  if(peer?.isAlive&&!member.removed){
   const info=row.querySelector('.person-info>small');
   const text=peer.hasLockedAction?'Đã chốt hành động':peer.hasStatement?'Đã gửi ý kiến':'Đang chơi';
   if(info&&info.textContent!==text)info.textContent=text;
  }
 }
 if(next.phase==='DEBATE'||next.phase==='BLIND_ACTION'){
  const list=app.querySelector('.gi-area-discussion>.card:first-child>.hist');
  const oldStatements=new Map(before.currentStatements.map(statement=>[statement.playerId,statement]));
  const rows=new Map([...list.children].map(row=>[row.dataset.playerId,row]));
  for(const [index,statement] of next.currentStatements.entries()){
   let row=rows.get(statement.playerId);
   if(!row||JSON.stringify(oldStatements.get(statement.playerId))!==JSON.stringify(statement)){
    const template=document.createElement('template');template.innerHTML=statementMarkup(statement,members);
    const fresh=template.content.firstElementChild;if(row)row.replaceWith(fresh);row=fresh;
   }
   if(list.children[index]!==row)list.insertBefore(row,list.children[index]||null);
   rows.delete(statement.playerId);
  }
  for(const row of rows.values())row.remove();
 }
 if(JSON.stringify(before.discussionSkip)!==JSON.stringify(next.discussionSkip)){
  const skip=app.querySelector('#skip-discussion');if(skip)skip.outerHTML=discussionSkipButton(next);
 }
 return true;
}
function render(previous){if(!snapshot||!session)return;const s=snapshot;const me=s.game?.myPlayer;const host=s.room.hostId===(me?.id||session.playerId);
 if(updateGameInPlace(previous,s))return;
 document.body.classList.toggle('gi-gameplay',Boolean(s.game)&&s.game.phase!=='GAME_OVER');
 document.body.classList.toggle('gi-ending',s.game?.phase==='GAME_OVER');
 if(!s.game){clearStatementDraft();app.innerHTML=`<section class="grid lobby"><div class="column"><div class="card lobby-invite"><span class="eyebrow">Phòng chờ<svg class="lobby-title-stroke" viewBox="0 0 188 16" aria-hidden="true"><path d="M2 9C45 3 99 2 185 7M16 14C61 8 114 9 164 11"/></svg></span><h1>Phòng ${escapeHTML(s.room.code)}</h1><p>Mời bạn bè vào phòng trước khi bắt đầu ván.</p><div class="code mono">${escapeHTML(s.room.code)}</div><div class="actions"><button id="copy" class="primary">Sao chép link mời</button>${host?`<button id="start">Bắt đầu ván</button>`:'<span class="note">Đợi chủ phòng bắt đầu…</span>'}</div></div><div class="card lobby-members"><h2>Người chơi (${s.room.players.length}${s.room.maxPlayers?' / '+s.room.maxPlayers:''})</h2><div class="people" tabindex="0" role="region" aria-label="Danh sách thành viên">${playerList(s)}</div>${lobbyExpeditionArt()}</div></div><div class="column"><div class="card lobby-rules"><h2>Cách chơi</h2><p>Mỗi người nhận một vai trò bí mật và 2 xu khi bắt đầu. Thảo luận tối đa 10 dự án, rồi chọn đầu tư 1 xu hoặc giữ lại. Bạn cũng có thể kiểm chứng vai trò (3 xu) hoặc góp xu trục xuất người chơi (cần tổng cộng 5 xu).</p><button type="button" id="rules-open" class="rules-open" data-open-rules aria-haspopup="dialog" aria-controls="rules-dialog"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 6c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v15"/></svg><span>Xem toàn bộ luật chơi</span></button><button id="leave" >Rời phòng</button></div></div></section>`;return;}
 const g=s.game;const latest=g.history.at(-1);let content='';
 if(g.phase==='GAME_OVER'&&window.GreenTrapEnding){
  peopleOpen=false;document.body.classList.remove('gi-drawer-open');clearStatementDraft();actionDraft=null;
  app.innerHTML=window.GreenTrapEnding.render(s,playerList(s));window.GreenTrapEnding.enhance(app);document.getElementById('ending-title')?.focus({preventScroll:true});return;
 }
 if(g.phase==='DEBATE'){
 content=`${!me.isAlive?'<p class="note">Bạn đã bị loại và đang theo dõi trận.</p>':g.players.find(p=>p.id===me.id)?.hasStatement?'<div class="note">Đã gửi ý kiến. Chờ hết thời gian thảo luận.</div>':`<form id="statement"><label class="gi-stance-select">Quan điểm<select id="stance"><option value="UNSURE">Chưa chắc chắn</option><option value="SUPPORT">Ủng hộ</option><option value="OPPOSE">Phản đối</option></select></label><label>Lý do<textarea id="statement-text" maxlength="500" required placeholder="Ví dụ: dự án cần làm rõ tác động tới hệ sinh thái..."></textarea></label><span class="gi-statement-counter" id="statement-counter">0 / 500</span><button type="submit" class="primary">Gửi ý kiến công khai</button></form><dialog id="statement-choice" class="gi-statement-choice" aria-labelledby="statement-choice-title"><h2 id="statement-choice-title">Quan điểm của bạn?</h2><div class="gi-stance-choices" role="group" aria-label="Chọn quan điểm"><button type="button" data-stance="SUPPORT" aria-pressed="false">Ủng hộ</button><button type="button" data-stance="UNSURE" aria-pressed="true">Chưa chắc</button><button type="button" data-stance="OPPOSE" aria-pressed="false">Phản đối</button></div><div class="gi-choice-actions"><button type="button" id="edit-statement">Sửa ý kiến</button><button type="button" id="confirm-statement" class="primary">Gửi ý kiến</button></div></dialog>`}`;
 }else if(g.phase==='BLIND_ACTION'){
 content=!me.isAlive?'<div class="note">Bạn đang quan sát, không thể thực hiện hành động.</div>':me.lockedAction?'<div class="note">Đã chốt hành động: '+(me.lockedAction.invest?'đầu tư 1 xu':'không đầu tư')+' · '+(me.lockedAction.bankAction.type==='NONE'?'không dùng hành động bổ sung':me.lockedAction.bankAction.type==='INSPECT'?'kiểm chứng vai trò':'góp '+me.lockedAction.bankAction.amount+' xu trục xuất')+'. Chờ công bố kết quả.</div>':`<form id="action-form"><label class="choice"><input type="checkbox" id="invest"> Đầu tư 1 xu vào dự án</label><label>Hành động bổ sung<select id="bank"><option value="NONE">Không dùng</option><option value="INSPECT">Kiểm chứng vai trò (3 xu)</option><option value="EXPEL">Góp xu trục xuất người chơi (1–5 xu)</option></select></label><div id="bank-details" class="hidden"><label>Mục tiêu<select id="target">${g.players.filter(p=>p.isAlive&&p.id!==me.id).map(p=>`<option value="${escapeHTML(p.id)}">${escapeHTML(s.room.players.find(x=>x.id===p.id)?.name||p.id)}</option>`).join('')}</select></label><label id="amount-row" class="hidden">Số xu góp trục xuất<select id="amount">${[1,2,3,4,5].map(n=>`<option value="${n}">${n} xu</option>`).join('')}</select></label></div><p id="action-cost" class="note" role="status"></p><button id="lock-action" type="submit" class="primary">Chốt hành động</button></form>`;
 }else if(g.phase==='REVEAL'){
 content=`<div class="summary ${latest.alignment==='PROTECTOR'?'success':'danger'}"><b class="gi-reveal-status" data-approved="${latest.approved}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${latest.approved?'M5 12l4 4L19 6':'M7 12h10'}"/></svg>${latest.approved?'Thông qua':'Không thông qua'}</b><p>${latest.investorCount}/${latest.eligibleCount} người đầu tư · Cần ${latest.requiredVotes}</p><h2 class="gi-verdict" data-verdict="${escapeHTML(latest.verdictLabel)}">${escapeHTML(latest.verdictLabel)}</h2><p>${escapeHTML(latest.explanation)}</p><p>${latest.newlyEliminatedIds.length?'Bị loại: '+latest.newlyEliminatedIds.map(id=>escapeHTML(s.room.players.find(x=>x.id===id)?.name||id)).join(', '):'Không có người bị loại lượt này.'}</p></div>${host?'<button id="next" class="primary">Sang lượt tiếp theo</button>':'<p class="muted">Chờ chủ phòng chuyển lượt hoặc đồng hồ đếm hết.</p>'}`;

 }else{
 content=`<div class="summary"><b>KẾT THÚC VÁN</b><h2>${g.outcome?.winner==='DRAW'?'HÒA':labelRole(g.outcome?.winner)+' CHIẾN THẮNG'}</h2><p>Lý do: ${escapeHTML(outcomeText[g.outcome?.reason]||'Ván đã kết thúc')}</p><p>Dự án Bảo vệ thông qua: ${g.approvedProtectorCount} · Dự án Phá hoại thông qua: ${g.approvedSaboteurCount}</p><p>Vai trò được mở công khai trong danh sách người chơi.</p></div><button id="home">Về trang đầu</button>`;
 }
 const project = g.phase==='GAME_OVER'?latest?{id:latest.projectId,title:latest.projectTitle,description:'Các dự án đã hoàn thành. Xem lịch sử bên dưới.'}:g.project:g.project;
 const statements=(g.phase==='REVEAL'||g.phase==='GAME_OVER')?(latest?.statements||[]):g.currentStatements;
  const members=new Map(s.room.players.map(player=>[player.id,player]));
  const discussion=statements.map(statement=>statementMarkup(statement,members)).join('');
 app.innerHTML=`
 <div class="gi-mobile-topbar"><div class="gi-top-wallet"><picture class="gi-brand-picture"><source type="image/webp" srcset="/brand/green-coin.webp"><img src="/brand/green-coin.png" alt="" width="24" height="24"></picture><b>${me.coins}</b><span>xu</span></div><button id="mobile-show-role" type="button" aria-label="Nhấn giữ để xem vai trò" aria-describedby="mobile-role-value" aria-pressed="false"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M5 32c7-11 17-17 27-17s20 6 27 17c-7 11-17 17-27 17S12 43 5 32Z"/><circle cx="32" cy="32" r="10"/></svg></button><span id="mobile-role-value" role="status" data-role="${escapeHTML(me.role)}" hidden></span><span class="gi-round-chip">Lượt ${g.round} / ${g.roundLimit}</span><button type="button" class="tutorial-mobile-open" data-tutorial-open aria-label="Xem video hướng dẫn giai đoạn hiện tại" aria-haspopup="dialog" aria-controls="tutorial-dialog"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9 5 11 7-11 7Z"/><path d="M4 5v14"/></svg></button></div>
 <div class="gi-game-grid" data-game-layout="four-areas">
  <header class="card gi-phase-header">
   <div class="gi-mobile-wallet"><picture class="gi-brand-picture"><source type="image/webp" srcset="/brand/green-coin.webp"><img class="gi-coin-icon" src="/brand/green-coin.png" alt="" width="28" height="28"></picture> ${me.coins} xu</div>
   <div class="flex"><span class="phase">${escapeHTML(phaseText[g.phase].toUpperCase())} · LƯỢT ${g.round}/${g.roundLimit}</span>${timer(s)}</div>
   ${g.phase!=='GAME_OVER'?'<progress id="phase-progress" max="'+phaseSeconds[g.phase]+'" value="'+remainingMilliseconds()/1000+'" aria-label="Thời gian còn lại"></progress>':''}
   <div class="flex muted"><span>Bảo vệ: ${g.approvedProtectorCount}</span><span>Phá hoại: ${g.approvedSaboteurCount}</span></div>
  </header>
  <aside class="card gi-area-players" id="players-panel" data-open="${peopleOpen}" aria-label="Danh sách người chơi">
   <div class="flex"><h2 class="gi-council-heading"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 5a3 3 0 0 1 0 6m2 3a4 4 0 0 1 3 4v2"/></svg>Hội đồng · ${s.room.players.length}${s.room.maxPlayers?' / '+s.room.maxPlayers:''}</h2><button type="button" class="gi-close-players" id="close-players" aria-label="Đóng danh sách">×</button></div>
   <div class="people" tabindex="0" role="region" aria-label="Danh sách thành viên">${playerList(s)}</div>
  </aside>
  <section class="card gi-area-project" aria-label="Dự án hiện tại">
   <span class="eyebrow">DỰ ÁN ĐANG ĐƯỢC ĐƯA RA</span>
   <section class="project"><small>HỒ SƠ ${escapeHTML(project.id)}</small><h2>${escapeHTML(project.title)}</h2><p>${escapeHTML(project.description)}</p></section>
  </section>
  <div class="gi-center-column">
  <section class="gi-area-actions" aria-label="Hồ sơ và hành động cá nhân">
   <div class="card gi-profile-panel${me.inspections?.length?' gi-has-inspections':''}"><div class="flex"><h2>Hồ sơ cá nhân</h2><span class="coins"><picture class="gi-brand-picture"><source type="image/webp" srcset="/brand/green-coin.webp"><img class="gi-coin-icon" src="/brand/green-coin.png" alt="" width="28" height="28"></picture> ${me.coins}</span></div><p><b>${escapeHTML(me.name)}</b> · ${me.isAlive?'Còn trong ván':'Đã bị loại'}</p>
    <div id="role" class="note" data-role="${escapeHTML(me.role)}">Vai trò của bạn: <b id="role-value">••••••</b><button id="show-role" type="button" aria-label="Nhấn giữ để xem thẻ vai trò"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M5 32c7-11 17-17 27-17s20 6 27 17c-7 11-17 17-27 17S12 43 5 32Z"/><circle cx="32" cy="32" r="10"/></svg><span>Nhấn giữ để xem</span></button></div>
    ${me.inspections?.length?'<div class="rule"><h3>Kết quả kiểm chứng</h3>'+me.inspections.map(x=>'<p class="tiny gi-inspection-result" data-inspection-round="'+x.round+'" data-inspection-target="'+escapeHTML(x.targetId)+'" data-inspection-role="'+escapeHTML(x.revealedRole)+'"><span class="gi-inspection-eye" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></span><span>Lượt '+x.round+': <b>'+escapeHTML(s.room.players.find(p=>p.id===x.targetId)?.name)+'</b> — <strong>'+escapeHTML(labelRole(x.revealedRole))+'</strong></span></p>').join('')+'</div>':''}
   </div>
   <div class="card gi-action-panel"><div class="gi-desktop-wallet"><picture class="gi-brand-picture"><source type="image/webp" srcset="/brand/green-coin.webp"><img src="/brand/green-coin.png" alt="" width="112" height="112"></picture><strong>${me.coins} xu</strong></div><h2 data-phase="${g.phase}"${g.phase==='DEBATE'?' class="gi-discussion-title"':''}>${escapeHTML(phaseText[g.phase])}</h2>${content}</div>
  </section>
  <section class="gi-area-discussion" aria-label="Ý kiến công khai">
   <div class="card"><h2 class="gi-discussion-heading"><span>Ý kiến trong phòng</span>${g.phase==='DEBATE'?discussionSkipButton(g):''}</h2><div class="hist">${discussion}</div></div>
   <details class="card gi-history"><summary>Nhật ký · ${g.history.length} lượt</summary><div class="hist">${g.history.map(h=>'<div>Lượt '+h.round+': '+escapeHTML(h.projectTitle)+' · '+(h.approved?'Thông qua':'Bác bỏ')+' · <span class="gi-verdict" data-verdict="'+escapeHTML(h.verdictLabel)+'">'+escapeHTML(h.verdictLabel)+'</span></div>').join('')||'<p class="tiny">Chưa có kết quả.</p>'}</div></details>
  </section>
  </div>
 </div>
 <button id="players-backdrop" class="gi-players-backdrop" type="button" aria-label="Đóng danh sách người chơi" ${peopleOpen?'':'hidden'}></button><button id="toggle-players" class="gi-toggle-players" aria-controls="players-panel" aria-expanded="${peopleOpen}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8"/></svg><span>Hội đồng · ${s.room.players.length}</span></button>`;
 if(peopleOpen)setPlayersOpen(true,false);
 if(g.phase==='DEBATE'&&me.isAlive&&!g.players.find(p=>p.id===me.id)?.hasStatement)restoreStatementDraft(g,me);else clearStatementDraft();
 if(g.phase==='BLIND_ACTION'&&!me.lockedAction){restoreActionDraft(g,me);wireBank();}else actionDraft=null;
}
function wireBank(){
 const bank=document.getElementById('bank'),form=document.getElementById('action-form');if(!bank||!form)return;
 const update=event=>{
  document.getElementById('bank-details').classList.toggle('hidden',bank.value==='NONE');
  document.getElementById('amount-row').classList.toggle('hidden',bank.value!=='EXPEL');
  const cost=(document.getElementById('invest').checked?1:0)+(bank.value==='INSPECT'?3:bank.value==='EXPEL'?Number(document.getElementById('amount').value):0);
  const available=snapshot.game.myPlayer.coins;
  document.getElementById('action-cost').textContent='Tổng chi: '+cost+' xu / Bạn có: '+available+' xu'+(cost>available?' — Không đủ xu':'');
  document.getElementById('lock-action').disabled=requesting||cost>available;
  window.GreenTrapActionFX?.preview(snapshot,Boolean(event));
 };
 form.onchange=update;update();
}

async function act(type,payload){
 if(requesting||eliminationHold||actionBurnHold)return false;
 requesting=true;
 const finishMotion=type==='submit'?window.GreenTrapMotion?.pending(app.querySelector('#statement button[type=submit],#lock-action')):null;
 let confirmed=false;
 try{await api('/api/action',{type,...(type==='kick'?{targetId:payload.targetId}:{payload}),...(['submit','next','skip_discussion'].includes(type)?{context:{gameId:snapshot.game.gameId,round:snapshot.game.round,phase:snapshot.game.phase}}:{})},true);if(type!=='leave')await readState();confirmed=true;return true;}
 catch(e){handleSessionError(e);return false;}
 finally{finishMotion?.(confirmed);requesting=false;wireBank();}
}
function updateStatementCounter(){const field=document.getElementById('statement-text'),counter=document.getElementById('statement-counter');if(field&&counter)counter.textContent=field.value.length+' / 500';}
function openStatementChoice(){const dialog=document.getElementById('statement-choice'),stance=document.getElementById('stance');if(!dialog||!stance||dialog.open)return;dialog.querySelectorAll('[data-stance]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.stance===stance.value)));dialog.showModal();dialog.querySelector('[aria-pressed="true"]')?.focus();}
app.addEventListener('input',e=>{if(e.target.id==='statement-text'){persistStatementDraft();updateStatementCounter();}});
app.addEventListener('click',async e=>{
 const button=e.target.closest('[data-kick-player],[data-kick-cancel],[data-kick-confirm]');if(!button||requesting||kickSubmittingId)return;
 if(button.dataset.kickCancel){const id=kickConfirmationId;kickConfirmationId=null;refreshPlayerLists();document.getElementById('kick-open-'+id)?.focus({preventScroll:true});return;}
 const id=button.dataset.kickPlayer||button.dataset.kickConfirm,target=snapshot?.room.players.find(p=>p.id===id&&!p.removed);
 if(!target||id===snapshot.room.hostId||session?.playerId!==snapshot.room.hostId||snapshot.game?.phase==='GAME_OVER')return;
 if(button.dataset.kickPlayer){kickConfirmationId=id;refreshPlayerLists();document.getElementById('kick-cancel-'+id)?.focus({preventScroll:true});return;}
 if(kickConfirmationId!==id)return;
 const roomCode=snapshot.room.code,index=snapshot.room.players.findIndex(p=>p.id===id);
 kickSubmittingId=id;refreshPlayerLists();
 const ok=await act('kick',{targetId:id});kickSubmittingId=null;
 if(snapshot?.room.code!==roomCode)return;
 if(ok){kickConfirmationId=null;if(!snapshot.room.players.some(p=>p.id===id))rememberKick(target,roomCode,true,index);}
 refreshPlayerLists();if(ok)app.querySelector('.gi-area-players .people,.lobby-members .people')?.focus({preventScroll:true});
});
app.addEventListener('change',e=>{if(e.target.id==='stance')persistStatementDraft();});
app.addEventListener('submit',async e=>{
 const formId=e.target.id;
 if(formId==='form-create'||formId==='form-join'){
  e.preventDefault();
  if(requesting||session)return;
  const joining=formId==='form-join';
  const roomCode=joining?document.getElementById('join-code').value.trim().toUpperCase():null;
  const name=document.getElementById(joining?'join-name':'create-name').value;
  requesting=true;
  try{
   const next=await api(joining?'/api/join':'/api/create',joining?{roomCode,name}:{name});
   if(joining&&next.roomCode!==roomCode)throw Error('Phản hồi không khớp mã phòng. Hãy thử lại.');
   onSession(next);
  }catch(err){gameError(err);}
  finally{requesting=false;}
  return;
 }
 if(e.target.id==='statement'){e.preventDefault();if(matchMedia('(max-width:759px)').matches)openStatementChoice();else act('submit',{text:document.getElementById('statement-text').value,stance:document.getElementById('stance').value});}
 if(e.target.id==='action-form'){e.preventDefault();const kind=document.getElementById('bank').value;const bankAction=kind==='NONE'?{type:'NONE'}:kind==='INSPECT'?{type:'INSPECT',targetId:document.getElementById('target').value}:{type:'EXPEL',targetId:document.getElementById('target').value,amount:Number(document.getElementById('amount').value)};act('submit',{action:{invest:document.getElementById('invest').checked,bankAction}});}
});
function setPlayersOpen(open,moveFocus=true){
 const changed=peopleOpen!==open;
 peopleOpen=open;const panel=document.getElementById('players-panel'),toggle=document.getElementById('toggle-players'),backdrop=document.getElementById('players-backdrop');
 panel?.setAttribute('data-open',String(open));toggle?.setAttribute('aria-expanded',String(open));if(backdrop)backdrop.hidden=!open;
 document.body.classList.toggle('gi-drawer-open',open);
 if(open){panel?.setAttribute('role','dialog');panel?.setAttribute('aria-modal','true');if(moveFocus)document.getElementById('close-players')?.focus();}
 else{panel?.removeAttribute('role');panel?.removeAttribute('aria-modal');if(moveFocus)toggle?.focus();}
 if(changed&&open)window.GreenTrapMotion?.drawer(panel);
}
app.addEventListener('click',e=>{
 const button=e.target.closest('button'),id=button?.id||e.target.id;
 if(id==='toggle-players'||id==='close-players'||id==='players-backdrop')setPlayersOpen(id==='toggle-players'?!peopleOpen:false);
 if(button?.dataset.stance){document.getElementById('stance').value=button.dataset.stance;app.querySelectorAll('[data-stance]').forEach(choice=>choice.setAttribute('aria-pressed',String(choice===button)));persistStatementDraft();}
 if(id==='edit-statement'){document.getElementById('statement-choice').close();document.getElementById('statement-text')?.focus();}
 if(id==='confirm-statement'&&!requesting&&document.getElementById('statement')?.reportValidity()){const payload={text:document.getElementById('statement-text').value,stance:document.getElementById('stance').value};document.getElementById('statement-choice').close();act('submit',payload);}
 if(id==='skip-discussion')act('skip_discussion');
 if(id==='copy')copyRoom();if(id==='start')act('start');if(id==='next')act('next');
 if(id==='leave')act('leave').then(ok=>{if(!ok)return;session=null;save();aborter?.abort();location.assign('/')});
 if(id==='home'||id==='return-home'){leaveFinishedRoom();session=null;save();clearStatementDraft();aborter?.abort();location.assign('/')}
});
app.addEventListener('pointerdown',e=>{if(['show-role','mobile-show-role'].includes(e.target.closest('button')?.id))showRoleText();});
for(const ev of ['pointerup','pointercancel','pointerleave'])app.addEventListener(ev,e=>{if(['show-role','mobile-show-role'].includes(e.target.closest('button')?.id))hideRoleText();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(clock);clock=null;}else scheduleClock();});
window.addEventListener('pagehide',()=>{leaveFinishedRoom();cancelAnimationFrame(clock);clock=null;});
window.addEventListener('pageshow',scheduleClock);
function setDesktopRoleCard(hidden){const card=document.querySelector('#role .gi-private-role-card');if(card&&(hidden||matchMedia('(min-width:760px)').matches))card.hidden=hidden;}
function showRoleText(){const node=document.getElementById('role-value'),mobile=document.getElementById('mobile-role-value');if(node)node.textContent=labelRole(snapshot.game.myPlayer.role);setDesktopRoleCard(false);if(mobile){mobile.hidden=false;const card=mobile.querySelector('.gi-private-role-card');if(card)card.hidden=false;}document.getElementById('mobile-show-role')?.setAttribute('aria-pressed','true');window.GreenTrapActionFX?.rolePeek();}
function hideRoleText(){window.GreenTrapActionFX?.hideRolePeek();const node=document.getElementById('role-value'),mobile=document.getElementById('mobile-role-value');setDesktopRoleCard(true);if(node)node.textContent='••••••';if(mobile){mobile.hidden=true;const card=mobile.querySelector('.gi-private-role-card');if(card)card.hidden=true;}document.getElementById('mobile-show-role')?.setAttribute('aria-pressed','false');}
document.addEventListener('pointerup',hideRoleText,true);document.addEventListener('pointercancel',hideRoleText,true);window.addEventListener('blur',hideRoleText);
app.addEventListener('keydown',e=>{if(['show-role','mobile-show-role'].includes(e.target.id)&&(e.key===' '||e.key==='Enter')){e.preventDefault();showRoleText();}});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&kickConfirmationId){e.preventDefault();if(!kickSubmittingId){const id=kickConfirmationId;kickConfirmationId=null;refreshPlayerLists();document.getElementById('kick-open-'+id)?.focus({preventScroll:true});}return;}
 if(!peopleOpen||!matchMedia('(max-width:1199px)').matches)return;
 if(e.key==='Escape'){e.preventDefault();setPlayersOpen(false);return;}
  if(e.key==='Tab'){const panel=document.getElementById('players-panel');if(!panel){setPlayersOpen(false,false);return;}const items=Array.from(panel.querySelectorAll('button,[tabindex="0"]')).filter(el=>el.getClientRects().length);const first=items[0],last=items.at(-1);if(e.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){e.preventDefault();first?.focus();}}
});
matchMedia('(max-width:1199px)').addEventListener('change',()=>{if(peopleOpen)setPlayersOpen(false);});
app.addEventListener('keyup',hideRoleText);document.addEventListener('visibilitychange',()=>{if(document.hidden)hideRoleText();});
window.addEventListener('resize',hideRoleText);
const inviteCode=new URLSearchParams(location.search).get('room')?.toUpperCase();
const invitedRoom=inviteCode&&/^[A-Z2-9]{6}$/.test(inviteCode)?inviteCode:null;
const saved=sessionStorage.getItem(storeKey);
if(saved){
 try{
  const previous=JSON.parse(saved);
  if(previous&&(!invitedRoom||previous.roomCode===invitedRoom))onSession(previous);
 }catch{session=null;save();}
}
if(!session&&invitedRoom)document.getElementById('join-code').value=invitedRoom;
if(!session)window.GreenTrapMotion?.home();
