'use strict';
const app=document.getElementById('app'), statusEl=document.getElementById('connection'),toast=document.getElementById('toast');
let session=null,snapshot=null,aborter=null,delay=750,clock=null,requesting=false,statementDraft=null,actionDraft=null;
let clockAnchor=null,peopleOpen=false;
const phaseSeconds={DEBATE:120,BLIND_ACTION:60,REVEAL:25};
function acceptSnapshot(value){
 if(snapshot&&snapshot.room.code===value.room.code&&snapshot.room.revision>value.room.revision)return;
 synchronizeClock(value);
 if(snapshot?.room.code===value.room.code&&typeof value.room.revision==='number'&&snapshot.room.revision===value.room.revision){snapshot.serverTime=value.serverTime;snapshot.deadline=value.deadline;return;}
 // Presence updates after game over must not recreate or restart the film.
 if(snapshot?.game?.phase==='GAME_OVER'&&value.game?.phase==='GAME_OVER'&&snapshot.game.gameId===value.game.gameId&&snapshot.game.outcome?.winner===value.game.outcome?.winner&&app.querySelector('.gi-ending-screen')){
  snapshot=value;const people=app.querySelector('.ending-people');if(people)people.innerHTML=playerList(value);return;
 }
 const sameRound=snapshot?.game&&snapshot.room.code===value.room.code&&snapshot.game.gameId===value.game?.gameId&&snapshot.game.round===value.game?.round;
 const scrollSelectors=['.people','#players-panel',...(sameRound?['.gi-center-column','.gi-area-discussion>.card:first-child>.hist','.gi-history .hist']:[])];
 const scrolls=scrollSelectors.flatMap(selector=>{const el=app.querySelector(selector);return el?[{selector,left:el.scrollLeft,top:el.scrollTop,focused:document.activeElement===el}]:[];});
 const choiceOpen=app.querySelector('#statement-choice')?.open,choiceFocus=document.activeElement?.id,drawerFocused=peopleOpen&&app.querySelector('#players-panel')?.contains(document.activeElement);
 const motionFrame=window.GreenTrapMotion?.capture(snapshot);
 captureStatementDraft();snapshot=value;render();
 if(choiceOpen){openStatementChoice();if(choiceFocus)document.getElementById(choiceFocus)?.focus();}
 if(drawerFocused)(document.getElementById(choiceFocus)||document.getElementById('close-players'))?.focus();
 for(const saved of scrolls){const el=app.querySelector(saved.selector);if(el){el.scrollLeft=saved.left;el.scrollTop=saved.top;if(saved.focused)el.focus({preventScroll:true});}}
 window.GreenTrapMotion?.commit(value,motionFrame);
}
function remainingMilliseconds(){return clockAnchor?Math.max(0,clockAnchor.remaining-(performance.now()-clockAnchor.at)):0;}
function remainingSeconds(){return Math.ceil(remainingMilliseconds()/1000);}
function scheduleClock(){if(!clock&&clockAnchor&&!document.hidden)clock=requestAnimationFrame(paintClock);}
function synchronizeClock(value){
 if(!value.deadline||value.game?.phase==='GAME_OVER'){clockAnchor=null;cancelAnimationFrame(clock);clock=null;return;}
 const key=[value.room.code,value.game?.gameId,value.game?.round,value.game?.phase,value.deadline].join(':');
 const remaining=Math.max(0,value.deadline-value.serverTime);
 clockAnchor={key,remaining:clockAnchor?.key===key?Math.min(remaining,remainingMilliseconds()):remaining,at:performance.now()};
 scheduleClock();
}
function paintClock(){
 clock=null;if(!clockAnchor||document.hidden||!snapshot?.deadline)return;
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
const save=()=>{if(session)sessionStorage.setItem(storeKey,JSON.stringify(session));else sessionStorage.removeItem(storeKey)};
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
 const expiredRoom=error.code==='ROOM_NOT_FOUND',kicked=error.code==='KICKED';
 peopleOpen=false;document.body.classList.remove('gi-drawer-open','gi-gameplay','gi-ending');
 aborter?.abort();session=null;snapshot=null;save();clearStatementDraft();
 try{const url=new URL(location.href);url.searchParams.delete('room');history.replaceState({},'',url.pathname+url.search+url.hash);}catch{}
 statusEl.textContent=kicked?'Đã rời phòng':expiredRoom?'Phòng không còn tồn tại':'Phiên chơi hết hạn';
 app.innerHTML=`<section class="card welcome"><h1>${kicked?'Bạn đã được đưa ra khỏi phòng':expiredRoom?'Phòng đã kết thúc hoặc hết hạn':'Phiên chơi không còn hợp lệ'}.</h1><p>${kicked?'Chủ phòng đã kick bạn khỏi phòng.':expiredRoom?'Phòng này không còn trên máy chủ. Phòng có thể đã bị đóng hoặc hết thời gian lưu.':'Phiên xác thực đã hết hạn hoặc không còn hợp lệ.'} Bạn có thể quay về trang đầu để tạo phòng mới hoặc nhập mã phòng khác.</p><div class="actions"><button id="return-home" class="primary">Tạo hoặc tham gia phòng khác <span aria-hidden="true">→</span></button></div></section>`;
}
function handleSessionError(error){if(error?.code==='ROOM_NOT_FOUND'||error?.code==='UNAUTHORIZED'){recoverSession(error);return;}gameError(error);}
const pendingRequests=new Map();
const api=async(path,data,authenticated=false)=>{const headers={'Content-Type':'application/json'};if(authenticated){headers.Authorization=`Bearer ${session.token}`;headers['x-room-code']=session.roomCode;}
 const key=JSON.stringify([authenticated?session.playerId:'entry',path,data]);
 const requestId=pendingRequests.get(key)||crypto.randomUUID();pendingRequests.set(key,requestId);
 if(pendingRequests.size>20)pendingRequests.delete(pendingRequests.keys().next().value);
 const r=await fetch(path,{method:'POST',headers,body:JSON.stringify({...data,requestId}),signal:AbortSignal.timeout(15000)});const value=await r.json().catch(()=>({}));if(r.ok||r.status<500)pendingRequests.delete(key);if(!r.ok){const error=Error(value.message||value.error||`HTTP ${r.status}`);error.code=value.error;error.status=r.status;throw error;}return value;};
const readState=async(signal)=>{const current=session;if(!current)return;const r=await fetch(`/api/state?room=${current.roomCode}`,{headers:{Authorization:`Bearer ${current.token}`},cache:'no-store',signal:signal||AbortSignal.timeout(12000)});const value=await r.json().catch(()=>({}));if(!r.ok){const error=Error(value.message||value.error||'Không thể tải trạng thái phòng');error.code=value.error;error.status=r.status;throw error;}if(session!==current)return;acceptSnapshot(value);return value;};
const copyRoom=async()=>{const url=`${location.origin}/?room=${session.roomCode}`;try{await navigator.clipboard.writeText(url);showToast('Đã sao chép','success',3000);}catch{gameError({message:'Không thể sao chép. Hãy thử lại.'});}};
function onSession(s) {
 const url=new URL(location.href);
 if(url.searchParams.has('room')&&url.searchParams.get('room')!==s.roomCode){
  url.searchParams.set('room',s.roomCode);
  history.replaceState(history.state,'',url);
 }
 session=s;save();app.innerHTML='';if(s.transport==='poll')connectPoll();else readState().then(value=>{if(session!==s)return;if(value?.transport==='poll'){s.transport='poll';save();connectPoll();}else connectStream();}).catch(handleSessionError);}
async function connectPoll(){
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
function playerList(s){return s.room.players.map(p=>{const g=s.game?.players.find(x=>x.id===p.id);let info=!g?'Trong phòng':g.isAlive?(g.hasLockedAction?'Đã khóa lệnh':g.hasStatement?'Đã phát biểu':'Đang chơi'):'Đã bị loại';if(g?.role&&s.game.phase==='GAME_OVER')info+=` · ${labelRole(g.role)}`;
 if(p.removed)info='Đã bị kick khỏi phòng';
 const canKick=session?.playerId===s.room.hostId&&p.id!==s.room.hostId&&!p.removed&&s.game?.phase!=='GAME_OVER';
 return `<div class="person ${g&&!g.isAlive?'dead':''}" data-player-id="${escapeHTML(p.id)}"><div class="avatar">${escapeHTML(p.name.charAt(0).toUpperCase())}</div><div class="person-info"><b>${escapeHTML(p.name)} ${p.id===s.room.hostId?'★':''} ${p.id===s.game?.myPlayer.id?'(Bạn)':''}</b><small>${escapeHTML(info)}</small></div><span class="pill">${p.online?'● Online':'○ Offline'}</span>${canKick?`<button type="button" class="kick-player" data-kick-player="${escapeHTML(p.id)}" aria-label="Kick ${escapeHTML(p.name)} khỏi phòng">Kick</button>`:''}</div>`}).join('');}
function timer(s){if(!s.deadline)return '';const remain=remainingSeconds();return `<span class="countdown" id="clock">${remain}s</span>`;}
function render(){if(!snapshot||!session)return;const s=snapshot;const me=s.game?.myPlayer;const host=s.room.hostId===(me?.id||session.playerId);const q=(new URLSearchParams(location.search)).get('room');
 document.body.classList.toggle('gi-gameplay',Boolean(s.game));
 document.body.classList.toggle('gi-ending',s.game?.phase==='GAME_OVER');
 if(!s.game){clearStatementDraft();app.innerHTML=`<section class="grid lobby"><div class="column"><div class="card lobby-invite"><span class="eyebrow">Phòng chờ</span><h1>Phòng ${escapeHTML(s.room.code)}</h1><p>Mời bạn bè vào phòng trước khi bắt đầu ván.</p><div class="code mono">${escapeHTML(s.room.code)}</div><div class="actions"><button id="copy" class="primary">Sao chép link mời</button>${host?`<button id="start">Bắt đầu ván</button>`:'<span class="note">Đợi chủ phòng bắt đầu…</span>'}</div></div><div class="card lobby-members"><h2>Người chơi (${s.room.players.length}${s.room.maxPlayers?' / '+s.room.maxPlayers:''})</h2><div class="people" tabindex="0" role="region" aria-label="Danh sách thành viên">${playerList(s)}</div><div class="lobby-table-art" aria-hidden="true"><svg class="lobby-orbit" viewBox="0 0 800 300" fill="none"><ellipse cx="400" cy="156" rx="340" ry="104"/><ellipse cx="400" cy="156" rx="286" ry="138" stroke-dasharray="3 10"/><path d="M56 186c20-32 31-65 36-102m-15 58c-33-4-39-27-38-45 27 4 40 19 38 45Zm9-29c26-3 41-23 40-46-25 5-41 21-40 46ZM718 177c-1-34 12-63 33-88m-27 54c-24-5-31-24-29-43 23 4 32 20 29 43Zm9-24c27 1 43-15 48-35-26-1-44 12-48 35Z"/></svg><div class="lobby-card gi-card-preview"><span class="gi-card-image-viewport"><picture><source srcset="/cards-hd/PROJ_11.png"><img src="/cards/PROJ_11.png" alt="" loading="lazy" decoding="async"></picture></span></div><div class="lobby-card gi-card-preview"><span class="gi-card-image-viewport"><picture><source srcset="/cards-hd/PROJ_01.png"><img src="/cards/PROJ_01.png" alt="" loading="lazy" decoding="async"></picture></span></div><div class="lobby-card gi-card-preview"><span class="gi-card-image-viewport"><picture><source srcset="/cards-hd/PROJ_25.png"><img src="/cards/PROJ_25.png" alt="" loading="lazy" decoding="async"></picture></span></div></div></div></div><div class="column"><div class="card lobby-rules"><h2>Cách chơi</h2><p>Mỗi người được chia phe bí mật và nhận 2 xu. Thảo luận 10 dự án môi trường; đầu tư 1 xu hoặc giữ lại, dùng ngân hàng để kiểm chứng (3 xu) hoặc góp trục xuất (đủ 5 xu).</p><button id="leave" >Rời phòng</button></div></div></section>`;return;}
 const g=s.game;const latest=g.history.at(-1);let content='';
 if(g.phase==='GAME_OVER'&&window.GreenTrapEnding){
  peopleOpen=false;document.body.classList.remove('gi-drawer-open');clearStatementDraft();actionDraft=null;
  app.innerHTML=window.GreenTrapEnding.render(s,playerList(s));window.GreenTrapEnding.enhance(app);document.getElementById('ending-title')?.focus({preventScroll:true});return;
 }
 if(g.phase==='DEBATE'){
 content=`${!me.isAlive?'<p class="note">Bạn đã bị loại và đang theo dõi trận.</p>':g.players.find(p=>p.id===me.id)?.hasStatement?'<div class="note">Đã gửi ý kiến. Đợi các người chơi khác…</div>':`<form id="statement"><label class="gi-stance-select">Quan điểm<select id="stance"><option value="UNSURE">Chưa chắc chắn</option><option value="SUPPORT">Ủng hộ</option><option value="OPPOSE">Phản đối</option></select></label><label>Lý do<textarea id="statement-text" maxlength="500" required placeholder="Ví dụ: dự án cần làm rõ tác động tới hệ sinh thái..."></textarea></label><span class="gi-statement-counter" id="statement-counter">0 / 500</span><button type="submit" class="primary">Gửi ý kiến công khai</button></form><dialog id="statement-choice" class="gi-statement-choice" aria-labelledby="statement-choice-title"><h2 id="statement-choice-title">Quan điểm của bạn?</h2><div class="gi-stance-choices" role="group" aria-label="Chọn quan điểm"><button type="button" data-stance="SUPPORT" aria-pressed="false">Ủng hộ</button><button type="button" data-stance="UNSURE" aria-pressed="true">Chưa chắc</button><button type="button" data-stance="OPPOSE" aria-pressed="false">Phản đối</button></div><div class="gi-choice-actions"><button type="button" id="edit-statement">Sửa nhận định</button><button type="button" id="confirm-statement" class="primary">Gửi nhận định</button></div></dialog>`}`;
 }else if(g.phase==='BLIND_ACTION'){
 content=!me.isAlive?'<div class="note">Bạn đang quan sát, không thể thực hiện hành động.</div>':me.lockedAction?'<div class="note">Đã khóa quyết định bí mật: '+(me.lockedAction.invest?'đầu tư 1 xu':'không đầu tư')+' · '+(me.lockedAction.bankAction.type==='NONE'?'không dùng ngân hàng':me.lockedAction.bankAction.type==='INSPECT'?'kiểm chứng vai trò':'góp '+me.lockedAction.bankAction.amount+' xu trục xuất')+'. Đợi những người còn lại…</div>':`<form id="action-form"><label class="choice"><input type="checkbox" id="invest"> Đầu tư 1 xu vào dự án</label><label>Hành động ngân hàng<select id="bank"><option value="NONE">Không dùng ngân hàng</option><option value="INSPECT">Kiểm chứng vai trò (3 xu)</option><option value="EXPEL">Góp tiền trục xuất (1–5 xu)</option></select></label><div id="bank-details" class="hidden"><label>Mục tiêu<select id="target">${g.players.filter(p=>p.isAlive&&p.id!==me.id).map(p=>`<option value="${escapeHTML(p.id)}">${escapeHTML(s.room.players.find(x=>x.id===p.id)?.name||p.id)}</option>`).join('')}</select></label><label id="amount-row" class="hidden">Số xu góp trục xuất<select id="amount">${[1,2,3,4,5].map(n=>`<option value="${n}">${n} xu</option>`).join('')}</select></label></div><p id="action-cost" class="note" role="status"></p><button id="lock-action" type="submit" class="primary">Khóa lệnh bí mật</button></form>`;
 }else if(g.phase==='REVEAL'){
 content=`<div class="summary ${latest.alignment==='PROTECTOR'?'success':'danger'}"><b>${latest.approved?'DỰ ÁN ĐƯỢC THÔNG QUA':'DỰ ÁN KHÔNG ĐƯỢC THÔNG QUA'}</b><p>${latest.investorCount}/${latest.eligibleCount} người đầu tư · Cần ${latest.requiredVotes}</p><h2>${escapeHTML(latest.verdictLabel)}</h2><p>${escapeHTML(latest.explanation)}</p><p>${latest.newlyEliminatedIds.length?'Bị loại: '+latest.newlyEliminatedIds.map(id=>escapeHTML(s.room.players.find(x=>x.id===id)?.name||id)).join(', '):'Không có người bị loại lượt này.'}</p></div>${host?'<button id="next" class="primary">Sang lượt tiếp theo</button>':'<p class="muted">Đợi chủ phòng hoặc hết thời gian đọc…</p>'}`;
 }else{
 content=`<div class="summary"><b>KẾT THÚC VÁN</b><h2>${g.outcome?.winner==='DRAW'?'HÒA':labelRole(g.outcome?.winner)+' CHIẾN THẮNG'}</h2><p>Lý do: ${escapeHTML(outcomeText[g.outcome?.reason]||'Ván đã kết thúc')}</p><p>Dự án Bảo vệ thông qua: ${g.approvedProtectorCount} · Dự án Phá hoại thông qua: ${g.approvedSaboteurCount}</p><p>Vai trò được mở công khai trong danh sách người chơi.</p></div><button id="home">Về trang đầu</button>`;
 }
 const project = g.phase==='GAME_OVER'?latest?{id:latest.projectId,title:latest.projectTitle,description:'Các dự án đã hoàn thành. Xem lịch sử bên dưới.'}:g.project:g.project;
 const statements=(g.phase==='REVEAL'||g.phase==='GAME_OVER')?(latest?.statements||[]):g.currentStatements;
 const stanceLabel={SUPPORT:'Ủng hộ',OPPOSE:'Phản đối',UNSURE:'Chưa chắc chắn'};
 const discussion=statements.map(st=>{const name=s.room.players.find(p=>p.id===st.playerId)?.name||'Người chơi';return '<div class="gi-statement" data-player-id="'+escapeHTML(st.playerId)+'"><span class="gi-chat-avatar" aria-hidden="true">'+escapeHTML(name.charAt(0).toUpperCase())+'</span><div class="gi-chat-bubble"><b>'+escapeHTML(name)+'</b><span class="pill">'+escapeHTML(stanceLabel[st.stance]||'Nhận định')+'</span><p>'+escapeHTML(st.text)+'</p></div></div>';}).join('');
 app.innerHTML=`
 <div class="gi-mobile-topbar"><div class="gi-top-wallet"><img src="/brand/green-coin.png" alt="" width="24" height="24"><b>${me.coins}</b><span>xu</span></div><button id="mobile-show-role" type="button" aria-label="Nhấn giữ để xem vai trò" aria-describedby="mobile-role-value" aria-pressed="false"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M5 32c7-11 17-17 27-17s20 6 27 17c-7 11-17 17-27 17S12 43 5 32Z"/><circle cx="32" cy="32" r="10"/></svg></button><span id="mobile-role-value" role="status" data-role="${escapeHTML(me.role)}" hidden></span><span class="gi-round-chip">Lượt ${g.round} / ${g.roundLimit}</span></div>
 <div class="gi-game-grid" data-game-layout="four-areas">
  <header class="card gi-phase-header">
   <div class="gi-mobile-wallet"><img class="gi-coin-icon" src="/brand/green-coin.png" alt="" width="28" height="28"> ${me.coins} xu</div>
   <div class="flex"><span class="phase">${escapeHTML(phaseText[g.phase].toUpperCase())} · LƯỢT ${g.round}/${g.roundLimit}</span>${timer(s)}</div>
   ${g.phase!=='GAME_OVER'?'<progress id="phase-progress" max="'+phaseSeconds[g.phase]+'" value="'+remainingMilliseconds()/1000+'" aria-label="Thời gian còn lại"></progress>':''}
   <div class="flex muted"><span>Bảo vệ: ${g.approvedProtectorCount}</span><span>Phá hoại: ${g.approvedSaboteurCount}</span></div>
  </header>
  <aside class="card gi-area-players" id="players-panel" data-open="${peopleOpen}" aria-label="Danh sách người chơi">
   <div class="flex"><h2>Hội đồng · ${s.room.players.length}${s.room.maxPlayers?' / '+s.room.maxPlayers:''}</h2><button type="button" class="gi-close-players" id="close-players" aria-label="Đóng danh sách">×</button></div>
   <div class="people" tabindex="0" role="region" aria-label="Danh sách thành viên">${playerList(s)}</div>
  </aside>
  <section class="card gi-area-project" aria-label="Dự án hiện tại">
   <span class="eyebrow">DỰ ÁN ĐANG ĐƯỢC ĐƯA RA</span>
   <section class="project"><small>HỒ SƠ ${escapeHTML(project.id)}</small><h2>${escapeHTML(project.title)}</h2><p>${escapeHTML(project.description)}</p></section>
  </section>
  <div class="gi-center-column">
  <section class="gi-area-actions" aria-label="Hồ sơ và hành động cá nhân">
   <div class="card gi-profile-panel${me.inspections?.length?' gi-has-inspections':''}"><div class="flex"><h2>Hồ sơ cá nhân</h2><span class="coins"><img class="gi-coin-icon" src="/brand/green-coin.png" alt="" width="28" height="28"> ${me.coins}</span></div><p><b>${escapeHTML(me.name)}</b> · ${me.isAlive?'Còn trong ván':'Đã bị loại'}</p>
    <div id="role" class="note" data-role="${escapeHTML(me.role)}">Vai trò của bạn: <b id="role-value">••••••</b><button id="show-role" type="button" aria-label="Nhấn giữ để xem thẻ vai trò"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M5 32c7-11 17-17 27-17s20 6 27 17c-7 11-17 17-27 17S12 43 5 32Z"/><circle cx="32" cy="32" r="10"/></svg><span>Nhấn giữ để xem</span></button></div>
    ${me.inspections?.length?'<div class="rule"><h3>Kiểm chứng riêng</h3>'+me.inspections.map(x=>'<p class="tiny">Lượt '+x.round+': '+escapeHTML(s.room.players.find(p=>p.id===x.targetId)?.name)+' — '+escapeHTML(labelRole(x.revealedRole))+'</p>').join('')+'</div>':''}
   </div>
   <div class="card gi-action-panel"><div class="gi-desktop-wallet"><img src="/brand/green-coin.png" alt="" width="112" height="112"><strong>${me.coins} xu</strong></div><h2 data-phase="${g.phase}"${g.phase==='DEBATE'?' class="gi-discussion-title"':''}>${escapeHTML(phaseText[g.phase])}</h2>${content}</div>
  </section>
  <section class="gi-area-discussion" aria-label="Nhận định công khai">
   <div class="card"><h2>Nhận định trong phòng</h2><div class="hist">${discussion}</div></div>
   <details class="card gi-history"><summary>Nhật ký · ${g.history.length} lượt</summary><div class="hist">${g.history.map(h=>'<div>Lượt '+h.round+': '+escapeHTML(h.projectTitle)+' · '+(h.approved?'Thông qua':'Bác bỏ')+' · '+escapeHTML(h.verdictLabel)+'</div>').join('')||'<p class="tiny">Chưa có kết quả.</p>'}</div></details>
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
 const update=()=>{
  document.getElementById('bank-details').classList.toggle('hidden',bank.value==='NONE');
  document.getElementById('amount-row').classList.toggle('hidden',bank.value!=='EXPEL');
  const cost=(document.getElementById('invest').checked?1:0)+(bank.value==='INSPECT'?3:bank.value==='EXPEL'?Number(document.getElementById('amount').value):0);
  const available=snapshot.game.myPlayer.coins;
  document.getElementById('action-cost').textContent='Tổng chi: '+cost+' xu / Bạn có: '+available+' xu'+(cost>available?' — Không đủ xu':'');
  document.getElementById('lock-action').disabled=requesting||cost>available;
 };
 form.onchange=update;update();
}

async function act(type,payload){
 if(requesting)return false;
 requesting=true;
 const finishMotion=type==='submit'?window.GreenTrapMotion?.pending(app.querySelector('#statement button[type=submit],#lock-action')):null;
 let confirmed=false;
 try{await api('/api/action',{type,...(type==='kick'?{targetId:payload.targetId}:{payload}),...(['submit','next'].includes(type)?{context:{gameId:snapshot.game.gameId,round:snapshot.game.round,phase:snapshot.game.phase}}:{})},true);if(type!=='leave')await readState();confirmed=true;return true;}
 catch(e){handleSessionError(e);return false;}
 finally{finishMotion?.(confirmed);requesting=false;wireBank();}
}
function updateStatementCounter(){const field=document.getElementById('statement-text'),counter=document.getElementById('statement-counter');if(field&&counter)counter.textContent=field.value.length+' / 500';}
function openStatementChoice(){const dialog=document.getElementById('statement-choice'),stance=document.getElementById('stance');if(!dialog||!stance||dialog.open)return;dialog.querySelectorAll('[data-stance]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.stance===stance.value)));dialog.showModal();dialog.querySelector('[aria-pressed="true"]')?.focus();}
app.addEventListener('input',e=>{if(e.target.id==='statement-text'){persistStatementDraft();updateStatementCounter();}});
app.addEventListener('click',e=>{
 const button=e.target.closest('[data-kick-player]');if(!button||requesting)return;
 const target=snapshot?.room.players.find(p=>p.id===button.dataset.kickPlayer);
 if(target&&confirm(`Kick ${target.name} khỏi phòng${snapshot?.game?' và loại khỏi ván hiện tại':' chờ'}?`))act('kick',{targetId:target.id});
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
 if(id==='copy')copyRoom();if(id==='start')act('start');if(id==='next')act('next');
 if(id==='leave')act('leave').then(ok=>{if(!ok)return;session=null;save();aborter?.abort();location.assign('/')});
 if(id==='home'||id==='return-home'){session=null;save();clearStatementDraft();aborter?.abort();location.assign('/')}
});
app.addEventListener('pointerdown',e=>{if(['show-role','mobile-show-role'].includes(e.target.closest('button')?.id))showRoleText();});
for(const ev of ['pointerup','pointercancel','pointerleave'])app.addEventListener(ev,e=>{if(['show-role','mobile-show-role'].includes(e.target.closest('button')?.id))hideRoleText();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(clock);clock=null;}else scheduleClock();});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(clock);clock=null;});
window.addEventListener('pageshow',scheduleClock);
function setDesktopRoleCard(hidden){const card=document.querySelector('#role .gi-private-role-card');if(card&&(hidden||matchMedia('(min-width:1200px)').matches))card.hidden=hidden;}
function showRoleText(){const node=document.getElementById('role-value'),mobile=document.getElementById('mobile-role-value');if(node)node.textContent=labelRole(snapshot.game.myPlayer.role);setDesktopRoleCard(false);if(mobile){mobile.hidden=false;const card=mobile.querySelector('.gi-private-role-card');if(card)card.hidden=false;}document.getElementById('mobile-show-role')?.setAttribute('aria-pressed','true');}
function hideRoleText(){const node=document.getElementById('role-value'),mobile=document.getElementById('mobile-role-value');setDesktopRoleCard(true);if(node)node.textContent='••••••';if(mobile){mobile.hidden=true;const card=mobile.querySelector('.gi-private-role-card');if(card)card.hidden=true;}document.getElementById('mobile-show-role')?.setAttribute('aria-pressed','false');}
document.addEventListener('pointerup',hideRoleText,true);document.addEventListener('pointercancel',hideRoleText,true);window.addEventListener('blur',hideRoleText);
app.addEventListener('keydown',e=>{if(['show-role','mobile-show-role'].includes(e.target.id)&&(e.key===' '||e.key==='Enter')){e.preventDefault();showRoleText();}});
document.addEventListener('keydown',e=>{
 if(!peopleOpen||!matchMedia('(max-width:1199px)').matches)return;
 if(e.key==='Escape'){e.preventDefault();setPlayersOpen(false);return;}
  if(e.key==='Tab'){const panel=document.getElementById('players-panel');if(!panel){setPlayersOpen(false,false);return;}const items=Array.from(panel.querySelectorAll('button,[tabindex="0"]')).filter(el=>el.getClientRects().length);const first=items[0],last=items.at(-1);if(e.shiftKey&&(document.activeElement===first||!panel.contains(document.activeElement))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&(document.activeElement===last||!panel.contains(document.activeElement))){e.preventDefault();first?.focus();}}
});
matchMedia('(max-width:1199px)').addEventListener('change',()=>{if(peopleOpen)setPlayersOpen(false);});
app.addEventListener('keyup',hideRoleText);document.addEventListener('visibilitychange',()=>{if(document.hidden)hideRoleText();});
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
