'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');

test('ordered migrations combine private reads and quotas without repeating global cleanup',
 {skip:!process.env.PGLITE_MODULE_PATH},async()=>{
 const {PGlite}=require(process.env.PGLITE_MODULE_PATH),db=new PGlite();
 try{
  await db.exec('create role anon; create role authenticated; create role service_role;');
  const dir=path.join(__dirname,'../supabase/migrations');
  for(const file of fs.readdirSync(dir).filter(file=>file.endsWith('.sql')).sort())await db.exec(fs.readFileSync(path.join(dir,file),'utf8'));
  // Re-applying the additive migration must retain the cleanup checkpoint.
  const source='a'.repeat(64),scope='b'.repeat(64),otherScope='c'.repeat(64),id=randomUUID();
  const limited=async(scopeValue=scope,operation='state')=>(await db.query(
   'select public.game_trial_read_limited($1,$2,$3,$4,$5,$6) as result',
   ['AAAAAA',scopeValue,id,source,'api',operation])).rows[0].result;
  const payload={version:1,rooms:[{code:'AAAAAA',players:[{id:'host',secret:'private-secret'}],state:null}]};
  await db.query("insert into green_trap_trial.rooms values ('AAAAAA',1,$1,clock_timestamp()+interval '1 hour')",[payload]);
  await db.query('insert into green_trap_trial.receipts(scope,request_id,request_hash,response) values($1,$2,$3,$4)',[scope,id,'d'.repeat(64),{ok:true}]);
  const first=await limited();assert.equal(first.allowed,true);assert.deepEqual(first.record.payload,payload);assert.deepEqual(first.receipt.response,{ok:true});
  assert.equal((await limited(otherScope)).receipt,null,'another scope cannot read a private receipt');
  const bucket=Number((await db.query('select cleaned_minute from green_trap_trial.maintenance')).rows[0].cleaned_minute);
  // Cleanup has already run in this minute. Expired records remain physically
  // until the next cleaner, but room/receipt reads must reject them immediately.
  await db.query("insert into green_trap_trial.rooms values ('BBBBBB',1,$1,clock_timestamp()-interval '1 second')",[payload]);
  await db.query("update green_trap_trial.rooms set expires_at=clock_timestamp()-interval '1 second' where code='AAAAAA'");
  await db.query("update green_trap_trial.receipts set created_at=clock_timestamp()-interval '2 hours' where scope=$1",[scope]);
  const expired=await limited();assert.equal(expired.record,null);assert.equal(expired.receipt,null);
  assert.equal((await db.query('select count(*)::int as n from green_trap_trial.rooms')).rows[0].n,2,'idle polls do not repeat cleanup');
  const restoredPayload={...payload,rooms:[{...payload.rooms[0],code:'AAAAAA'}]};
  const replacement=(await db.query('select public.game_trial_commit($1,$2,$3,$4,$5,$6,$7,$8,$9) as result',
   ['AAAAAA',0,restoredPayload,scope,id,'f'.repeat(64),{replacement:true},source,'create'])).rows[0].result;
  assert.deepEqual(replacement.receipt.response,{replacement:true},'expired receipt and expired room key can be reused before global cleanup');
  assert.equal((await limited()).receipt.requestHash,'f'.repeat(64));
  assert.equal((await limited()).record.version,1);
  await db.exec(fs.readFileSync(path.join(dir,'20261106_poll_read_efficiency.sql'),'utf8'));
  assert.equal(Number((await db.query('select cleaned_minute from green_trap_trial.maintenance')).rows[0].cleaned_minute),bucket);
  await db.exec('update green_trap_trial.maintenance set cleaned_minute=-1');await limited();
  assert.equal((await db.query('select count(*)::int as n from green_trap_trial.rooms')).rows[0].n,1,'cleaner preserves renewed room');
  assert.equal((await db.query('select count(*)::int as n from green_trap_trial.receipts')).rows[0].n,1,'cleaner preserves renewed receipt');
  // Set counters at the exact thresholds so window timing cannot make a loop flaky.
  await db.query("update green_trap_trial.rate_buckets set hits=120 where source=$1 and operation='state'",[scope]);
  assert.deepEqual(await limited(),{allowed:false});
  await db.query("update green_trap_trial.rate_buckets set hits=3000 where source=$1 and operation='api'",[source]);
  assert.deepEqual(await limited(otherScope),{allowed:false});
  const fresh='e'.repeat(64);
  for(const [operation,max] of [['create',30],['join',180],['action',60]]){
   await db.query('insert into green_trap_trial.rate_buckets values($1,$2,floor(extract(epoch from clock_timestamp())/60),$3)',[fresh,operation,max]);
   assert.equal((await db.query('select public.game_trial_limit($1,$2) as result',[fresh,operation])).rows[0].result.allowed,false,'legacy quota '+operation);
  }
  for(const role of ['anon','authenticated','service_role']){
   const allowed=(await db.query("select has_function_privilege($1,'public.game_trial_read_limited(text,text,uuid,text,text,text)','EXECUTE') as allowed",[role])).rows[0].allowed;
   assert.equal(allowed,role==='service_role');
  }
  for(const role of ['anon','authenticated']){
   assert.equal((await db.query("select has_table_privilege($1,'green_trap_trial.maintenance','SELECT') as allowed",[role])).rows[0].allowed,false);
   assert.equal((await db.query("select has_function_privilege($1,'green_trap_trial.prune_expired()','EXECUTE') as allowed",[role])).rows[0].allowed,false);
  }
  assert.equal((await db.query("select relrowsecurity from pg_class where oid='green_trap_trial.maintenance'::regclass")).rows[0].relrowsecurity,true);
 }finally{await db.close();}
});
