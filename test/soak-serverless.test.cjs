'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { randomBytes } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const { options, run } = require('../scripts/soak-serverless.cjs');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// A disposable external HTTP API; no production modules, DB or server process.
async function fake(t, hooks = {}) {
  const api = { entries: [], sessions: [], players: new Map(), receipts: new Map(), room: false, revision: 1, created: 0, activeJoins: 0, maxJoins: 0, reads: new Map(), unrelated: { code: '6HMUVX', untouched: true } };
  const json = (res, status, body, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(body)); };
  const override = (res, value) => {
    if (!value) return false;
    if (value === 'disconnect') res.destroy();
    else if (value === 'partial') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{"token":'); setTimeout(() => res.destroy(), 5); }
    else json(res, value.status, value.body || { error: 'SERVER_BUSY' }, value.headers);
    return true;
  };
  const server = http.createServer(async (req, res) => {
    try {
      const chunks = []; for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('utf8');
      const body = raw ? JSON.parse(raw) : undefined;
      const route = new URL(req.url, 'http://localhost').pathname;
      const entry = { route, raw, body, authorization: req.headers.authorization, roomHeader: req.headers['x-room-code'], time: performance.now() };
      api.entries.push(entry);
      if (body && !uuid.test(body.requestId)) return json(res, 400, { error: 'REQUEST_ID_REQUIRED' });
      if (override(res, await hooks.before?.(entry, api))) return;
      const key = route + ':' + body?.requestId;
      if (body && api.receipts.has(key)) {
        const receipt = api.receipts.get(key);
        if (receipt.raw !== raw) return json(res, 409, { error: 'REQUEST_REUSED' });
        return json(res, 200, receipt.value);
      }
      let value;
      if (route === '/api/create') {
        api.room = true; api.created++;
        value = addSession('host');
      } else if (route === '/api/join') {
        if (body.roomCode !== 'QATEST') return json(res, 404, { error: 'ROOM_NOT_FOUND' });
        api.activeJoins++; api.maxJoins = Math.max(api.maxJoins, api.activeJoins);
        try { await pause(hooks.joinDelay || 0); value = addSession('guest'); } finally { api.activeJoins--; }
      } else {
        if (!api.room) return json(res, 404, { error: 'ROOM_NOT_FOUND' });
        const token = req.headers.authorization?.replace(/^Bearer /, '');
        const session = api.sessions.find(s => s.token === token && api.players.has(s.playerId));
        if (!session || req.headers['x-room-code'] !== 'QATEST') return json(res, 401, { error: 'UNAUTHORIZED' });
        entry.actor = session.kind;
        if (route === '/api/state') {
          const count = (api.reads.get(session.playerId) || 0) + 1; api.reads.set(session.playerId, count);
          value = { room: { code: 'QATEST', revision: api.revision, status: 'LOBBY', players: [...api.players.values()].map(s => ({ id: s.playerId, name: s.kind, online: true })) }, game: null };
          value = hooks.state?.(value, session, count) || value;
        } else if (route === '/api/action' && body.type === 'leave') {
          api.players.delete(session.playerId); api.revision++;
          if (!api.players.size) api.room = false;
          value = { ok: true };
        } else return json(res, 400, { error: 'INVALID_ACTION' });
      }
      if (body) api.receipts.set(key, { raw, value });
      if (override(res, await hooks.after?.(entry, api, value))) return;
      json(res, 200, value);
    } catch { if (!res.destroyed) json(res, 500, { error: 'FAKE_API_FAILURE' }); }
  });
  function addSession(kind) {
    const value = { roomCode: 'QATEST', playerId: 'p' + api.sessions.length, token: randomBytes(32).toString('hex'), transport: 'poll', kind };
    api.sessions.push(value); api.players.set(value.playerId, value); api.revision++;
    return { roomCode: value.roomCode, playerId: value.playerId, token: value.token, transport: value.transport };
  }
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  api.url = 'http://127.0.0.1:' + server.address().port;
  api.config = extra => ({ url: api.url, players: 3, seconds: .025, intervalMs: 2000, concurrency: 2, ...extra });
  return api;
}
function assertRedacted(report, api) {
  const text = JSON.stringify(report);
  for (const s of api.sessions) assert.ok(!text.includes(s.token), 'report contains a bearer token');
  assert.ok(!/authorization|Bearer |x-room-code|secret payload/i.test(text));
}
function assertCleanup(api, report) {
  assert.equal(api.room, false); assert.equal(api.players.size, 0);
  assert.equal(report.cleanup.roomRemoved, true);
  const leaves = api.entries.filter(e => e.route === '/api/action');
  assert.ok(leaves.every(e => e.body.type === 'leave'));
  assert.equal(leaves.at(-1).actor, 'host');
  assert.ok(leaves.slice(0, -1).every(e => e.actor === 'guest'));
  assert.equal(api.unrelated.untouched, true);
  assert.ok(api.entries.every(e => e.roomHeader === undefined || e.roomHeader === 'QATEST'));
}

test('CLI defaults, numeric validation and remote opt-in do not make network requests', async () => {
  const o = options(['--url', 'http://localhost:4567']);
  assert.equal(o.players, 10); assert.equal(o.seconds, 60); assert.equal(o.intervalMs, 2000);
  assert.equal(options(['--url', 'https://isolated-preview.vercel.app', '--allow-remote']).allowRemote, true);
  for (const url of ['https://example.com', 'https://127.0.0.1.evil.example', 'http://192.168.0.1']) {
    await assert.rejects(run({ url }), /REMOTE_REQUIRES_ALLOW_REMOTE/);
  }
  await assert.rejects(run({ url: 'https://example.com', allowRemote: 'false' }), /REMOTE_REQUIRES_ALLOW_REMOTE/);
  for (const url of ['https://greentrap.vercel.app', 'https://greentrap.vercel.app.', 'https://green-trap-detective.onrender.com', 'https://green-impact-mobile-demo.vercel.app', 'https://green-impact-mobile-demo-ryankn07s-projects.vercel.app']) {
    await assert.rejects(run({ url, allowRemote: true }), /PRODUCTION_TARGET_FORBIDDEN/);
  }
  for (const url of ['https://name:password@example.com', 'https://example.com/?secret=x', 'file:///tmp/test', 'http://localhost:123/api']) assert.throws(() => options(['--url', url]), /INVALID_URL/);
  for (const [flag, value] of [['--interval-ms', '1999'], ['--concurrency', '0'], ['--players', '1.5'], ['--seconds', 'NaN']]) assert.throws(() => options(['--url', 'http://localhost:123', flag, value]));
  assert.throws(() => options(['--url', 'http://localhost:123', '--unexpected']), /INVALID_OPTION/);
});

test('one lobby, distinct authenticated sessions, bounded joins, actual duration and labeled latency', async t => {
  const api = await fake(t, { joinDelay: 20 });
  const report = await run(api.config({ players: 6, concurrency: 2, seconds: .04 }));
  assert.equal(report.ok, true); assert.equal(api.created, 1); assert.equal(report.sessionCount, 6);
  assert.ok(api.maxJoins <= 2 && api.maxJoins > 1);
  assert.ok(report.steadySeconds >= .04); assert.ok(report.elapsedSeconds > report.steadySeconds + .03, 'setup is outside the steady window');
  assert.equal(report.snapshots, 6);
  for (const kind of ['create', 'join', 'state', 'leaveGuest', 'leaveHost', 'verifyCleanup']) {
    assert.ok(report.requests[kind].attempts > 0); assert.ok(report.requests[kind].attemptLatencyMs.p95 >= 0);
  }
  assert.ok(api.entries.filter(e => e.body).every(e => uuid.test(e.body.requestId)));
  assertCleanup(api, report); assertRedacted(report, api);
});

test('committed create response loss and 429/503 joins retry the identical UUID and body', async t => {
  let createLost = false, joinAttempts = 0;
  const api = await fake(t, {
    after(entry) { if (entry.route === '/api/create' && !createLost) { createLost = true; return 'partial'; } },
    before(entry) {
      if (entry.route !== '/api/join') return;
      joinAttempts++;
      if (joinAttempts === 1) return { status: 429, body: { error: 'RATE_LIMITED', message: 'secret payload' }, headers: { 'Retry-After': '0' } };
      if (joinAttempts === 2) return { status: 503, body: { error: 'SERVER_BUSY' } };
    }
  });
  const report = await run(api.config({ players: 2 }));
  assert.equal(report.ok, true); assert.equal(api.created, 1); assert.equal(report.retries, 3);
  for (const route of ['/api/create', '/api/join']) {
    const requests = api.entries.filter(e => e.route === route);
    assert.ok(requests.length > 1); assert.equal(new Set(requests.map(e => e.raw)).size, 1);
  }
  assertCleanup(api, report); assertRedacted(report, api);
});

test('401 protection and validation failures are not retried or bypassed', async t => {
  const api = await fake(t, { before: entry => entry.route === '/api/create' ? { status: 401, body: { error: 'UNAUTHORIZED', message: 'secret payload' } } : null });
  const report = await run(api.config());
  assert.equal(report.ok, false); assert.deepEqual(report.failures, ['HTTP_401']); assert.equal(report.retries, 0);
  assert.equal(api.entries.length, 1); assert.equal(api.entries[0].authorization, undefined);
  assertRedacted(report, api);
});

test('redirects are refused instead of forwarding credentials or opting into another target', async t => {
  const destination = await fake(t);
  const api = await fake(t, { before: () => ({ status: 307, headers: { Location: destination.url + '/api/create' } }) });
  const report = await run(api.config());
  assert.equal(report.ok, false); assert.ok(report.failures.includes('REDIRECT_REFUSED'));
  assert.equal(destination.entries.length, 0); assert.equal(api.entries.length, 1);
});

test('join validation failure drains concurrent joins before guests/host cleanup', async t => {
  const api = await fake(t, { joinDelay: 45, before(entry) { if (entry.route === '/api/join' && entry.body.name.endsWith(' 2')) return { status: 400, body: { error: 'INVALID_NAME' } }; } });
  const report = await run(api.config({ players: 4, concurrency: 2 }));
  assert.equal(report.ok, false); assert.ok(report.failures.includes('HTTP_400')); assert.equal(report.retries, 0);
  assert.equal(report.cleanup.guestAttempts, 1); assertCleanup(api, report);
  const lastJoin = api.entries.filter(e => e.route === '/api/join').at(-1);
  const firstLeave = api.entries.find(e => e.route === '/api/action');
  assert.ok(firstLeave.time - lastJoin.time >= 20, 'cleanup must wait for the delayed join');
});

test('revision regression is detected without accelerating the configured polling cadence', async t => {
  const api = await fake(t, { state(value, session, count) { value.room.revision = count === 1 ? 100 : 99; return value; } });
  const report = await run(api.config({ players: 1, seconds: 2.03 }));
  assert.equal(report.ok, false); assert.equal(report.revisionRegressions, 1); assert.ok(report.failures.includes('REVISION_REGRESSION'));
  const reads = api.entries.filter(e => e.route === '/api/state').slice(0, 2);
  assert.ok(reads[1].time - reads[0].time >= 1950);
  assertCleanup(api, report);
});

test('incorrect room count and private projection fields both fail and still clean up', async t => {
  for (const issue of ['count', 'private']) {
    const api = await fake(t, { state(value) { if (issue === 'count') value.room.players.pop(); else value.room.players[0].coins = 2; return value; } });
    const report = await run(api.config());
    assert.equal(report.ok, false); assert.ok(report.failures.includes(issue === 'count' ? 'ROOM_COUNT_MISMATCH' : 'PRIVATE_FIELDS_IN_PROJECTION'));
    assertCleanup(api, report); assertRedacted(report, api);
  }
});

test('cleanup failure is explicit and does not prevent other guest/host leave attempts', async t => {
  const api = await fake(t, { before(entry, a) {
    if (entry.route === '/api/action' && entry.authorization === 'Bearer ' + a.sessions[1]?.token) return { status: 400, body: { error: 'INVALID_ACTION', message: 'secret payload' } };
  } });
  const report = await run(api.config());
  assert.equal(report.ok, false); assert.ok(report.failures.includes('CLEANUP_FAILED'));
  assert.equal(report.cleanup.guestAttempts, 2); assert.equal(report.cleanup.guestSucceeded, 1); assert.equal(report.cleanup.hostSucceeded, true);
  assert.equal(report.cleanup.roomRemoved, false); assert.ok(report.cleanup.failures.includes('HTTP_400'));
  assertRedacted(report, api);
});

test('CLI prints a redacted JSON failure report and nonzero exit status', async t => {
  const api = await fake(t, { state: value => ({ ...value, game: { private: 'secret payload' } }) });
  let failure;
  try { await promisify(execFile)(process.execPath, [path.join(__dirname, '../scripts/soak-serverless.cjs'), '--url', api.url, '--players', '2', '--seconds', '.02'], { timeout: 15000 }); }
  catch (error) { failure = error; }
  assert.ok(failure); assert.equal(failure.code, 1);
  const report = JSON.parse(failure.stdout);
  assert.equal(report.ok, false); assert.ok(report.failures.includes('INVALID_LOBBY_PROJECTION'));
  assertRedacted(report, api); assertCleanup(api, report);
});

test('transport mismatch after create retains ownership so the QA host still leaves', async t => {
  const api = await fake(t, { after(entry, a, value) { if (entry.route === '/api/create') value.transport = 'sse'; } });
  const report = await run(api.config());
  assert.equal(report.ok, false); assert.ok(report.failures.includes('INVALID_TRANSPORT'));
  assertCleanup(api, report); assertRedacted(report, api);
});

test('lost host-leave response replays the same command after the QA room is deleted', async t => {
  let lost = false;
  const api = await fake(t, { after(entry) { if (entry.route === '/api/action' && entry.actor === 'host' && !lost) { lost = true; return 'disconnect'; } } });
  const report = await run(api.config({ players: 1 }));
  assert.equal(report.ok, true); assert.equal(report.retries, 1);
  const leaves = api.entries.filter(e => e.route === '/api/action');
  assert.equal(leaves.length, 2); assert.equal(leaves[0].raw, leaves[1].raw);
  assert.equal(report.cleanup.roomRemoved, true); assert.equal(api.room, false); assertRedacted(report, api);
});

test('exhausted ambiguous create retries report unresolved cleanup rather than pretending success', async t => {
  const api = await fake(t, { before: () => ({ status: 503, body: { error: 'SERVER_BUSY', message: 'secret payload' } }) });
  const report = await run(api.config());
  assert.equal(report.ok, false); assert.equal(api.entries.length, 4);
  assert.equal(new Set(api.entries.map(e => e.raw)).size, 1);
  assert.ok(report.failures.includes('CLEANUP_UNRESOLVED'));
  assert.deepEqual(report.cleanup.failures, ['CREATE_OWNERSHIP_UNRESOLVED']);
  assert.equal(report.cleanup.hostSucceeded, false); assertRedacted(report, api);
});
