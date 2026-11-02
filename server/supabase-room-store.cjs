'use strict';
const { HttpError } = require('./http-guards.cjs');
// Preview-only RPCs never claim or write the existing production singleton.
class SupabaseRoomStore {
  constructor({ url, key, fetch: request = globalThis.fetch, budgetMs = 24000 }) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !key) throw Error('Invalid trial storage configuration');
    this.url = parsed.origin; this.key = key; this.request = request; this.deadline = performance.now() + budgetMs;
  }
  async call(name, body) {
    const remaining = Math.floor(this.deadline - performance.now());
    if (remaining <= 0) { const error = Error('Trial request deadline exceeded'); error.name = 'TimeoutError'; throw error; }
    const response = await this.request(this.url + '/rest/v1/rpc/game_trial_' + name, {
      method: 'POST', headers: { apikey: this.key, Authorization: 'Bearer ' + this.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(Math.min(8000, remaining))
    });
    if (!response.ok) { const error = Error('Trial storage unavailable'); error.status = response.status; throw error; }
    return response.json();
  }
  async limit(source, operation) {
    const result = await this.call('limit', { source_hash: source, operation });
    if (!result.allowed) throw new HttpError('RATE_LIMITED', 'Quá nhiều yêu cầu. Hãy thử lại sau.', 429);
  }
  read(code, scope, requestId) { return this.call('read', { room_code: code, scope_hash: scope || null, request_id: requestId || null }); }
  async commit(value) {
    const result = await this.call('commit', { room_code: value.code, expected_version: value.expectedVersion, new_payload: value.payload, scope_hash: value.scope, request_id: value.requestId, request_hash: value.requestHash, public_response: value.response, source_hash: value.source, operation: value.operation });
    if (result.error === 'ADMISSION_LIMIT') throw new HttpError('ADMISSION_LIMIT', 'Mạng của bạn đang giữ quá nhiều phòng hoặc chỗ chơi. Hãy rời phòng không dùng rồi thử lại.', 429);
    if (result.error === 'SERVER_BUSY') throw new HttpError('SERVER_BUSY', 'Máy chủ đang đầy. Hãy thử lại sau.', 503);
    return result;
  }
}
module.exports = { SupabaseRoomStore };
