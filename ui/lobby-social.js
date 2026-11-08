(function(){
 'use strict';

 const gardenReactions={
  leafstorm:{
   label:'Lốc lá',play:leafstorm,
   icon:'<path d="M7 15Q9 6 31 6q27 0 27 10-2 11-16 18-14 8-7 16l5 7q-15 0-16-11-1-10-12-18-6-6-5-13Z" fill="#d3edaa" stroke="#48865b" stroke-width="2"/><path d="M11 15q10 8 34 4m-29 8q13 7 29 1M23 38q7 5 15 1m-12 9q4 3 9 1" fill="none" stroke="#6aa969" stroke-width="2.6" stroke-linecap="round"/><path d="M47 8q6-9 14-4-1 8-11 9ZM6 26q-8-6-2-11 7 1 8 8Z" fill="#9fc765" stroke="#4b855c" stroke-width="1.4"/>'
  },
  vine:{
   label:'Dây leo',play:vine,
   icon:'<path d="M15 56Q31 49 18 39T23 17Q29 7 41 9M27 54q19 1 24-15t-6-12" fill="none" stroke="#4a8050" stroke-width="3.4" stroke-linecap="round"/><path d="M20 43Q8 45 6 36q10-5 17 5m2-10q2-11 15-11 1 10-15 11m14 18q-4-11 8-14 8 7-8 14" fill="#83b86a" stroke="#4f8552" stroke-width="1.5"/><path d="M43 7q5-5 9 0 6 1 4 7 3 6-4 8-4 5-9 0-6 0-5-6-3-6 5-9Z" fill="#f196ac" stroke="#b35b7c" stroke-width="1.5"/><circle cx="47" cy="15" r="4" fill="#ffdd80"/>'
  },
  bubbles:{
   label:'Bong bóng',play:bubbles,
   icon:'<circle cx="24" cy="33" r="16" fill="#a8deec" fill-opacity=".55" stroke="#579db7" stroke-width="2"/><circle cx="45" cy="17" r="11" fill="#d5b9e9" fill-opacity=".55" stroke="#9b72af" stroke-width="2"/><circle cx="46" cy="45" r="9" fill="#aadfc9" fill-opacity=".55" stroke="#579f90" stroke-width="2"/><path d="M14 29q2-6 8-7m16-8q2-4 6-4m-3 33q1-3 4-3M13 47l-3 4m8 1-1 5" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/>'
  }
 };
 const names={rock:'Ném đá',brick:'Ném gạch',flowers:'Tặng hoa',water:'Tạt nước',tomato:'Ném cà chua',egg:'Ném trứng',snow:'Ném tuyết',confetti:'Tung pháo giấy',...Object.fromEntries(Object.entries(gardenReactions).map(([kind,item])=>[kind,item.label]))};
 let bridge,roomCode=null,seen=new Set(),hold=null,origin=null,suppressClick=false,dialog=null,pending=false;
 const flying=new Set(),activeTargets=new Map(),particleSprites=new Map();
 const gardenRecipientMotions=new Set();
 const maxConcurrentReactions=2;
 const throwMotion={
  rock:{lift:.57,bias:-.24,spin:260,sway:0,impact:1.18},
  brick:{lift:.46,bias:-.18,spin:170,sway:0,impact:1.2},
  flowers:{lift:1,bias:.16,spin:0,sway:24,impact:1.21},
  tomato:{lift:.78,bias:-.08,spin:320,sway:0,impact:1.3},
  egg:{lift:.91,bias:0,spin:205,sway:12,impact:1.3},
  snow:{lift:1.18,bias:.14,spin:145,sway:14,impact:1.25}
 };
 const impactPulses={
  rock:['#b28641','M58 8l12 21 24-9-3 26 20 11-21 14 6 25-26-6-12 22-15-22-25 8 7-24-22-12 23-15-6-25 24 8Z'],
  brick:['#b95940','M19 21l24 13-13 17-22 3m99-28L77 39l14 11 20 2M13 82l24 8-9 17m77-31-23 15 9 15'],
  flowers:['#cf6e99','M26 92C8 74 11 47 31 30 45 18 57 29 60 40 65 27 80 18 93 33c20 22 13 47-6 61Q59 114 26 92Z'],
  water:['#279cbe','M12 73Q9 45 27 50L22 28 43 41 50 13 62 39 84 23 81 47 105 42 97 63 111 74Q90 101 63 95 31 108 12 73Z'],
  tomato:['#c94d39','M16 49l20-1-7-23 20 14 11-26 11 26 25-9-9 22 24 11-26 10 8 24-23-14-13 24-11-25-27 10 10-23Z'],
  egg:['#d8942d','M18 62Q15 30 50 17Q83 7 102 43Q120 80 87 101Q58 117 32 92Q19 80 18 62Z'],
  snow:['#4c9abb','m59 8 40 24 4 49-43 30-43-26-3-50Z'],
  confetti:['#e3a238','M60 73 18 42m42 31L33 16m27 57V9m0 64 31-59M60 73l48-32']
 };
 const contactCues={
  rock:{size:2.14,duration:460,rise:4,twist:-10,spread:24,art:`<path d="M16 70Q5 36 30 20M90 19Q115 34 104 68M38 103q22 13 45-1" fill="none" stroke="#877047" stroke-width="4" stroke-linecap="round"/>
   <path d="M18 65Q12 42 24 32m68-10q21 14 16 37M44 102q15 7 33 2" fill="none" stroke="#f8d680" stroke-width="2.8" stroke-linecap="round"/>
   <g data-scatter="-1"><path d="m18 19 6 13-14-5zm-4 35-9 1 4 8 9-4z" fill="#ebce89" stroke="#8e7147" stroke-width="1.5"/></g>
   <g data-scatter="1"><path d="m91 11 3 8 8-3-4 8 6 6-9-1-5 7-1-8-9-2 8-4Z" fill="#ffefad" stroke="#b18642" stroke-width="1.7"/><path d="m108 72 8 8-12 1Z" fill="#d4ba79"/></g>`},
  brick:{size:2.16,duration:500,rise:8,twist:10,spread:26,art:`<path d="m20 26 17 8-13 8 10 6-15 10m65-34-13 10 14 2-7 11 19 1-6 12" fill="none" stroke="#c97650" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
   <path d="M13 83q21-17 40 1 20-12 49-4" fill="none" stroke="#f0c09a" stroke-width="7" stroke-linecap="round" opacity=".84"/>
   <g data-scatter="-1"><path d="m15 14 11 6-8 8-10-7zm4 56-9 2-4-9 9-4z" fill="#e99464" stroke="#ac503c" stroke-width="1.5"/></g>
   <g data-scatter="1"><path d="m90 16 13-8 8 8-15 9zm12 46 9 5 4 11-12-4z" fill="#d77a51" stroke="#a74f3a" stroke-width="1.5"/></g>`},
  flowers:{size:2.06,duration:800,rise:20,twist:-15,spread:23,art:`<path d="M19 75Q9 56 22 35Q35 13 59 18M100 43q15 26-9 45-17 12-38 7" fill="none" stroke="#e6a4b5" stroke-width="3" stroke-linecap="round"/>
   <path d="M24 80q10 13 28 15m27-72q12 3 18 12" fill="none" stroke="#f0bd70" stroke-width="2.5" stroke-linecap="round"/>
   <g data-scatter="-1"><path d="M23 40q-10-11-15-6-3 7 15 6Zm7-14q-8-5-3-12 8 1 3 12ZM15 62q-11-9-13-3 0 8 13 3Z" fill="#e98faf" stroke="#b25f80" stroke-width="1.4"/><path d="m47 13 3-6 3 6 6 3-6 3-3 6-3-6-6-3Z" fill="#f5cf76"/></g>
   <g data-scatter="1"><path d="M99 43q-1-12 7-12 6 5-7 12ZM95 84q13-7 15 0 0 7-15 0ZM71 98q6 10 13 6 1-6-13-6Z" fill="#de91b0" stroke="#a86a89" stroke-width="1.4"/><path d="m100 65 3-5 3 5 5 2-5 3-3 5-3-5-5-3Z" fill="#eabe68"/></g>`},
  tomato:{size:2.02,duration:470,rise:-2,twist:8,spread:27,art:`<path d="M13 55q11 0 23 7m53-22q11-13 19-13M23 31l11 12m58 27 17 6" fill="none" stroke="#fa9774" stroke-width="4" stroke-linecap="round"/>
   <g data-scatter="-1"><path d="M23 23q-8-15-14-8-3 6 14 8ZM23 66q-21-9-21-1 2 8 21 1Z" fill="#ec765b" stroke="#b9483a" stroke-width="1.6"/><path d="M14 87q6 6 13-2-11-4-13 2Z" fill="#f8cf87"/></g>
   <g data-scatter="1"><path d="M93 36q11-20 17-12 3 6-17 12ZM96 78q17 0 17 8-2 8-17-8Z" fill="#e66650" stroke="#a83f34" stroke-width="1.6"/><path d="M105 50q-11-1-9 5 3 4 9-5Z" fill="#f8cf87"/></g>`},
  egg:{size:2.05,duration:570,rise:10,twist:-10,spread:29,art:`<path d="M22 52l-9-10m81 7 12-10M35 25l-2-9m46 11 7-10" fill="none" stroke="#edb14e" stroke-width="4" stroke-linecap="round"/>
   <g data-scatter="-1"><path d="M30 45q-12 15-20 6-5-6-6-13l9 3 4-7 6 6 6-4Z" fill="#fff5d7" stroke="#bd9168" stroke-width="2" stroke-linejoin="round"/><path d="m12 60 8 3-4 7-7-4z" fill="#ffe5a7" stroke="#c19458" stroke-width="1.4"/></g>
   <g data-scatter="1"><path d="M89 46q15 13 23 2 5-6 5-14l-8 6-5-6-5 7-7-5Z" fill="#fff7e0" stroke="#bd9168" stroke-width="2" stroke-linejoin="round"/><path d="m100 69 8-2 2 7-9 3Z" fill="#ffda84" stroke="#c19458" stroke-width="1.4"/></g>`},
  snow:{size:2.12,duration:760,rise:15,twist:19,spread:22,art:`<path d="M16 64Q10 35 33 23M93 24q21 15 13 41M37 93q23 11 48 0" fill="none" stroke="#b5e4f2" stroke-width="3" stroke-linecap="round"/>
   <path d="m59 9 4 7 7 4-7 4-4 7-4-7-7-4 7-4Zm1 77 4 6 7 3-7 4-4 7-4-7-7-4 7-3Z" fill="#e7faff" stroke="#70aac3" stroke-width="1.8"/>
   <g data-scatter="-1" fill="none" stroke="#80bad3" stroke-width="2.3" stroke-linecap="round"><path d="M18 25v22M8 30l20 12m0-12L8 42m5-13 5 4 5-4M11 61l-6 5 6 6 6-6Z"/></g>
   <g data-scatter="1" fill="none" stroke="#80bad3" stroke-width="2.3" stroke-linecap="round"><path d="M101 33v22M91 38l20 12m0-12L91 50m5-13 5 4 5-4m-10 29-6 5 6 6 6-6Z"/></g>`},
  water:{size:2.13,duration:560,rise:13,twist:10,spread:26,art:`<path d="M16 67Q31 65 42 51m29 1q16 11 33 7M29 42q4-11 15-17m25 0q13 3 20 14" fill="none" stroke="#69cce3" stroke-width="4" stroke-linecap="round"/>
   <g data-scatter="-1"><path d="M28 29Q10 8 6 18q-5 9 22 11Zm-3 46q-21-5-20 5 2 10 20-5Z" fill="#9eeaf3" stroke="#258fae" stroke-width="1.9"/></g>
   <g data-scatter="1"><path d="M89 24q17-17 24-8 4 9-24 8Zm10 46q17-7 19 3-2 11-19-3Z" fill="#7ed9eb" stroke="#258fae" stroke-width="1.9"/></g>`},
  confetti:{size:2.19,duration:600,rise:18,twist:7,spread:22,art:`<path d="m59 43 5 13 13 4-13 5-5 13-5-13-13-5 13-4Z" fill="#fff3a8" stroke="#e5a747" stroke-width="2"/>
   <g data-scatter="-1"><path d="M42 58Q20 54 20 37Q19 29 10 23" fill="none" stroke="#c870ad" stroke-width="3.5" stroke-linecap="round"/><path d="m25 33 8-5 5 6-8 5Z" fill="#efac4f"/></g>
   <g data-scatter="1"><path d="M74 55q22-3 25-19 2-9 11-13" fill="none" stroke="#58a890" stroke-width="3.5" stroke-linecap="round"/><path d="m86 22 6-6 7 5-6 6Z" fill="#e8809a"/></g>`}
 };
 const burstCounts={rock:21,brick:22,flowers:24,water:15,tomato:20,egg:20,snow:28,confetti:40};
 const confettiColors=['#cb5684','#32846c','#d79723','#438fba','#9b63ba','#e2854d'];
 // Covers the longest flight plus the attached impact animation.
 const reactionWindowMs=2700;
 const avatars=Array.from({length:30},(_,i)=>'a'+String(i+1).padStart(2,'0'));
 function close(){dialog?.close();dialog?.remove();dialog=null;}
 function clearEffects(){
  for(const node of flying)node.remove();
  for(const motion of gardenRecipientMotions)motion.cancel();
  flying.clear();gardenRecipientMotions.clear();activeTargets.clear();
 }
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
   tomato:`<path d="M9 24q6-12 22-9 15-5 23 8 9 17-5 28-10 9-23 6Q7 52 7 39q-1-8 2-15Z" fill="#e65a43" stroke="#9e352e" stroke-width="2.5"/>
   <path d="M12 41q16 17 39-2l-1 10q-10 11-26 6-11-3-12-14Z" fill="#b63832" opacity=".75"/>
   <path d="M15 34q1-8 11-11m-10 16 2 3" fill="none" stroke="#ffc19a" stroke-width="4" stroke-linecap="round"/>
   <path d="M31 18q3-8 7-13l4 2q-5 4-6 9l14 1-11 6-7-3-10 4 2-7-8-5 13 2Z" fill="#77a65b" stroke="#466c43" stroke-width="1.7" stroke-linejoin="round"/>
   <circle cx="39" cy="37" r="1.6" fill="#f99879"/><circle cx="46" cy="34" r="1" fill="#f99879"/>`,
   egg:`<path d="M31 4q12 0 21 18 9 18-1 29-7 7-20 7-15 0-21-9-8-11 0-27Q20 4 31 4Z" fill="#fff2d4" stroke="#ac8864" stroke-width="2.2"/>
   <path d="M37 8q13 7 17 23 6 20-13 25-12 3-20-1 15-2 20-13 5-12-4-34Z" fill="#e9c899"/>
   <path d="M15 34q1-11 10-18m-10 24 1 4" fill="none" stroke="#fffdf4" stroke-width="4" stroke-linecap="round"/>
   <g fill="#c5a481"><circle cx="43" cy="28" r="1.7"/><circle cx="46" cy="36" r="1.1"/><circle cx="35" cy="49" r="1.3"/></g>`,
   snow:`<path d="M10 22q1-8 9-9 4-9 13-8 10-2 15 6 10 1 12 12 5 8-2 16-1 12-12 15-11 7-22 1-12-1-15-13-6-10 2-20Z" fill="#f5fdff" stroke="#5997b0" stroke-width="2.2"/>
   <path d="M11 37q10 6 22 2 15 4 24-8-1 14-12 20-11 7-24 0-8-3-10-14Z" fill="#b5dce9"/>
   <path d="m19 23 5-5 6-1m13 19 5-4" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
   <path d="M37 20v12m-5-9 10 6m0-6-10 6" fill="none" stroke="#83bacc" stroke-width="1.8" stroke-linecap="round"/>`,
   confetti:`<path d="m11 57 9-35 24 24Z" fill="#d67aa0" stroke="#884d82" stroke-width="2.4" stroke-linejoin="round"/>
   <path d="m14 46 5-17 19 15-9 4-4-7-8-5" fill="#f9cb70"/>
   <ellipse cx="32" cy="34" rx="17" ry="6" transform="rotate(45 32 34)" fill="#f2bc61" stroke="#884d82" stroke-width="2.4"/>
   <path d="M27 26Q21 14 30 11Q34 10 34 6m5 22q10-1 10-9 0-7 7-8m-11 24 13-2" fill="none" stroke="#6e9dc2" stroke-width="2.8" stroke-linecap="round"/>
   <path d="m16 16 5-3 3 5-5 3zm31-10 4-3 3 4-4 3zm6 17 5-1 1 5-5 1Z" fill="#73b087"/>
   <path d="M39 17l3-5 4 4-4 5Z" fill="#ee9175"/>`,
   rock:`<path d="m7 40 4-17L24 9l21 3 14 17-2 16-15 11-25-3Z" fill="#708891" stroke="#344b55" stroke-width="2.5" stroke-linejoin="round"/>
   <path d="m12 24 13-12 18 2 9 13-19-2-11 12Z" fill="#b9cbd0"/>
   <path d="m22 37 11-12 19 2 4 8-17 2-4 15-15-3Z" fill="#8ca6ad"/>
   <path d="m39 38 17-3-2 9-14 9-6-1Z" fill="#516c77"/>
   <path d="m15 28 11-10m13 16 6-1m-29 8 4 4" fill="none" stroke="#dae8e6" stroke-width="2.5" stroke-linecap="round"/>`,
   brick:`<path d="m5 23 33-13 21 10-33 17Z" fill="#edaa79" stroke="#904a38" stroke-width="2.4" stroke-linejoin="round"/>
   <path d="m5 23 21 14v18L6 44Z" fill="#aa503a" stroke="#904a38" stroke-width="2.4" stroke-linejoin="round"/>
   <path d="m26 37 33-17v20L26 55Z" fill="#d47b53" stroke="#904a38" stroke-width="2.4" stroke-linejoin="round"/>
   <path d="m16 23 8-4 6 3-8 4zm12-5 8-4 6 3-8 4zm12 4 8-4 6 3-8 4z" fill="#873d31" stroke="#ce7751" stroke-width="1.2"/>
   <path d="m31 40 19-9m-16 17 7-4M9 32l9 6" fill="none" stroke="#f7c49a" stroke-width="2.4" stroke-linecap="round"/>`,
   flowers:`<path d="M12 17q3-10 13-5 7-13 16-5 10-2 13 9 8 6 3 13-4 8-13 7L53 53l-9 7-23-17Q9 41 7 31q-5-7 5-14Z" fill="#fff3dc" stroke="#aa795c" stroke-width="2"/>
   <path d="M11 29 28 31 49 26 55 52 44 59 22 43Z" fill="#ead3a1"/>
   <path d="M18 18q10 0 16 16M44 14q-3 8-6 25M15 27q11 8 25 15" fill="none" stroke="#568553" stroke-width="3" stroke-linecap="round"/>
   <path d="M35 41q-14 1-13-10 12-2 13 10m5-6q-1-11 9-12 5 9-9 12" fill="#83ad62"/>
   <path d="M12 19q-3-7 4-9 5-5 9 1 8 0 8 6 0 5-6 6-2 7-8 4-7-1-7-8Z" fill="#e5789f" stroke="#a84876" stroke-width="1.3"/>
   <path d="M34 12q-2-6 4-8 4-4 8 1 6 0 6 6 3 5-3 8-2 5-8 2-6 0-7-9Z" fill="#f2c75f" stroke="#b28437" stroke-width="1.3"/>
   <path d="M9 29q2-6 8-5 5 1 5 6 4 4-1 8-5 4-9 0-6-1-3-9Z" fill="#ba86bf" stroke="#86568e" stroke-width="1.3"/>
   <circle cx="22" cy="18" r="3.5" fill="#ffe08c"/><circle cx="43" cy="13" r="3.4" fill="#df8c60"/><circle cx="15" cy="32" r="2.7" fill="#f6d17e"/>
   <path d="M34 47q-7-6-7 0 1 5 10 2-2 7 6 5 5-3-3-7l5-3-3-4Z" fill="#ce657f" stroke="#974b64" stroke-width="1.3"/>`
  };
  const node=document.createElement('span');node.className='social-projectile social-projectile-'+kind;node.setAttribute('aria-hidden','true');
  node.innerHTML='<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+(gardenReactions[kind]?.icon||shapes[kind])+'</svg>';
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
   rock:`<path d="M20 79q-9-2-12-9 6-8 17-5l8-8 11 9-7 12Z" fill="#a5b6b8" opacity=".9"/>
   <path d="m88 24 7-12 3 14 14 3-12 7-1 14-8-11-13 4 7-11-8-11Z" fill="#f6d178" stroke="#a67545" stroke-width="2"/>
   <path d="m104 53 7-4m-3 15 8 1M27 29l-8-5m11 17-12 2" fill="none" stroke="#ae8a5b" stroke-width="3" stroke-linecap="round"/>
   <path d="m10 59 5-5 6 3-2 6zm92 12 7-5 6 5-3 6Z" fill="#869ba3"/>`,
   brick:`<path d="M9 81Q3 72 18 69q6-11 18-8 6-7 13 2 12-4 18 6 14-3 20 7 17-1 23 8-11 10-42 4-24 7-46 1Z" fill="#e8aa83" opacity=".85"/>
   <path d="m93 21 12-7 4 12-10 8Z" fill="#d17852" stroke="#994735" stroke-width="2"/>
   <path d="m96 44 13-5 5 6-9 8ZM16 36l9-7 6 8-9 8Z" fill="#eda881" stroke="#b26149" stroke-width="1.7"/>
   <path d="m91 17 4-8m16 22 7-3M16 48l-9 3" fill="none" stroke="#b56e51" stroke-width="3" stroke-linecap="round"/>`,
   water:'<path d="M15 38q4-10 2-21 10 15 20 8 7-3 8-15 7 12 17 13 11 1 16-13 2 16 12 17 8 1 15-10-2 13 1 23" fill="none" stroke="#a5e3ef" stroke-width="5" stroke-linecap="round"/><path d="M19 35q17 7 28 0m30 2q13 3 25-1" fill="none" stroke="#f1ffff" stroke-width="2" stroke-linecap="round"/><g fill="#78c5de" stroke="#d7f7ff" stroke-width="1.5"><path d="M12 60q-8 11 0 11t0-11"/><path d="M108 73q-8 12 0 12t0-12"/></g>',
   flowers:`<path d="M10 66Q14 45 29 30M110 65q-1-19-15-29" fill="none" stroke="#d78fa3" stroke-width="2.2" stroke-linecap="round"/>
   <path d="M25 30C10 21 18 9 25 17c7-8 15 4 0 13ZM96 37c-14-7-8-19 0-12 8-7 14 5 0 12Z" fill="#ec91af" stroke="#a65176" stroke-width="1.6"/>
   <path d="M12 68q0-13 15-10-1 10-15 10m86 1q12-10 20 1-11 7-20-1" fill="#85ad72"/>
   <path d="m43 17 3-6 3 6 6 3-6 3-3 6-3-6-6-3zm35 8 2-5 3 5 5 2-5 2-3 5-2-5-5-2Z" fill="#f4c968" stroke="#fff6e1" stroke-width="1.5"/>
   <path d="M32 84Q60 98 87 80" fill="none" stroke="#e8a8b6" stroke-width="3" stroke-linecap="round"/>`,
   tomato:`<path d="M46 62Q53 62 53 70V90Q52 99 47 95L47 75Q47 69 43 69Zm21 0q7-2 8 5l1 31q-2 9-7 4l-1-24q0-5-4-6Z" fill="#d9604b" stroke="#b44a3b" stroke-width="1.6"/>
   <path d="M44 49Q26 42 34 35q6-4 16 5 3-20 12-14 6 3 3 15 17-12 24-5 5 6-10 16 22 5 17 12-4 5-20 2 6 18-2 20-8 3-14-16-9 19-18 12-3-5 1-15-22 8-23-1 0-7 24-17Z" fill="#db5441" stroke="#ac3f36" stroke-width="2"/>
   <path d="M46 53q11-14 22-5m-13 12q8-4 16-2" fill="none" stroke="#ffab82" stroke-width="3.5" stroke-linecap="round"/>
   <g fill="#ffd392"><ellipse cx="53" cy="55" rx="2.5" ry="1.6"/><ellipse cx="70" cy="62" rx="3" ry="1.8" transform="rotate(-22 70 62)"/></g>
   <path d="M29 24q-8-9-12-3-4 6 12 9m66-7q10-10 13-4 2 6-13 9m5 49q13 1 11 8-3 6-11-3" fill="#ea7961" stroke="#b8473d" stroke-width="1.3"/>`,
   egg:`<path d="M43 68Q50 64 52 72L51 94Q48 102 45 94L45 80Q44 77 41 77Zm28 3q7-5 10 3v18q-3 8-6 3l-2-12q0-3-4-3Z" fill="#fff1ce" stroke="#d9bb88" stroke-width="1.6"/>
   <path d="M27 57q-11-10 3-16 7-5 17 0 14-13 28-4 16-3 21 9 14 7 3 17 5 13-11 15-10 11-25 4-11 8-20 0-17 1-19-11-9-6 3-14Z" fill="#fff5dc" stroke="#cfb487" stroke-width="2"/>
   <ellipse cx="63" cy="59" rx="18" ry="15" fill="#f5bd4d" stroke="#d49330" stroke-width="1.6"/>
   <path d="M51 58q6-11 16-8m-13 18q9 5 18-2" fill="none" stroke="#ffe79e" stroke-width="3.4" stroke-linecap="round"/>
   <path d="m15 36 5-10 5 4 5-4-3 13Zm77-12 4-11 5 5 8-1-5 12Zm13 54 6 1 4 8-11-2Z" fill="#fff9e5" stroke="#bd9c74" stroke-width="1.7" stroke-linejoin="round"/>`,
   snow:`<path d="M19 48q-7-14 6-19 2-11 18-10 7-10 21-5 13-6 23 5 14 0 16 12 12 5 7 16-7 11-21 7-8 7-20 1-12 7-23 0-17 4-27-7Z" fill="#ecfaff" stroke="#7ab2c9" stroke-width="2"/>
   <path d="M26 43q12 5 22 0 10 7 22 0 11 6 29-2-4 14-19 10-9 5-17 1-9 6-20 0-11 3-17-9Z" fill="#b8dfed"/>
   <path d="M20 64v20m-9-15 18 10m0-10-18 10m84-20v18m-8-14 16 10m0-10-16 10" fill="none" stroke="#65a8c1" stroke-width="2.5" stroke-linecap="round"/>
   <path d="m52 65 4 5-4 5-4-5zm27 20 3 4-3 4-3-4Z" fill="#c0e8f6" stroke="#81bfd7" stroke-width="1.5"/>`,
   confetti:`<path d="m60 27 5 19 15-10-7 17 18 7-19 5 9 17-17-9-5 19-5-19-18 8 9-17-19-5 19-6-8-17 17 10Z" fill="#ffe98d" stroke="#e9ac4c" stroke-width="2.5" stroke-linejoin="round"/>
   <path d="M18 68q17-9 13-24-3-10 5-17m64 45q-13-9-5-19 7-8 4-18m-46-6q3-12 13-15" fill="none" stroke="#ad72b7" stroke-width="3.4" stroke-linecap="round"/>
   <path d="m15 43 8-5 4 7-8 5zm75-17 7-6 5 7-7 6zm15 34 7-4 4 7-8 4Z" fill="#edb85a"/>
   <path d="m13 55 4 3-3 6-5-3zm65-38 6-3 4 5-6 4Zm11 67 8 3-3 5-8-3Z" fill="#6db29a"/>
   <path d="m42 21 5-3 3 6-5 3zm68 19 5-3 2 6-5 2Z" fill="#e886a4"/>`
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
  const started=performance.now(),isConfetti=kind==='confetti';
  function draw(now){
   if(!canvas.isConnected)return;
   const age=now-started;
   if(age>=end){canvas.remove();flying.delete(canvas);return;}
   ctx.resetTransform();ctx.clearRect(0,0,canvas.width,canvas.height);
   for(const p of particles){
    const t=(age-p.delay)/p.duration;
    if(t<0||t>=1)continue;
    // Advance the initial lift quickly, then let the particles fall and drift.
    const travel=isConfetti?t+.26*(1-t)*Math.min(1,t/.16):t;
    const dx=p.vx*travel+(p.flutter?Math.sin(t*Math.PI*3+p.index)*14*t:0);
    const dy=(p.vy+p.gravity*travel)*travel;
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
 function popConfetti(target){
  const rect=target.getBoundingClientRect();
  const flash=attachedEffect(target,'social-impact social-impact-confetti');
  flash.style.top='78%';flash.style.width=flash.style.height=rect.width*1.68+'px';
  animateContact('confetti',rect,1);
  flash.innerHTML=impactArt('confetti');
  finish(flash,[
   {transform:'translate(-50%,-50%) scale(.28)',opacity:.8},
   {transform:'translate(-50%,-63%) scale(1.04)',opacity:1,offset:.18},
   {transform:'translate(-50%,-80%) scale(1.2)',opacity:0}
  ],{duration:420,easing:'ease-out'});
  const pieces=Array.from({length:burstCounts.confetti},(_,i)=>({
   index:i,angle:0,spin:(i%2?1:-1)*(95+i*23)*Math.PI/180,
   vx:Math.sin(i*2.39996)*rect.width*1.85,
   vy:-rect.height*(3.88+(i%7)*.18),gravity:rect.height*4.45,
   width:i%4===0?8:5+i%3,height:i%4===0?6:10+i%3*3,
   duration:1350+i%5*100,delay:i%6*8,flutter:true,
   color:confettiColors[i%confettiColors.length]
  }));
  paintParticles('confetti',rect.x+rect.width/2,rect.y+rect.height*.78,pieces);
 }

 function animateContact(kind,rect,direction){
  const cue=contactCues[kind];
  const centerY=rect.y+rect.height*(kind==='confetti'?.61:.5);
  // Position above the scrolling roster so the expanding artwork can cross its edge.
  const stamp=effect('social-contact social-contact-'+kind,rect.x+rect.width/2,centerY);
  stamp.style.position='fixed';
  stamp.style.width=stamp.style.height=Math.min(rect.width*cue.size,innerWidth*.78)+'px';
  const [color,outline]=impactPulses[kind];
  stamp.innerHTML='<svg viewBox="0 0 120 120" aria-hidden="true"><path data-pulse="" d="'+outline+'" stroke="'+color+'" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'+cue.art+'</svg>';
  const pulse=stamp.querySelector('[data-pulse]');
  pulse.style.transformOrigin='center';
  pulse.style.transformBox='view-box';
  pulse.animate([
   {transform:'scale(.45)',opacity:.25},
   {transform:'scale(.89)',opacity:.95,offset:.22},
   {transform:'scale(1.22)',opacity:0}
  ],{duration:cue.duration*.8,fill:'both',easing:'ease-out'});
  const pose=(rise,turn,scale)=>'translate(-50%,'+(-50-rise)+'%) rotate('+turn+'deg) scale('+scale+')';
  finish(stamp,[
   {transform:pose(0,-cue.twist*direction,.42),opacity:.85,easing:'cubic-bezier(.12,.78,.18,1)'},
   {transform:pose(cue.rise*.35,0,1.06),opacity:1,offset:.2},
   {transform:pose(cue.rise*.7,cue.twist*direction*.4,1.1),opacity:.93,offset:.47},
   {transform:pose(cue.rise,cue.twist*direction,1.16),opacity:0}
  ],{duration:cue.duration,easing:'linear'});
  for(const part of stamp.querySelectorAll('[data-scatter]')){
   const side=Number(part.dataset.scatter);
   part.style.transformBox='fill-box';part.style.transformOrigin='center';
   part.animate([
    {transform:'none'},
    {transform:'translate('+side*cue.spread+'px,'+(-cue.rise/2)+'px) rotate('+side*11+'deg)'}
   ],{duration:cue.duration,fill:'both',easing:'ease-out'});
  }
 }
 function burst(target,kind,direction=1){
  const rect=target.getBoundingClientRect(),x=rect.x+rect.width/2,y=rect.y+rect.height/2;
  const gentle=kind==='flowers',cold=kind==='snow',hard=kind==='rock'||kind==='brick';
  // Recoil follows the incoming object; attached residue moves with the portrait.
  const kick=direction*(hard?18:7);
  if(kind==='rock'||kind==='brick')dizzy(target);
  const reaction=gentle?[
   {transform:'translateY(0) scale(1)'},{transform:'translateY(-7px) scale(1.035)',offset:.3},{transform:'translateY(2px) scale(.99)',offset:.65},{transform:'none'}
  ]:cold?[
   {transform:'translateX(0)'},{transform:'translateX(-2px) rotate(-2deg)',offset:.2},{transform:'translateX(2px) rotate(2deg)',offset:.4},{transform:'translateX(-2px) rotate(-1deg)',offset:.6},{transform:'translateX(1px)',offset:.8},{transform:'none'}
  ]:[
   {transform:'none'},{transform:'translateX('+kick+'px) rotate('+direction*11+'deg) scale(.88,1.07)',offset:.1},{transform:'translateX('+(-kick*.4)+'px) rotate('+(-direction*3)+'deg) scale(1.035,.98)',offset:.33},{transform:'translateX('+kick*.15+'px) rotate('+direction+'deg)',offset:.6},{transform:'none'}
  ];
  target.animate(reaction,{duration:gentle?720:cold?650:540,easing:'cubic-bezier(.2,.7,.25,1)'});
  const accent=attachedEffect(target,'social-impact social-impact-'+kind);accent.innerHTML=impactArt(kind);accent.style.width=accent.style.height=rect.width*throwMotion[kind].impact+'px';
  const duration=['tomato','egg','snow'].includes(kind)?1700:gentle?1250:680;
  const fall=kind==='tomato'||kind==='egg',drift=cold?-68:gentle?-60:fall?-34:-46;
  finish(accent,[{transform:'translate(-50%,-50%) scale(.45)',opacity:0},{transform:'translate(-50%,-50%) scale(1.08)',opacity:1,offset:.08},{transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.2},{transform:'translate(-50%,'+(fall?-43:-50)+'%) scale(1)',opacity:1,offset:.65},{transform:'translate(-50%,'+drift+'%) scale(.98)',opacity:0}],{duration,easing:'ease-out'});
  animateContact(kind,rect,direction);
  if(kind==='rock'||kind==='brick'||kind==='snow'){
   const dust=effect('social-dust social-dust-'+kind,x,y);dust.style.width=rect.width*.8+'px';dust.style.height=rect.height*.45+'px';
   finish(dust,[{transform:'translate(-50%,-50%) scale(.25)',opacity:0},{transform:'translate(-50%,-55%) scale(1.17)',opacity:.92,offset:.2},{transform:'translate(-50%,-75%) scale(1.48)',opacity:0}],{duration:520,easing:'ease-out'});
  }
  const particles=Array.from({length:burstCounts[kind]},(_,i)=>{
   const angle=i*2.39996,reach=rect.width*(.45+(i%5)*.19)+14;
   const width=Math.max(6,rect.width/98*(gentle?14+i%4*5:cold?7+i%5*4:hard?7+i%5*5:10+i%4*4));
   return {
    index:i,angle:0,spin:(i%2?1:-1)*(95+i*23)*Math.PI/180,
    vx:Math.cos(angle)*reach+(hard?direction*rect.width*.33:0),
    vy:Math.sin(angle)*reach*.68-(gentle?55:cold?34:hard?53:26),
    gravity:gentle?75:cold?110:hard?rect.height*1.8:130,
    width,height:width,
    duration:gentle?1350+i%3*90:cold?1200:hard?650+i%4*70:1000,
    delay:i%3*8,flutter:gentle||cold,
    sprite:particleSprite(kind,i),color:'#9d896d'
   };
  });
  paintParticles(kind,x,y,particles);
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
  const size=Math.min(61,a.width*.62),bx=a.x+a.width/2+direction*a.width*.54,by=a.y+a.height*.55;
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
  const width=Math.max(64,Math.min(124,b.width*1.1));
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
  const splash=attachedEffect(target,'social-impact social-impact-water');splash.style.width=splash.style.height=box.width*1.51+'px';splash.style.top='43%';
  splash.innerHTML=`<svg viewBox="0 0 100 100" aria-hidden="true">
   <path d="M11 58Q21 49 36 49Q24 40 20 31Q18 25 25 28Q40 33 45 44Q41 31 46 19Q50 11 54 20Q59 31 55 45Q65 34 78 28Q86 25 81 33Q76 43 65 49Q81 44 91 50Q98 55 89 58Q68 63 63 71Q56 78 47 73Q40 67 29 72Q18 75 13 66Q10 62 20 59Z" fill="#79d8e8" stroke="#288ca7" stroke-width="2.1" stroke-linejoin="round"/>
   <path d="M27 53Q40 46 46 52Q55 47 64 52Q73 49 80 53Q64 55 61 62Q54 66 48 62Q38 57 27 60Z" fill="#d8fbfc"/>
   <path d="M10 28Q6 19 10 18Q15 18 17 25Q17 29 10 28ZM61 14Q62 7 67 8Q71 10 68 15Q64 18 61 14ZM84 69Q92 65 95 70Q97 75 91 76Q85 75 84 69Z" fill="#a1eaf0" stroke="#399bb4" stroke-width="1.6"/>
  </svg>`;
  finish(splash,[{transform:'translate(-50%,-50%) scale(.42)',opacity:.65},{transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.2},{transform:'translate(-50%,-46%) scale(1.1)',opacity:.9,offset:.5},{transform:'translate(-50%,-38%) scale(1.24)',opacity:0}],{duration:410,easing:'ease-out'});
  animateContact('water',box,direction);
  const drops=Array.from({length:burstCounts.water},(_,i)=>{
   const angle=i*2.4,reach=box.width*(.38+i%5*.12),width=6+i%4;
   return {
    index:i,angle,spin:0,vx:Math.cos(angle)*reach+direction*box.width*.12,vy:Math.sin(angle)*reach*.76-10,gravity:box.height*.75,
    width,height:width*1.6,duration:450+i%3*65,delay:0,flutter:false,
    sprite:particleSprite('water',i),color:'#459fc6'
   };
  });
  paintParticles('water',x,y,drops);
  wet(target);
 }

 function gardenStage(kind,rect,art){
  const stage=effect('social-garden social-garden-'+kind,rect.x+rect.width/2,rect.y+rect.height/2);
  stage.style.width=stage.style.height=Math.min(rect.width*1.9,innerWidth*.68)+'px';
  stage.innerHTML='<svg viewBox="0 0 120 120" aria-hidden="true">'+art+'</svg>';
  return stage;
 }
 function moveGardenRecipient(target,frames,timing){
  const motion=target.animate(frames,timing);
  gardenRecipientMotions.add(motion);
  motion.finished.catch(()=>{}).finally(()=>gardenRecipientMotions.delete(motion));
 }

 function leafstorm(rect,target){
  const foliage=Array.from({length:18},(_,i)=>
   '<g data-leaf opacity="0"><path d="M-8 3Q-2-8 11-5Q9 7-8 3Z" fill="'+['#d4eb73','#6bb768','#ebb76a'][i%3]+'" stroke="#346f4c" stroke-width="1.1"/><path d="M-5 2 7-3" stroke="#f2f6c5" stroke-width="1.2" stroke-linecap="round"/></g>'
  ).join('');
  const cone=`<g class="leafstorm-core">
   <path d="M9 27C7 13 29 7 48 10C71 13 96 14 113 22C118 39 102 59 86 76C68 96 54 119 66 134C49 132 44 122 47 110C52 94 37 80 25 63C16 50 11 38 9 27Z" fill="#b3da8e" opacity=".48"/>
   <path d="M18 35C45 54 77 48 109 28C95 55 68 59 45 58C25 57 19 49 18 35ZM32 66C48 76 69 74 88 60C77 82 54 90 41 86ZM45 93Q60 104 71 91Q62 115 50 116Z" fill="#3b8d67" opacity=".45"/>
   <path d="M72 134C50 132 44 120 58 112C75 102 78 97 63 96C38 95 31 89 46 82C57 77 91 73 91 65C90 58 64 63 49 61C25 58 15 52 19 46C23 38 55 41 78 36C111 29 118 21 100 15C84 9 63 7 42 10" fill="none" stroke="#367e57" stroke-opacity=".76" stroke-width="4.6" stroke-linecap="round"/>
   <g data-wind-bands fill="none" stroke-linecap="round" stroke-dasharray=".29 .12 .13 .46">
    <path pathLength="1" d="M69 132C43 131 50 117 67 108C81 101 71 94 53 93C34 91 40 83 61 78C93 70 102 59 75 58C45 59 20 56 17 47C13 40 33 39 56 37C86 34 123 23 105 15C93 10 65 5 39 10" stroke="#f5ffcf" stroke-width="3.6"/>
    <path pathLength="1" d="M41 126Q27 117 49 103C65 92 47 87 40 82Q16 71 46 64C80 57 106 53 110 44Q114 37 82 39C39 44 3 36 10 25Q18 13 60 16" stroke="#7fd399" stroke-width="3.3"/>
   </g>
   <path d="M11 24Q24 13 47 16M84 42q21-5 26-13M16 53q9 7 24 8m31 17q12-3 19-9M43 101l7 3" fill="none" stroke="#e7f8b6" stroke-width="2.3" stroke-linecap="round"/>
  </g>`;
  const landing='<ellipse data-landing cx="60" cy="132" rx="29" ry="6" fill="none" stroke="#7eaa59" stroke-width="2.4" opacity="0"/>';
  const stage=gardenStage('leafstorm',rect,landing+cone+foliage);
  const width=Math.min(rect.width*2.28,innerWidth*.69);
  stage.style.width=width+'px';stage.style.height=width*1.25+'px';
  stage.style.top=(rect.y+rect.height*.29)+'px';
  stage.querySelector('svg').setAttribute('viewBox','0 0 120 150');
  stage.querySelector('.leafstorm-core').animate([
   {transform:'translateY(4px) rotate(-8deg) scale(.22,.2)',opacity:0},
   {transform:'rotate(5deg) scale(.94,.89)',opacity:1,offset:.19},
   {transform:'rotate(-5deg) scale(.94,1.04)',opacity:1,offset:.36},
   {transform:'rotate(4deg) scale(1.03,1.08)',opacity:1,offset:.55},
   {transform:'rotate(-4deg) scale(.87,1.01)',opacity:.91,offset:.72},
   {transform:'translateY(-23px) rotate(8deg) scale(1.36,1.13)',opacity:0}
  ],{duration:1660,fill:'both'});
  stage.querySelector('[data-wind-bands]').animate([{strokeDashoffset:0},{strokeDashoffset:-1}],
   {duration:750,iterations:3});
  [...stage.querySelectorAll('[data-leaf]')].forEach((leaf,i)=>{
   const frames=Array.from({length:27},(_,j)=>{
    const t=j/26,lift=Math.min(1,t/.78),release=Math.max(0,(t-.78)/.22);
    const angle=i*2.4+lift*Math.PI*5.6+release*.3;
    const depth=Math.cos(angle),radius=5+38*lift+34*release;
    const x=59+Math.sin(angle)*radius+6*(1-lift);
    const y=134-111*lift-26*release+depth*(2+5*lift);
    const scale=(.43+.31*lift+.17*depth)*(i%3===0?1.24:1);
    return {
     transform:'translate('+x.toFixed(2)+'px,'+y.toFixed(2)+'px) rotate('+((angle*180/Math.PI)+25).toFixed(2)+'deg) scale('+scale.toFixed(2)+')',
     opacity:Math.min(1,t*16,(1-t)*8)*(.75+.25*depth)
    };
   });
   leaf.animate(frames,{duration:1120+(i%3)*115,delay:i*33,easing:'linear',fill:'both'});
  });
  const lift=Math.round(Math.max(17,Math.min(rect.height*.28,42)));
  moveGardenRecipient(target,[
   {transform:'none'},
   {transform:'translate(-4px, 3px) rotate(-7deg) scale(.96)',offset:.13},
   {transform:'translate(9px, -'+Math.round(lift*.6)+'px) rotate(14deg) scale(1.04)',offset:.28},
   {transform:'translate(-10px, -'+lift+'px) rotate(-16deg) scale(1.06)',offset:.45},
   {transform:'translate(9px, -'+Math.round(lift*.76)+'px) rotate(12deg)',offset:.61},
   {transform:'translate(-4px, 3px) rotate(-5deg) scale(1.06,.93)',offset:.79},
   {transform:'translate(2px, -4px) rotate(3deg)',offset:.89},
   {transform:'none'}
  ],{duration:1740,delay:135});
  stage.querySelector('[data-landing]').animate([
   {transform:'scale(.45)',opacity:.8},{transform:'scale(1.45,1.15)',opacity:0}
  ],{duration:370,delay:1505,easing:'ease-out'});
  finish(stage,[{opacity:1},{opacity:1,offset:.88},{opacity:0}],{duration:2040});
 }
 function vine(rect,target){
  const coils=[
   'M49 112C39 105 24 99 28 89C32 78 58 89 79 81C100 73 94 61 82 61Q73 61 76 68',
   'M69 112C87 108 98 93 88 84C76 73 42 79 31 68C21 57 32 39 43 39Q50 39 47 46'
  ];
  const stems=coils.map((path,i)=>`<g data-vine-stem fill="none" stroke-dasharray="1" stroke-dashoffset="1" stroke-linecap="round">
   <path pathLength="1" d="${path}" stroke="#28553a" stroke-width="6.4"/>
   <path pathLength="1" d="${path}" stroke="${i===0?'#80b852':'#5c9f52'}" stroke-width="3.8"/>
  </g>`).join('');
  const sprouts=[[43,105,158],[78,106,-30],[29,91,164],[91,92,-35],[54,84,-122],
   [80,81,25],[36,72,170],[90,65,-50],[31,54,198],[42,39,-115]];
  const leaves=sprouts.map(([x,y,angle],i)=>`<g transform="translate(${x} ${y})"><g data-vine-leaf opacity="0">
   <g transform="rotate(${angle})">
    <path d="M0 0Q4-10 15-7Q13 2 0 0Z" fill="${i%2===0?'#b9da6d':'#83bc62'}" stroke="#386a45" stroke-width="1.2"/>
    <path d="M2 0 11-5" stroke="#ebf3ad" stroke-width="1.1" stroke-linecap="round"/>
   </g>
  </g></g>`).join('');
  const stage=attachedEffect(target,'social-garden social-garden-vine');
  stage.style.width=stage.style.height=Math.min(rect.width*1.88,innerWidth*.67)+'px';
  stage.innerHTML='<svg viewBox="0 0 120 120" aria-hidden="true">'+stems+leaves+'</svg>';
  stage.querySelectorAll('[data-vine-stem]').forEach((stem,i)=>stem.animate([
   {strokeDashoffset:1},{strokeDashoffset:0,offset:.35,easing:'linear'},
   {strokeDashoffset:0,offset:.76,easing:'cubic-bezier(.5,0,.8,.35)'},{strokeDashoffset:1}
  ],{duration:1800,delay:i*90,easing:'ease-out',fill:'both'}));
  stage.querySelectorAll('[data-vine-leaf]').forEach((leaf,i)=>{
   const [x]=sprouts[i],drift=x<60?-1:1;
   const delay=210+i*47;
   leaf.animate([
    {transform:'scale(.12)',opacity:0},
    {transform:'scale(1.08)',opacity:1,offset:160/(1810-delay)},
    {transform:'scale(1)',opacity:1,offset:(1420-delay)/(1810-delay)},
    {transform:'translate('+drift*(13+i%3*5)+'px, -15px) rotate('+drift*42+'deg) scale(.65)',opacity:0}
   ],{duration:1810-delay,delay,fill:'both',easing:'ease-out'});
  });
  moveGardenRecipient(target,[
   {transform:'none'},
   {transform:'translate(4px, -3px) rotate(5deg)',offset:.12},
   {transform:'translate(-6px, 10px) rotate(-12deg) scale(.96,.91)',offset:.26},
   {transform:'translate(4px, 7px) rotate(7deg) scale(.98,.95)',offset:.41},
   {transform:'translate(-4px, 8px) rotate(-7deg) scale(.98,.94)',offset:.55},
   {transform:'translate(-2px, 6px) rotate(-4deg) scale(.98,.95)',offset:.71},
   {transform:'translate(2px, -4px) rotate(4deg)',offset:.85},
   {transform:'none'}
  ],{duration:1560,delay:340});
  finish(stage,[{opacity:1},{opacity:1,offset:.84},{opacity:0}],{duration:1990});
 }
 function bubbles(rect,target){
  const colors=['#63b9d1','#a98acb','#69bca9'];
  const droplets=Array.from({length:12},(_,i)=>`<g data-bubble-droplet opacity="0">
   <circle r="${i%3+2.8}" fill="${colors[i%3]}" fill-opacity=".32" stroke="${colors[i%3]}" stroke-width="1.3"/>
   <path d="M-1.8-1q.4-1 1.6-1.3" fill="none" stroke="#fff" stroke-width="1" stroke-linecap="round"/>
  </g>`).join('');
  const stage=attachedEffect(target,'social-garden social-garden-bubbles');
  stage.style.width=stage.style.height=Math.min(rect.width*1.85,innerWidth*.67)+'px';
  stage.innerHTML=`<span class="social-bubble-shell"></span><svg viewBox="0 0 120 120" aria-hidden="true">
   <g data-bubble-pop opacity="0" fill="none" stroke-linecap="round">
    <circle cx="60" cy="60" r="39" stroke="#6dc9db" stroke-width="2.8" stroke-dasharray="26 9 8 11 23 13"/>
    <path d="M27 23l-6-8m75 12 8-7m-86 40-9 1m94 4 9 1M38 94l-5 8m53-8 5 8" stroke="#e9fbff" stroke-width="3"/>
   </g>${droplets}</svg>`;
  const popAt=1170;
  stage.querySelector('.social-bubble-shell').animate([
   {transform:'translateY(8%) scale(.22,.13)',opacity:0},
   {transform:'scale(1.06,.92)',opacity:1,offset:.18},
   {transform:'scale(.98,1.04)',opacity:1,offset:.32},
   {transform:'scale(1.025,.98)',opacity:1,offset:.6},
   {transform:'scale(.98,1.035)',opacity:1,offset:.86},
   {transform:'scale(1.13)',opacity:1,offset:.93},
   {transform:'scale(1.24)',opacity:0}
  ],{duration:popAt+90,fill:'both'});
  stage.querySelector('[data-bubble-pop]').animate([
   {transform:'scale(.92)',opacity:0},
   {transform:'scale(1.12)',opacity:1,offset:.24},
   {transform:'translateY(-12px) scale(1.52)',opacity:0}
  ],{duration:345,delay:popAt,fill:'both',easing:'ease-out'});
  stage.querySelectorAll('[data-bubble-droplet]').forEach((drop,i)=>{
   const angle=(i+.25)*Math.PI/6;
   const dx=Math.cos(angle),dy=Math.sin(angle),distance=57+i%4*5;
   const position=(radius,rise,scale)=>'translate('+Math.round(60+dx*radius)+'px,'+Math.round(60+dy*radius-rise)+'px) scale('+scale+')';
   drop.animate([
    {transform:position(37,0,.5),opacity:0},
    {transform:position(48,6,1.2),opacity:1,offset:.23},
    {transform:position(distance,20,.72),opacity:.88,offset:.71},
    {transform:position(distance+8,29,.3),opacity:0}
   ],{duration:560+i%3*60,delay:popAt+i%3*32,fill:'both',easing:'ease-out'});
  });
  const lift=Math.round(Math.max(18,Math.min(24,rect.height*.24)));
  moveGardenRecipient(target,[
   {transform:'none'},
   {transform:'translate(0px, 2px) scale(1.03,.97)',offset:.13},
   {transform:'translate(-5px, -'+Math.round(lift*.72)+'px) rotate(-6deg)',offset:.33},
   {transform:'translate(5px, -'+lift+'px) rotate(6deg)',offset:.54},
   {transform:'translate(-3px, -'+lift+'px) rotate(-3deg)',offset:.71,easing:'cubic-bezier(.6,0,1,.7)'},
   {transform:'translate(0px, 4px) scale(1.07,.92)',offset:.84},
   {transform:'translate(0px, -4px) scale(.98,1.03)',offset:.92},
   {transform:'none'}
  ],{duration:1780});
  finish(stage,[{opacity:1},{opacity:1,offset:.9},{opacity:0}],{duration:1940});
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
  if(event.kind==='confetti'){popConfetti(to);return;}
  const garden=gardenReactions[event.kind];
  if(garden){garden.play(b,to);return;}
  from.animate([{transform:'scale(1)'},{transform:'rotate(-7deg) scale(.92)'},{transform:'scale(1)'}],{duration:280});
  const startX=a.x+a.width/2,startY=a.y+a.height/2,endX=b.x+b.width/2,endY=b.y+b.height/2;
  const motion=throwMotion[event.kind],direction=endX>=startX?1:-1;
  const lift=motion.lift*Math.max(18,Math.min(115,Math.min(startY,endY)-35));
  const duration=Math.min(850,550+Math.hypot(endX-startX,endY-startY)*.24);
  const point=t=>{
   const progress=t+motion.bias*t*(1-t);
   return {x:startX+(endX-startX)*progress,y:startY+(endY-startY)*progress-lift*4*progress*(1-progress)};
  };
  for(const [i,t] of [.2,.38,.56,.74].entries()){
   const p=point(t),next=point(t+.01);
   const turn=Math.atan2(next.y-p.y,next.x-p.x)*180/Math.PI;
   const trail=effect('social-trail social-trail-'+event.kind,p.x,p.y+(i%2===0?-3:4));
   const mark='translate(-50%,-50%) rotate('+turn+'deg) scale(';
   finish(trail,[{transform:mark+'.38)',opacity:0},{transform:mark+'1.45,.85)',opacity:.98,offset:.22},{transform:mark+'.75,.4)',opacity:0}],{duration:350,delay:duration*t,easing:'ease-out'});
  }
  const node=projectile(event.kind);
  const size=Math.max(57,Math.min(96,a.width*.77));node.style.width=node.style.height=size+'px';
  document.body.append(node);flying.add(node);
  const frames=Array.from({length:33},(_,i)=>{
   const t=i/32,p=point(t);
   const turn=(direction*(motion.spin*t+motion.sway*Math.sin(t*Math.PI*2))).toFixed(2);
   return {transform:'translate('+p.x+'px,'+p.y+'px) translate(-50%,-50%) rotate('+turn+'deg) scale('+(1+.22*Math.sin(t*Math.PI))+')'};
  });
  node.animate(frames,{duration,easing:'linear',fill:'forwards'}).finished.then(()=>{
   const recipient=avatarElement(event.to);if(node.isConnected&&recipient)burst(recipient,event.kind,direction);
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
