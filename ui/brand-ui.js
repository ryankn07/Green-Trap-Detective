/* Prefer exact-pixel WebP branding; keep the original PNG usable on failure. */
(function(){
  'use strict';
  function fallback(image){
    if(!(image instanceof HTMLImageElement))return;
    const picture=image.parentElement;
    if(!picture?.matches('picture.gi-brand-picture'))return;
    picture.querySelector('source[type="image/webp"]')?.remove();
  }
  document.addEventListener('error',event=>fallback(event.target),true);
  // A cached failed image can finish before this deferred script executes.
  for(const image of document.querySelectorAll('picture.gi-brand-picture img')){
    if(image.complete&&!image.naturalWidth)fallback(image);
  }
})();
