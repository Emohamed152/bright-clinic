const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connect } = require('./db');
const { User, Service, Patient, Appointment, Payment } = require('./models');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '20kb' }));

// CORS: only the website(s) listed in FRONTEND_ORIGIN may call the API from a browser.
app.use(cors((req, cb) => {
  const allowed = (process.env.FRONTEND_ORIGIN || '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
  const origin = req.header('Origin');
  cb(null, { origin: !origin || allowed.includes(origin), allowedHeaders: ['Content-Type', 'Authorization'], maxAge: 600 });
}));

const limiter = (windowMs, max) => rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { error: 'too_many_requests' } });
app.use(limiter(60 * 1000, 120));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg = 'invalid_input') => res.status(400).json({ error: msg });

// ---------- helpers ----------
const str = (v, max, min = 0) => (typeof v === 'string' && v.trim().length >= min && v.trim().length <= max ? v.trim() : null);
const phoneOk = (v) => typeof v === 'string' && /^[0-9+\s-]{7,20}$/.test(v.trim());
const dateOk = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const timeOk = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const idOk = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hashIp = (ip) => crypto.createHash('sha256').update(`${ip}|${process.env.JWT_SECRET || ''}`).digest('hex').slice(0, 32);
const cairoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
const STATUSES = ['pending', 'confirmed', 'done', 'canceled'];

function configured() {
  return Boolean(process.env.MONGODB_URI) && (process.env.JWT_SECRET || '').length >= 32;
}

// Health check (no private info).
app.get(['/', '/api', '/api/health'], (req, res) => res.json({ ok: true, configured: configured() }));

app.use(wrap(async (req, res, next) => {
  if (!configured()) return res.status(500).json({ error: 'server_not_configured' });
  try { await connect(); } catch (e) { return res.status(503).json({ error: 'database_unavailable' }); }
  next();
}));

// ---------- auth ----------
const signToken = (u) => jwt.sign({ sub: String(u._id), role: u.role }, process.env.JWT_SECRET, { expiresIn: '12h' });

const requireAuth = (roles) => wrap(async (req, res, next) => {
  const h = req.header('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); } catch (e) { return res.status(401).json({ error: 'unauthorized' }); }
  const user = idOk(String(payload.sub)) ? await User.findById(payload.sub) : null;
  if (!user || !user.active) return res.status(401).json({ error: 'unauthorized' });
  if (roles && !roles.includes(user.role)) return res.status(403).json({ error: 'forbidden' });
  req.user = user;
  next();
});
const staff = requireAuth();
const doctorOnly = requireAuth(['doctor']);

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

app.post('/api/auth/login', limiter(15 * 60 * 1000, 30), wrap(async (req, res) => {
  const email = str(req.body.email, 120, 3);
  const password = typeof req.body.password === 'string' ? req.body.password : null;
  if (!email || !password || password.length > 200) return bad(res);
  const user = await User.findOne({ email: email.toLowerCase() });
  if (user && user.lockUntil && user.lockUntil > new Date()) return res.status(429).json({ error: 'locked' });
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !user.active || !ok) {
    if (user) {
      user.failedAttempts += 1;
      if (user.failedAttempts >= 5) { user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); user.failedAttempts = 0; }
      await user.save();
    }
    return res.status(401).json({ error: 'wrong_credentials' });
  }
  user.failedAttempts = 0; user.lockUntil = null; await user.save();
  res.json({ token: signToken(user), user: { id: user._id, name: user.name, role: user.role } });
}));

app.get('/api/auth/me', staff, (req, res) => res.json({ user: { id: req.user._id, name: req.user.name, role: req.user.role } }));

// One-time creation of the FIRST doctor account. Needs the SETUP_CODE env variable and works only while there are no users.
app.post('/api/setup', limiter(15 * 60 * 1000, 10), wrap(async (req, res) => {
  const expected = process.env.SETUP_CODE || '';
  const given = typeof req.body.setupCode === 'string' ? req.body.setupCode : '';
  const a = Buffer.from(given), b = Buffer.from(expected);
  if (expected.length < 8 || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(403).json({ error: 'forbidden' });
  if (await User.countDocuments() > 0) return res.status(403).json({ error: 'already_set_up' });
  const name = str(req.body.name, 80, 2), email = str(req.body.email, 120, 5), password = req.body.password;
  if (!name || !email || !email.includes('@') || typeof password !== 'string' || password.length < 10 || password.length > 200) return bad(res);
  const u = await User.create({ name, email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12), role: 'doctor' });
  res.status(201).json({ ok: true, id: u._id });
}));

// ---------- public ----------
app.get('/api/services', wrap(async (req, res) => {
  const items = await Service.find({ active: true }).sort({ name: 1 }).select('name price description').lean();
  res.json({ services: items.map((s) => ({ id: s._id, name: s.name, price: s.price, description: s.description })) });
}));

// Booking REQUEST: only creates a pending appointment. Returns nothing but ok:true. Cannot read anything.
app.post('/api/bookings', limiter(60 * 60 * 1000, 10), wrap(async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.status(201).json({ ok: true }); // honeypot: bots fill this hidden field
  const name = str(b.name, 100, 2), note = b.note ? str(b.note, 500) : '';
  if (!name || !phoneOk(b.phone) || !dateOk(b.date) || !timeOk(b.time) || note === null) return bad(res);
  if (b.date < cairoToday() || Date.parse(b.date) > Date.now() + 180 * 864e5) return bad(res, 'invalid_date');
  let service = null;
  if (b.serviceId) {
    if (!idOk(b.serviceId)) return bad(res);
    service = await Service.findOne({ _id: b.serviceId, active: true });
    if (!service) return bad(res);
  }
  const ipHash = hashIp(req.ip);
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const phone = b.phone.trim();
  if (await Appointment.countDocuments({ ipHash, createdAt: { $gt: since }, source: 'online' }) >= 8
    || await Appointment.countDocuments({ phone, createdAt: { $gt: since }, source: 'online' }) >= 4) {
    return res.status(429).json({ error: 'too_many_requests' });
  }
  await Appointment.create({ patientName: name, phone, service: service ? service._id : null, serviceName: service ? service.name : '', date: b.date, time: b.time, note, source: 'online', ipHash });
  res.status(201).json({ ok: true });
}));

// ---------- staff: appointments ----------
app.get('/api/appointments', staff, wrap(async (req, res) => {
  const q = {};
  if (req.query.status !== undefined) { if (!STATUSES.includes(req.query.status)) return bad(res); q.status = req.query.status; }
  if (req.query.date !== undefined) { if (!dateOk(req.query.date)) return bad(res); q.date = req.query.date; }
  const items = await Appointment.find(q).sort({ date: 1, time: 1 }).limit(500).select('-ipHash').lean();
  res.json({ appointments: items });
}));

async function ensurePatient(a) {
  if (a.patient) return a.patient;
  let p = await Patient.findOne({ phone: a.phone, name: a.patientName });
  if (!p) p = await Patient.create({ name: a.patientName, phone: a.phone });
  return p._id;
}

app.post('/api/appointments', staff, wrap(async (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 100, 2), note = b.note ? str(b.note, 500) : '';
  if (!name || !phoneOk(b.phone) || !dateOk(b.date) || !timeOk(b.time) || note === null) return bad(res);
  let service = null;
  if (b.serviceId) { if (!idOk(b.serviceId)) return bad(res); service = await Service.findById(b.serviceId); if (!service) return bad(res); }
  const a = await Appointment.create({ patientName: name, phone: b.phone.trim(), service: service && service._id, serviceName: service ? service.name : '', date: b.date, time: b.time, note, status: 'confirmed', source: 'staff' });
  a.patient = await ensurePatient(a); await a.save();
  res.status(201).json({ appointment: a });
}));

app.patch('/api/appointments/:id', staff, wrap(async (req, res) => {
  if (!idOk(req.params.id)) return bad(res);
  const a = await Appointment.findById(req.params.id);
  if (!a) return res.status(404).json({ error: 'not_found' });
  const b = req.body || {};
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return bad(res);
    a.status = b.status;
    if (b.status === 'confirmed' || b.status === 'done') a.patient = await ensurePatient(a);
  }
  if (b.date !== undefined) { if (!dateOk(b.date)) return bad(res); a.date = b.date; }
  if (b.time !== undefined) { if (!timeOk(b.time)) return bad(res); a.time = b.time; }
  await a.save();
  res.json({ appointment: a });
}));

// ---------- staff: patients ----------
app.get('/api/patients', staff, wrap(async (req, res) => {
  const q = {};
  if (req.query.q !== undefined) {
    const s = str(String(req.query.q), 60, 1);
    if (s) { const r = new RegExp(esc(s), 'i'); q.$or = [{ name: r }, { phone: r }]; }
  }
  res.json({ patients: await Patient.find(q).sort({ createdAt: -1 }).limit(100).lean() });
}));

app.post('/api/patients', staff, wrap(async (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 100, 2), notes = b.notes ? str(b.notes, 2000) : '';
  const age = b.age === undefined || b.age === null || b.age === '' ? null : Number(b.age);
  if (!name || !phoneOk(b.phone) || notes === null || (age !== null && !(age >= 0 && age <= 120))) return bad(res);
  res.status(201).json({ patient: await Patient.create({ name, phone: b.phone.trim(), age, notes }) });
}));

app.get('/api/patients/:id', staff, wrap(async (req, res) => {
  if (!idOk(req.params.id)) return bad(res);
  const patient = await Patient.findById(req.params.id).lean();
  if (!patient) return res.status(404).json({ error: 'not_found' });
  const [appointments, payments] = await Promise.all([
    Appointment.find({ patient: patient._id }).sort({ date: -1 }).select('-ipHash').lean(),
    Payment.find({ patient: patient._id }).sort({ paidAt: -1 }).lean(),
  ]);
  res.json({ patient, appointments, payments });
}));

app.patch('/api/patients/:id', staff, wrap(async (req, res) => {
  if (!idOk(req.params.id)) return bad(res);
  const p = await Patient.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'not_found' });
  const b = req.body || {};
  if (b.notes !== undefined) { const n = str(String(b.notes), 2000); if (n === null && b.notes !== '') return bad(res); p.notes = n || ''; }
  if (b.phone !== undefined) { if (!phoneOk(b.phone)) return bad(res); p.phone = b.phone.trim(); }
  if (b.name !== undefined) { const n = str(b.name, 100, 2); if (!n) return bad(res); p.name = n; }
  await p.save();
  res.json({ patient: p });
}));

// ---------- staff: payments ----------
app.get('/api/payments', staff, wrap(async (req, res) => {
  const q = {};
  if (req.query.month !== undefined) {
    if (!/^\d{4}-\d{2}$/.test(req.query.month)) return bad(res);
    const start = new Date(`${req.query.month}-01T00:00:00.000Z`);
    const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
    q.paidAt = { $gte: start, $lt: end };
  }
  const payments = await Payment.find(q).sort({ paidAt: -1 }).limit(500).populate('patient', 'name phone').lean();
  res.json({ payments, total: payments.reduce((s, p) => s + p.amount, 0) });
}));

app.post('/api/payments', staff, wrap(async (req, res) => {
  const b = req.body || {};
  const amount = Number(b.amount), note = b.note ? str(b.note, 300) : '';
  if (!idOk(b.patientId) || !(amount > 0 && amount <= 1e7) || !['cash', 'card', 'other'].includes(b.method || 'cash') || note === null) return bad(res);
  if (!(await Patient.exists({ _id: b.patientId }))) return bad(res);
  const p = await Payment.create({ patient: b.patientId, amount, method: b.method || 'cash', note, createdBy: req.user._id });
  res.status(201).json({ payment: p });
}));

// ---------- staff: services (doctor edits, everyone staff can read all) ----------
app.get('/api/staff/services', staff, wrap(async (req, res) => res.json({ services: await Service.find().sort({ name: 1 }).lean() })));

app.post('/api/staff/services', doctorOnly, wrap(async (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 100, 2), description = b.description ? str(b.description, 300) : '', price = Number(b.price);
  if (!name || !(price >= 0 && price <= 1e6) || description === null) return bad(res);
  res.status(201).json({ service: await Service.create({ name, price, description }) });
}));

app.patch('/api/staff/services/:id', doctorOnly, wrap(async (req, res) => {
  if (!idOk(req.params.id)) return bad(res);
  const s = await Service.findById(req.params.id);
  if (!s) return res.status(404).json({ error: 'not_found' });
  const b = req.body || {};
  if (b.price !== undefined) { const p = Number(b.price); if (!(p >= 0 && p <= 1e6)) return bad(res); s.price = p; }
  if (b.name !== undefined) { const n = str(b.name, 100, 2); if (!n) return bad(res); s.name = n; }
  if (b.description !== undefined) { const d = str(String(b.description), 300); if (d === null && b.description !== '') return bad(res); s.description = d || ''; }
  if (b.active !== undefined) { if (typeof b.active !== 'boolean') return bad(res); s.active = b.active; }
  await s.save();
  res.json({ service: s });
}));

// ---------- doctor: staff accounts ----------
app.get('/api/users', doctorOnly, wrap(async (req, res) => res.json({ users: await User.find().select('name email role active createdAt').lean() })));

app.post('/api/users', doctorOnly, wrap(async (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 80, 2), email = str(b.email, 120, 5);
  if (!name || !email || !email.includes('@') || !['doctor', 'reception'].includes(b.role) || typeof b.password !== 'string' || b.password.length < 10 || b.password.length > 200) return bad(res);
  if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ error: 'email_exists' });
  const u = await User.create({ name, email: email.toLowerCase(), passwordHash: await bcrypt.hash(b.password, 12), role: b.role });
  res.status(201).json({ user: { id: u._id, name: u.name, email: u.email, role: u.role } });
}));

app.patch('/api/users/:id', doctorOnly, wrap(async (req, res) => {
  if (!idOk(req.params.id) || typeof (req.body || {}).active !== 'boolean') return bad(res);
  if (String(req.user._id) === req.params.id) return bad(res, 'cannot_change_self');
  const u = await User.findByIdAndUpdate(req.params.id, { active: req.body.active }, { new: true }).select('name email role active');
  if (!u) return res.status(404).json({ error: 'not_found' });
  res.json({ user: u });
}));

app.use((req, res) => res.status(404).json({ error: 'not_found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => { console.error(err.message); res.status(500).json({ error: 'server_error' }); });

module.exports = app;
