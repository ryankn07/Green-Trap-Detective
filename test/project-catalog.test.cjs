'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {selectProjectDeck}=require('../engine/dist/setup.js');
test('the original 25-card catalog is available to deck selection with original artwork',()=>{
 const projects=require('../engine/dist/data/projects.json');
 assert.equal(projects.length,25);
 assert.equal(new Set(projects.map(p=>p.id)).size,25);
 for(const p of projects){
  assert.ok(p.title&&p.description&&p.explanation);
  assert.ok(['PROTECTOR','SABOTEUR'].includes(p.alignment));
  assert.ok(fs.existsSync(path.join(__dirname,'../ui/cards',p.id+'.png')));
 }
 assert.equal(projects.find(p=>p.id==='PROJ_13').sourceHeadingNumber,14);
 assert.equal(projects.find(p=>p.id==='PROJ_14').sourceHeadingNumber,14);
 const chosen=selectProjectDeck(projects,10,()=>0);
 assert.equal(chosen.length,10);assert.equal(new Set(chosen).size,10);
 assert.ok(selectProjectDeck([...projects].reverse(),10,()=>0).some(id=>Number(id.slice(-2))>10));
});
