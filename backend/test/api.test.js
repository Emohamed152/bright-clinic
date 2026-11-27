const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod, server, base, doctorToken, receptionToken, serviceId, apptId, patientId;
const call = async (method, path, body, token, headers = {}) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch (e) {}
  return { status: r.status, json };
};
const future = () => new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('clinic_test');
  process.env.JWT_SECRET = 'x'.repeat(40);
  process.env.SETUP_CODE = 'setup-code-1234';
  process.env.FRONTEND_ORIGIN = 'https://site.example';
  const app = require('../src/app');
  await new Promise((res) => { server = app.listen(0, res); });
  base = `http://localhost:${server.address().port}`;
});
after(async () => { server && server.close(); await require('mongoose').disconnect(); await mongod.stop(); });

test('first doctor setup needs the code and works once', async () => {
  const body = { name: 'Dr Test', email: 'Doc@Example.com', password: 'a-long-password-1' };
  assert.equal((await call('POST', '/api/setup', { ...body, setupCode: 'wrong-code-xx' })).status, 403);
  assert.equal((await call('POST', '/api/setup', { ...body, setupCode: 'setup-code-1234' })).status, 201);
  assert.equal((await call('POST', '/api/setup', { ...body, email: 'b@example.com', setupCode: 'setup-code-1234' })).status, 403);
});

test('login: wrong password rejected, right password works', async () => {
  assert.equal((await call('POST', '/api/auth/login', { email: 'doc@example.com', password: 'nope-nope-nope' })).status, 401);
  const r = await call('POST', '/api/auth/login', { email: 'doc@example.com', password: 'a-long-password-1' });
  assert.equal(r.status, 200); doctorToken = r.json.token;
  assert.equal(r.json.user.role, 'doctor');
});

test('logged-out requests cannot read ANY private data', async () => {
  for (const p of ['/api/appointments', '/api/patients', '/api/patients/aaaaaaaaaaaaaaaaaaaaaaaa', '/api/payments', '/api/users', '/api/staff/services', '/api/auth/me']) {
    const r = await call('GET', p);
    assert.equal(r.status, 401, p);
  }
  assert.equal((await call('GET', '/api/appointments', null, 'garbage.token.value')).status, 401);
  for (const [m, p] of [['POST', '/api/payments'], ['POST', '/api/patients'], ['POST', '/api/appointments'], ['POST', '/api/users'], ['POST', '/api/staff/services'], ['PATCH', '/api/appointments/aaaaaaaaaaaaaaaaaaaaaaaa']]) {
    assert.equal((await call(m, p, { x: 1 })).status, 401, m + p);
  }
});

test('doctor adds a service; public sees only name/price/description of active ones', async () => {
  const r = await call('POST', '/api/staff/services', { name: 'كشف', price: 100, description: 'test' }, doctorToken);
  assert.equal(r.status, 201); serviceId = r.json.service._id;
  const hidden = await call('POST', '/api/staff/services', { name: 'مخفي', price: 5 }, doctorToken);
  await call('PATCH', `/api/staff/services/${hidden.json.service._id}`, { active: false }, doctorToken);
  const pub = await call('GET', '/api/services');
  assert.equal(pub.status, 200);
  assert.equal(pub.json.services.length, 1);
  assert.deepEqual(Object.keys(pub.json.services[0]).sort(), ['description', 'id', 'name', 'price']);
});

test('public booking creates a pending request and returns nothing private', async () => {
  const r = await call('POST', '/api/bookings', { name: 'مريض تجربة', phone: '01012345678', serviceId, date: future(), time: '18:00' });
  assert.equal(r.status, 201); assert.deepEqual(r.json, { ok: true });
  assert.equal((await call('POST', '/api/bookings', { name: 'x', phone: 'abc', date: 'bad', time: '99' })).status, 400);
  assert.equal((await call('POST', '/api/bookings', { name: 'مريض', phone: '01012345678', date: '2000-01-01', time: '18:00' })).status, 400);
  assert.equal((await call('POST', '/api/bookings', { name: 'مريض', phone: '01012345678', serviceId: { $ne: null }, date: future(), time: '18:00' })).status, 400);
  const bot = await call('POST', '/api/bookings', { name: 'bot', phone: '01099999999', date: future(), time: '18:00', website: 'spam.com' });
  assert.equal(bot.status, 201);
});

test('same phone cannot flood bookings', async () => {
  let last;
  for (let i = 0; i < 6; i++) last = await call('POST', '/api/bookings', { name: 'مكرر', phone: '01055555555', date: future(), time: '17:00' });
  assert.equal(last.status, 429);
});

test('staff sees the request; honeypot spam was not stored; ipHash not leaked', async () => {
  const r = await call('GET', '/api/appointments', null, doctorToken);
  assert.equal(r.status, 200);
  assert.ok(r.json.appointments.find((a) => a.patientName === 'مريض تجربة' && a.status === 'pending'));
  assert.ok(!r.json.appointments.find((a) => a.patientName === 'bot'));
  assert.ok(!('ipHash' in r.json.appointments[0]));
  apptId = r.json.appointments.find((a) => a.patientName === 'مريض تجربة')._id;
});

test('confirming creates a searchable patient; payments work', async () => {
  const c = await call('PATCH', `/api/appointments/${apptId}`, { status: 'confirmed' }, doctorToken);
  assert.equal(c.status, 200); assert.ok(c.json.appointment.patient);
  const s = await call('GET', '/api/patients?q=0101234', null, doctorToken);
  assert.equal(s.json.patients.length, 1); patientId = s.json.patients[0]._id;
  const s2 = await call('GET', '/api/patients?q=' + encodeURIComponent('.*'), null, doctorToken);
  assert.equal(s2.status, 200); assert.equal(s2.json.patients.length, 0); // regex is escaped
  assert.equal((await call('POST', '/api/payments', { patientId, amount: 250, method: 'cash' }, doctorToken)).status, 201);
  assert.equal((await call('POST', '/api/payments', { patientId, amount: -5 }, doctorToken)).status, 400);
  const d = await call('GET', `/api/patients/${patientId}`, null, doctorToken);
  assert.equal(d.json.payments.length, 1); assert.equal(d.json.appointments.length, 1);
  const all = await call('GET', '/api/payments', null, doctorToken);
  assert.equal(all.json.total, 250);
});

test('NoSQL operator injection is rejected', async () => {
  const r = await call('POST', '/api/auth/login', { email: { $gt: '' }, password: { $gt: '' } });
  assert.equal(r.status, 400);
});

test('reception role: can work with appointments, cannot edit services or users', async () => {
  assert.equal((await call('POST', '/api/users', { name: 'Reception', email: 'rec@example.com', password: 'another-long-pass', role: 'reception' }, doctorToken)).status, 201);
  const r = await call('POST', '/api/auth/login', { email: 'rec@example.com', password: 'another-long-pass' });
  receptionToken = r.json.token;
  assert.equal((await call('GET', '/api/appointments', null, receptionToken)).status, 200);
  assert.equal((await call('POST', '/api/staff/services', { name: 'ز', price: 1 }, receptionToken)).status, 403);
  assert.equal((await call('GET', '/api/users', null, receptionToken)).status, 403);
  assert.equal((await call('POST', '/api/users', { name: 'X', email: 'x@example.com', password: 'another-long-pass', role: 'doctor' }, receptionToken)).status, 403);
});

test('deactivated staff token stops working immediately', async () => {
  const users = await call('GET', '/api/users', null, doctorToken);
  const rec = users.json.users.find((u) => u.email === 'rec@example.com');
  assert.equal((await call('PATCH', `/api/users/${rec._id}`, { active: false }, doctorToken)).status, 200);
  assert.equal((await call('GET', '/api/appointments', null, receptionToken)).status, 401);
});

test('account locks after repeated wrong passwords', async () => {
  let last;
  for (let i = 0; i < 6; i++) last = await call('POST', '/api/auth/login', { email: 'doc@example.com', password: 'wrong-wrong-wrong' });
  assert.equal(last.status, 429);
  assert.equal((await call('POST', '/api/auth/login', { email: 'doc@example.com', password: 'a-long-password-1' })).status, 429);
});

test('CORS: allowed site gets the header, other sites do not', async () => {
  const ok = await fetch(base + '/api/services', { headers: { Origin: 'https://site.example' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://site.example');
  const no = await fetch(base + '/api/services', { headers: { Origin: 'https://evil.example' } });
  assert.equal(no.headers.get('access-control-allow-origin'), null);
});
