const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DurableCoordinator } = require('../server/durable-coordinator.cjs');

test('mutations share one commit and wait for it', async () => {
  let state = 0, commits = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  const c = new DurableCoordinator({ batchMs: 0, capture: () => state, restore: x => { state = x; }, commit: () => { commits++; return gate; } });
  let done = false;
  const a = c.run(() => { state++; c.markChanged(); return state; }).then(x => { done = true; return x; });
  const b = c.run(() => { state++; c.markChanged(); return state; });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(commits, 1); assert.equal(done, false);
  release(); assert.deepEqual(await Promise.all([a,b]), [1,2]);
});

test('failed commit restores state and rejects reads in the batch', async () => {
  let state = 0, broadcasts = 0;
  const c = new DurableCoordinator({ batchMs: 0, capture: () => state, restore: x => { state = x; }, commit: async () => { throw new Error('offline'); }, onCommitted: () => { broadcasts++; } });
  const write = c.run(() => { state = 7; c.markChanged('room'); });
  const read = c.read(() => state);
  const results = await Promise.allSettled([write, read]);
  assert.deepEqual(results.map(x => x.status), ['rejected', 'rejected']);
  assert.equal(state, 0); assert.equal(broadcasts, 0);
  assert.equal(await c.read(() => state), 0);
});

test('work queued during a commit waits for the next batch', async () => {
  let state = 0, commits = 0, release, started;
  const gate = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { started = resolve; });
  const c = new DurableCoordinator({ batchMs: 0, capture: () => state, restore: x => { state = x; }, commit: async () => { if (++commits === 1) { started(); await gate; } } });
  const first = c.run(() => { state = 1; c.markChanged(); });
  await entered;
  const second = c.run(() => { state = 2; c.markChanged(); });
  const read = c.read(() => state);
  assert.equal(state, 1); release();
  await Promise.all([first, second]); assert.equal(await read, 2); assert.equal(commits, 2);
});

test('callback errors do not poison subsequent work', async () => {
  let state = 0, commits = 0;
  const c = new DurableCoordinator({ batchMs: 0, capture: () => state, restore: x => { state = x; }, commit: async () => { commits++; } });
  const failed = c.run(() => { throw new Error('invalid'); });
  const good = c.run(() => { state = 3; c.markChanged(); return state; });
  await assert.rejects(failed, /invalid/); assert.equal(await good, 3); assert.equal(commits, 1);
});

test('queue limit returns a safe typed error', async () => {
  const c = new DurableCoordinator({ batchMs: 100, maxPending: 1, capture: () => 0, restore: () => {}, commit: () => {} });
  const first = c.read(() => 1);
  await assert.rejects(c.read(() => 2), error => error.code === 'SERVER_BUSY' && error.message === 'Server is busy. Please try again.');
  assert.equal(await first, 1);
});

test('notification failure does not roll back a committed write', async () => {
  let state = 0, restores = 0;
  const c = new DurableCoordinator({ batchMs: 0, capture: () => state, restore: () => { restores++; }, commit: async () => {}, onCommitted: () => { throw new Error('notification failed'); } });
  await assert.rejects(c.run(() => { state = 1; c.markChanged('room'); }), /notification failed/);
  assert.equal(state, 1); assert.equal(restores, 0);
});
test('ambiguous remote commit failure closes subsequent reads and writes', async () => {
  let state = 0;
  const c = new DurableCoordinator({batchMs: 0, capture: () => state, restore: x => {state = x;}, commit: async () => {throw Error('timeout');}, failClosed: true});
  await assert.rejects(c.run(() => {state = 1; c.markChanged();}));
  assert.equal(state, 0);
  await assert.rejects(c.read(() => state), /unavailable/i);
  await assert.rejects(c.run(() => {state = 2; c.markChanged();}), /unavailable/i);
});
test('read-only batches verify ownership before serving and fail closed',async()=>{
 let checks=0,closed=0;
 const c=new DurableCoordinator({batchMs:0,failClosed:true,capture:()=>0,restore:()=>{},commit:()=>{},verify:async()=>{checks++;throw Error('fenced');},onUnavailable:()=>{closed++;}});
 await assert.rejects(c.read(()=>42));assert.equal(checks,1);assert.equal(closed,1);await assert.rejects(c.read(()=>42),/unavailable/i);
});
