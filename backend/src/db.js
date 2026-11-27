const mongoose = require('mongoose');
const cache = global.__mongoCache || (global.__mongoCache = { conn: null, promise: null });

// Reuses one connection between serverless calls (important on Vercel).
async function connect() {
  if (cache.conn) return cache.conn;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  if (!cache.promise) {
    cache.promise = mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000, bufferCommands: false });
  }
  try { cache.conn = await cache.promise; } catch (e) { cache.promise = null; throw e; }
  return cache.conn;
}
module.exports = { connect };
