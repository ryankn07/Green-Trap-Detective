'use strict';
const app=document.getElementById('app'), statusEl=document.getElementById('connection'),toast=document.getElementById('toast');
let session=null,snapshot=null,aborter=null,delay=750,clock=null,requesting=false,statementDraft=null;
const draftStorageKey='green-impact-statement-draft';
const storeKey='green-impact-multiplayer-session';
const escapeHTML=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labelRole=r=>r==='PROTECTOR'?'Người Bảo Vệ':r==='SABOTEUR'?'Người Phá Hoại':'Hòa';
const phaseText={DEBATE:'THẢO LUẬN',BLIND_ACTION:'HÀNH ĐỘNG BÍ MẬT',REVEAL:'CÔNG BỐ',GAME_OVER:'KẾT THÚC'};
const gameError=e=>{toast.textContent=e.message||'Đã xảy ra lỗi';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),4700)};
const save=()=>{if(session)sessionStorage.setItem(storeKey,JSON.stringify(session));else sessionStorage.removeItem(storeKey)};
const statementDraftKey=(game,player)=>[game?.gameId||'',game?.round??'',player?.id||''].join(':');
function persistStatementDraft(){
 if(!snapshot?.game||snapshot.game.phase!=='DEBATE')return;
 const field=app.querySelector('#statement-text');if(!field)return;
 const player=snapshot.game.myPlayer;
 const draft={key:statementDraftKey(snapshot.game,player),text:field.value,stance:document.getElementById('stance')?.value||'UNSURE',selectionStart:field.selectionStart,selectionEnd:field.selectionEnd,focused:document.activeElement===field};
 statementDraft=draft;try{sessionStorage.setItem(draftStorageKey,JSON.stringify(draft));}catch{}
}
function captureStatementDraft(){persistStatementDraft();}
function restoreStatementDraft(game,player){
 const key=statementDraftKey(game,player);let draft=statementDraft;
 if(!draft||draft.key!==key){try{draft=JSON.parse(sessionStorage.getItem(draftStorageKey)||'null');}catch{draft=null;}}
 if(!draft||draft.key!==key)return;
 const field=app.querySelector('#statement-text');if(!field)return;
 field.value=String(draft.text||'');
 const stance=document.getElementById('stance');if(stance)stance.value=draft.stance||'UNSURE';
 statementDraft=draft;
 if(draft.focused){field.focus({preventScroll:true});try{field.setSelectionRange(draft.selectionStart??field.value.length,draft.selectionEnd??field.value.length);}catch{}}
}
function clearStatementDraft(){statementDraft=null;try{sessionStorage.removeItem(draftStorageKey);}catch{}}
function recoverSession(error){
 if(!session)return;
 const expiredRoom=error.code==='ROOM_NOT_FOUND';
 aborter?.abort();session=null;snapshot=null;save();clearStatementDraft();
 try{const url=new URL(location.href);url.searchParams.delete('room');history.replaceState({},'',url.pathname+url.search+url.hash);}catch{}
 statusEl.textContent=expiredRoom?'Phòng không còn tồn tại':'Phiên chơi hết hạn';
 app.innerHTML=`<section class="card welcome"><span class="eyebrow">PHIÊN CHƠI KHÔNG CÒN KHẢ DỤNG</span><h1>${expiredRoom?'Phòng đã kết thúc hoặc hết hạn':'Phiên chơi không còn hợp lệ'}.</h1><p>${expiredRoom?'Phòng này không còn trên máy chủ. Phòng có thể đã bị đóng hoặc hết thời gian lưu.':'Phiên xác thực đã hết hạn hoặc không còn hợp lệ.'} Bạn có thể quay về trang đầu để tạo phòng mới hoặc nhập mã phòng khác.</p><div class="actions"><button id="return-home" class="primary">Tạo hoặc tham gia phòng khác <span aria-hidden="true">→</span></button></div></section>`;
}
function handleSessionError(error){if(error?.code==='ROOM_NOT_FOUND'||error?.code==='UNAUTHORIZED'){recoverSession(error);return;}gameError(error);}
const api=async(path,data,authenticated=false)=>{const headers={'Content-Type':'application/json'};if(authenticated){headers.Authorization=`Bearer ${session.token}`;headers['x-room-code']=session.roomCode;}
 const r=await fetch(path,{method:'POST',headers,body:JSON.stringify(data)});const value=await r.json().catch(()=>({}));if(!r.ok){const error=Error(value.message||value.error||`HTTP ${r.status}`);error.code=value.error;error.status=r.status;throw error;}return value;};
const readState=async()=>{const r=await fetch(`/api/state?room=${session.roomCode}`,{headers:{Authorization:`Bearer ${session.token}`},cache:'no-store'});const value=await r.json().catch(()=>({}));if(!r.ok){const error=Error(value.message||value.error||'Không thể tải trạng thái phòng');error.code=value.error;error.status=r.status;throw error;}captureStatementDraft();snapshot=value;render();};
const copyRoom=async()=>{const url=`${location.origin}/?room=${session.roomCode}`;try{await navigator.clipboard.writeText(url);alert('Đã sao chép link mời: '+url);}catch{prompt('Sao chép link mời:',url)}};
function onSession(s) {session=s;save();app.innerHTML='';readState().catch(handleSessionError);connectStream();}
async function connectStream(){if(!session)return;aborter?.abort();aborter=new AbortController();const active=aborter;statusEl.textContent='Đang kết nối';try{
 const res=await fetch(`/api/stream?room=${session.roomCode}`,{signal:active.signal,headers:{Authorization:`Bearer ${session.token}`},cache:'no-store'});
 if(!res.ok){const value=await res.json().catch(()=>({}));const error=Error(value.message||value.error||'Mất kết nối tới phòng');error.code=value.error;error.status=res.status;throw error;}delay=750;statusEl.textContent='● Trực tuyến';
 let buffer='';const reader=res.body.getReader();const decoder=new TextDecoder();
 while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let i;
 while((i=buffer.indexOf('\n\n'))>=0){const part=buffer.slice(0,i).replace(/\r/g,'');buffer=buffer.slice(i+2);const event=part.match(/^event: (.+)$/m)?.[1];const data=part.match(/^data: (.+)$/m)?.[1];if(event==='snapshot'&&data){captureStatementDraft();snapshot=JSON.parse(data);render();}if(event==='superseded'){statusEl.textContent='Đã mở ở thiết bị khác';active.abort();return;}}}
 }catch(e){if(!active.signal.aborted){if(e.code==='ROOM_NOT_FOUND'||e.code==='UNAUTHORIZED'){recoverSession(e);return;}statusEl.textContent='● Mất kết nối';console.error(e);}}
 if(!active.signal.aborted&&session){statusEl.textContent='Đang kết nối lại';setTimeout(()=>{if(session&&aborter===active)connectStream()},delay);delay=Math.min(delay*1.8,9000);}
}
function playerList(s){return s.room.players.map(p=>{const g=s.game?.players.find(x=>x.id===p.id);let info=!g?'Trong phòng':g.isAlive?(g.hasLockedAction?'Đã khóa lệnh':g.hasStatement?'Đã phát biểu':'Đang chơi'):'Đã bị loại';if(g?.role&&s.game.phase==='GAME_OVER')info+=` · ${labelRole(g.role)}`;
 return `<div class="person ${g&&!g.isAlive?'dead':''}"><div class="avatar">${escapeHTML(p.name.charAt(0).toUpperCase())}</div><div class="person-info"><b>${escapeHTML(p.name)} ${p.id===s.room.hostId?'★':''} ${p.id===s.game?.myPlayer.id?'(Bạn)':''}</b><small>${escapeHTML(info)}</small></div><span class="pill">${p.online?'● Online':'○ Offline'}</span></div>`}).join('');}
function timer(s){if(!s.deadline)return '';const remain=Math.max(0,Math.ceil((s.deadline-Date.now())/1000));return `<span class="countdown" id="clock">${remain}s</span>`;}
function render(){if(!snapshot||!session)return;const s=snapshot;const me=s.game?.myPlayer;const host=s.room.hostId===(me?.id||session.playerId);const q=(new URLSearchParams(location.search)).get('room');
 if(!s.game){clearStatementDraft();app.innerHTML=`<section class="grid"><div class="column"><div class="card"><span class="eyebrow">PHÒNG CHỜ</span><h1>Phòng ${escapeHTML(s.room.code)}</h1><p>Mời bạn bè vào phòng trước khi bắt đầu ván.</p><div class="code mono">${escapeHTML(s.room.code)}</div><div class="actions"><button id="copy" class="primary">Sao chép link mời</button>${host?'<button id="start">Bắt đầu ván · 3–8 người</button>':'<span class="note">Đợi chủ phòng bắt đầu…</span>'}</div></div><div class="card"><h2>Người chơi (${s.room.players.length}/8)</h2><div class="people">${playerList(s)}</div></div></div><div class="column"><div class="card"><h2>Cách chơi</h2><p>Mỗi người được chia phe bí mật và nhận 2 xu. Thảo luận 10 dự án môi trường; đầu tư 1 xu hoặc giữ lại, dùng ngân hàng để kiểm chứng (3 xu) hoặc góp trục xuất (đủ 5 xu).</p><p>Mỗi thiết bị có phiên riêng, server giữ các đáp án và quyết định bí mật.</p><p class="tiny">Lời mời: ${escapeHTML(location.origin+'/?room='+s.room.code)}</p><button id="leave" >Rời phòng</button></div></div></section>`;return;}
 const g=s.game;const latest=g.history.at(-1);let content='';
 if(g.phase==='DEBATE'){
 content=`<p>Nêu một lý do về việc nên hoặc không nên triển khai dự án. Mọi ý kiến được công khai.</p>${!me.isAlive?'<p class="note">Bạn đã bị loại và đang theo dõi trận.</p>':g.players.find(p=>p.id===me.id)?.hasStatement?'<div class="note">Đã gửi ý kiến. Đợi các người chơi khác…</div>':`<form id="statement"><label>Quan điểm<select id="stance"><option value="UNSURE">Chưa chắc chắn</option><option value="SUPPORT">Ủng hộ</option><option value="OPPOSE">Phản đối</option></select></label><label>Lý do<textarea id="statement-text" maxlength="500" required placeholder="Ví dụ: dự án cần làm rõ tác động tới hệ sinh thái..."></textarea></label><button type="submit" class="primary">Gửi ý kiến công khai</button></form>`}`;
 }else if(g.phase==='BLIND_ACTION'){
 content=!me.isAlive?'<div class="note">Bạn đang quan sát, không thể thực hiện hành động.</div>':me.lockedAction?'<div class="note">Đã khóa quyết định bí mật. Đợi những người còn lại…</div>':`<p>Chọn kín; hành động của bạn không gửi sang các trình duyệt khác.</p><form id="action-form"><label class="choice"><input type="checkbox" id="invest"> Đầu tư 1 xu vào dự án</label><label>Hành động ngân hàng<select id="bank"><option value="NONE">Không dùng ngân hàng</option><option value="INSPECT">Kiểm chứng vai trò (3 xu)</option><option value="EXPEL">Góp tiền trục xuất (1–5 xu)</option></select></label><div id="bank-details" class="hidden"><label>Mục tiêu<select id="target">${g.players.filter(p=>p.isAlive&&p.id!==me.id).map(p=>`<option value="${escapeHTML(p.id)}">${escapeHTML(s.room.players.find(x=>x.id===p.id)?.name||p.id)}</option>`).join('')}</select></label><label id="amount-row" class="hidden">Số xu góp trục xuất<select id="amount">${[1,2,3,4,5].map(n=>`<option value="${n}">${n} xu</option>`).join('')}</select></label></div><button type="submit" class="primary">Khóa lệnh bí mật</button></form>`;
 }else if(g.phase==='REVEAL'){
 content=`<div class="summary ${latest.alignment==='PROTECTOR'?'success':'danger'}"><b>${latest.approved?'DỰ ÁN ĐƯỢC THÔNG QUA':'DỰ ÁN KHÔNG ĐƯỢC THÔNG QUA'}</b><p>${latest.investorCount}/${latest.eligibleCount} người đầu tư · Cần ${latest.requiredVotes}</p><h2>${escapeHTML(latest.verdictLabel)}</h2><p>${escapeHTML(latest.explanation)}</p><p>${latest.newlyEliminatedIds.length?'Bị loại: '+latest.newlyEliminatedIds.map(id=>escapeHTML(s.room.players.find(x=>x.id===id)?.name||id)).join(', '):'Không có người bị loại lượt này.'}</p></div>${host?'<button id="next" class="primary">Sang lượt tiếp theo</button>':'<p class="muted">Đợi chủ phòng hoặc hết thời gian đọc…</p>'}`;
 }else{
 content=`<div class="summary"><b>KẾT THÚC VÁN</b><h2>${g.outcome?.winner==='DRAW'?'HÒA':labelRole(g.outcome?.winner)+' CHIẾN THẮNG'}</h2><p>Lý do: ${escapeHTML(g.outcome?.reason)}</p><p>Dự án Bảo vệ thông qua: ${g.approvedProtectorCount} · Dự án Phá hoại thông qua: ${g.approvedSaboteurCount}</p><p>Vai trò được mở công khai trong danh sách người chơi.</p></div><button id="home">Về trang đầu</button>`;
 }
 const project = g.phase==='GAME_OVER'?latest?{id:latest.projectId,title:latest.projectTitle,description:'Các dự án đã hoàn thành. Xem lịch sử bên dưới.'}:g.project:g.project;
 app.innerHTML=`<div class="grid"><div class="column"><div class="card"><div class="flex"><span class="phase">${escapeHTML(phaseText[g.phase])} · LƯỢT ${g.round}/${g.roundLimit}</span>${timer(s)}</div><section class="project"><small>HỒ SƠ ${escapeHTML(project.id)}</small><h2>${escapeHTML(project.title)}</h2><p>${escapeHTML(project.description)}</p>${g.project.alignment?`<div class="rule"><b>ĐÁNH GIÁ: ${escapeHTML(g.project.verdictLabel)}</b></div>`:''}</section><div class="flex muted"><span>✓ Bảo vệ: ${g.approvedProtectorCount}</span><span>! Phá hoại: ${g.approvedSaboteurCount}</span></div><div class="rule"><h3>Thảo luận hiện tại</h3><div class="hist">${g.currentStatements.map(st=>`<div><b>${escapeHTML(s.room.players.find(p=>p.id===st.playerId)?.name||'Người chơi')}</b> · ${escapeHTML(st.stance||'')}: ${escapeHTML(st.text)}</div>`).join('')||'<p class="tiny">Chưa có ý kiến.</p>'}</div></div></div><div class="card"><h3>Nhật ký lượt</h3><div class="hist">${g.history.map(h=>`<div>Lượt ${h.round}: ${escapeHTML(h.projectTitle)} · ${h.approved?'Thông qua':'Bác bỏ'} · ${escapeHTML(h.verdictLabel)}</div>`).join('')||'<p class="tiny">Chưa có kết quả.</p>'}</div></div></div><div class="column"><div class="card"><div class="flex"><h2>Hồ sơ cá nhân</h2><span class="coins">◈ ${me.coins}</span></div><p><b>${escapeHTML(me.name)}</b> · ${me.isAlive?'Còn trong ván':'Đã bị loại'}</p><div id="role" class="note" data-role="${escapeHTML(me.role)}">Vai trò của bạn: <b id="role-value">••••••</b><button id="show-role" type="button">Nhấn giữ để xem</button></div>${me.inspections?.length?`<div class="rule"><h3>Kiểm chứng cá nhân</h3>${me.inspections.map(x=>`<p class="tiny">Lượt ${x.round}: ${escapeHTML(s.room.players.find(p=>p.id===x.targetId)?.name)} — ${escapeHTML(labelRole(x.revealedRole))}</p>`).join('')}</div>`:''}</div><div class="card"><h2>${escapeHTML(phaseText[g.phase])}</h2>${content}</div><div class="card"><h2>Hội đồng · ${s.room.players.length} người</h2><div class="people">${playerList(s)}</div></div></div></div>`;
 if(g.phase==='DEBATE'&&me.isAlive&&!g.players.find(p=>p.id===me.id)?.hasStatement)restoreStatementDraft(g,me);else clearStatementDraft();
 if(g.phase==='BLIND_ACTION')wireBank();
}
function wireBank(){const bank=document.getElementById('bank'),details=document.getElementById('bank-details'),amount=document.getElementById('amount-row');if(bank) bank.addEventListener('change',()=>{details.classList.toggle('hidden',bank.value==='NONE');amount.classList.toggle('hidden',bank.value!=='EXPEL');});}
async function act(type,payload){if(requesting)return;requesting=true;try{await api('/api/action',{type,payload},true);await readState();}catch(e){handleSessionError(e)}finally{requesting=false}}
app.addEventListener('input',e=>{if(e.target.id==='statement-text')persistStatementDraft();});
app.addEventListener('change',e=>{if(e.target.id==='stance')persistStatementDraft();});
app.addEventListener('submit',async e=>{if(e.target.id==='form-create'){e.preventDefault();try{onSession(await api('/api/create',{name:document.getElementById('create-name').value}));}catch(err){gameError(err)}}
 if(e.target.id==='form-join'){e.preventDefault();try{onSession(await api('/api/join',{roomCode:document.getElementById('join-code').value.trim().toUpperCase(),name:document.getElementById('join-name').value}));}catch(err){gameError(err)}}
 if(e.target.id==='statement'){e.preventDefault();act('submit',{text:document.getElementById('statement-text').value,stance:document.getElementById('stance').value});}
 if(e.target.id==='action-form'){e.preventDefault();const kind=document.getElementById('bank').value;const bankAction=kind==='NONE'?{type:'NONE'}:kind==='INSPECT'?{type:'INSPECT',targetId:document.getElementById('target').value}:{type:'EXPEL',targetId:document.getElementById('target').value,amount:Number(document.getElementById('amount').value)};act('submit',{action:{invest:document.getElementById('invest').checked,bankAction}});}
});
app.addEventListener('click',e=>{const id=e.target.id;if(id==='copy')copyRoom();if(id==='start')act('start');if(id==='next')act('next');if(id==='leave')act('leave').then(()=>{session=null;save();aborter?.abort();location.assign('/')});if(id==='home'||id==='return-home'){session=null;save();clearStatementDraft();aborter?.abort();location.assign('/')}});
app.addEventListener('pointerdown',e=>{if(e.target.id==='show-role'){const node=document.getElementById('role-value');if(node)node.textContent=labelRole(snapshot.game.myPlayer.role);}});
for(const ev of ['pointerup','pointercancel','pointerleave'])app.addEventListener(ev,e=>{if(e.target.id==='show-role'){const node=document.getElementById('role-value');if(node)node.textContent='••••••';}});
clock=setInterval(()=>{if(snapshot?.deadline){const el=document.getElementById('clock');if(el)el.textContent=Math.max(0,Math.ceil((snapshot.deadline-Date.now())/1000))+'s';}},300);
const saved=sessionStorage.getItem(storeKey);if(saved){try{session=JSON.parse(saved);onSession(session)}catch{session=null;save()}}
if(!session){const q=new URLSearchParams(location.search).get('room');if(q&&/^[A-Z2-9]{6}$/i.test(q)){document.getElementById('join-code').value=q.toUpperCase();}}
