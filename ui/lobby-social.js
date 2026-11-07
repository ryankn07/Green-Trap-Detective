(function(){
 'use strict';
 const names={rock:'Ném đá',brick:'Ném gạch',flowers:'Tặng hoa',water:'Tạt nước',tomato:'Ném cà chua',egg:'Ném trứng',snow:'Ném tuyết',confetti:'Tung pháo giấy'};
 let bridge,roomCode=null,seen=new Set(),hold=null,origin=null,suppressClick=false,dialog=null,pending=false;
 const flying=new Set(),activeTargets=new Map(),particleSprites=new Map();
 const maxConcurrentReactions=2;
 const burstCounts={rock:17,brick:17,flowers:18,water:9,tomato:15,egg:15,snow:22,confetti:30};
 const confettiColors=['#cb5684','#32846c','#d79723','#438fba','#9b63ba','#e2854d'];
 // Covers the longest flight plus the attached impact animation.
 const reactionWindowMs=2700;
 const avatars=Array.from({length:30},(_,i)=>'a'+String(i+1).padStart(2,'0'));
 function close(){dialog?.close();dialog?.remove();dialog=null;}
 function clearEffects(){for(const node of flying)node.remove();flying.clear();activeTargets.clear();}
 function clear(){clearEffects();close();clearTimeout(hold);}
 function avatarElement(id){
  return [...document.querySelectorAll('.lobby-members .person')].find(p=>p.dataset.playerId===id)?.querySelector('.avatar');
 }
 function avatarPicture(id){
  const src='/social/avatars/'+(/^a(?:0[1-9]|[12][0-9]|30)$/.test(id)?id:'a01');
  return '<picture class="avatar-artwork"><source type="image/webp" srcset="'+src+'.webp"><img src="'+src+'.png" alt="" width="192" height="192" loading="lazy" decoding="async"></picture>';
 }
 function effect(className,x,y){
  const node=document.createElement('span');node.className=className;node.setAttribute('aria-hidden','true');
  node.style.left=x+'px';node.style.top=y+'px';document.body.append(node);flying.add(node);return node;
 }
 function attachedEffect(target,className){
  const node=effect(className+' social-attached',0,0);
  node.style.left=node.style.top='50%';target.append(node);return node;
 }
 function finish(node,frames,options){
  const motion=node.animate(frames,options);
  motion.finished.catch(()=>{}).finally(()=>{node.remove();flying.delete(node);});return motion;
 }
 function projectile(kind){
  const shapes={
   water:'<path d="M15 21q-8-17 9-16t17 16" fill="none" stroke="#759aa6" stroke-width="4"/><path d="m12 18 37 7-10 30-24-5Z" fill="#80c8da" stroke="#4b859a" stroke-width="2"/><ellipse cx="31" cy="22" rx="19" ry="6" transform="rotate(11 31 22)" fill="#c3edf3" stroke="#4b859a" stroke-width="2"/><path d="m45 29 10 10m-6-4 8 13" stroke="#56b8df" stroke-width="5" stroke-linecap="round"/>',
   tomato:'<path d="M12 20C-3 38 13 59 33 57s34-21 22-37C46 7 24 10 12 20Z" fill="#e96c56" stroke="#b6443b" stroke-width="2"/><path d="m32 18-15-7 9 13-11 6 16-3 11 9-4-13 13-8-16 4 2-12Z" fill="#68934a"/><path d="M13 33q-1 10 6 14" stroke="#ffad8b" stroke-width="4" fill="none" stroke-linecap="round"/>',
   egg:'<path d="M32 5C19 5 9 27 10 40c1 25 43 25 44 0C55 27 45 5 32 5Z" fill="#fff4d8" stroke="#d3bc92" stroke-width="2"/><path d="M22 18q-8 10-7 20" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>',
   snow:'<circle cx="32" cy="33" r="25" fill="#e9f7fa" stroke="#a8d6df" stroke-width="2"/><path d="M13 37q6 19 24 16" stroke="#c1e3eb" stroke-width="6" fill="none" stroke-linecap="round"/><g fill="white"><circle cx="23" cy="22" r="7"/><circle cx="42" cy="27" r="3"/></g>',
   confetti:'<path d="m12 56 9-35 24 24Z" fill="#d5a2cd" stroke="#9c72a1" stroke-width="2"/><path d="m17 37 16 11m-14-21 22 16" stroke="#f6d786" stroke-width="5"/><path d="m31 18 2-9m12 17 11-3m-15-7 5-8" stroke="#dbae59" stroke-width="3" stroke-linecap="round"/><path d="m14 12 5 2m29 23 6 5m-3-31 5 4" stroke="#88b7a5" stroke-width="4"/>',
   rock:'<path d="M9 43 7 30 17 14 34 8 49 16 59 34 53 49 35 56 17 52Z" fill="#7a8990" stroke="#465760" stroke-width="3" stroke-linejoin="round"/><path d="m10 29 9-13 15-5 12 8-14 8-7 13Z" fill="#c8d4d5"/><path d="m28 40 4-13 14-8 10 15-13 6-7 12Z" fill="#a3b3b8"/><path d="m18 45 7-5 11 12-17-3Z" fill="#60747e"/>',
   brick:'<path d="m5 25 34-14 21 10-34 15Z" fill="#e9a078" stroke="#9a4d37" stroke-width="2"/><path d="m5 25 21 11v20L5 44Z" fill="#a84d37" stroke="#8f402f" stroke-width="2"/><path d="m26 36 34-15v20L26 56Z" fill="#cf7350" stroke="#8f402f" stroke-width="2"/><g fill="#9b513d"><ellipse cx="22" cy="24" rx="5" ry="2.5" transform="rotate(-22 22 24)"/><ellipse cx="33" cy="20" rx="5" ry="2.5" transform="rotate(-22 33 20)"/><ellipse cx="44" cy="23" rx="5" ry="2.5" transform="rotate(-22 44 23)"/></g><path d="m33 39 12-5m-11 15 13-5" stroke="#ebad87" stroke-width="2"/>',
   flowers:'<path d="m23 23 24 34M39 17l8 40M14 36l33 21" stroke="#547747" stroke-width="3"/><path d="m31 39 3-13 9 11m-2 11-14 1-2-7" fill="#8dab5d"/><path d="m26 41 16-10 13 23-8 6Z" fill="#ecd5a3" stroke="#b89665" stroke-width="1.5"/><path d="m39 49 11-5" stroke="#cf7d85" stroke-width="4"/><g fill="#e79cac"><circle cx="18" cy="19" r="7"/><circle cx="27" cy="14" r="7"/><circle cx="29" cy="24" r="7"/><circle cx="21" cy="27" r="7"/></g><circle cx="24" cy="21" r="5" fill="#f5d575"/><g fill="#f1cf70"><circle cx="38" cy="11" r="6"/><circle cx="47" cy="15" r="6"/><circle cx="40" cy="22" r="6"/></g><circle cx="41" cy="16" r="4" fill="#b78343"/><g fill="#df778d"><circle cx="9" cy="31" r="5"/><circle cx="16" cy="29" r="5"/><circle cx="18" cy="36" r="5"/><circle cx="11" cy="39" r="5"/></g><circle cx="13" cy="34" r="3" fill="#f5d575"/>'
  };
  const node=document.createElement('span');node.className='social-projectile social-projectile-'+kind;node.setAttribute('aria-hidden','true');
  node.innerHTML='<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+shapes[kind]+'</svg>';
  return node;
 }
 function dizzy(target){
  const box=target.getBoundingClientRect(),rx=Math.max(29,box.width*.34),ry=8;
  target.querySelectorAll('.social-dizzy').forEach(node=>{node.remove();flying.delete(node);});
  const ring=attachedEffect(target,'social-dizzy');ring.style.top='4%';
  ring.style.width=rx*2+'px';ring.style.height=ry*2+'px';
  for(let i=0;i<3;i++){
   const star=document.createElement('span');star.className='social-dizzy-star';ring.append(star);
   const frames=Array.from({length:49},(_,n)=>{const angle=n/48*Math.PI*4+i*Math.PI*2/3;return {transform:'translate('+Math.cos(angle)*rx+'px,'+Math.sin(angle)*ry+'px) translate(-50%,-50%) rotate('+n*12+'deg)',opacity:.65+.35*(Math.sin(angle)+1)/2};});
   star.animate(frames,{duration:1700,easing:'linear'});
  }
  finish(ring,[{transform:'translate(-50%,-50%) scale(.4)',opacity:0},{transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.12},{transform:'translate(-50%,-60%) scale(1)',opacity:1,offset:.8},{transform:'translate(-50%,-90%) scale(.9)',opacity:0}],{duration:1850});
 }
 function popMenu(panel){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  panel.animate([{transform:'translateY(22px) scale(.88)',opacity:0},{transform:'translateY(-5px) scale(1.025)',opacity:1,offset:.65},{transform:'none',opacity:1}],{duration:420,easing:'cubic-bezier(.16,.8,.3,1)'});
 }
 function impactArt(kind){
  const art={
   rock:'<g fill="none" stroke="#b49764" stroke-width="3" stroke-linecap="round"><path d="m96 21 8-9m-1 24 13-2m-25-21 1-10"/></g><path d="m104 47 3-6 3 6 6 3-6 3-3 6-3-6-6-3Z" fill="#edcb79" stroke="#fff8e6" stroke-width="1.5"/>',
   brick:'<g fill="none" stroke="#c68a63" stroke-width="3" stroke-linecap="round"><path d="m96 24 9-7m-2 20 12 1m-27-23 2-10"/></g><path d="m103 47 9-2 4 7-10 3Z" fill="#dfab87" stroke="#fff4df" stroke-width="1.5"/>',
   water:'<path d="M15 38q4-10 2-21 10 15 20 8 7-3 8-15 7 12 17 13 11 1 16-13 2 16 12 17 8 1 15-10-2 13 1 23" fill="none" stroke="#a5e3ef" stroke-width="5" stroke-linecap="round"/><path d="M19 35q17 7 28 0m30 2q13 3 25-1" fill="none" stroke="#f1ffff" stroke-width="2" stroke-linecap="round"/><g fill="#78c5de" stroke="#d7f7ff" stroke-width="1.5"><path d="M12 60q-8 11 0 11t0-11"/><path d="M108 73q-8 12 0 12t0-12"/></g>',
   flowers:'<g fill="#ed9fb5" opacity=".65"><ellipse cx="28" cy="75" rx="10" ry="4"/><ellipse cx="92" cy="75" rx="10" ry="4"/></g><path d="M13 25C0 17 5 7 13 13c8-6 13 4 0 12Z" fill="#dc8ca6" stroke="#fff4ee" stroke-width="1.6"/><path d="M105 32c-15-9-9-21 0-14 9-7 15 5 0 14Z" fill="#edb2b8" stroke="#fff4ee" stroke-width="1.6"/>',
   tomato:'<g transform="translate(51 40)"><path d="M8 12Q-7-1 4-5l15 9Q30-7 33 3l1 10Q54 6 50 18L37 28q16 18 2 18L24 34Q9 49 8 36l2-10Q-9 22 0 16Z" fill="#d95843" opacity=".92"/><path d="M11 12q6-9 15-2m5 15 7-4" fill="none" stroke="#ffaf82" stroke-width="3" stroke-linecap="round"/><g fill="#ffe0a0"><ellipse cx="17" cy="20" rx="2" ry="3" transform="rotate(-30 17 20)"/><ellipse cx="30" cy="27" rx="2" ry="3"/></g><path d="M13 33v14m17-11v20" stroke="#db6950" stroke-width="4" stroke-linecap="round"/><circle cx="-5" cy="2" r="3" fill="#dc6850"/><circle cx="49" cy="37" r="2.5" fill="#dc6850"/></g>',
   egg:'<g transform="translate(43 22)"><path d="M5 17q-14-12-3-16 8-6 17 3 15-9 19 2 16-3 14 11 11 9-1 16-1 16-17 9-13 11-18-2-17 4-15-10-11-7 4-13Z" fill="#fff9e9" fill-opacity=".88" stroke="#dfcfa7" stroke-width="1.1"/><ellipse cx="24" cy="23" rx="14" ry="12" fill="#efb637"/><ellipse cx="25" cy="26" rx="10" ry="7" fill="#eaa127" opacity=".6"/><path d="M16 20q5-7 12-4" fill="none" stroke="#fff0a7" stroke-width="3" stroke-linecap="round"/><path d="M12 38v20m26-19v12" stroke="#fff5d9" stroke-width="5" stroke-linecap="round"/><path d="m-6-4 7 4 5-3-1 9-9 2Z" fill="#fff6e6" stroke="#d1bd99" stroke-width="1"/></g>',
   snow:'<path d="M17 30Q24 9 60 10q29 0 43 19-7 8-17 2-7 7-16 0-11 9-21 0-10 7-18 0-7 7-14-1Z" fill="#f3fcff" stroke="#badde7" stroke-width="1.7"/><path d="M30 22q17-10 35-7" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><g stroke="#94becf" stroke-width="1.7" stroke-linecap="round"><path d="M12 59v15m-6-11 12 7m-12 0 12-7M108 52v15m-6-11 12 7m-12 0 12-7"/></g>',
   confetti:'<g fill="none" stroke-linecap="round" stroke-width="2.5"><path d="m24 72-9-3m10-8-5-7" stroke="#d3a24d"/><path d="m93 38 7-5m-5 15 11 1" stroke="#83b7a2"/></g>'
  };
  return '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+art[kind]+'</svg>';
 }
 function materialPiece(kind,i){
  const flowerColors=['#df729b','#efbb55','#bc77b1','#e8956c'];
  const petal=flowerColors[i%flowerColors.length];
  const forms={
   water:'<path d="M16 2Q30 16 25 24Q20 34 10 28Q0 22 16 2Z" fill="#50b4d6" stroke="#2784a9" stroke-width="2"/><path d="M11 20q1-5 4-8" fill="none" stroke="#dcfbff" stroke-width="3" stroke-linecap="round"/>',
   rock:'<path d="m5 12 9-7 13 6 1 14-15 6L3 23Z" fill="'+['#829096','#a7b2b4','#6e7e85'][i%3]+'" stroke="#53666f" stroke-width="1.4"/><path d="m5 12 9-7 13 6-11 7Z" fill="#c5d0d0"/><path d="m16 18 12-7v14l-15 6Z" fill="#6f828b" opacity=".55"/>',
   brick:'<path d="m3 11 17-6 10 7-18 7Z" fill="#e5a27a" stroke="#a26448" stroke-width="1.2"/><path d="m3 11 9 8v11l-9-7Z" fill="#a6563b"/><path d="m12 19 18-7v11l-18 7Z" fill="#c77d58" stroke="#a26448" stroke-width="1.2"/><path d="m17 21 8-3" stroke="#efbd94" stroke-width="1.4"/>',
   flowers:i%3===0?'<path d="M4 23Q11 3 28 8 24 27 4 23Z" fill="'+petal+'" stroke="#fff1e3" stroke-width="1"/>':'<g fill="'+petal+'" stroke="#fff6e8" stroke-width=".8"><ellipse cx="16" cy="9" rx="5" ry="7"/><ellipse cx="23" cy="14" rx="7" ry="5"/><ellipse cx="20" cy="23" rx="5" ry="7"/><ellipse cx="11" cy="23" rx="5" ry="7"/><ellipse cx="8" cy="14" rx="7" ry="5"/></g><circle cx="16" cy="16" r="5" fill="#efcf6a"/><circle cx="15" cy="15" r="1.4" fill="#fff4bd"/>',
   snow:i%3===0?'<g fill="none" stroke="#70adc5" stroke-width="2" stroke-linecap="round"><path d="M16 2v28M4 9l24 14M4 23 28 9m-16-2 4 4m-4-4-4 4m4 14 4-4m-4 4-4-4"/></g>':'<path d="M5 12q-2-8 7-7 5-7 10 0 9-1 8 9 5 8-3 12-5 8-12 2-11 4-12-5-6-4 2-11Z" fill="#f2fbff" stroke="#bddce9" stroke-width="1.2"/><path d="m7 13 5-4" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
   egg:i%3===0?'<path d="M4 16q5-13 17-9 12 3 8 15-7 10-14 3-11 2-11-9Z" fill="#f0c65d" stroke="#f9df94" stroke-width="1.2"/>':'<path d="m3 6 8 5 5-5 5 6 9-5q0 18-14 22Q3 25 3 6Z" fill="#fff8e3" stroke="#d3bd98" stroke-width="1.2"/><path d="M7 15q1 7 8 9" fill="none" stroke="#e7d8b8" stroke-width="2"/>',
   tomato:'<path d="M5 12q4-10 12-5 11-4 12 7 4 11-7 13-7 6-12-1-11-2-5-14Z" fill="#e48369" stroke="#bf6650" stroke-width="1.2"/><g fill="#f9d7a4"><ellipse cx="13" cy="14" rx="2" ry="3" transform="rotate(-35 13 14)"/><ellipse cx="22" cy="21" rx="2" ry="3" transform="rotate(30 22 21)"/></g>'
  };
  return '<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+forms[kind]+'</svg>';
 }
 function particleSprite(kind,i){
  const variant=kind==='flowers'?i%12:['rock','egg','snow'].includes(kind)?i%3:0;
  const key=kind+':'+variant;
  if(!particleSprites.has(key)){
   const sprite={bitmap:null},image=new Image();
   image.onload=()=>{
    const bitmap=document.createElement('canvas');bitmap.width=bitmap.height=48;
    bitmap.getContext('2d').drawImage(image,0,0,48,48);
    sprite.bitmap=bitmap;
   };
   image.src='data:image/svg+xml,'+encodeURIComponent(materialPiece(kind,variant));
   particleSprites.set(key,sprite);
  }
  return particleSprites.get(key);
 }
 function paintParticles(kind,x,y,particles){
  // Bound the bitmap to the visible trajectory, including its arc and rotation.
  let minX=0,maxX=0,minY=0,maxY=0,end=0;
  for(const p of particles){
   const radius=Math.hypot(p.width,p.height)/2+(p.flutter?14:2);
   const tip=p.vy+p.gravity,vertex=Math.max(0,Math.min(1,-p.vy/(2*p.gravity)));
   minX=Math.min(minX,p.vx-radius,-radius);
   maxX=Math.max(maxX,p.vx+radius,radius);
   minY=Math.min(minY,p.vy*vertex+p.gravity*vertex*vertex-radius);
   maxY=Math.max(maxY,tip+radius,radius);
   end=Math.max(end,p.delay+p.duration);
  }
  const left=Math.max(0,Math.floor(x+minX)),top=Math.max(0,Math.floor(y+minY));
  const width=Math.min(innerWidth,Math.ceil(x+maxX))-left;
  const height=Math.min(innerHeight,Math.ceil(y+maxY))-top;
  if(width<=0||height<=0)return;
  const scale=Math.min(devicePixelRatio||1,1.5),canvas=document.createElement('canvas');
  canvas.className='social-burst social-burst-'+kind;
  canvas.setAttribute('aria-hidden','true');
  canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);
  Object.assign(canvas.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  document.body.append(canvas);flying.add(canvas);
  const started=performance.now();
  function draw(now){
   if(!canvas.isConnected)return;
   const age=now-started;
   if(age>=end){canvas.remove();flying.delete(canvas);return;}
   ctx.resetTransform();ctx.clearRect(0,0,canvas.width,canvas.height);
   for(const p of particles){
    const t=(age-p.delay)/p.duration;
    if(t<0||t>=1)continue;
    const dx=p.vx*t+(p.flutter?Math.sin(t*Math.PI*3+p.index)*14*t:0);
    const dy=(p.vy+p.gravity*t)*t;
    const angle=p.angle+p.spin*t,cos=Math.cos(angle),sin=Math.sin(angle);
    const sx=scale*Math.min(1,.72+t*4)*(1-.35*t);
    const sy=sx*(p.flutter?.76+.24*Math.cos(t*9+p.index):1);
    ctx.setTransform(cos*sx,sin*sx,-sin*sy,cos*sy,(x-left+dx)*scale,(y-top+dy)*scale);
    ctx.globalAlpha=Math.min(1,(1-t)/.27);
    if(p.sprite?.bitmap)ctx.drawImage(p.sprite.bitmap,-p.width/2,-p.height/2,p.width,p.height);
    else{
     ctx.fillStyle=p.color;
     ctx.fillRect(-p.width/2,-p.height/2,p.width,p.height);
    }
   }
   requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
 }
 function burst(target,kind,direction=1){
  const rect=target.getBoundingClientRect(),x=rect.x+rect.width/2,y=rect.y+rect.height/2;
  const gentle=kind==='flowers'||kind==='confetti',cold=kind==='snow',hard=kind==='rock'||kind==='brick';
  // Recoil follows the incoming object; attached residue moves with the portrait.
  const kick=direction*(hard?9:4);
  if(kind==='rock'||kind==='brick')dizzy(target);
  const reaction=gentle?[
   {transform:'translateY(0) scale(1)'},{transform:'translateY(-7px) scale(1.035)',offset:.3},{transform:'translateY(2px) scale(.99)',offset:.65},{transform:'none'}
  ]:cold?[
   {transform:'translateX(0)'},{transform:'translateX(-2px) rotate(-2deg)',offset:.2},{transform:'translateX(2px) rotate(2deg)',offset:.4},{transform:'translateX(-2px) rotate(-1deg)',offset:.6},{transform:'translateX(1px)',offset:.8},{transform:'none'}
  ]:[
   {transform:'none'},{transform:'translateX('+kick+'px) rotate('+direction*7+'deg) scale(.91,1.04)',offset:.1},{transform:'translateX('+(-kick*.4)+'px) rotate('+(-direction*3)+'deg) scale(1.035,.98)',offset:.33},{transform:'translateX('+kick*.15+'px) rotate('+direction+'deg)',offset:.6},{transform:'none'}
  ];
  target.animate(reaction,{duration:gentle?720:cold?650:540,easing:'cubic-bezier(.2,.7,.25,1)'});
  const accent=attachedEffect(target,'social-impact social-impact-'+kind);accent.innerHTML=impactArt(kind);accent.style.width=accent.style.height=rect.width*1.12+'px';
  const duration=kind==='confetti'?280:['tomato','egg','snow'].includes(kind)?1700:gentle?1250:680;
  finish(accent,[{transform:'translate(-50%,-50%) scale(.45)',opacity:0},{transform:'translate(-50%,-50%) scale(1.08)',opacity:1,offset:.08},{transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.2},{transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.72},{transform:'translate(-50%,-46%) scale(.98)',opacity:0}],{duration,easing:'ease-out'});
  if(hard){
   const snap=attachedEffect(target,'social-contact social-contact-'+kind);
   snap.style.width=snap.style.height=rect.width*.72+'px';
   snap.innerHTML='<svg viewBox="0 0 100 100" aria-hidden="true"><path d="m50 8 7 26 20-14-11 23 27 6-28 7 13 24-23-16-7 29-7-28-22 13 13-23-26-8 28-5-14-24 25 16Z" fill="#fff5d5" stroke="'+(kind==='brick'?'#ca8e68':'#c1ad7c')+'" stroke-width="2"/></svg>';
   finish(snap,[{transform:'translate(-50%,-50%) scale(.25)',opacity:1},{transform:'translate(-50%,-50%) scale(1)',opacity:.9,offset:.35},{transform:'translate(-50%,-50%) scale(1.15)',opacity:0}],{duration:240,easing:'ease-out'});
  }
  if(kind==='rock'||kind==='brick'||kind==='snow'){
   const dust=effect('social-dust social-dust-'+kind,x,y);dust.style.width=rect.width*.8+'px';dust.style.height=rect.height*.45+'px';
   finish(dust,[{transform:'translate(-50%,-50%) scale(.25)',opacity:0},{transform:'translate(-50%,-55%) scale(1)',opacity:.86,offset:.2},{transform:'translate(-50%,-75%) scale(1.25)',opacity:0}],{duration:520,easing:'ease-out'});
  }
  const confetti=kind==='confetti',flowers=kind==='flowers';
  const particles=Array.from({length:burstCounts[kind]},(_,i)=>{
   const angle=i*2.39996,reach=rect.width*(.28+(i%5)*.13)+10;
   const width=confetti?(i%4===0?7:4+i%3):Math.max(5,rect.width/110*(flowers?14+i%4*5:cold?7+i%5*4:hard?7+i%5*5:10+i%4*4));
   return {
    index:i,angle:0,spin:(i%2?1:-1)*(95+i*23)*Math.PI/180,
    vx:confetti?direction*rect.width*(.25+Math.sin(angle)*.85):Math.cos(angle)*reach+(hard?direction*rect.width*.2:0),
    vy:confetti?-rect.height*(1.55+(i%7)*.2):Math.sin(angle)*reach*.6-(flowers?40:cold?25:hard?45:22),
    gravity:confetti?rect.height*3.35:flowers?75:cold?110:hard?rect.height*1.8:130,
    width,height:confetti?(i%4===0?4:9+i%3*3):width,
    duration:confetti?1350+i%5*100:flowers?1350+i%3*90:cold?1200:hard?650+i%4*70:1000,
    delay:confetti?i%6*10:i%3*8,flutter:flowers||confetti||cold,
    sprite:confetti?null:particleSprite(kind,i),color:confetti?confettiColors[i%confettiColors.length]:'#9d896d'
   };
  });
  paintParticles(kind,confetti?x-direction*rect.width*.32:x,confetti?y+rect.height*.12:y,particles);
 }
 function wet(target){
  const box=target.getBoundingClientRect(),overlay=attachedEffect(target,'social-wet');
  overlay.style.width=box.width+'px';overlay.style.height=box.height+'px';
  const sheet=document.createElement('span');sheet.className='social-water-sheet';overlay.append(sheet);
  sheet.animate([{transform:'translateY(-15%) scaleX(.65)',opacity:0},{transform:'translateY(5%) scaleX(1)',opacity:.5,offset:.12},{transform:'translateY(55%) scaleX(.9)',opacity:.25,offset:.55},{transform:'translateY(110%) scaleX(.75)',opacity:0}],{duration:1050,easing:'linear',fill:'both'});
  for(let i=0;i<4;i++){
   const drop=document.createElement('span');drop.className='social-wet-drip';drop.style.left=[25,42,61,76][i]+'%';drop.style.top=[28,40,32,46][i]+'%';drop.style.height=box.height*(.12+i%2*.07)+'px';overlay.append(drop);
   drop.animate([{transform:'translateY(0) scaleY(.3)',opacity:0},{transform:'translateY(3px) scaleY(1)',opacity:.8,offset:.15},{transform:'translateY('+box.height*.46+'px) scaleY(.65)',opacity:0}],{duration:900,delay:i*45,fill:'both',easing:'ease-in'});
  }
  finish(overlay,[{transform:'translate(-50%,-50%)',opacity:0},{transform:'translate(-50%,-50%)',opacity:1,offset:.08},{transform:'translate(-50%,-50%)',opacity:1,offset:.8},{transform:'translate(-50%,-50%)',opacity:0}],{duration:1150});
 }
 function waterJet(event,a,b){
  const ex=b.x+b.width/2,ey=b.y+b.height*.43;
  const direction=ex>=a.x+a.width/2?1:-1;
  const size=Math.min(54,a.width*.55),bx=a.x+a.width/2+direction*a.width*.54,by=a.y+a.height*.55;
  // Match the starting point to the rim of the tipped bucket.
  const angle=55*Math.PI/180,dx=17*size/64,dy=-10*size/64;
  const sx=bx+direction*(dx*Math.cos(angle)-dy*Math.sin(angle)),sy=by+dx*Math.sin(angle)+dy*Math.cos(angle);
  const cx=(sx+ex)/2,cy=Math.max(14,Math.min(sy,ey)-Math.min(63,Math.hypot(ex-sx,ey-sy)*.32));
  const bucket=effect('social-water-bucket',bx,by);bucket.style.width=bucket.style.height=size+'px';
  bucket.innerHTML=`<svg viewBox="0 0 64 64" aria-hidden="true">
   <path d="M15 23Q12 5 29 4Q47 2 48 23" fill="none" stroke="#276276" stroke-width="4" stroke-linecap="round"/>
   <path d="M13 22L50 22L43 52Q31 59 20 52Z" fill="#61afc5" stroke="#245d73" stroke-width="2.5"/>
   <path d="M44 26L41 50Q35 53 30 53L36 26Z" fill="#387e9b"/>
   <path d="M20 31L24 46" fill="none" stroke="#c9f4f6" stroke-width="3" stroke-linecap="round"/>
   <ellipse cx="31.5" cy="22" rx="19" ry="6" fill="#dbf9f8" stroke="#245d73" stroke-width="2.5"/>
   <path d="M17 23Q31 28 46 22" fill="none" stroke="#55b9d1" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
  const pose='translate(-50%,-50%) scaleX('+direction+') rotate(';
  finish(bucket,[
   {transform:pose+'-18deg)',opacity:0},
   {transform:pose+'55deg)',opacity:1,offset:.18},
   {transform:pose+'63deg)',opacity:1,offset:.64},
   {transform:pose+'42deg)',opacity:0}
  ],{duration:570,easing:'ease-out'});
  const water=effect('social-water-jet',0,0);
  const width=Math.max(54,Math.min(102,b.width*.9));
  water.style.width=width+'px';water.style.height=width*72/124+'px';
  water.innerHTML=`<svg viewBox="0 0 124 72" aria-hidden="true">
   <path d="M10 44Q23 44 36 33Q48 23 63 26Q66 17 79 12Q89 8 97 14Q107 11 113 21Q120 28 112 37Q118 44 105 50Q95 57 82 51Q72 61 57 54Q44 60 30 55Q17 56 10 44Z" fill="#64cde0" stroke="#187f9e" stroke-width="2" stroke-linejoin="round"/>
   <path d="M21 48Q39 49 57 42Q68 36 84 40Q96 42 111 32Q107 39 112 41Q107 50 95 50Q88 51 82 49Q70 58 58 52Q42 58 29 53Z" fill="#309ebe" opacity=".75"/>
   <path d="M31 41Q47 28 62 30Q74 20 82 19Q92 13 102 19Q111 20 113 26Q106 23 101 26Q92 21 84 26Q74 30 63 35Q46 33 31 41Z" fill="#c8f5f8"/>
   <path d="M79 31Q86 26 94 27M41 45Q49 42 54 43" fill="none" stroke="#f4ffff" stroke-width="2.6" stroke-linecap="round"/>
   <path d="M51 16Q56 7 62 7Q67 8 64 12Q59 15 51 16ZM5 34Q8 29 14 31Q18 33 15 35Q10 38 5 34ZM91 61Q99 58 103 60Q107 63 103 66Q97 70 91 61Z" fill="#8be0eb" stroke="#338da8" stroke-width="1.6"/>
  </svg>`;
  const mirror=ex<sx?-1:1;
  const frames=Array.from({length:33},(_,i)=>{
   const t=i/32,p=t*(.66+.34*t),q=1-p;
   const x=q*q*sx+2*p*q*cx+p*p*ex,y=q*q*sy+2*p*q*cy+p*p*ey;
   const rise=2*(q*(cy-sy)+p*(ey-cy));
   const rotation=Math.atan2(rise*mirror,Math.abs(ex-sx))*180/Math.PI;
   const stretch=.5+.5*Math.sin(t*Math.PI/2),spread=.36+.74*t;
   return {
    transform:'translate('+x+'px,'+y+'px) translate(-50%,-50%) rotate('+rotation+'deg) scale('+mirror*stretch+','+spread+')',
    opacity:Math.min(1,t*10)
   };
  });
  water.animate(frames,{duration:470,easing:'linear',fill:'forwards'}).finished.then(()=>{
   if(!water.isConnected)return;
   const recipient=avatarElement(event.to);
   if(recipient)splashWater(recipient,direction);
  }).catch(()=>{}).finally(()=>{water.remove();flying.delete(water);});
 }
 function splashWater(target,direction){
  const box=target.getBoundingClientRect(),x=box.x+box.width/2,y=box.y+box.height*.43;
  target.animate([{transform:'none'},{transform:'translateX('+direction*3+'px) scale(.98)',offset:.2},{transform:'none'}],{duration:360,easing:'ease-out'});
  const splash=attachedEffect(target,'social-impact social-impact-water');splash.style.width=splash.style.height=box.width*1.25+'px';splash.style.top='43%';
  splash.innerHTML=`<svg viewBox="0 0 100 100" aria-hidden="true">
   <path d="M11 58Q21 49 36 49Q24 40 20 31Q18 25 25 28Q40 33 45 44Q41 31 46 19Q50 11 54 20Q59 31 55 45Q65 34 78 28Q86 25 81 33Q76 43 65 49Q81 44 91 50Q98 55 89 58Q68 63 63 71Q56 78 47 73Q40 67 29 72Q18 75 13 66Q10 62 20 59Z" fill="#79d8e8" stroke="#288ca7" stroke-width="2.1" stroke-linejoin="round"/>
   <path d="M27 53Q40 46 46 52Q55 47 64 52Q73 49 80 53Q64 55 61 62Q54 66 48 62Q38 57 27 60Z" fill="#d8fbfc"/>
   <path d="M10 28Q6 19 10 18Q15 18 17 25Q17 29 10 28ZM61 14Q62 7 67 8Q71 10 68 15Q64 18 61 14ZM84 69Q92 65 95 70Q97 75 91 76Q85 75 84 69Z" fill="#a1eaf0" stroke="#399bb4" stroke-width="1.6"/>
  </svg>`;
  finish(splash,[{transform:'translate(-50%,-50%) scale(.42)',opacity:.65},{transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.2},{transform:'translate(-50%,-46%) scale(1.1)',opacity:.9,offset:.5},{transform:'translate(-50%,-38%) scale(1.24)',opacity:0}],{duration:410,easing:'ease-out'});
  const drops=Array.from({length:burstCounts.water},(_,i)=>{
   const angle=i*2.4,reach=box.width*(.28+i%3*.12),width=5+i%3;
   return {
    index:i,angle,spin:0,vx:Math.cos(angle)*reach,vy:Math.sin(angle)*reach*.6,gravity:box.height*.65,
    width,height:width*1.6,duration:450+i%3*65,delay:0,flutter:false,
    sprite:particleSprite('water',i),color:'#459fc6'
   };
  });
  paintParticles('water',x,y,drops);
  wet(target);
 }
 function play(event,prioritize=false){
  if(document.hidden)return;
  const now=performance.now();
  for(const [target,until] of activeTargets)if(until<=now)activeTargets.delete(target);
  const occupied=activeTargets.size>=maxConcurrentReactions||activeTargets.has(event.to);
  if(occupied&&!prioritize)return;
  const from=avatarElement(event.from),to=avatarElement(event.to);
  if(!from||!to)return;
  const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();
  if(b.bottom<0||b.top>innerHeight||b.right<0||b.left>innerWidth)return;
  if(occupied)clearEffects();
  activeTargets.set(event.to,now+reactionWindowMs);
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){
   to.animate([{opacity:1},{opacity:.65},{opacity:1}],{duration:250});return;
  }
  if(event.kind==='water'){waterJet(event,a,b);return;}
  from.animate([{transform:'scale(1)'},{transform:'rotate(-7deg) scale(.92)'},{transform:'scale(1)'}],{duration:280});
  const startX=a.x+a.width/2,startY=a.y+a.height/2,endX=b.x+b.width/2,endY=b.y+b.height/2;
  const lift=Math.max(18,Math.min(115,Math.min(startY,endY)-35));
  const duration=Math.min(850,550+Math.hypot(endX-startX,endY-startY)*.24);
  const point=t=>({x:startX+(endX-startX)*t,y:startY+(endY-startY)*t-lift*4*t*(1-t)});
  for(const t of [.2,.38,.56,.74]){
   const p=point(t),trail=effect('social-trail social-trail-'+event.kind,p.x,p.y);
   finish(trail,[{transform:'translate(-50%,-50%) scale(.3)',opacity:0},{transform:'translate(-50%,-50%) scale(1)',opacity:.8,offset:.2},{transform:'translate(-50%,-30%) scale(.15)',opacity:0}],{duration:350,delay:duration*t,easing:'ease-out'});
  }
  const node=projectile(event.kind);
  const size=Math.max(52,Math.min(82,a.width*.65));node.style.width=node.style.height=size+'px';
  document.body.append(node);flying.add(node);
  const frames=Array.from({length:33},(_,i)=>{
   const t=i/32,p=point(t);
   return {transform:'translate('+p.x+'px,'+p.y+'px) translate(-50%,-50%) rotate('+(event.kind==='flowers'?t*35:(endX>=startX?1:-1)*t*400)+'deg) scale('+(1+.22*Math.sin(t*Math.PI))+')'};
  });
  node.animate(frames,{duration,easing:'linear',fill:'forwards'}).finished.then(()=>{
   const recipient=avatarElement(event.to);if(node.isConnected&&recipient)burst(recipient,event.kind,endX>=startX?1:-1);
  }).catch(()=>{}).finally(()=>{node.remove();flying.delete(node);});
 }
 async function submit(data){
  if(pending)return;
  pending=true;
  const submittedDialog=dialog;
  try{
   if(data.type==='react'){
    close();
    play({from:bridge.getPlayerId(),to:data.targetId,kind:data.kind},true);
   }
   await bridge.send(data);
   if(dialog===submittedDialog)close();
   return true;
  }
  catch(error){bridge.notify(error.message);return false;}
  finally{pending=false;}
 }
 function open(id){
  const state=bridge?.getState();
  if(!state||state.game)return;
  const player=state.room.players.find(p=>p.id===id&&!p.removed);
  if(!player)return;
  close();
  const mine=id===bridge.getPlayerId();
  dialog=document.createElement('dialog');dialog.className='social-menu'+(mine?'':' social-reaction-menu');
  dialog.setAttribute('aria-labelledby','social-title');
  const header=document.createElement('h2');header.id='social-title';header.textContent=mine?'Chọn avatar của bạn':player.name;
  dialog.append(header);
  const grid=document.createElement('div');grid.className=mine?'social-avatar-grid':'social-item-grid';
  for(const key of mine?avatars:Object.keys(names)){
   const button=document.createElement('button');button.type='button';
   if(mine)button.innerHTML=avatarPicture(key);
   else{const art=projectile(key);art.className='social-item-art';button.append(art);}
   button.setAttribute('aria-label',mine?'Avatar '+key:names[key]);
   if(mine){
    button.setAttribute('aria-pressed',String(player.avatarId===key));
   }
   else{const label=document.createElement('span');label.textContent=names[key];button.append(label);}
   button.addEventListener('click',async()=>{
    const room=bridge.getState()?.room.code;
    if(room!==state.room.code){close();return;}
    await submit(mine?{type:'avatar',avatarId:key}:{type:'react',targetId:id,kind:key});
   });
   grid.append(button);
  }
  const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='Đóng';dismiss.className='social-close';
  dismiss.onclick=close;dialog.append(grid,dismiss);
  dialog.addEventListener('cancel',()=>{dialog.remove();dialog=null;});
  document.body.append(dialog);dialog.showModal();if(!mine)popMenu(dialog);
  dialog.addEventListener('click',e=>{if(e.target===dialog){const box=dialog.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)close();}});
 }
 function target(event){return event.target.closest?.('.lobby-members .avatar')?.closest('.person')?.dataset.playerId;}
 document.addEventListener('pointerdown',event=>{
  const id=target(event);if(!id||event.button!==0)return;
  origin={x:event.clientX,y:event.clientY};suppressClick=false;
  clearTimeout(hold);hold=setTimeout(()=>{suppressClick=true;open(id);},420);
 });
 document.addEventListener('pointermove',event=>{if(origin&&Math.hypot(event.clientX-origin.x,event.clientY-origin.y)>9)clearTimeout(hold);});
 document.addEventListener('pointerup',()=>{clearTimeout(hold);origin=null;});
 document.addEventListener('pointercancel',()=>{clearTimeout(hold);origin=null;});
 document.addEventListener('click',event=>{const id=target(event);if(!id)return;if(suppressClick){suppressClick=false;return;}open(id);});
 document.addEventListener('contextmenu',event=>{const id=target(event);if(id){event.preventDefault();clearTimeout(hold);open(id);}});
 document.addEventListener('keydown',event=>{const id=target(event);if(id&&['Enter',' '].includes(event.key)){event.preventDefault();open(id);}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
 window.addEventListener('pagehide',clear);
 window.addEventListener('resize',clear);
 window.GreenTrapSocial={
  avatarPicture,
  setup(value){bridge=value;},
  receive(next){
   if(next.game||next.room.code!==roomCode){
    clear();seen=new Set((next.room.reactions||[]).map(e=>e.id));roomCode=next.room.code;
    return;
   }
   // This tab plays its own throw on click. Snapshots only animate other players.
   const playerId=bridge.getPlayerId();
   const events=next.room.reactions||[],fresh=events.filter(e=>e.from!==playerId&&!seen.has(e.id)&&names[e.kind]&&next.serverTime-e.at<8000);
   seen=new Set(events.map(e=>e.id));
   if(!fresh.length)return;
   requestAnimationFrame(()=>{
    const state=bridge.getState();
    if(state?.game||state?.room.code!==next.room.code)return;
    for(const event of fresh.reverse()){
     play(event);
     if(activeTargets.size>=maxConcurrentReactions)break;
    }
   });
  }
 };
})();
