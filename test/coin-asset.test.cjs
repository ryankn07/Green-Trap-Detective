'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {server}=require('../server/server.cjs');
let base;
test.before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
test('new transparent coin is served exactly and all wallet renderers use it',async()=>{
 const expected=fs.readFileSync(path.join(__dirname,'../ui/brand/green-coin.png'));
 const response=await fetch(base+'/brand/green-coin.png');
 assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
 assert.deepEqual(Buffer.from(await response.arrayBuffer()),expected);
 assert.equal(expected[25],6,'PNG must have an RGBA channel');
 const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 assert.equal((app.match(/src="\/brand\/green-coin.png"/g)||[]).length,3);
 assert.ok(!app.includes('◈ ${me.coins}'));
 for(const wrong of ['/brand/.env','/brand/green-coin.png/extra','/brand/other.png'])assert.equal((await fetch(base+wrong)).status,404);
});
