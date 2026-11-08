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
    const result=this.rooms.get(code);if(result&&result.expires<=this.time)this.rooms.delete(code);
    return structuredClone({ record: this.rooms.get(code) || null, receipt: this.receipts.get(scope + ':' + requestId) || null, now: this.time });
  }
  async commit({ code, expectedVersion, payload, scope, requestId, requestHash, response }) {
    const key = scope + ':' + requestId;
    if (this.receipts.has(key)) return { receipt: structuredClone(this.receipts.get(key)) };
    const old = this.rooms.get(code);
    if ((old?.version ?? 0) !== expectedVersion) return { conflict: true };
    if(payload){const terminal=payload.rooms[0].state?.phase==='GAME_OVER'&&payload.completionProtocol===1;const expires=terminal?Math.min(old?.expires??Infinity,this.time+120000):this.time+14400000;this.rooms.set(code,structuredClone({version:expectedVersion+1,payload,expires}));}
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
  async function request(path, body, session, cachesEnding=true) {
    const origin = 'http://127.0.0.1:' + servers[count++ % 2].address().port;
    const response = await fetch(origin + path, { method: body ? 'POST' : 'GET', headers: { ...(cachesEnding?{'x-game-result-cache':'1'}:{}),...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}), ...(session ? { Authorization: 'Bearer ' + session.token, 'x-room-code': session.roomCode } : {}) }, body: body ? JSON.stringify({ requestId: randomUUID(), ...body }) : undefined });
    return { status: response.status, value: await response.json() };
  }
  return { store, request };
}

test('unchanged polling uses the combined read adapter once without redundant quota calls',async t=>{
 const {store,request}=await fixture(t),host=(await request('/api/create',{name:'Combined poll'})).value;
 const originalRead=store.read.bind(store);let combined=0,legacyLimits=0;
 store.limit=async()=>{legacyLimits++;};
 store.readLimited=async input=>{combined++;assert.equal(input.sourceOperation,'api');assert.equal(input.sessionOperation,'state');return originalRead(input.code,input.scope,input.requestId);};
 const response=await request('/api/state?room='+host.roomCode,null,host);
 assert.equal(response.status,200);assert.equal(response.value.room.code,host.roomCode);assert.equal(combined,1);assert.equal(legacyLimits,0);
});

test('lobby avatar and reaction survive cold Functions and request replay',async t=>{
 const {store,request}=await fixture(t);
 const host=(await request('/api/create',{name:'Social host'})).value;
 const guest=(await request('/api/join',{roomCode:host.roomCode,name:'Social guest'})).value;
 assert.equal((await request('/api/action',{type:'avatar',avatarId:'a10'},host)).status,200);
 const event={type:'react',targetId:guest.playerId,kind:'water',requestId:randomUUID()};
 assert.equal((await request('/api/action',event,host)).status,200);
 assert.equal((await request('/api/action',event,host)).status,200);
 const state=(await request('/api/state?room='+host.roomCode,null,guest)).value;
 assert.equal(state.room.players.find(p=>p.id===host.playerId).avatarId,'a10');
 assert.equal(state.room.reactions.length,1);
 assert.equal(Object.hasOwn(state.room,'social'),false);
 assert.equal((await request('/api/action',{...event,requestId:randomUUID()},host)).value.error,'REACTION_COOLDOWN');
 assert.equal((await request('/api/action',{...event,targetId:randomUUID(),requestId:randomUUID()},guest)).value.error,'INVALID_TARGET');
 store.time+=16000;
 assert.equal((await request('/api/state?room='+host.roomCode,null,host)).value.room.reactions.length,0);
 for(const kind of ['tomato','egg','snow','confetti','leafstorm','vine','bubbles']){store.time+=1300;assert.equal((await request('/api/action',{type:'react',targetId:guest.playerId,kind,requestId:randomUUID()},host)).status,200);assert.equal((await request('/api/state?room='+host.roomCode,null,guest)).value.room.reactions.at(-1).kind,kind);}
});

test('discussion skip persists across cold Functions, retries once per voter and advances on unanimous consent',async t=>{
 const {store,request}=await fixture(t),host=(await request('/api/create',{name:'Skip host'})).value;
 const guests=[];for(const name of ['Skip A','Skip B'])guests.push((await request('/api/join',{roomCode:host.roomCode,name})).value);
 await request('/api/action',{type:'start'},host);
 const first=(await request('/api/state?room='+host.roomCode,null,host)).value;
 const context={gameId:first.game.gameId,round:first.game.round,phase:'DEBATE'};
 const vote=(session,extra={})=>request('/api/action',{type:'skip_discussion',context,...extra},session);
 assert.equal((await vote(host,{context:{...context,round:2}})).status,409);
 assert.equal((await vote(host)).status,200);assert.equal((await vote(host)).status,200);
 assert.equal((await vote(guests[0])).status,200);
 const partial=(await request('/api/state?room='+host.roomCode,null,guests[1])).value;
 assert.deepEqual(partial.game.discussionSkip,{count:2,required:3,voted:false,complete:false});assert.equal(partial.deadline,first.deadline);
 const id=randomUUID();const result=await vote(guests[1],{requestId:id});assert.equal(result.status,200);
 assert.deepEqual(await vote(guests[1],{requestId:id}),result,'same committed command replays after the phase changes');
 const next=(await request('/api/state?room='+host.roomCode,null,host)).value;
 assert.equal(next.game.phase,'BLIND_ACTION');assert.equal(next.deadline,store.time+60000);
 assert.deepEqual(next.game.discussionSkip,{count:3,required:3,voted:true,complete:true});
 assert.equal((await vote(host)).status,409);assert.equal(next.game.currentStatements.length,3);
 assert.equal(Object.hasOwn(next.game,'discussionSkipVotes'),false);
});

test('all locked actions resolve early across cold invocations and the last request replays after resolution',async t=>{
 const {store,request}=await fixture(t),host=(await request('/api/create',{name:'Ready host'})).value,guests=[];
 for(const name of ['Ready A','Ready B'])guests.push((await request('/api/join',{roomCode:host.roomCode,name})).value);
 await request('/api/action',{type:'start'},host);
 let view=(await request('/api/state?room='+host.roomCode,null,host)).value;store.time=view.deadline;
 view=(await request('/api/state?room='+host.roomCode,null,host)).value;
 const deadline=view.deadline,context={gameId:view.game.gameId,round:view.game.round,phase:'BLIND_ACTION'};
 const lock=(session,extra={})=>request('/api/action',{type:'submit',context,payload:{action:{invest:false,bankAction:{type:'NONE'}}},...extra},session);
 assert.equal((await lock(host)).status,200);assert.equal((await lock(guests[0])).status,200);
 view=(await request('/api/state?room='+host.roomCode,null,host)).value;assert.equal(view.game.phase,'BLIND_ACTION');assert.equal(view.deadline,deadline);
 const last={requestId:randomUUID()},response=await lock(guests[1],last);assert.equal(response.status,200);assert.deepEqual(await lock(guests[1],last),response);
 view=(await request('/api/state?room='+host.roomCode,null,host)).value;
 assert.equal(view.game.phase,'REVEAL');assert.equal(view.deadline,store.time+25000);assert.equal(view.game.history.length,1);assert.equal(view.game.history[0].fastForward,true);
 assert.ok(view.game.players.every(p=>!Object.hasOwn(p,'role')&&!Object.hasOwn(p,'coins')));assert.equal((await lock(host)).status,409);
});

test('completion keeps only bounded authenticated delivery results outside admission',async t=>{
 const {store,request}=await fixture(t);
 const host=(await request('/api/create',{name:'Host'})).value,guests=[];
 for(const name of ['Guest A','Guest B'])guests.push((await request('/api/join',{roomCode:host.roomCode,name})).value);
 await request('/api/action',{type:'start'},host);
 let view=(await request('/api/state?room='+host.roomCode,null,host)).value;
 for(let count=0;view.game.phase!=='GAME_OVER'&&count<32;count++){
  store.time=view.deadline+1;const response=await request('/api/state?room='+host.roomCode,null,host);assert.equal(response.status,200);view=response.value;
 }
 assert.equal(view.game.phase,'GAME_OVER');assert.equal(store.rooms.get(host.roomCode).payload.rooms[0].state.phase,'GAME_OVER');
 const expiry=store.rooms.get(host.roomCode).expires;assert.equal(expiry,store.time+120000);
 const peer=await request('/api/state?room='+host.roomCode,null,guests[0]);assert.equal(peer.status,200);assert.equal(peer.value.game.phase,'GAME_OVER');assert.ok(!JSON.stringify(peer.value).includes(host.token));
 assert.equal(store.rooms.get(host.roomCode).expires,expiry,'result reads do not renew delivery lifetime');
 assert.equal((await request('/api/state?room='+host.roomCode,null,{...host,token:'0'.repeat(64)})).status,401);
 assert.equal((await request('/api/action',{type:'next'},host)).value.error,'GAME_OVER');
 assert.equal((await request('/api/join',{roomCode:host.roomCode,name:'Too late'})).status,400);
 store.time=expiry+1;assert.equal((await request('/api/state?room='+host.roomCode,null,host)).status,404);
});

test('guests with the host name get separate authenticated IDs in the requested room', async t => {
  const { request } = await fixture(t);
  const { value: host } = await request('/api/create', { name: 'Minh' });
  const guests = await Promise.all([1, 2].map(() => request('/api/join', { roomCode: host.roomCode, name: 'Minh' })));
  assert.ok(guests.every(result => result.status === 200));
  const sessions = [host, ...guests.map(result => result.value)];
  assert.equal(new Set(sessions.map(session => session.playerId)).size, 3);
  assert.equal(new Set(sessions.map(session => session.token)).size, 3);
  for (const session of sessions) {
    assert.equal(session.roomCode, host.roomCode);
    const state = await request('/api/state?room=' + host.roomCode, null, session);
    assert.equal(state.status, 200);
    assert.equal(state.value.room.code, host.roomCode);
    assert.equal(state.value.room.hostId, host.playerId);
    assert.deepEqual(new Set(state.value.room.players.map(player => player.id)), new Set(sessions.map(session => session.playerId)));
  }
});

test('an older client joining a new room preserves the legacy ending delivery window',async t=>{
 const {store,request}=await fixture(t);
 const host=(await request('/api/create',{name:'Current host'})).value;
 assert.equal(store.rooms.get(host.roomCode).payload.completionProtocol,1);
 const guest=(await request('/api/join',{roomCode:host.roomCode,name:'Older guest'},null,false)).value;
 assert.equal(store.rooms.get(host.roomCode).payload.completionProtocol,undefined);
 await request('/api/join',{roomCode:host.roomCode,name:'Other guest'});
 await request('/api/action',{type:'start'},host);
 store.time+=35*60000;
 const ending=await request('/api/state?room='+host.roomCode,null,host);
 assert.equal(ending.value.game.phase,'GAME_OVER');
 assert.equal(store.rooms.get(host.roomCode).payload.completionProtocol,undefined,'later new clients cannot re-enable short expiry');
 store.time+=3*60000;
 assert.equal((await request('/api/state?room='+host.roomCode,null,guest,false)).value.game.phase,'GAME_OVER');
});

test('finished room remains readable until all players leave the ending', async t => {
  const { store, request } = await fixture(t);
  const { value: host } = await request('/api/create', { name: 'Chủ phòng' });
  const sessions = [host];
  for (const name of ['An', 'Bình']) {
    const guest = await request('/api/join', { roomCode: host.roomCode, name });
    assert.equal(guest.status, 200);
    sessions.push(guest.value);
  }

  const leave = { type: 'finish_leave' };
  assert.equal((await request('/api/action', leave, host)).value.error, 'INVALID_PHASE');
  assert.equal((await request('/api/action', { type: 'start' }, host)).status, 200);
  store.time += 35 * 60_000;

  for (const session of sessions) {
    const ending = await request('/api/state?room=' + host.roomCode, null, session);
    assert.equal(ending.status, 200);
    assert.equal(ending.value.game.phase, 'GAME_OVER');
  }

  const lastLeave = { ...leave, requestId: randomUUID() };
  const firstLeaves = await Promise.all(sessions.slice(0, 2).map(session =>
    request('/api/action', leave, session)));
  assert.ok(firstLeaves.every(result => result.status === 200));
  assert.equal(store.rooms.has(host.roomCode), true);
  assert.equal((await request('/api/action', leave, host)).status, 200);
  assert.equal(store.rooms.has(host.roomCode), true);

  assert.equal((await request('/api/action', lastLeave, sessions[2])).status, 200);
  assert.equal(store.rooms.has(host.roomCode), false);
  assert.equal((await request('/api/action', lastLeave, sessions[2])).status, 200);
  assert.equal((await request('/api/state?room=' + host.roomCode, null, host)).status, 404);
});

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
