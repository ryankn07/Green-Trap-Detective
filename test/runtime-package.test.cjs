'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {extractExpectedFiles}=require('../scripts/restore-runtime-bundle.cjs');
test('legacy Render extraction cannot replace the client or catalog with stale bundled content',()=>{
 const root=path.resolve(__dirname,'..');
 const encoded=[1,2,3].map(i=>fs.readFileSync(path.join(root,'runtime','compatibility','part0'+i+'.b64'),'ascii').trim()).join('');
 const files=extractExpectedFiles(zlib.gunzipSync(Buffer.from(encoded,'base64')));
 for(const [name,data] of files){assert.equal(data.toString('utf8').replace(/\r\n/g,'\n'),fs.readFileSync(path.join(root,name),'utf8').replace(/\r\n/g,'\n'),name+' is stale; run npm run bundle:pack');}
});
