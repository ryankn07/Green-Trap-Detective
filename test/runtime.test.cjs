'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const zlib = require('node:zlib');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { server, manager } = require('../server/server.cjs');

let baseUrl;

test.before(async () => {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
});

async function post(url, body) {
  const response = await fetch(baseUrl + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { response, body: await response.json() };
}

function getRaw(pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = http.get(new URL(pathname, baseUrl), { headers }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks)
      }));
    });
    request.on('error', reject);
  });
}

test('runtime bundle can restore/validate the original client and project data', () => {
  const files = [
    'public/app.js',
    'public/index.html',
    'public/style.css',
    'engine/dist/data/projects.json'
  ];
  for (const file of files) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', file)), `missing ${file}`);
  }

  const result = spawnSync(process.execPath, [
    path.join(__dirname, '..', 'scripts/restore-runtime-bundle.cjs'),
    '--check'
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /25 project records/);

  // Simulate a checkout with one missing bundled runtime file.
  const stylePath = path.join(__dirname, '..', 'public/style.css');
  const backupPath = stylePath + '.test-backup';
  const originalStyle = fs.readFileSync(stylePath);
  fs.renameSync(stylePath, backupPath);
  try {
    const restored = spawnSync(process.execPath, [
      path.join(__dirname, '..', 'scripts/restore-runtime-bundle.cjs')
    ], { encoding: 'utf8' });
    assert.equal(restored.status, 0, restored.stderr || restored.stdout);
    // Git may check text out with CRLF on Windows; the tar stores LF.
    assert.equal(fs.readFileSync(stylePath, 'utf8').replace(/\r\n/g, '\n'), originalStyle.toString('utf8').replace(/\r\n/g, '\n'));
  } finally {
    if (fs.existsSync(stylePath)) fs.unlinkSync(stylePath);
    if (fs.existsSync(backupPath)) fs.renameSync(backupPath, stylePath);
  }
});

test('static text assets use gzip when accepted and preserve exact identity responses', async () => {
  const assets = [
    ['/','ui/index.html'],
    ['/app.js','public/app.js'],
    ['/style.css','ui/style.css'],
    ['/card-ui.js','ui/card-ui.js'],
    ['/card-webp-manifest.js','ui/card-webp-manifest.js']
  ];
  for (const [url, sourcePath] of assets) {
    const compressed = await getRaw(url, { 'Accept-Encoding': 'gzip' });
    assert.equal(compressed.status, 200, url);
    assert.equal(compressed.headers['content-encoding'], 'gzip', url);
    assert.match(compressed.headers.vary || '', /accept-encoding/i, url);
    const decoded = zlib.gunzipSync(compressed.body);
    const source = fs.readFileSync(path.join(__dirname, '..', sourcePath));
    assert.deepEqual(decoded, source, url + ' must decompress to the exact source bytes');
    assert.ok(compressed.body.length < decoded.length, url + ' gzip response should be smaller');

    const identity = await getRaw(url, { 'Accept-Encoding': 'identity' });
    assert.equal(identity.status, 200, url);
    assert.equal(identity.headers['content-encoding'], undefined, url);
    assert.deepEqual(identity.body, source, url + ' identity response must remain unchanged');
  }
});

test('server starts and serves the real client and Canva project artwork', async () => {
  const health = await fetch(baseUrl + '/health');
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, 'ok');

  const shell = await fetch(baseUrl + '/');
  assert.equal(shell.status, 200);
  assert.match(await shell.text(), /src="\/app\.js"/);

  const client = await fetch(baseUrl + '/app.js');
  assert.equal(client.status, 200);
  const source = await client.text();
  assert.match(source, /captureStatementDraft/);
  assert.match(source, /restoreStatementDraft/);
  assert.match(source, /recoverSession/);
  assert.match(source, /return-home/);
  assert.ok(source.includes('sessionStorage.setItem(draftStorageKey'));

  const card = await fetch(baseUrl + '/cards/PROJ_01.png');
  assert.equal(card.status, 200);
  assert.match(card.headers.get('content-type'), /image\/png/);
  const originalPng = Buffer.from(await card.arrayBuffer());
  assert.ok(originalPng.byteLength > 1000);

  const webpManifest = await fetch(baseUrl + '/card-webp-manifest.js');
  assert.equal(webpManifest.status, 200);
  assert.match(await webpManifest.text(), /window\.GREEN_TRAP_WEBP_CARDS/);

  const webp = await fetch(baseUrl + '/cards-hd-webp/PROJ_01.webp');
  assert.equal(webp.status, 200);
  assert.match(webp.headers.get('content-type'), /image\/webp/);
  const webpBytes = Buffer.from(await webp.arrayBuffer());
  const hdPng = await fetch(baseUrl + '/cards-hd/PROJ_01.png');
  assert.equal(hdPng.status, 200);
  const hdPngBytes = Buffer.from(await hdPng.arrayBuffer());
  assert.ok(webpBytes.length < hdPngBytes.length, 'lossless WebP is smaller than the native HD PNG');
  assert.equal(webpBytes.subarray(8, 12).toString(), 'WEBP');
  assert.equal(hdPngBytes.subarray(1, 4).toString(), 'PNG');
});

test('restored project data lets a three-player room start with the real engine', async () => {
  const host = await post('/api/create', { name: 'Host' });
  assert.equal(host.response.status, 200);
  const roomCode = host.body.roomCode;

  const second = await post('/api/join', { roomCode, name: 'Player 2' });
  const third = await post('/api/join', { roomCode, name: 'Player 3' });
  assert.equal(second.response.status, 200);
  assert.equal(third.response.status, 200);

  const room = manager.getRoom(roomCode);
  for (const player of room.players) manager.connected(room, player);
  manager.start(room, room.players[0]);

  const view = manager.view(room, room.players[0]);
  assert.equal(view.game.phase, 'DEBATE');
  assert.equal(view.game.players.length, 3);
  assert.match(view.game.project.id, /^PROJ_\d{2}$/);
  assert.equal(view.game.myPlayer.coins, 2);
  for (const other of view.game.players.filter(player => player.id !== room.players[0].id)) {
    assert.equal(Object.hasOwn(other, 'role'), false, 'other players’ roles must remain private');
  }
});

test('expired rooms return a typed error that the client can recover from', async () => {
  const created = await post('/api/create', { name: 'Expired host' });
  assert.equal(created.response.status, 200);
  const roomCode = created.body.roomCode;
  const room = manager.getRoom(roomCode);

  room.lastActivity = Date.now() - 4 * 60 * 60 * 1000 - 1;
  manager.tick();
  assert.equal(manager.rooms.has(roomCode), false);

  const response = await fetch(baseUrl + `/api/state?room=${roomCode}`, {
    headers: { Authorization: `Bearer ${created.body.token}` }
  });
  assert.equal(response.status, 404);
  const error = await response.json();
  assert.equal(error.error, 'ROOM_NOT_FOUND');
  assert.match(error.message, /không tìm thấy phòng/i);
});
