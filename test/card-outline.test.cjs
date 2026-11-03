'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('the card outline removes exported side bleed but retains the frame and white card interior',{skip:!process.env.PLAYWRIGHT_MODULE_PATH},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH),{server}=require('../server/server.cjs');let browser;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:800,height:1300}}),base='http://127.0.0.1:'+server.address().port;
  await page.setContent('<base href="'+base+'/"><link rel="stylesheet" href="/style.css"><div class="gi-card-preview"><span class="gi-card-image-viewport"><picture><source srcset="/cards-hd/PROJ_03.png"><img src="/cards/PROJ_03.png"></picture></span></div>');
  await page.locator('img').evaluate(img=>img.decode());
  const check=await page.locator('img').evaluate(img=>{
   const rect=img.getBoundingClientRect();
   const hit=(x,y)=>document.elementFromPoint(rect.x+x/img.naturalWidth*rect.width,rect.y+y/img.naturalHeight*rect.height)===img;
   return {leftBleed:hit(75,800),rightBleed:hit(1340,760),whiteInterior:hit(700,1500),greenBorder:hit(125,1000),illustration:hit(700,700)};
  });
  assert.equal(check.leftBleed,false,'the pale exported volcano illustration outside the left green frame is removed');
  assert.equal(check.rightBleed,false,'the exported right-side flap is removed');
  assert.equal(check.whiteInterior,true,'the white interior stays part of the card');
  assert.equal(check.greenBorder,true,'the outer green frame remains');
  assert.equal(check.illustration,true,'the project illustration remains');
  if(process.env.BROWSER_ARTIFACT_DIR){const fs=require('node:fs'),path=require('node:path');fs.mkdirSync(process.env.BROWSER_ARTIFACT_DIR,{recursive:true});await page.locator('.gi-card-preview').screenshot({path:path.join(process.env.BROWSER_ARTIFACT_DIR,'CARD_03_CLEAN_OUTLINE.png')});}
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
