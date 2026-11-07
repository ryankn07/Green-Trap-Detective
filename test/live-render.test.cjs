'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('peer updates retain the form, project, open history and focus across desktop and phone', {skip: !process.env.PLAYWRIGHT_MODULE_PATH}, async () => {
  const {chromium} = require(process.env.PLAYWRIGHT_MODULE_PATH);
  const {server, manager} = require('../server/server.cjs');
  let browser;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true});
    for (const width of [1440, 390]) {
      const {room, player} = manager.create('Live render');
      for (const name of ['An', 'Bình', 'Chi', 'Dũng']) manager.join(room.code, name);
      room.players.forEach(peer => manager.connected(room, peer));
      manager.start(room, player);
      const page = await browser.newPage({viewport: {width, height: 900}, reducedMotion: 'reduce'});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(session => sessionStorage.setItem('green-impact-multiplayer-session', JSON.stringify(session)), {roomCode: room.code, playerId: player.id, token: player.secret});
      await page.goto('http://127.0.0.1:' + server.address().port);
      await page.locator('#statement').waitFor();
      await page.locator('.gi-area-project img').waitFor();
      await page.locator('#statement-text').fill('Kiểm tra tác động dài hạn.');
      await page.evaluate(() => {
        document.querySelector('.gi-history').open = true;
        const field = document.getElementById('statement-text');
        field.focus(); field.setSelectionRange(5, 9);
        window.retained = {form: document.getElementById('statement'), project: document.querySelector('.gi-area-project'), field, history: document.querySelector('.gi-history')};
      });
      const checkRevision = () => page.waitForFunction(revision => snapshot.room.revision >= revision, room.revision);
      manager.submit(room, room.players[1], {text: '<img src=x onerror=alert(1)>', stance: 'UNSURE'});
      await checkRevision();
      assert.deepEqual(await page.evaluate(() => ({
        form: retained.form === document.getElementById('statement'),
        project: retained.project === document.querySelector('.gi-area-project'),
        history: retained.history === document.querySelector('.gi-history') && retained.history.open,
        focus: document.activeElement === retained.field,
        selection: [retained.field.selectionStart, retained.field.selectionEnd]
      })), {form: true, project: true, history: true, focus: true, selection: [5, 9]});
      assert.equal(await page.locator('.gi-chat-bubble p').innerText(), '<img src=x onerror=alert(1)>');
      assert.equal(await page.locator('.gi-chat-bubble img').count(), 0, 'incremental text stays escaped');
      manager.skipDiscussion(room, room.players[1]);
      manager.disconnected(room, room.players[2]);
      await checkRevision();
      assert.equal(await page.locator('.gi-skip-count').innerText(), '1/5');
      assert.match(await page.locator('.person[data-player-id="' + room.players[2].id + '"]>.pill').innerText(), /Offline/);
      assert.equal(await page.locator('#statement').evaluate(node => node === retained.form), true);
      for (const peer of room.players) manager.skipDiscussion(room, peer);
      await page.locator('#action-form').waitFor();
      await page.waitForFunction(() => !phaseScreen && !actionBurnHold);
      assert.equal(await page.locator('.gi-history').evaluate(node => node.open), true, 'phase changes preserve history expansion');
      await page.locator('#bank').selectOption('EXPEL');
      await page.locator('#target').selectOption(room.players[3].id);
      await page.locator('#amount').selectOption('2');
      await page.locator('#target').focus();
      await page.evaluate(() => {window.retainedAction = document.getElementById('action-form'); window.retainedTarget = document.getElementById('target');});
      manager.submit(room, room.players[1], {action: {invest: false, bankAction: {type: 'NONE'}}});
      await checkRevision();
      assert.equal(await page.evaluate(() => retainedAction === document.getElementById('action-form') && document.activeElement === retainedTarget), true);
      assert.equal(await page.locator('#target').inputValue(), room.players[3].id);
      assert.equal(await page.locator('#amount').inputValue(), '2');
      assert.match(await page.locator('.person[data-player-id="' + room.players[1].id + '"] small').innerText(), /Đã chốt/);
      // A host removal really changes the available targets and must update the form.
      manager.kick(room, player, room.players[4].id);
      await checkRevision();
      assert.equal(await page.locator('#target option[value="' + room.players[4].id + '"]').count(), 0);
      assert.equal(await page.locator('#target').evaluate(node => node === document.activeElement), true);
      assert.equal(await page.locator('.gi-history').evaluate(node => node.open), true);
      await page.locator('.gi-area-project img').evaluate(image => image.decode());
      await page.evaluate(() => {window.projectBeforeLock = document.querySelector('.gi-area-project');});
      await page.locator('#bank').selectOption('NONE');
      await page.locator('#invest').check();
      await page.locator('#lock-action').click();
      await page.waitForFunction(() => Boolean(snapshot.game.myPlayer.lockedAction));
      assert.equal(await page.evaluate(() => projectBeforeLock === document.querySelector('.gi-area-project') && projectBeforeLock.querySelector('img').naturalWidth > 0), true, 'own confirmation retains the decoded project for investment feedback');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
