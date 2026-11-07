'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {server,manager}=require('../server/server.cjs');
let base;
test.before(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});

test('branding serves smaller verified derivatives and preserves the exact original files',async()=>{
 const directory=path.join(__dirname,'../ui/brand');
 const manifest=JSON.parse(fs.readFileSync(path.join(directory,'derivatives.json'),'utf8'));
 for(const [name,entry] of Object.entries(manifest.assets)){
  const png=fs.readFileSync(path.join(directory,name+'.png')),webp=fs.readFileSync(path.join(directory,name+'.webp'));
  assert.equal(createHash('sha256').update(png).digest('hex'),entry.sourceSha256);
  assert.equal(createHash('sha256').update(webp).digest('hex'),entry.webpSha256);
  assert.ok(webp.length<png.length);
  for(const [extension,bytes,type] of [['png',png,'image/png'],['webp',webp,'image/webp']]){
   const result=await fetch(base+'/brand/'+name+'.'+extension);
   assert.equal(result.headers.get('content-type'),type);assert.deepEqual(Buffer.from(await result.arrayBuffer()),bytes);
  }
 }
 const icon=await fetch(base+'/brand/favicon-32.png');assert.equal(icon.status,200);
 assert.ok((await icon.arrayBuffer()).byteLength<4096,'favicon must not download the full-size logo');
 for(const invalid of ['/brand/arbitrary.webp','/brand/derivatives.json','/brand/green-coin.webp/extra'])assert.equal((await fetch(base+invalid)).status,404);
});

test('browser branding downloads WebP first and recovers PNG on unavailable derivatives',{skip:!process.env.PLAYWRIGHT_MODULE_PATH},async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH);let browser;
 try{
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  for(const failing of [false,true]){
   const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),requested=[];
   page.on('request',request=>{if(request.url().includes('/brand/'))requested.push(new URL(request.url()).pathname);});
   if(failing)await page.route('**/brand/*.webp',route=>route.fulfill({status:404,body:'Missing derivative'}));
   await page.goto(base);await page.locator('.brand-logo').evaluate(image=>image.decode());
   assert.ok((await page.locator('.brand-logo').evaluate(image=>image.currentSrc)).endsWith(failing?'.png':'.webp'));
   const {room,player}=manager.create('Brand QA');for(const name of ['An','Bình'])manager.join(room.code,name);
   room.players.forEach(peer=>manager.connected(room,peer));manager.start(room,player);
   await page.addInitScript(session=>sessionStorage.setItem('green-impact-multiplayer-session',JSON.stringify(session)),{roomCode:room.code,playerId:player.id,token:player.secret});
   await page.reload();await page.locator('.gi-top-wallet img').evaluate(image=>image.decode());
   assert.ok((await page.locator('.gi-top-wallet img').evaluate(image=>image.currentSrc)).endsWith(failing?'.png':'.webp'));
   if(!failing){
    assert.equal(requested.includes('/brand/green-trap-detective.png'),false,'supported browsers do not preload the PNG fallback');
    assert.equal(requested.includes('/brand/green-coin.png'),false,'wallet must not double-download its coin');
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.close();
  }
 }finally{await browser?.close();}
});
