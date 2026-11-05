'use strict';
(() => {
  const dialog=document.getElementById('rules-dialog');
  const close=document.getElementById('rules-close');
  const content=document.getElementById('rules-content');
  if(!dialog||!close||!content)return;
  let opener=null;
  document.addEventListener('click',event=>{
    const trigger=event.target.closest('[data-open-rules]');
    if(!trigger||dialog.open)return;
    opener=trigger;
    dialog.showModal();
    content.scrollTop=0;
    document.documentElement.classList.add('rules-showing');
  });
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape')event.stopPropagation();});
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const box=dialog.getBoundingClientRect();
    if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();
  });
  content.addEventListener('click',event=>{
    const link=event.target.closest('.rules-index a');
    if(!link)return;
    const heading=document.getElementById(link.hash.slice(1));
    if(!heading)return;
    event.preventDefault();
    heading.scrollIntoView({block:'start'});
    heading.focus({preventScroll:true});
  });
  dialog.addEventListener('close',()=>{
    document.documentElement.classList.remove('rules-showing');
    // Live room updates replace the lobby button while this dialog stays open.
    const candidates=[document.querySelector('[data-open-rules]'),opener,...document.querySelectorAll('#app button')];
    const target=candidates.find(node=>node?.isConnected&&!node.disabled&&node.getClientRects().length);
    target?.focus({preventScroll:true});
    opener=null;
  });
})();
