(function(root){
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const films={
    PROTECTOR:{key:'good',eyebrow:'GOOD ENDING',title:'Tương lai vẫn còn xanh.',winner:'Người Bảo Vệ chiến thắng',description:'Những lựa chọn hôm nay đã giữ lại một cơ hội cho ngày mai.',action:'Xem tương lai xanh',role:'PROTECTOR'},
    SABOTEUR:{key:'bad',eyebrow:'BAD ENDING',title:'Khi màu xanh chỉ còn là ký ức.',winner:'Người Phá Hoại chiến thắng',description:'Đằng sau những lời hứa xanh, một tương lai khác đang chờ đợi.',action:'Xem tương lai đã chọn',role:'SABOTEUR'}
  };
  const reasons={TEN_ROUNDS:'Đã hoàn thành 10 lượt',FACTION_ELIMINATED:'Một phe đã bị loại toàn bộ',MUTUAL_ELIMINATION:'Hai phe cùng bị loại'};
  const projectId=id=>/^PROJ_(?:0[1-9]|1\d|2[0-5])$/.test(id||'')?id:null;
  const drawIcons={
    scales:'M16 7v17m-6 1h12M5 12h22M8 12l-4 8h8l-4-8Zm16 0-4 8h8l-4-8ZM16 8c-4 0-6-2-6-5 3 0 5 1 6 5Zm0 0c0-4 2-6 6-6 0 3-2 6-6 6Z',
    protector:'M16 4c3 3 7 4 10 4v6c0 6-4 10-10 14C10 24 6 20 6 14V8c3 0 7-1 10-4Zm-5 17 9-9m-7 7c-1-5 3-7 8-7 0 5-3 8-8 7Z',
    saboteur:'m19 3-13 15h9l-2 11 13-16h-9l2-10Z',
    weather:'M4 23a12 12 0 0 1 24 0M16 11c-6 5-6 12 0 16m0-16c6 5 6 12 0 16M5 20h22M4 9h13c0-3-3-4-5-3-1-4-7-3-8 3Zm18-3h.01M22 2v1m4 3h1'
  };
  const drawIcon=name=>`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${drawIcons[name]}"/></svg>`;
  function disaster(){return `<div class="ending-disaster-glow"></div><svg class="ending-disaster-city" viewBox="0 0 1440 480" fill="none" focusable="false"><g class="disaster-smoke"><path d="M135 290c-48-46 23-60-8-98-42-51-98-26-92-79 4-38 57-33 46-66 66 23 77 57 54 82-27 29 30 37 25 77-3 27-5 55 20 84Z"/><path d="M1240 290c-43-42 8-62-24-91-57-53-6-58-32-87-27-30-19-65 14-81-1 44 58 36 50 87-7 45 56 37 32 94-10 25-7 48 6 78Z"/><path d="M1332 318c-30-26 17-51-4-79-39-53-80-54-53-104 26 33 65 24 69 67 4 38 45 55 14 116Z"/></g><g class="disaster-silhouette"><path d="M0 480V329h40V276h58v71h38V236h56v56h29V184l30-12 18 21v110h37V266h55v84h39v130ZM1070 480V348h38V266h55v57h33V187l18-20 25 12v119h37V225h62v96h32v-43h44v62h26v140Z"/><path d="m79 277 4-80 26-4-1 84m113-93 3-52 18 8 14-8 13 9-2 51m931-5-2-60 19-10 11 11 16-8 3 63"/><path d="m317 480 11-121-8-17 10-11 9 27 16-42 6 4-16 57 19-19 5 6-27 29 3 87Zm732 0-4-87-29-29 5-6 23 18-19-58 7-3 17 42 8-31 7 3-6 35 13-21 6 5-18 34 10 98Z"/></g><g class="disaster-windows"><path d="M55 303h17m-17 22h17m78-61h23m-23 22h23m55-73h15m-15 22h15m64 58h20m-20 25h20m817-20h20m-20 24h20m74-103h13m-13 25h13m55 3h22m-22 25h22m-22 24h22m68 0h17"/></g><path class="disaster-horizon" d="M0 443c140-22 259 4 396 10m648 0c120-18 250-24 396-10"/></svg><svg class="ending-disaster-ground" viewBox="0 0 1440 300" fill="none" preserveAspectRatio="none" focusable="false"><path d="m0 61 130 39 73-31 52 70 126 9 46-55 75 29m-299-53 8-69m44 139-28 70 64 91m-64-91-102 7-61 49m317-117 58 70-31 82m31-82 106 27 45-63m922-121-103 39-88-31-52 70-126 9-46-55-75 29m299-53-8-69m-44 139 28 70-64 91m64-91 102 7 61 49m-317-117-58 70 31 82m-31-82-106 27-45-63"/></svg>`;}
  function renewalForest(){
    // Every crown, branch and root uses the same local origin and transform.
    const tree=(x,y,scale)=>`<g class="renewal-tree" transform="translate(${x} ${y}) scale(${scale})"><ellipse class="renewal-tree-shadow" cx="0" cy="2" rx="29" ry="5"/><path class="renewal-tree-trunk" d="M0 0v-137M0-66l-27-25M0-95l29-28"/><path class="renewal-tree-crown" d="M0-232c-22-20-58-7-62 21-31 0-43 32-24 52-14 29 11 53 37 49 21 23 45 13 56-2 25 18 55 1 56-19 30 0 45-30 26-54 9-26-16-52-44-43-10-22-33-21-45-4Z"/></g>`;
    const trees=tree(185,310,.96)+tree(60,334,.62);
    return `<svg class="ending-forest ending-forest-left" viewBox="0 0 300 350" fill="none" focusable="false">${trees}</svg><svg class="ending-forest ending-forest-right" viewBox="0 0 300 350" fill="none" focusable="false"><g transform="translate(300 0) scale(-1 1)">${trees}</g></svg>`;
  }
  function restoration(){return `<div class="ending-restoration"><div class="ending-sunlight"></div><svg class="ending-sun" viewBox="0 0 160 160" fill="none" focusable="false"><circle cx="80" cy="80" r="28"/><circle class="renewal-sun-ring" cx="80" cy="80" r="47"/><path d="M80 12v12m0 112v12M12 80h12m112 0h12M32 32l9 9m78 78 9 9M32 128l9-9m78-78 9-9"/></svg><svg class="ending-renewal-scene" viewBox="0 0 1440 540" fill="none" focusable="false"><path class="renewal-hill-far" d="M0 319c149-83 265-70 388 28s211 108 356 40 279-166 404-144 186 72 292 57v240H0Z"/><path class="renewal-hill-near" d="M0 410c152-57 261-34 374 9s264 65 421 34 358-90 645-27v114H0Z"/><path class="renewal-river" d="M746 372c-68 42-20 57 88 79s221 49 164 89H815c89-39 42-51-49-78s-112-54-32-90Z"/><path class="renewal-river-light" d="M739 381c-37 30-16 46 58 65m105 32c45 12 63 24 40 36"/><g class="renewal-birds"><path d="M265 111q18-14 36 0 18-14 36 0m722 21q13-12 26 0 13-12 26 0m-854 18q10-9 20 0 10-9 20 0"/></g><g class="renewal-clouds"><path d="M17 155h111m-74-14h34m1139 26h117m-74-14h32"/></g></svg>${renewalForest()}<svg class="ending-renewal-ground" viewBox="0 0 1440 260" fill="none" focusable="false"><g class="renewal-meadow"><path d="M0 260c75-60 111-73 187-57s140 22 207-1m1046 58c-75-60-111-73-187-57s-140 22-207-1M43 247c19-53 31-82 15-126m-1 65c-38 1-50-25-53-42 29-4 48 16 53 42Zm9 22c26-31 51-23 67-6-22 23-48 29-67 6ZM1397 247c-19-53-31-82-15-126m1 65c38 1 50-25 53-42-29-4-48 16-53 42Zm-9 22c-26-31-51-23-67-6 22 23 48 29 67 6Z"/></g><g class="renewal-ripples"><path d="M549 212c73-17 173-17 246 0m-213 17c62-11 123-11 184 0m-157 15c39-5 78-5 117 0"/></g></svg></div>`;}
  function atmosphere(kind){return '<div class="ending-atmosphere" aria-hidden="true"><div class="ending-halo"></div>'+Array.from({length:12},()=>'<span class="ending-particle"></span>').join('')+(kind==='bad'?disaster():kind==='good'?restoration():'<div class="ending-orbit"></div><svg class="ending-botanical" viewBox="0 0 320 560" fill="none"><path d="M35 560C196 430 69 214 278 8"/><path d="M94 470C3 443 10 366 35 333c76 14 99 73 59 137Zm20-116c20-87 111-106 163-79-26 77-99 114-163 79Zm37-102c-72-21-77-95-56-134 67 24 100 78 56 134Zm45-111c16-74 68-99 119-88-11 70-67 107-119 88Z"/></svg>')+'</div>';}
  function cinema(film){return `<div class="ending-cinema"><div class="ending-film-frame"><video id="ending-video" controls playsinline preload="metadata" poster="/endings/${film.key}-poster.jpg" aria-label="Video ${film.eyebrow}"><source src="/endings/${film.key}.mp4" type="video/mp4">Trình duyệt chưa hỗ trợ video.</video><button type="button" class="ending-play" id="ending-play"><span class="ending-play-icon" aria-hidden="true">▶</span><span>${film.action}</span></button></div><div class="ending-film-caption"><span>GREEN TRAP DETECTIVE</span><span>${film.eyebrow}</span></div><p id="ending-media-status" class="ending-media-status" role="status" hidden></p></div>`;}
  function homeControl(inGame){
    const text='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/></svg><span>Quay về trang chủ</span>';
    return '<div class="ending-home-wrap">'+(inGame?'<button id="home" type="button" class="primary ending-home">'+text+'</button>':'<a href="/" class="primary ending-home">'+text+'</a>')+'</div>';
  }
  function finalRound(s,draw){
    const last=s.game.history.at(-1);if(!last)return '';
    const names=last.newlyEliminatedIds.map(id=>escape(s.room.players.find(p=>p.id===id)?.name||'Người chơi')).join(', ');
    return `<details class="ending-details" open><summary>Công bố lượt cuối · ${last.round}</summary><div class="ending-last-result">${draw?`<div class="draw-reveal-art">${drawIcon('weather')}</div>`:''}<div class="ending-last-copy"><span class="ending-kicker">${last.approved?'DỰ ÁN ĐƯỢC THÔNG QUA':'DỰ ÁN KHÔNG ĐƯỢC THÔNG QUA'}</span><h3>${escape(last.projectTitle)}</h3><p>${last.investorCount}/${last.eligibleCount} người đầu tư · Cần ${last.requiredVotes}</p><strong class="gi-verdict" data-verdict="${escape(last.verdictLabel)}">${escape(last.verdictLabel)}</strong><p>${escape(last.explanation)}</p><p>${names?'Bị loại: '+names:'Không có người bị loại lượt này.'}</p></div></div></details>`;
  }
  function render(s,roster){
    const g=s.game,film=films[g.outcome?.winner];
    const title=film?.title||'Câu chuyện chưa ngã ngũ.',winner=film?.winner||'HÒA';
    const history=g.history.map(h=>`<li><span class="ending-history-round">${h.round}</span><div><b>${escape(h.projectTitle)}</b><span><span class="gi-verdict" data-verdict="${escape(h.verdictLabel)}">${escape(h.verdictLabel)}</span> · ${h.approved?'Thông qua':'Không thông qua'}</span></div></li>`).join('');
    const draw=!film;
    const header=`<header class="ending-header"><span class="phase ending-kicker">KẾT THÚC · LƯỢT ${g.round}/${g.roundLimit}</span></header>`;
    const badge=draw?`<div class="draw-emblem">${drawIcon('scales')}<span class="ending-winner">${winner}</span></div>`:`<span class="ending-winner">${winner}</span>`;
    const intro=`<div class="ending-intro gi-action-panel">${badge}<h1 id="ending-title" tabindex="-1">${title}</h1><p>${film?.description||'Hai phe khép lại ván chơi với kết quả hòa. Không có Good Ending hoặc Bad Ending được chọn cho ván này.'}</p><span class="ending-reason">${escape(reasons[g.outcome?.reason]||'Ván đã kết thúc')}</span></div>`;
    const score=(label,count,icon)=>draw
      ?`<div class="draw-score"><span class="draw-score-icon">${drawIcon(icon)}</span><strong>${count}</strong><span><b>${label}</b><span>dự án thông qua</span></span></div>`
      :`<div><span>${label}</span><strong>${count}</strong><span>dự án thông qua</span></div>`;
    const scores=`<div class="ending-scoreboard" aria-label="Số dự án đã được thông qua">${score('Bảo vệ',g.approvedProtectorCount,'protector')}${draw?'':'<span class="ending-score-divider" aria-hidden="true">/</span>'}${score('Phá hoại',g.approvedSaboteurCount,'saboteur')}</div>`;
    const hero=draw?`<div class="draw-result-panel">${header}${intro}${scores}${homeControl(true)}</div>`
      :`${header}${intro}${scores}<div class="ending-feature">${cinema(film)}</div>${homeControl(true)}`;
    return `<section class="gi-ending-screen ending-${film?.key||'draw'}" data-ending="${film?.key||'draw'}" aria-labelledby="ending-title">${atmosphere(film?.key)}<div class="ending-content">${hero}<div class="ending-records">${finalRound(s,draw)}<details class="ending-details"><summary>Nhật ký · ${g.history.length} lượt</summary><ol class="ending-history">${history||'<li>Chưa có lượt nào được quyết toán.</li>'}</ol></details><details class="ending-details"><summary>Vai trò đã được công bố · ${g.players.length} người</summary><div class="people ending-people" tabindex="0" role="region" aria-label="Vai trò người chơi">${roster}</div></details></div><footer class="ending-footer"><span>Mỗi lựa chọn đều để lại một dấu vết.</span></footer></div></section>`;
  }
  function enhance(container){
    const current=container.querySelector('.gi-ending-screen');
    if(current){
      document.body.dataset.ending=current.dataset.ending;
      const label=document.getElementById('ending-nav-label');
      if(label){label.textContent=current.dataset.ending==='good'?'GOOD ENDING':current.dataset.ending==='bad'?'BAD ENDING':'KẾT QUẢ HÒA';label.hidden=false;}
    }
    const video=container.querySelector('#ending-video'),play=container.querySelector('#ending-play'),status=container.querySelector('#ending-media-status');
    if(video&&play){
      const label=play.querySelector('span:last-child'),originalLabel=label.textContent;
      let failed=false;
      function mediaFailed(){
        failed=true;status.hidden=false;status.textContent='Không tải được video. Bấm Thử lại video để tải lại.';
        play.hidden=false;label.textContent='Thử lại video';
      }
      play.addEventListener('click',()=>{
        if(failed){failed=false;status.hidden=true;label.textContent=originalLabel;video.load();}
        video.play().catch(error=>{
          if(error.name==='AbortError'||failed)return;
          mediaFailed();
        });
      });
      video.addEventListener('play',()=>{if(!failed){play.hidden=true;status.hidden=true;}});
      video.addEventListener('ended',()=>{play.hidden=false;});
      // A failed child <source> emits a non-bubbling error before video.error
      // is populated. Capture it too, so both network and decode errors recover.
      video.addEventListener('error',mediaFailed,true);
    }
    const reduced=root.matchMedia('(prefers-reduced-motion: reduce)');
    if(!reduced.matches&&root.IntersectionObserver){
      const screen=container.querySelector('.gi-ending-screen');
      if(screen){const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){screen.classList.add('ending-entered');observer.disconnect();}});observer.observe(screen);}
    }
  }
  function standalone(){
    const target=document.getElementById('ending-page');if(!target)return;
    const params=new URLSearchParams(location.search),film=Object.values(films).find(item=>item.key===params.get('ending'));
    if(!film){target.innerHTML='<section class="card welcome"><h1>Chưa chọn ending.</h1><p>Hãy mở liên kết ở màn kết thúc ván chơi để xem video.</p><a href="/">Về trang đầu ↗</a></section>';return;}
    const id=projectId(params.get('project'));
    document.title=film.eyebrow+' · Green Trap Detective';
    target.innerHTML=`<section class="gi-ending-screen ending-${film.key} ending-viewer" data-ending="${film.key}" aria-labelledby="ending-title">${atmosphere(film?.key)}<div class="ending-content"><div class="ending-intro"><span class="ending-winner">${film.winner}</span><h1 id="ending-title">${film.title}</h1><p>${film.description}</p></div>${cinema(film)}${homeControl(false)}${id?`<figure class="ending-viewer-card"><img src="/cards-hd/${id}.png" alt="Thẻ dự án ${id}" width="1414" height="2000"><figcaption>Thẻ dự án dẫn đến ending · ${id}</figcaption></figure>`:''}<footer class="ending-footer"><span>Mỗi lựa chọn đều để lại một dấu vết.</span></footer></div></section>`;
    enhance(target);
  }
  const api={render,enhance};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else{root.GreenTrapEnding=api;standalone();}
})(typeof window==='undefined'?globalThis:window);
