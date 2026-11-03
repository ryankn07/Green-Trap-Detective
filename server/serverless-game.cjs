'use strict';
const { createHash } = require('node:crypto');
const { isIP } = require('node:net');
const { RoomManager } = require('./rooms.cjs');
const { serializeRoom, validateSnapshot } = require('./room-store.cjs');
const { HttpError, readBody, checkOrigin, validateSubmission } = require('./http-guards.cjs');
const { GameError } = require('../engine/dist/errors.js');
const { BODY_BYTES } = require('./limits.cjs');
const hash = value => createHash('sha256').update(value).digest('hex');
const PRESENCE_MS = 45000, HEARTBEAT_MS = 15000;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function unavailable() { return new HttpError('SERVER_BUSY', 'Máy chủ đang bận. Hãy thử lại.', 503); }
function reply(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
function address(req) {
  // Only Vercel's deployed ingress may supply the overwritten forwarding header.
  const forwarded = process.env.VERCEL === '1' ? req.headers['x-forwarded-for'] : null;
  if (typeof forwarded === 'string' && isIP(forwarded)) return forwarded;
  return req.socket?.remoteAddress || 'unknown';
}
async function bodyOf(req) {
  if (req.body === undefined) return readBody(req);
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw new HttpError('BAD_CONTENT_TYPE', 'Yêu cầu phải dùng JSON.', 415);
  if (Buffer.byteLength(JSON.stringify(req.body)) > BODY_BYTES) throw new HttpError('TOO_LARGE', 'Nội dung gửi quá lớn.', 413);
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new HttpError('BAD_JSON', 'Nội dung JSON không hợp lệ.');
  return req.body;
}
function hydrate(record, now) {
  const payload = record?.payload;
  if (payload) validateSnapshot(payload);
  const manager = new RoomManager({ currentTime: () => now, store: { load: () => payload?.rooms || [], save() {} } });
  const presence = { ...(payload?.presence || {}) };
  let presenceChanged = false;
  for (const room of manager.rooms.values()) {
    for (const player of room.players) {
      const online = !player.removed && Number(presence[player.id] || 0) > now - PRESENCE_MS;
      const previous = payload?.online?.[player.id] ?? (!player.removed && Number(presence[player.id] || 0) > 0);
      if (previous !== online) presenceChanged = true;
      player.online = online;
    }
    manager.remember(room);
  }
  return { manager, presence, presenceChanged };
}
function catchUp(manager, room, now) {
  // Preserve original deadlines when an invocation arrives after an idle period.
  for (let n = 0; n < 32 && room.state && room.deadline !== null && room.deadline <= now; n++) {
    const deadline = room.deadline;
    manager.currentTime = () => deadline;
    manager.tick();
    if (room.deadline === deadline) break;
  }
  manager.currentTime = () => now;
}
function receiptValue(receipt, requestHash) {
  if (receipt.requestHash !== requestHash) throw new HttpError('REQUEST_REUSED', 'Mã yêu cầu đã dùng cho lệnh khác.', 409);
  return receipt.response;
}
function createServerlessHandler({ store } = {}) {
  return async (req, res) => {
    try {
      if (!store) throw unavailable();
      const url = new URL(req.url, 'http://local');
      const route = url.searchParams.get('route');
      const path = route ? (route === 'health' ? '/health' : '/api/' + route) : url.pathname;
      if (path === '/health' && req.method === 'GET') { await store.read(null, null, null); return reply(res, 200, { status: 'ok', backend: 'vercel-supabase-trial' }); }
      if (!['/api/create', '/api/join', '/api/state', '/api/action'].includes(path)) return reply(res, 404, { error: 'NOT_FOUND' });
      const writing = path !== '/api/state';
      if (req.method !== (writing ? 'POST' : 'GET')) return reply(res, 405, { error: 'METHOD_NOT_ALLOWED' });
      if (writing) checkOrigin(req);
      const body = writing ? await bodyOf(req) : {};
      if (writing && !uuid.test(body.requestId || '')) throw new HttpError('REQUEST_ID_REQUIRED', 'Yêu cầu thiếu mã chống gửi lặp.');
      const source = hash(address(req));
      const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
      const authenticated = path === '/api/state' || path === '/api/action';
      if (authenticated && !token) throw new HttpError('UNAUTHORIZED', 'Thiếu hoặc sai phiên chơi.', 401);
      const scope = hash(authenticated ? token : source + ':' + path);
      const requestHash = hash(JSON.stringify({ path, body }));
      await store.limit(source, path === '/api/create' ? 'create' : path === '/api/join' ? 'join' : 'api');
      if (authenticated) await store.limit(scope, writing ? 'action' : 'state');
      let code = path === '/api/create' ? null : String(body.roomCode || url.searchParams.get('room') || req.headers['x-room-code'] || '').toUpperCase();
      if (code !== null && !/^[A-Z2-9]{6}$/.test(code)) throw new HttpError('ROOM_NOT_FOUND', 'Không tìm thấy phòng.', 404);
      const started = performance.now();
      for (let attempt = 0; attempt < 10 && performance.now() - started < 10000; attempt++) {
        const loaded = await store.read(code, scope, body.requestId);
        const now = loaded.now;
        if (!Number.isFinite(now)) throw unavailable();
        const { manager, presence, presenceChanged } = hydrate(loaded.record, now);
        let room, player;
        if (authenticated && loaded.record) ({ room, player } = manager.authenticate(code, token));
        if (loaded.receipt) return reply(res, 200, receiptValue(loaded.receipt, requestHash));
        if (authenticated && !loaded.record) throw new HttpError('ROOM_NOT_FOUND', 'Không tìm thấy phòng.', 404);
        let result, operation = 'write';
        let endingDeparted = loaded.record?.payload.endingDeparted || [];
        let endingClosed = false;
        const supportsEndingCache=req.headers['x-game-result-cache']==='1';
        const completionProtocol=path==='/api/create'?supportsEndingCache:loaded.record?.payload.completionProtocol===1&&supportsEndingCache;
        const oldRevision = room?.revision;
        if (room && presenceChanged) manager.changed(room);
        if (path === '/api/create') {
          ({ room, player } = manager.create(body.name, source));
          code = room.code; operation = 'create';
        } else if (path === '/api/join') {
          room = manager.getRoom(code);
          ({ player } = manager.join(code, body.name, source)); operation = 'join';
        }
        if (room) catchUp(manager, room, now);
        const freshPresence = now - Number(presence[player.id] || 0) >= HEARTBEAT_MS;
        if (freshPresence) { presence[player.id] = now; if (!player.online) manager.connected(room, player); }
        if (path === '/api/action') {
          if(room.state?.phase==='GAME_OVER'&&body.type!=='finish_leave')throw new HttpError('GAME_OVER','Ván đã kết thúc.');
          switch (body.type) {
            case 'start': manager.start(room, player); break;
            case 'submit': validateSubmission(room, body); manager.submit(room, player, body.payload || {}); break;
            case 'next': validateSubmission(room, { ...body, payload: {} }); manager.next(room, player); break;
            case 'kick': manager.kick(room, player, body.targetId); break;
            case 'finish_leave':
              if (room.state?.phase !== 'GAME_OVER') {
                throw new HttpError('INVALID_PHASE', 'Ván chưa kết thúc.');
              }
              if (!endingDeparted.includes(player.id)) {
                endingDeparted = [...endingDeparted, player.id];
              }
              if (room.players.every(member => member.removed || endingDeparted.includes(member.id))) {
                manager.removeRoom(room);
                endingClosed=true;
              }
              break;
            case 'leave': manager.leaveLobby(room, player); delete presence[player.id]; break;
            default: throw new HttpError('INVALID_ACTION', 'Lệnh không được hỗ trợ.');
          }
          result = { ok: true };
        } else if (path === '/api/state') {
          result = { ...manager.view(room, player), transport: 'poll' };
          if (!freshPresence && room.revision === oldRevision) return reply(res, 200, result);
        } else result = { roomCode: room.code, playerId: player.id, token: player.secret, transport: 'poll' };
        const exists = manager.rooms.has(room.code);
        const completed=room.state?.phase==='GAME_OVER';
        const payload = !endingClosed&&(exists||completed) ? { version: 1, rooms: [serializeRoom(room)], presence, ...(completionProtocol?{completionProtocol:1}:{}),...(completed?{endingDeparted}:{}),online: Object.fromEntries(room.players.map(member => [member.id, member.online])) } : null;
        const committed = await store.commit({ code: room.code, expectedVersion: loaded.record?.version || 0, payload, scope: writing ? scope : null, requestId: body.requestId || null, requestHash: writing ? requestHash : null, response: writing ? result : null, source, operation });
        if (committed.receipt) return reply(res, 200, receiptValue(committed.receipt, requestHash));
        if (committed.committed) return reply(res, 200, result);
        if (!committed.conflict) throw unavailable();
        if (path === '/api/create') code = null;
      }
      throw unavailable();
    } catch (error) {
      const known = error instanceof HttpError || error instanceof GameError || error.public;
      const status = error instanceof HttpError ? error.status : !known ? 503 : error.code === 'UNAUTHORIZED' ? 401 : error.code === 'ROOM_NOT_FOUND' ? 404 : error.code === 'ADMISSION_LIMIT' ? 429 : error.code === 'SERVER_BUSY' ? 503 : 400;
      if (!known) console.error('Serverless game request failed:', error.name);
      return reply(res, status, { error: known ? error.code : 'SERVER_BUSY', message: known ? error.message : 'Máy chủ đang bận. Hãy thử lại.' });
    }
  };
}
module.exports = { createServerlessHandler };
