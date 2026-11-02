'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { createServerlessHandler } = require('../server/serverless-game.cjs');

// External persistence seam: each invocation receives an independent copy.
class TestDatabase {
  constructor() { this.rooms = new Map(); this.receipts = new Map(); this.time = Date.now(); }
  async limit() {}
  async read(code, scope, requestId) {
    return structuredClone({ record: this.rooms.get(code) || null, receipt: this.receipts.get(scope + ':' + requestId) || null, now: this.time });
  }
  async commit({ code, expectedVersion, payload, scope, requestId, requestHash, response }) {
    const key = scope + ':' + requestId;
    if (this.receipts.has(key)) return { receipt: structuredClone(this.receipts.get(key)) };
    const old = this.rooms.get(code);
    if ((old?.version ?? 0) !== expectedVersion) return { conflict: true };
    if (payload) this.rooms.set(code, structuredClone({ version: expectedVersion + 1, payload }));
    else this.rooms.delete(code);
    if (!requestId) return { committed: true };
    const receipt = { requestHash, response };
    this.receipts.set(key, structuredClone(receipt));
    return { receipt };
  }
}
async function fixture(t) {
  const store = new TestDatabase();
  // Separate handlers emulate cold starts and different concurrent Functions.
  const servers = [0, 1].map(() => http.createServer(createServerlessHandler({ store })));
  for (const server of servers) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { for (const server of servers) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } });
  let count = 0;
  async function request(path, body, session) {
    const origin = 'http://127.0.0.1:' + servers[count++ % 2].address().port;
    const response = await fetch(origin + path, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}), ...(session ? { Authorization: 'Bearer ' + session.token, 'x-room-code': session.roomCode } : {}) }, body: body ? JSON.stringify({ requestId: randomUUID(), ...body }) : undefined });
    return { status: response.status, value: await response.json() };
  }
  return { store, request };
}
test('a room survives separate Function invocations and a concurrent join does not lose players', async t => {
  const { request } = await fixture(t);
  const created = await request('/api/create', { name: 'Chủ phòng' });
  assert.equal(created.status, 200);
  assert.equal(created.value.transport, 'poll');
  const host = created.value;
  const joined = await Promise.all(['An', 'Bình', 'Chi'].map(name => request('/api/join', { roomCode: host.roomCode, name })));
  assert.ok(joined.every(result => result.status === 200));
  const state = await request('/api/state?room=' + host.roomCode, null, host);
  assert.equal(state.status, 200);
  assert.deepEqual(state.value.room.players.map(p => p.name).sort(), ['An', 'Bình', 'Chi', 'Chủ phòng'].sort());
  assert.ok(!JSON.stringify(state.value).includes(host.token));
});
test('replaying a request does not add a second player and reusing its ID for another name is rejected', async t => {
  const { request } = await fixture(t);
  const host = (await request('/api/create', { name: 'Host' })).value;
  const command = { requestId: randomUUID(), roomCode: host.roomCode, name: 'Guest' };
  const [a, b] = await Promise.all([request('/api/join', command), request('/api/join', command)]);
  assert.equal(a.status, 200); assert.deepEqual(a, b);
  assert.equal((await request('/api/join', { ...command, name: 'Different' })).status, 409);
  assert.equal((await request('/api/state?room=' + host.roomCode, null, host)).value.room.players.length, 2);
});
test('private roles, kicks, stale turns and retrying a host next action work across cold invocations', async t => {
  const { request, store } = await fixture(t);
  const host = (await request('/api/create', { name: 'Host' })).value;
  const guests = [];
  for (const name of ['One', 'Two', 'Three']) guests.push((await request('/api/join', { roomCode: host.roomCode, name })).value);
  assert.equal((await request('/api/action', { type: 'start' }, guests[0])).status, 400);
  assert.equal((await request('/api/action', { type: 'start' }, host)).status, 200);
  const get = async session => (await request('/api/state?room=' + host.roomCode, null, session)).value;
  let state = await get(host);
  assert.equal(state.transport, 'poll', 'existing browser sessions can discover the serverless transport');
  assert.equal(state.game.phase, 'DEBATE');
  assert.ok(state.game.myPlayer.role);
  assert.ok(state.game.players.every(player => !Object.hasOwn(player, 'role') && !Object.hasOwn(player, 'coins')));
  assert.equal((await request('/api/state?room=' + host.roomCode, null, { ...host, token: '0'.repeat(64) })).status, 401);
  store.time = state.deadline + 1;
  state = await get(host); assert.equal(state.game.phase, 'BLIND_ACTION');
  store.time = state.deadline + 1;
  state = await get(host); assert.equal(state.game.phase, 'REVEAL');
  const context = { gameId: state.game.gameId, round: state.game.round, phase: state.game.phase };
  const next = { requestId: randomUUID(), type: 'next', context };
  const raced = await Promise.all([request('/api/action', next, host), request('/api/action', next, host)]);
  assert.ok(raced.every(result => result.status === 200));
  assert.equal((await get(host)).game.round, 2);
  assert.equal((await request('/api/action', { ...next, requestId: randomUUID() }, host)).status, 409);
  assert.equal((await request('/api/action', { type: 'kick', targetId: guests[2].playerId }, host)).status, 200);
  assert.equal((await request('/api/state?room=' + host.roomCode, null, guests[2])).status, 401);
});
test('expired deadlines catch up without a background process, and dead sessions cannot start a game', async t => {
  const { request, store } = await fixture(t);
  const host = (await request('/api/create', { name: 'Host' })).value;
  for (const name of ['One', 'Two']) await request('/api/join', { roomCode: host.roomCode, name });
  store.time += 46000;
  assert.equal((await request('/api/action', { type: 'start' }, host)).value.error, 'PLAYERS_OFFLINE');
});
test('an expired peer presence changes the public revision while the viewer keeps polling', async t => {
  const { request, store } = await fixture(t);
  const host = (await request('/api/create', { name: 'Host' })).value;
  const guest = (await request('/api/join', { roomCode: host.roomCode, name: 'Guest' })).value;
  const initial = (await request('/api/state?room=' + host.roomCode, null, host)).value;
  store.time += 30000;
  await request('/api/state?room=' + host.roomCode, null, host);
  store.time += 16000;
  const current = (await request('/api/state?room=' + host.roomCode, null, host)).value;
  assert.equal(current.room.players.find(player => player.id === guest.playerId).online, false);
  assert.ok(current.room.revision > initial.room.revision, 'polling clients must be able to observe that a peer went offline');
});
test('a committed join survives one TypeError and retries without duplicating the player', async t => {
  const { store, request } = await fixture(t);
  const host = (await request('/api/create', { name: 'Host' })).value;
  const command = {
    requestId: randomUUID(),
    roomCode: host.roomCode,
    name: 'Guest'
  };

  const originalCommit = store.commit.bind(store);
  let injected = false;
  store.commit = async function (args) {
    const result = await originalCommit(args);
    if (!injected && args.requestId === command.requestId && result.receipt) {
      injected = true;
      throw new TypeError('Connection lost after durable commit');
    }
    return result;
  };

  const failed = await request('/api/join', command);
  assert.equal(failed.status, 503);
  assert.equal(injected, true);

  const retry = await request('/api/join', command);
  assert.equal(retry.status, 200);

  const replay = await request('/api/join', command);
  assert.deepEqual(replay, retry);

  const state = await request('/api/state?room=' + host.roomCode, null, host);
  assert.equal(state.status, 200);
  assert.deepEqual(
    state.value.room.players.map(player => player.name).sort(),
    ['Guest', 'Host']
  );
  assert.equal(
    state.value.room.players.filter(player => player.id === retry.value.playerId).length,
    1
  );
});

test('an existing token reconnects through another handler without leaking peer tokens', async t => {
  const { request } = await fixture(t);
  const host = (await request('/api/create', { name: 'Host' })).value;
  const guest = (await request('/api/join', {
    roomCode: host.roomCode,
    name: 'Guest'
  })).value;
  const peer = (await request('/api/join', {
    roomCode: host.roomCode,
    name: 'Peer'
  })).value;

  await request('/health'); // Reconnect through the other Function handler.
  const reconnect = await request(
    '/api/state?room=' + guest.roomCode,
    null,
    guest
  );

  assert.equal(reconnect.status, 200);
  assert.equal(guest.roomCode, host.roomCode);
  assert.equal(reconnect.value.room.players.length, 3);
  assert.ok(reconnect.value.room.players.some(
    player => player.id === guest.playerId
  ));

  const serialized = JSON.stringify(reconnect.value);
  assert.ok(!serialized.includes(host.token));
  assert.ok(!serialized.includes(peer.token));

  const hostState = await request(
    '/api/state?room=' + host.roomCode,
    null,
    host
  );
  assert.equal(hostState.status, 200);
  assert.ok(hostState.value.room.players.some(
    player => player.id === host.playerId
  ));
  assert.ok(!JSON.stringify(hostState.value).includes(guest.token));
  assert.ok(!JSON.stringify(hostState.value).includes(peer.token));
});
