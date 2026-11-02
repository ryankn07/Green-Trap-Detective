'use strict';
// An external HTTP client only: never imports the game, starts it, or reads secrets.
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');

class SoakError extends Error {
  constructor(code, status = null, apiCode = null) { super(code); this.code = code; this.status = status; this.apiCode = apiCode; }
}
const defaults = { players: 10, seconds: 60, intervalMs: 2000, concurrency: 3, allowRemote: false };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const fail = code => { throw new SoakError(code); };
function configuration(input) {
  const value = { ...defaults, ...input };
  let url;
  try { url = new URL(value.url); } catch { fail('INVALID_URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') fail('INVALID_URL');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host.endsWith('.onrender.com') || ['onrender.com', 'greentrap.vercel.app', 'green-impact-mobile-demo.vercel.app', 'green-impact-mobile-demo-ryankn07s-projects.vercel.app'].includes(host)) fail('PRODUCTION_TARGET_FORBIDDEN');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(host);
  if (!loopback && value.allowRemote !== true) fail('REMOTE_REQUIRES_ALLOW_REMOTE');
  if (!loopback && url.protocol !== 'https:') fail('REMOTE_REQUIRES_HTTPS');
  for (const [key, min, max] of [['players', 1, 1200], ['concurrency', 1, 50], ['intervalMs', 2000, 3600000]]) {
    if (!Number.isSafeInteger(value[key]) || value[key] < min || value[key] > max) fail('INVALID_' + key.toUpperCase());
  }
  if (!Number.isFinite(value.seconds) || value.seconds <= 0 || value.seconds > 86400) fail('INVALID_SECONDS');
  value.url = url.origin;
  return value;
}
function options(args) {
  const result = {};
  const names = { '--url': 'url', '--players': 'players', '--seconds': 'seconds', '--interval-ms': 'intervalMs', '--concurrency': 'concurrency' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--allow-remote') { result.allowRemote = true; continue; }
    const key = names[args[i]];
    if (!key || i + 1 >= args.length || args[i + 1].startsWith('--')) fail('INVALID_OPTION');
    result[key] = key === 'url' ? args[++i] : Number(args[++i]);
  }
  return configuration(result);
}
function percentile(samples) {
  const sorted = samples.slice().sort((a, b) => a - b);
  const at = fraction => sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] : null;
  return { count: sorted.length, p50: at(.5), p95: at(.95), p99: at(.99), max: sorted.length ? sorted.at(-1) : null };
}
// Drain in-flight work before returning, so cleanup cannot race a pending join.
async function pool(items, concurrency, task) {
  let cursor = 0, firstError;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length && !firstError) {
      const item = items[cursor++];
      try { await task(item); } catch (error) { firstError ||= error; }
    }
  }));
  if (firstError) throw firstError;
}
function safeCode(error) { return error instanceof SoakError ? error.code : 'TRANSPORT_OR_PROTOCOL_FAILURE'; }
async function readJSON(response) {
  const chunks = []; let length = 0;
  try {
    for await (const chunk of response.body || []) {
      length += chunk.length;
      if (length > 1048576) fail('RESPONSE_TOO_LARGE');
      chunks.push(Buffer.from(chunk));
    }
  } catch (error) { if (error instanceof SoakError) throw error; throw new SoakError('TRANSPORT_FAILURE'); }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('INVALID_JSON'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_RESPONSE');
  return value;
}
async function run(input) {
  const config = configuration(input);
  const started = performance.now(), samples = {}, sessions = [], allTokens = new Set(), ids = new Set();
  const report = {
    ok: false, players: config.players, requestedSeconds: config.seconds, steadySeconds: 0, elapsedSeconds: 0,
    snapshots: 0, revisionRegressions: 0, retries: 0, sessionCount: 0, failures: [], requests: {},
    cleanup: { guestAttempts: 0, guestSucceeded: 0, hostSucceeded: false, roomRemoved: false, failures: [] }
  };
  let host, steadyStart, createAmbiguous = false;
  const runTag = randomUUID().slice(0, 8);
  const recordFailure = code => { if (!report.failures.includes(code)) report.failures.push(code); };
  async function request(kind, route, session, payload, expectMissing = false) {
    // Serialize once per logical operation: ambiguous writes retain their UUID/body.
    const body = payload === undefined ? undefined : JSON.stringify({ ...payload, requestId: randomUUID() });
    const stats = report.requests[kind] ||= { attempts: 0, successfulAttempts: 0, failedAttempts: 0, statuses: {} };
    const latency = samples[kind] ||= [];
    for (let attempt = 0; attempt < 4; attempt++) {
      const attemptStart = performance.now(); let response, transient = false, retryAfter = 0;
      stats.attempts++;
      try {
        try {
          response = await fetch(config.url + route, {
            method: body === undefined ? 'GET' : 'POST', redirect: 'manual', signal: AbortSignal.timeout(10000),
            headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json', Origin: config.url }),
              ...(session ? { Authorization: 'Bearer ' + session.token, 'x-room-code': session.roomCode } : {}) },
            body
          });
        } catch { transient = true; throw new SoakError('TRANSPORT_FAILURE'); }
        stats.statuses[response.status] = (stats.statuses[response.status] || 0) + 1;
        if (response.status >= 300 && response.status < 400) fail('REDIRECT_REFUSED');
        transient = response.status === 429 || response.status === 503;
        const retryHeader = response.headers.get('retry-after');
        if (retryHeader) {
          retryAfter = /^\d+(?:\.\d+)?$/.test(retryHeader) ? Number(retryHeader) * 1000 : Date.parse(retryHeader) - Date.now();
          if (!Number.isFinite(retryAfter)) retryAfter = 0;
          if (retryAfter > 5000) transient = false;
        }
        // Authentication/protection responses may be HTML. Status takes priority.
        if (!response.ok) {
          let errorCode = null;
          if (/application\/json/i.test(response.headers.get('content-type') || '')) {
            const value = await readJSON(response);
            if (typeof value.error !== 'string' || !/^[A-Z][A-Z0-9_]{0,79}$/.test(value.error)) fail('UNSAFE_ERROR_SHAPE');
            errorCode = value.error;
          } else await response.body?.cancel();
          if (expectMissing && response.status === 404 && errorCode === 'ROOM_NOT_FOUND') {
            stats.successfulAttempts++; return { missing: true };
          }
          throw new SoakError('HTTP_' + response.status, response.status, errorCode);
        }
        const value = await readJSON(response);
        stats.successfulAttempts++; return value;
      } catch (error) {
        stats.failedAttempts++;
        if (error instanceof SoakError && error.code === 'TRANSPORT_FAILURE') transient = true;
        if (!transient || attempt === 3) throw error;
        report.retries++;
      } finally { latency.push(performance.now() - attemptStart); }
      await sleep(Math.max(Math.max(0, retryAfter), Math.min(2000, 200 * 2 ** attempt) + Math.random() * 100));
    }
  }
  function remember(value, expectedRoom) {
    if (typeof value.roomCode !== 'string' || !/^[A-Z2-9]{6}$/.test(value.roomCode) ||
        typeof value.playerId !== 'string' || !value.playerId || typeof value.token !== 'string' || !/^[a-f0-9]{64}$/i.test(value.token)) fail('INVALID_SESSION');
    if (expectedRoom && value.roomCode !== expectedRoom) fail('SESSION_ROOM_MISMATCH');
    // Retain credentials in memory for finally even when a protocol check fails.
    const session = { roomCode: value.roomCode, playerId: value.playerId, token: value.token, revision: null };
    sessions.push(session);
    if (!expectedRoom && !host) host = session;
    if (value.transport !== 'poll') fail('INVALID_TRANSPORT');
    if (allTokens.has(session.token) || ids.has(session.playerId)) fail('SESSIONS_NOT_DISTINCT');
    allTokens.add(session.token); ids.add(session.playerId);
    return session;
  }
  async function poll(session) {
    if (session.lastPoll !== undefined) await sleep(Math.max(0, session.lastPoll + config.intervalMs - performance.now()));
    session.lastPoll = performance.now();
    const value = await request('state', '/api/state?room=' + encodeURIComponent(host.roomCode), session);
    const room = value.room;
    if (!room || room.code !== host.roomCode || room.status !== 'LOBBY' || value.game !== null || !Array.isArray(room.players)) fail('INVALID_LOBBY_PROJECTION');
    if (room.players.length !== config.players || new Set(room.players.map(p => p.id)).size !== config.players || !room.players.some(p => p.id === session.playerId)) fail('ROOM_COUNT_MISMATCH');
    if (!Number.isSafeInteger(room.revision) || room.revision < 0) fail('INVALID_REVISION');
    if (session.revision !== null && room.revision < session.revision) { report.revisionRegressions++; fail('REVISION_REGRESSION'); }
    session.revision = room.revision;
    if (room.players.some(p => ['token', 'secret', 'role', 'coins', 'lockedAction', 'inspections'].some(k => Object.hasOwn(p, k)))) fail('PRIVATE_FIELDS_IN_PROJECTION');
    const serialized = JSON.stringify(value);
    if ([...allTokens].some(token => serialized.includes(token))) fail('TOKEN_IN_PROJECTION');
    report.snapshots++;
  }
  try {
    createAmbiguous = true;
    const created = await request('create', '/api/create', null, { name: 'QA soak ' + runTag });
    host = remember(created); createAmbiguous = false;
    await pool(Array.from({ length: config.players - 1 }, (_, i) => i + 1), config.concurrency, async i => {
      const value = await request('join', '/api/join', null, { roomCode: host.roomCode, name: 'QA ' + runTag + ' ' + i });
      remember(value, host.roomCode);
    });
    report.sessionCount = sessions.length;
    steadyStart = performance.now();
    const deadline = steadyStart + config.seconds * 1000;
    do {
      const pollStarted = performance.now();
      await pool(sessions, config.concurrency, poll);
      const remaining = deadline - performance.now();
      if (remaining <= 0) break;
      await sleep(Math.min(Math.max(0, pollStarted + config.intervalMs - performance.now()), remaining));
    } while (performance.now() < deadline);
    report.steadySeconds = (performance.now() - steadyStart) / 1000;
    if (report.steadySeconds < config.seconds) fail('DURATION_NOT_REACHED');
  } catch (error) {
    if (!host && error instanceof SoakError && error.status >= 400 && error.status < 500) createAmbiguous = false;
    recordFailure(safeCode(error));
  }
  finally {
    if (steadyStart !== undefined && !report.steadySeconds) report.steadySeconds = (performance.now() - steadyStart) / 1000;
    report.sessionCount = sessions.length;
    if (host) {
      // No kick/start command; leave only this run's authenticated QA sessions.
      for (const guest of sessions.filter(s => s !== host)) {
        report.cleanup.guestAttempts++;
        try { const value = await request('leaveGuest', '/api/action', guest, { type: 'leave' }); if (value.ok !== true) fail('INVALID_LEAVE_RESPONSE'); report.cleanup.guestSucceeded++; }
        catch (error) { report.cleanup.failures.push(safeCode(error)); }
      }
      try { const value = await request('leaveHost', '/api/action', host, { type: 'leave' }); if (value.ok !== true) fail('INVALID_LEAVE_RESPONSE'); report.cleanup.hostSucceeded = true; }
      catch (error) { report.cleanup.failures.push(safeCode(error)); }
      try { const value = await request('verifyCleanup', '/api/state?room=' + encodeURIComponent(host.roomCode), host, undefined, true); report.cleanup.roomRemoved = value.missing === true; if (!report.cleanup.roomRemoved) fail('QA_ROOM_STILL_EXISTS'); }
      catch (error) { report.cleanup.failures.push(safeCode(error)); }
      if (report.cleanup.failures.length || !report.cleanup.roomRemoved) recordFailure('CLEANUP_FAILED');
    } else if (createAmbiguous) {
      report.cleanup.failures.push('CREATE_OWNERSHIP_UNRESOLVED'); recordFailure('CLEANUP_UNRESOLVED');
    }
    report.elapsedSeconds = (performance.now() - started) / 1000;
    for (const [kind, stats] of Object.entries(report.requests)) stats.attemptLatencyMs = percentile(samples[kind]);
    report.ok = report.failures.length === 0 && report.cleanup.roomRemoved;
  }
  return report;
}
module.exports = { options, run };
if (require.main === module) {
  (async () => {
    try { const result = await run(options(process.argv.slice(2))); console.log(JSON.stringify(result, null, 2)); if (!result.ok) process.exitCode = 1; }
    catch (error) { console.error(JSON.stringify({ ok: false, failures: [safeCode(error)] })); process.exitCode = 1; }
  })();
}
