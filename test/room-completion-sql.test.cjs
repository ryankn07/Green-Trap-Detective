'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');

test('completion SQL preserves old clients, releases capacity, bounds delivery and enforces private CAS',
 {skip:!process.env.PGLITE_MODULE_PATH},async()=>{
 const {PGlite}=require(process.env.PGLITE_MODULE_PATH),db=new PGlite();
 try{
  await db.exec('create role anon; create role authenticated; create role service_role;');
  const migration=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8');
  await db.exec(migration('20261102_serverless_trial.sql'));
  const source='a'.repeat(64),scope='b'.repeat(64),hash='c'.repeat(64);
  const payload=(code,phase=null,modern=false)=>({version:1,rooms:[{code,admissionSource:source,players:[{id:'host',admissionSource:source}],state:phase?{phase}:null}],...(modern?{completionProtocol:1}:{})});
  const commit=async(code,version,value,operation='write',id=null)=>{
   const result=await db.query('select public.game_trial_commit($1,$2,$3,$4,$5,$6,$7,$8,$9) as result',[code,version,value,scope,id,hash,{ok:true},source,operation]);
   return result.rows[0].result;
  };
  const expiry=async code=>Number((await db.query('select extract(epoch from expires_at)*1000 as expiry from green_trap_trial.rooms where code=$1',[code])).rows[0].expiry);
  const codes=Array.from({length:10},(_,i)=>'AAAAA'+String.fromCharCode(65+i));
  for(const code of codes)assert.equal((await commit(code,0,payload(code),'create')).committed,true);
  assert.equal((await commit('BBBBBB',0,payload('BBBBBB'),'create')).error,'ADMISSION_LIMIT');
  await commit(codes[0],1,payload(codes[0],'GAME_OVER'));
  const legacyExpiry=await expiry(codes[0]);
  await db.exec(migration('20261103_release_finished_rooms.sql'));
  assert.equal(await expiry(codes[0]),legacyExpiry,'deploy must not shorten existing endings');
  assert.equal((await commit('BBBBBB',0,payload('BBBBBB'),'create')).committed,true,'ended rooms release capacity immediately');
  assert.deepEqual(await commit(codes[1],1,payload(codes[1],'GAME_OVER',true)),{committed:true});
  const endExpiry=await expiry(codes[1]);
  const now=Number((await db.query('select extract(epoch from clock_timestamp())*1000 as now')).rows[0].now);
  assert.ok(endExpiry-now>110000&&endExpiry-now<=120000);
  assert.equal((await commit(codes[1],2,payload(codes[1],'GAME_OVER',true))).committed,true);
  assert.equal(await expiry(codes[1]),endExpiry,'departure/presence writes cannot renew the ending');
  assert.equal((await commit(codes[1],2,payload(codes[1],'GAME_OVER',true))).conflict,true);
  assert.equal((await commit(codes[1],3,payload(codes[1]))).conflict,true,'terminal rooms cannot resurrect');
  const id=randomUUID(),deleted=await commit(codes[1],3,null,'write',id);
  assert.ok(deleted.receipt);
  assert.deepEqual(await commit(codes[1],3,null,'write',id),deleted,'last departure replays after row deletion');
  assert.equal((await db.query('select count(*)::int as count from green_trap_trial.rooms where code=$1',[codes[1]])).rows[0].count,0);
  await db.query("update green_trap_trial.rooms set expires_at=clock_timestamp()-interval '1 second' where code=$1",[codes[0]]);
  await db.query("select public.game_trial_limit($1,'state')",[source]);
  assert.equal((await db.query('select count(*)::int as count from green_trap_trial.rooms where code=$1',[codes[0]])).rows[0].count,0);
  for(const role of ['anon','authenticated','service_role']){
   const allowed=(await db.query("select has_function_privilege($1,'public.game_trial_commit(text,bigint,jsonb,text,uuid,text,jsonb,text,text)','EXECUTE') as allowed",[role])).rows[0].allowed;
   assert.equal(allowed,role==='service_role');
  }
  assert.equal((await db.query("select relrowsecurity from pg_class where oid='green_trap_trial.rooms'::regclass")).rows[0].relrowsecurity,true);
 }finally{await db.close();}
});
