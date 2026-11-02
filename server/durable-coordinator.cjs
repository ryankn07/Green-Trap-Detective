'use strict';

class DurableCoordinator {
  constructor({ capture, restore, commit, verify = async () => {}, onUnavailable = () => {}, onCommitted = () => {}, batchMs = 16, maxPending = 2000, failClosed = false }) {
    Object.assign(this, { capture, restore, commit, verify, onUnavailable, onCommitted, batchMs, maxPending, failClosed });
    this.unavailable = false;
    this.queue = [];
    this.running = false;
    this.timer = null;
    this.current = null;
  }

  run(fn) {
    if (this.unavailable) return Promise.reject(this.unavailableError());
    if (this.queue.length >= this.maxPending) {
      const error = new Error('Server is busy. Please try again.');
      error.code = 'SERVER_BUSY';
      return Promise.reject(error);
    }
    const result = new Promise((resolve, reject) => this.queue.push({ fn, resolve, reject }));
    this.schedule();
    return result;
  }

  read(fn) { return this.run(fn); }

  unavailableError() { const error = new Error('Remote storage unavailable'); error.code = 'SERVER_BUSY'; error.public = true; return error; }

  markChanged(room) {
    if (!this.current) throw new Error('markChanged must be called inside a queued callback');
    this.current.dirty = true;
    if (room !== undefined) this.current.rooms.add(room);
  }

  schedule() {
    if (!this.running && !this.timer && this.queue.length) {
      this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, this.batchMs);
    }
  }

  async flush() {
    if (this.running || !this.queue.length) return;
    this.running = true;
    const tasks = this.queue.splice(0);
    if (this.unavailable) {
      for (const task of tasks) task.reject(this.unavailableError());
      this.running = false;
      this.schedule();
      return;
    }
    const batch = { dirty: false, rooms: new Set() };
    this.current = batch;
    let checkpoint;
    try {
      checkpoint = this.capture();
      for (const task of tasks) {
        try {
          task.value = task.fn();
          if (task.value && typeof task.value.then === 'function') throw new TypeError('Callbacks must be synchronous');
        } catch (error) { task.error = error; }
      }
      this.current = null;
      {
        try { if (batch.dirty) await this.commit(); else await this.verify(); }
        catch (error) {
          if (this.failClosed) { this.unavailable = true; try { this.onUnavailable(error); } catch {} }
          try { await this.restore(checkpoint); } catch (restoreError) { error = restoreError; }
          for (const task of tasks) task.reject(this.failClosed ? this.unavailableError() : (task.error || error));
          return;
        }
      }
      if (batch.dirty) {
        try { await this.onCommitted(batch.rooms); }
        catch (error) {
          for (const task of tasks) task.reject(task.error || error);
          return;
        }
      }
      for (const task of tasks) task.error ? task.reject(task.error) : task.resolve(task.value);
    } catch (error) {
      for (const task of tasks) task.reject(task.error || error);
    } finally {
      this.current = null;
      this.running = false;
      this.schedule();
    }
  }
}

module.exports = { DurableCoordinator };
