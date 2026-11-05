'use strict';
(() => {
  const trigger=document.getElementById('tutorial-open');
  const dialog=document.getElementById('tutorial-dialog');
  const close=document.getElementById('tutorial-close');
  const video=document.getElementById('tutorial-video');
  const error=document.getElementById('tutorial-error');
  const retry=document.getElementById('tutorial-retry');
  const navigation=document.getElementById('tutorial-navigation');
  const chapterList=document.getElementById('tutorial-chapters');
  const timeline=dialog?.querySelector('.tutorial-timeline');
  const progress=document.getElementById('tutorial-progress');
  const contextLabel=document.getElementById('tutorial-context');
  const modeButton=document.getElementById('tutorial-mode');
  if(!trigger||!dialog||!close||!video||!error||!retry||!navigation||!chapterList||!timeline||!progress||!contextLabel||!modeButton)return;
  // Source timestamps of the approved 4815cfd5 film, before playback-speed adjustment.
  const duration=177.657;
  const chapters=[
    ['intro',0,'Mở đầu'],['room',4.2,'Vào phòng'],['roles',15.161,'Vai trò'],['flow',27.724,'Một lượt chơi'],
    ['debate',37.13,'Thảo luận'],['skip',48.424,'Skip thảo luận'],['invest',57.478,'Bình chọn / đầu tư'],
    ['consensus',68.485,'Đủ người chốt'],['coins',79.02,'Cách tính xu'],['inspect',92.203,'Kiểm chứng'],
    ['expel',106.203,'Trục xuất'],['host-afk',123.203,'Kick người AFK'],['survive',137.21,'Khi bị loại'],
    ['reveal',146.597,'Công bố'],['win',155.29,'Thắng / thua'],['outro',170.233,'Sẵn sàng chơi']
  ];
  const sections={
    DEBATE:{start:37.13,end:57.478,label:'Thảo luận',next:'bình chọn'},
    BLIND_ACTION:{start:57.478,end:68.485,label:'Bình chọn / đầu tư',next:'công bố'},
    REVEAL:{start:146.597,end:155.29,label:'Công bố',next:'lượt tiếp theo'},
    GAME_OVER:{start:155.29,end:duration,label:'Kết thúc ván',next:null}
  };
  let live=null,following=false,section=null,waiting=false,resumeAfterBoundary=false,pendingSeek=null,frame=0,activeChapter=null,opener=trigger;
  const formatTime=time=>Math.floor(time/60)+':'+String(Math.floor(time%60)).padStart(2,'0');
  for(const [id,start,label] of chapters){
    const button=document.createElement('button');button.type='button';button.dataset.tutorialChapter=id;
    const time=document.createElement('span');time.className='tutorial-chapter-time';time.textContent=formatTime(start);
    const title=document.createElement('span');title.textContent=label;button.append(time,title);
    button.setAttribute('aria-label',label+' · '+formatTime(start));chapterList.append(button);
    const marker=document.createElement('i');marker.style.left=(start/duration*100)+'%';marker.dataset.chapterMarker=id;timeline.append(marker);
  }
  const heading=dialog.querySelector('.tutorial-heading');
  function fitDialog(){
    if(!dialog.open)return;
    const chrome=(heading?.getBoundingClientRect().height||84)+navigation.getBoundingClientRect().height+(error.hidden?0:error.getBoundingClientRect().height);
    dialog.style.setProperty('--tutorial-chrome',Math.ceil(chrome+3)+'px');
  }
  const sizeObserver=new ResizeObserver(fitDialog);
  if(heading)sizeObserver.observe(heading);
  sizeObserver.observe(navigation);
  sizeObserver.observe(error);

  function updateContext(){
    modeButton.hidden=!live?.section;
    modeButton.textContent=following?'Xem toàn bộ video':'Theo giai đoạn hiện tại';
    dialog.dataset.tutorialFollowing=String(following);
    dialog.dataset.tutorialWaiting=String(waiting);
    if(following&&section){
      contextLabel.textContent=waiting?(section.next?'Đã xem xong '+section.label.toLowerCase()+' · Chờ '+section.next+'.':'Đã xem xong hướng dẫn kết thúc ván.'):'Đang xem: '+section.label+' · '+formatTime(section.start)+'–'+formatTime(section.end);
    }else contextLabel.textContent='Xem tự do · Chọn mốc để tua nhanh.';
    fitDialog();
  }
  function updateProgress(){
    const time=video.currentTime||0;
    progress.style.width=Math.min(100,time/duration*100)+'%';
    const chapter=chapters.findLast(([,start])=>time>=start-.015)||chapters[0];
    if(activeChapter===chapter[0])return;
    activeChapter=chapter[0];
    for(const button of chapterList.children){
      if(button.dataset.tutorialChapter===activeChapter){
        button.setAttribute('aria-current','true');
        if(dialog.open)chapterList.scrollLeft=Math.max(0,button.offsetLeft-chapterList.clientWidth/2+button.offsetWidth/2);
      }else button.removeAttribute('aria-current');
    }
    for(const marker of timeline.querySelectorAll('i'))marker.classList.toggle('is-current',marker.dataset.chapterMarker===activeChapter);
  }
  function seek(time){
    pendingSeek=video.readyState<1?time:null;
    try{video.currentTime=time;}catch{pendingSeek=time;}
    updateProgress();
  }
  function play(){
    if(!dialog.open||document.hidden)return;
    const playing=video.play();
    playing?.catch(()=>{if(dialog.open&&following&&!waiting)contextLabel.textContent='Đã đến đoạn '+section.label.toLowerCase()+' · Bấm phát để xem.';});
  }
  function followCurrent(shouldPlay){
    if(!live?.section)return;
    following=true;section=live.section;waiting=false;resumeAfterBoundary=false;
    seek(section.start);updateContext();if(shouldPlay)play();
  }
  function freePlayback(){following=false;section=null;waiting=false;resumeAfterBoundary=false;updateContext();}
  function receive(value){
    const next=value?.game&&sections[value.game.phase]?{key:JSON.stringify([value.room.code,value.game.gameId,value.game.round,value.game.phase]),section:sections[value.game.phase]}:null;
    if(live?.key===next?.key)return;
    live=next;
    if(dialog.open&&following){
      const continuePlaying=!video.paused||(waiting&&resumeAfterBoundary);
      if(live)followCurrent(continuePlaying);
      else{video.pause();freePlayback();}
    }else updateContext();
  }
  function boundary(){
    if(!dialog.open||!following||!section||waiting||pendingSeek!==null)return;
    if(video.currentTime>=section.end-.08){
      resumeAfterBoundary=!video.paused;waiting=true;
      video.pause();seek(section.end-.05);updateContext();
    }
  }
  function tick(){frame=0;boundary();updateProgress();if(dialog.open&&!video.paused)frame=requestAnimationFrame(tick);}

  document.addEventListener('click',event=>{
    const source=event.target.closest('#tutorial-open,[data-tutorial-open]');if(!source)return;
    if(dialog.open)return;
    opener=source;
    // Keep media lazy. In-match opening is the user's explicit request to play this phase.
    if(!video.hasAttribute('src')){
      video.defaultPlaybackRate=1.25;
      video.playbackRate=1.25;
      video.poster='/tutorials/how-to-play-fast-poster.jpg?v=4815cfd5';
      video.src='/tutorials/how-to-play-fast.mp4?v=4815cfd5';
      video.preload='metadata';
      video.load();
    }
    dialog.showModal();
    document.documentElement.classList.add('tutorial-showing');
    if(live?.section)followCurrent(true);else{freePlayback();updateProgress();}
    fitDialog();
  });
  chapterList.addEventListener('click',event=>{
    const button=event.target.closest('[data-tutorial-chapter]');if(!button)return;
    const chapter=chapters.find(([id])=>id===button.dataset.tutorialChapter);if(!chapter)return;
    freePlayback();seek(chapter[1]);play();
  });
  modeButton.addEventListener('click',()=>{if(following){freePlayback();play();}else followCurrent(true);});
  video.addEventListener('play',()=>{
    if(waiting&&following){waiting=false;resumeAfterBoundary=false;seek(section.start);updateContext();}
    if(!frame)frame=requestAnimationFrame(tick);
  });
  video.addEventListener('pause',()=>{cancelAnimationFrame(frame);frame=0;if(!waiting)resumeAfterBoundary=false;});
  video.addEventListener('timeupdate',()=>{boundary();updateProgress();});
  video.addEventListener('seeking',()=>{
    // A deliberate native-controls seek outside this section switches to free viewing.
    if(pendingSeek===null&&following&&section&&(video.currentTime<section.start-.2||video.currentTime>section.end+.2))freePlayback();
    updateProgress();
  });
  video.addEventListener('seeked',()=>{boundary();updateProgress();});
  function closeGuide(){video.pause();dialog.close();}
  close.addEventListener('click',closeGuide);
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape')event.stopPropagation();});
  dialog.addEventListener('cancel',()=>video.pause());
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const box=dialog.getBoundingClientRect();
    if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeGuide();
  });
  dialog.addEventListener('close',()=>{
    video.pause();
    cancelAnimationFrame(frame);frame=0;following=false;section=null;waiting=false;resumeAfterBoundary=false;
    document.documentElement.classList.remove('tutorial-showing');
    const candidates=[opener,...document.querySelectorAll('[data-tutorial-open]'),trigger];
    candidates.find(node=>node?.isConnected&&node.getClientRects().length)?.focus({preventScroll:true});
  });
  video.addEventListener('error',()=>{error.hidden=false;});
  video.addEventListener('loadedmetadata',()=>{error.hidden=true;if(pendingSeek!==null){const time=pendingSeek;pendingSeek=null;seek(time);}updateProgress();fitDialog();});
  retry.addEventListener('click',()=>{error.hidden=true;if(following&&section){pendingSeek=section.start;waiting=false;resumeAfterBoundary=false;updateContext();}video.load();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){video.pause();resumeAfterBoundary=false;}});
  window.addEventListener('pagehide',()=>video.pause());
  window.GreenTrapTutorial={receive};
})();
