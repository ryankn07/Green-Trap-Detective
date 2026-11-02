'use strict';
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test'),assert=require('node:assert/strict');
const {server}=require('../server/server.cjs');
let base;
test.before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port});
test.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r))});
test('website uses the new identity and serves its transparent logo locally',async()=>{
 const page=await fetch(base+'/'),html=await page.text();
 assert.match(html,/<title>Green Trap Detective:/);
 assert.ok(!html.includes('Green Impact'));
 const logo=await fetch(base+'/brand/green-trap-detective.png');
 assert.equal(logo.status,200);
 assert.equal(logo.headers.get('content-type'),'image/png');
 const b=Buffer.from(await logo.arrayBuffer());
 assert.equal(b.subarray(1,4).toString(),'PNG');
 assert.equal(b[25],6,'logo must include a real alpha channel');
 assert.match(html,/src="\/brand\/green-trap-detective.png"/);
 assert.equal((await fetch(base+'/brand/.env')).status,404);
 assert.equal((await fetch(base+'/brand/%2e%2e%2fserver%2fserver.cjs')).status,404);
});

test('README banner is high-resolution vector artwork using the original logo and Green Coin',()=>{
 const root=path.join(__dirname,'..');
 const readme=fs.readFileSync(path.join(root,'README.md'),'utf8');
 const banner=fs.readFileSync(path.join(root,'docs/assets/brand-banner.svg'),'utf8');
 assert.match(readme,/docs\/assets\/brand-banner\.svg/);
 assert.doesNotMatch(readme,/docs\/assets\/brand-banner\.webp/);
 assert.match(banner,/width="2400" height="1350"/);
 const embedded=[...banner.matchAll(/href="data:image\/png;base64,([^"]+)"/g)].map(match=>Buffer.from(match[1],'base64'));
 assert.equal(embedded.length,2,'banner embeds the logo and Green Coin');
 assert.deepEqual(embedded[0],fs.readFileSync(path.join(root,'ui/brand/green-trap-detective.png')));
 assert.deepEqual(embedded[1],fs.readFileSync(path.join(root,'ui/cards/GREENCOIN.png')));
 assert.equal(fs.existsSync(path.join(root,'docs/assets/brand-banner.webp')),false,'old low-resolution banner is removed');
});
