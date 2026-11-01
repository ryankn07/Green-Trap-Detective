'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('Vercel build includes the shared client and HD cards but no private server state',()=>{
 const root=path.resolve(__dirname,'..'),output=path.join(root,'.web-dist');
 const result=spawnSync(process.execPath,[path.join(root,'scripts/build-web.cjs')],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 for(const file of ['index.html','app.js','style.css','card-ui.js','brand/green-trap-detective.png','cards/GREENCOIN.png','cards-hd/PROJ_01.png','cards-hd/PROJ_25.png'])assert.ok(fs.statSync(path.join(output,file)).isFile(),file);
 for(const name of ['server','data','test','.env','.git','cards-manifest.json'])assert.equal(fs.existsSync(path.join(output,name)),false,name);
 assert.equal(fs.readFileSync(path.join(output,'app.js'),'utf8'),fs.readFileSync(path.join(root,'public/app.js'),'utf8'));
});
