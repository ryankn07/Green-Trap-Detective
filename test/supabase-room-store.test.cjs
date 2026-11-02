'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SupabaseRoomStore } = require('../server/supabase-room-store.cjs');
test('trial RPCs use server-only auth, typed rate errors and a shared invocation deadline', async () => {
  const calls = [];
  const store = new SupabaseRoomStore({ url: 'https://database.invalid', key: 'test-key-not-a-secret', budgetMs: 50, fetch: async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    assert.equal(options.headers.Authorization, 'Bearer test-key-not-a-secret');
    return { ok: true, json: async () => url.endsWith('_limit') ? { allowed: false } : { record: null, now: 123 } };
  } });
  await assert.rejects(store.limit('a'.repeat(64), 'create'), error => error.code === 'RATE_LIMITED' && error.status === 429);
  assert.equal((await store.read(null, null, null)).now, 123);
  assert.ok(calls.every(call => call.url.startsWith('https://database.invalid/rest/v1/rpc/game_trial_')));
  await new Promise(resolve => setTimeout(resolve, 60));
  await assert.rejects(store.read(null, null, null), error => error.name === 'TimeoutError');
  assert.equal(calls.length, 2, 'expired invocation must not start another database call');
});
