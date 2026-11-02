'use strict';

class DurableCoordinator {
  constructor({ capture, restore, commit, onCommitted = () => {}, batchMs = 16, maxPending = 2000, failClosed = false }) {
    Object.assign(this, { capture, restore, commit, onCommitted, batchMs, maxPending, failClosed });
    this.unavailable = false;
    this.queue = [];
    this.running = false;
    this.timer = null;
    this.current = null;
  }

  run(fn) {
    if (this.unavailable) return Promise.reject(new Error('Remote storage unavailable'));
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
      for (const task of tasks) task.reject(new Error('Remote storage unavailable'));
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
      if (batch.dirty) {
        try { await this.commit(); }
        catch (error) {
          if (this.failClosed) this.unavailable = true;
          try { await this.restore(checkpoint); } catch (restoreError) { error = restoreError; }
          for (const task of tasks) task.reject(task.error || error);
          return;
        }
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
