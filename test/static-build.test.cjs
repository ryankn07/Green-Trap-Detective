'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('Vercel build includes the shared client and HD cards but no private server state',()=>{
 const root=path.resolve(__dirname,'..'),output=path.join(root,'.web-dist');
 const result=spawnSync(process.execPath,[path.join(root,'scripts/build-web.cjs')],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 for(const file of ['index.html','app.js','style.css','card-ui.js','card-webp-manifest.js','ending.html','ending-ui.js','ending.css','endings/good.mp4','endings/bad.mp4','endings/good-poster.jpg','endings/bad-poster.jpg','brand/green-trap-detective.png','cards/GREENCOIN.png','cards-hd/PROJ_01.png','cards-hd/PROJ_25.png','cards-hd-webp/PROJ_01.webp','cards-hd-webp/PROJ_25.webp','cards-hd-webp/manifest.json'])assert.ok(fs.statSync(path.join(output,file)).isFile(),file);
 for(const name of ['server','data','test','.env','.git','cards-manifest.json','qr-code.js'])assert.equal(fs.existsSync(path.join(output,name)),false,name);
 assert.equal(fs.readFileSync(path.join(output,'app.js'),'utf8'),fs.readFileSync(path.join(root,'public/app.js'),'utf8'));
 for(const file of ['motion.js','motion.css'])assert.equal(fs.readFileSync(path.join(output,file),'utf8'),fs.readFileSync(path.join(root,'ui',file),'utf8'));
 const webpManifest=JSON.parse(fs.readFileSync(path.join(output,'cards-hd-webp/manifest.json'),'utf8'));
 assert.equal(webpManifest.assetCount,32);
 assert.equal(webpManifest.webpCount,32);
 for(const [id,asset] of Object.entries(webpManifest.assets)){
  assert.equal(asset.used,true,id+' has a smaller WebP derivative');
  assert.ok(fs.statSync(path.join(output,'cards-hd-webp',id+'.webp')).isFile(),id+' WebP is copied');
 }
 const browserManifest=fs.readFileSync(path.join(output,'card-webp-manifest.js'),'utf8');
 assert.match(browserManifest,/window\.GREEN_TRAP_WEBP_CARDS/);
 const home=fs.readFileSync(path.join(output,'index.html'),'utf8');
 for(const id of ['PROJ_01','PROJ_11','PROJ_25']){
  assert.ok(home.includes('href="/cards-hd/'+id+'.png"'),id+' homepage link opens the native HD artwork');
  assert.ok(home.includes('data-fallback-src="/cards/'+id+'.png"'),id+' homepage retains the original thumbnail fallback');
 }
 assert.match(home,/<source type="image\/webp" srcset="\/cards-hd-webp\/PROJ_01\.webp"><source type="image\/png" srcset="\/cards-hd\/PROJ_01\.png"><img src="\/cards-hd\/PROJ_01\.png"[^>]*fetchpriority="high"/,'front hero card keeps native HD priority');
 for(const id of ['PROJ_11','PROJ_25']){
  assert.match(home,new RegExp('<img src="\\/cards\\/'+id+'\\.png"[^>]*loading="lazy"[^>]*fetchpriority="low"'),id+' side hero card uses a lazy low-bandwidth thumbnail');
 }
 assert.match(home,/href="\/cards-hd\/PROJ_11\.png"[^>]*><picture[^>]*><source type="image\/webp" srcset="\/cards-hd-webp\/PROJ_11\.webp"><img src="\/cards\/PROJ_11\.png"/,'side hero uses WebP and retains the thumbnail fallback');
 assert.match(home,/href="\/cards-hd\/PROJ_25\.png"[^>]*><picture[^>]*><source type="image\/webp" srcset="\/cards-hd-webp\/PROJ_25\.webp"><img src="\/cards\/PROJ_25\.png"/,'side hero uses WebP and retains the thumbnail fallback');
 const cardUi=fs.readFileSync(path.join(output,'card-ui.js'),'utf8');
 assert.ok(cardUi.includes('cards(?:-hd)?'),'card preview accepts original and HD paths');
});
