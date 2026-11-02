'use strict';
const { createServerlessHandler } = require('../server/serverless-game.cjs');
const { SupabaseRoomStore } = require('../server/supabase-room-store.cjs');
module.exports = async function game(req, res) {
  let store;
  try {
    if (process.env.GAME_TRIAL_ENABLED === '1') store = new SupabaseRoomStore({ url: process.env.GAME_SUPABASE_URL, key: process.env.GAME_SUPABASE_SERVICE_KEY });
  } catch { /* Missing configuration fails closed; no in-memory fallback. */ }
  return createServerlessHandler({ store })(req, res);
};
