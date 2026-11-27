import React, { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { api, errText, getToken, setToken } from './api';
import lobby from './photos/lobby.jpg';
import { Callout, Caption, ChoiceRow, FileButton, Group, TextField } from './ui';

type Role = 'doctor' | 'reception';
interface Me { id: string; name: string; role: Role }
const egp = (n: number) => `${n.toLocaleString('en-US')}\u00A0ج.م`;
const statusLabel: Record<string, string> = { pending: 'طلب جديد', confirmed: 'مؤكد', done: 'تم', canceled: 'ملغي' };
const methodLabel: Record<string, string> = { cash: 'كاش', card: 'كارت', other: 'أخرى' };

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
    return <>
        <div className="dc-hero dc-hero-small" style={{ backgroundImage: `linear-gradient(180deg, rgb(10 52 56 / 0.7), rgb(10 52 56 / 0.9)), url(${lobby})` }}><span className="dc-gold-tag">للموظفين فقط</span><h1 className="dc-hero-title">{title}</h1></div>
        {children}
    </>;
}

export function Login({ onLogin }: { onLogin: (m: Me) => void }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const go = async () => {
        setBusy(true); setErr('');
        try { const r = await api<{ token: string; user: Me }>('POST', '/api/auth/login', { email, password }); setToken(r.token); onLogin(r.user); }
        catch (e) { setErr(errText(e)); }
        setBusy(false);
    };
    return <Shell title="تسجيل دخول الموظفين">
        <Group label="مركز برايت" heading="دخول">
            <TextField label="الإيميل" value={email} onChange={setEmail} type="email" ltr />
            <TextField label="الباسورد" value={password} onChange={setPassword} type="password" ltr />
            {err && <Callout title="مقدرناش ندخلك" tone="warning">{err}</Callout>}
            <div className="dc-actions"><FileButton variant="primary" pill disabled={!email || !password || busy} onClick={go}>دخول</FileButton></div>
            <Caption><Link to="/" className="dc-stafflink">رجوع لصفحة المرضى</Link></Caption>
        </Group>
    </Shell>;
}

export function Setup() {
    const [f, setF] = useState({ setupCode: '', name: '', email: '', password: '' });
    const [msg, setMsg] = useState(''); const [ok, setOk] = useState(false);
    const nav = useNavigate();
    const set = (k: string) => (v: string) => setF({ ...f, [k]: v });
    const go = async () => {
        setMsg('');
        try { await api('POST', '/api/setup', f); setOk(true); setTimeout(() => nav('/staff'), 1500); }
        catch (e) { setMsg(errText(e)); }
    };
    return <Shell title="إنشاء حساب الدكتور الأول">
        <Group label="مرة واحدة بس" heading="الإعداد الأول">
            <Caption>الصفحة دي بتشتغل بس لو مفيش أي حساب لسه، وبتحتاج كود الإعداد (SETUP_CODE) اللي حطيتيه في Vercel.</Caption>
            <TextField label="كود الإعداد" value={f.setupCode} onChange={set('setupCode')} type="password" ltr />
            <TextField label="الاسم" value={f.name} onChange={set('name')} />
            <TextField label="الإيميل" value={f.email} onChange={set('email')} type="email" ltr />
            <TextField label="الباسورد (10 حروف على الأقل)" value={f.password} onChange={set('password')} type="password" ltr />
            {msg && <Callout title="مقدرناش نكمل" tone="warning">{msg}</Callout>}
            {ok && <Callout title="تمام" tone="note">الحساب اتعمل. هنوديكي لتسجيل الدخول.</Callout>}
            <div className="dc-actions"><FileButton variant="primary" pill disabled={f.password.length < 10 || !f.name || !f.email || !f.setupCode} onClick={go}>إنشاء الحساب</FileButton></div>
        </Group>
    </Shell>;
}

// ---------- appointments ----------
interface Appt { _id: string; patientName: string; phone: string; serviceName: string; date: string; time: string; note: string; status: string; source: string }

function Appointments() {
    const [items, setItems] = useState<Appt[]>([]);
    const [status, setStatus] = useState('pending');
    const [err, setErr] = useState('');
    const load = useCallback(() => api<{ appointments: Appt[] }>('GET', '/api/appointments').then((r) => { setItems(r.appointments); setErr(''); }).catch((e) => setErr(errText(e))), []);
    useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);
    const setS = async (id: string, s: string) => { try { await api('PATCH', `/api/appointments/${id}`, { status: s }); load(); } catch (e) { setErr(errText(e)); } };
    const pending = items.filter((a) => a.status === 'pending').length;
    const shown = items.filter((a) => status === 'all' || a.status === status);
    return <Group label={`${pending} طلب جديد`} heading="الحجوزات">
        <ChoiceRow label="الحالة" value={status} onChange={setStatus} options={[
            { value: 'pending', label: 'طلبات جديدة' }, { value: 'confirmed', label: 'مؤكد' }, { value: 'done', label: 'تم' }, { value: 'canceled', label: 'ملغي' }, { value: 'all', label: 'الكل' }]} />
        {err && <Callout title="خطأ" tone="warning">{err}</Callout>}
        {shown.length === 0 && <Caption>مفيش حجوزات هنا.</Caption>}
        <div className="dc-appts">
            {shown.map((a) => <div className={`dc-appt dc-appt-${a.status}`} key={a._id}>
                <span className="dc-appt-time" dir="ltr">{a.date}<br />{a.time}</span>
                <span className="dc-appt-main">
                    <span className="dc-appt-patient">{a.patientName}</span>
                    <span className="dc-appt-treatment" dir="ltr" style={{ textAlign: 'start' }}>{a.phone}</span>
                    <span className="dc-appt-treatment">{a.serviceName || 'الخدمة غير محددة'}{a.note ? ` · ${a.note}` : ''}</span>
                </span>
                <span className="dc-appt-side">
                    <span className={`dc-badge dc-badge-${a.status}`}>{statusLabel[a.status]}</span>
                    {a.status === 'pending' && <button type="button" className="dc-mini" onClick={() => setS(a._id, 'confirmed')}>تأكيد</button>}
                    {a.status === 'confirmed' && <button type="button" className="dc-mini" onClick={() => setS(a._id, 'done')}>تم الكشف</button>}
                    {(a.status === 'pending' || a.status === 'confirmed') && <button type="button" className="dc-mini" onClick={() => setS(a._id, 'canceled')}>إلغاء</button>}
                </span>
            </div>)}
        </div>
    </Group>;
}

// ---------- patients ----------
interface Patient { _id: string; name: string; phone: string; age: number | null; notes: string }
interface Pay { _id: string; amount: number; method: string; note: string; paidAt: string }

function PatientDetail({ id, onClose }: { id: string; onClose: () => void }) {
    const [d, setD] = useState<{ patient: Patient; appointments: Appt[]; payments: Pay[] } | null>(null);
    const [notes, setNotes] = useState('');
    const [amount, setAmount] = useState(''); const [method, setMethod] = useState('cash'); const [pnote, setPnote] = useState('');
    const [msg, setMsg] = useState('');
    const load = useCallback(() => api<any>('GET', `/api/patients/${id}`).then((r) => { setD(r); setNotes(r.patient.notes || ''); }).catch((e) => setMsg(errText(e))), [id]);
    useEffect(() => { load(); }, [load]);
    if (!d) return <Caption>{msg || 'جاري التحميل...'}</Caption>;
    const paid = d.payments.reduce((s, p) => s + p.amount, 0);
    const saveNotes = async () => { try { await api('PATCH', `/api/patients/${id}`, { notes }); setMsg('اتحفظت الملاحظات.'); } catch (e) { setMsg(errText(e)); } };
    const addPay = async () => { try { await api('POST', '/api/payments', { patientId: id, amount: Number(amount), method, note: pnote || undefined }); setAmount(''); setPnote(''); setMsg('اتسجلت الدفعة.'); load(); } catch (e) { setMsg(errText(e)); } };
    return <div className="dc-panel">
        <div className="dc-panel-head"><h3>{d.patient.name}</h3><button type="button" className="dc-mini" onClick={onClose}>إغلاق</button></div>
        <Caption><span dir="ltr">{d.patient.phone}</span> · إجمالي المدفوع {egp(paid)}</Caption>
        <TextField label="ملاحظات طبية" value={notes} onChange={setNotes} />
        <div className="dc-actions"><FileButton variant="primary" pill onClick={saveNotes}>حفظ الملاحظات</FileButton></div>
        <h3 className="dc-dialog-sub">الزيارات</h3>
        {d.appointments.length === 0 && <Caption>مفيش زيارات.</Caption>}
        {d.appointments.map((a) => <Caption key={a._id}>{a.date} {a.time} · {a.serviceName || '-'} · {statusLabel[a.status]}</Caption>)}
        <h3 className="dc-dialog-sub">المدفوعات</h3>
        {d.payments.map((p) => <Caption key={p._id}>{new Date(p.paidAt).toLocaleDateString('en-GB')} · {egp(p.amount)} · {methodLabel[p.method]}{p.note ? ` · ${p.note}` : ''}</Caption>)}
        <TextField label="المبلغ (ج.م)" value={amount} onChange={setAmount} type="number" ltr />
        <ChoiceRow label="طريقة الدفع" value={method} onChange={setMethod} options={[{ value: 'cash', label: 'كاش' }, { value: 'card', label: 'كارت' }, { value: 'other', label: 'أخرى' }]} />
        <TextField label="ملاحظة (اختياري)" value={pnote} onChange={setPnote} />
        <div className="dc-actions"><FileButton variant="primary" pill disabled={!(Number(amount) > 0)} onClick={addPay}>تسجيل دفعة</FileButton></div>
        {msg && <Caption>{msg}</Caption>}
    </div>;
}

function Patients() {
    const [q, setQ] = useState('');
    const [list, setList] = useState<Patient[]>([]);
    const [open, setOpen] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [np, setNp] = useState({ name: '', phone: '' });
    const [err, setErr] = useState('');
    const load = useCallback(() => api<{ patients: Patient[] }>('GET', `/api/patients?q=${encodeURIComponent(q)}`).then((r) => { setList(r.patients); setErr(''); }).catch((e) => setErr(errText(e))), [q]);
    useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
    const add = async () => { try { await api('POST', '/api/patients', np); setNp({ name: '', phone: '' }); setAdding(false); load(); } catch (e) { setErr(errText(e)); } };
    return <Group label={`${list.length} مريض`} heading="ملفات المرضى">
        <TextField label="دوّري بالاسم أو رقم الموبايل" value={q} onChange={setQ} />
        {err && <Callout title="خطأ" tone="warning">{err}</Callout>}
        {open && <PatientDetail id={open} onClose={() => setOpen(null)} />}
        <div className="dc-patients">
            {list.map((p) => <button type="button" className="dc-patient" key={p._id} onClick={() => setOpen(p._id)}>
                <span className="dc-patient-avatar" aria-hidden>{p.name.trim()[0]}</span>
                <span className="dc-patient-main"><span className="dc-patient-name file-hover-underline">{p.name}</span><span className="dc-patient-sub" dir="ltr" style={{ textAlign: 'start' }}>{p.phone}</span></span>
            </button>)}
            {list.length === 0 && <Caption>مفيش مرضى. المريض بيتسجل لوحده لما تأكدي حجزه، أو ضيفيه بإيدك.</Caption>}
        </div>
        {adding ? <>
            <TextField label="اسم المريض" value={np.name} onChange={(v) => setNp({ ...np, name: v })} />
            <TextField label="الموبايل" value={np.phone} onChange={(v) => setNp({ ...np, phone: v })} type="tel" ltr />
            <div className="dc-actions"><FileButton variant="primary" pill disabled={np.name.trim().length < 2 || np.phone.trim().length < 7} onClick={add}>حفظ المريض</FileButton></div>
        </> : <div className="dc-actions"><FileButton variant="primary" pill onClick={() => setAdding(true)}>مريض جديد</FileButton></div>}
    </Group>;
}

// ---------- payments ----------
function Payments() {
    const month = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }).slice(0, 7);
    const [m, setM] = useState(month);
    const [d, setD] = useState<{ payments: (Pay & { patient: { name: string; phone: string } | null })[]; total: number } | null>(null);
    const [err, setErr] = useState('');
    useEffect(() => { api<any>('GET', `/api/payments?month=${m}`).then(setD).catch((e) => setErr(errText(e))); }, [m]);
    return <Group label="دخل الشهر" heading="المدفوعات">
        <TextField label="الشهر" value={m} onChange={setM} type="month" ltr />
        {err && <Callout title="خطأ" tone="warning">{err}</Callout>}
        {d && <>
            <div className="dc-stats"><div className="dc-stat"><span className="dc-stat-label">إجمالي الشهر</span><span className="dc-stat-value">{egp(d.total)}</span><span className="dc-stat-note">{d.payments.length} دفعة</span></div></div>
            {d.payments.length === 0 && <Caption>مفيش مدفوعات في الشهر ده. بتتسجل من ملف المريض.</Caption>}
            {d.payments.map((p) => <Caption key={p._id}>{new Date(p.paidAt).toLocaleDateString('en-GB')} · {p.patient ? p.patient.name : '-'} · {egp(p.amount)} · {methodLabel[p.method]}</Caption>)}
        </>}
    </Group>;
}

// ---------- services (doctor) ----------
interface Svc { _id: string; name: string; price: number; description: string; active: boolean }
function Services({ me }: { me: Me }) {
    const [list, setList] = useState<Svc[]>([]);
    const [n, setN] = useState(''); const [p, setP] = useState(''); const [ds, setDs] = useState('');
    const [err, setErr] = useState('');
    const load = useCallback(() => api<{ services: Svc[] }>('GET', '/api/staff/services').then((r) => setList(r.services)).catch((e) => setErr(errText(e))), []);
    useEffect(() => { load(); }, [load]);
    const isDoc = me.role === 'doctor';
    const add = async () => { try { await api('POST', '/api/staff/services', { name: n, price: Number(p), description: ds || undefined }); setN(''); setP(''); setDs(''); load(); } catch (e) { setErr(errText(e)); } };
    const patch = async (id: string, body: object) => { try { await api('PATCH', `/api/staff/services/${id}`, body); load(); } catch (e) { setErr(errText(e)); } };
    return <Group label="بتظهر للمرضى" heading="الخدمات والأسعار">
        {err && <Callout title="خطأ" tone="warning">{err}</Callout>}
        {list.length === 0 && <Caption>لسه مفيش خدمات. ضيفي الخدمات الحقيقية بأسعارها.</Caption>}
        {list.map((s) => <div className="dc-appt" key={s._id}>
            <span className="dc-appt-main"><span className="dc-appt-patient">{s.name}</span><span className="dc-appt-treatment">{egp(s.price)}{s.active ? '' : ' · مخفية'}</span></span>
            {isDoc && <span className="dc-appt-side">
                <button type="button" className="dc-mini" onClick={() => { const v = window.prompt('السعر الجديد (ج.م)', String(s.price)); if (v !== null && v.trim() !== '' && !Number.isNaN(Number(v))) patch(s._id, { price: Number(v) }); }}>تعديل السعر</button>
                <button type="button" className="dc-mini" onClick={() => patch(s._id, { active: !s.active })}>{s.active ? 'إخفاء' : 'إظهار'}</button>
            </span>}
        </div>)}
        {isDoc ? <>
            <TextField label="اسم الخدمة" value={n} onChange={setN} />
            <TextField label="السعر (ج.م)" value={p} onChange={setP} type="number" ltr />
            <TextField label="وصف قصير (اختياري)" value={ds} onChange={setDs} />
            <div className="dc-actions"><FileButton variant="primary" pill disabled={n.trim().length < 2 || p === '' || Number(p) < 0} onClick={add}>إضافة خدمة</FileButton></div>
        </> : <Caption>تعديل الخدمات للدكتور بس.</Caption>}
    </Group>;
}

// ---------- team (doctor) ----------
interface U { _id: string; name: string; email: string; role: Role; active: boolean }
function Team({ me }: { me: Me }) {
    const [list, setList] = useState<U[]>([]);
    const [f, setF] = useState({ name: '', email: '', password: '', role: 'reception' });
    const [err, setErr] = useState('');
    const load = useCallback(() => api<{ users: U[] }>('GET', '/api/users').then((r) => setList(r.users)).catch((e) => setErr(errText(e))), []);
    useEffect(() => { if (me.role === 'doctor') load(); }, [load, me.role]);
    if (me.role !== 'doctor') return <Callout title="مش مسموح" tone="warning">إدارة الموظفين للدكتور بس.</Callout>;
    const add = async () => { try { await api('POST', '/api/users', f); setF({ name: '', email: '', password: '', role: 'reception' }); setErr(''); load(); } catch (e) { setErr(errText(e)); } };
    const toggle = async (u: U) => { try { await api('PATCH', `/api/users/${u._id}`, { active: !u.active }); load(); } catch (e) { setErr(errText(e)); } };
    return <Group label="حسابات الدخول" heading="الموظفين">
        {err && <Callout title="خطأ" tone="warning">{err}</Callout>}
        {list.map((u) => <div className="dc-appt" key={u._id}>
            <span className="dc-appt-main"><span className="dc-appt-patient">{u.name}</span><span className="dc-appt-treatment" dir="ltr" style={{ textAlign: 'start' }}>{u.email}</span><span className="dc-appt-treatment">{u.role === 'doctor' ? 'دكتور' : 'استقبال'}{u.active ? '' : ' · موقوف'}</span></span>
            {u._id !== me.id && <button type="button" className="dc-mini" onClick={() => toggle(u)}>{u.active ? 'إيقاف' : 'تفعيل'}</button>}
        </div>)}
        <TextField label="الاسم" value={f.name} onChange={(v) => setF({ ...f, name: v })} />
        <TextField label="الإيميل" value={f.email} onChange={(v) => setF({ ...f, email: v })} type="email" ltr />
        <TextField label="باسورد مبدئي (10 حروف على الأقل)" value={f.password} onChange={(v) => setF({ ...f, password: v })} type="password" ltr />
        <ChoiceRow label="الدور" value={f.role} onChange={(v) => setF({ ...f, role: v })} options={[{ value: 'reception', label: 'استقبال' }, { value: 'doctor', label: 'دكتور' }]} />
        <div className="dc-actions"><FileButton variant="primary" pill disabled={f.name.length < 2 || !f.email || f.password.length < 10} onClick={add}>إضافة موظف</FileButton></div>
    </Group>;
}

// ---------- layout ----------
export function StaffArea() {
    const [me, setMe] = useState<Me | null>(null);
    const [checking, setChecking] = useState(!!getToken());
    useEffect(() => {
        if (!getToken()) return;
        api<{ user: Me }>('GET', '/api/auth/me').then((r) => setMe(r.user)).catch(() => setToken(null)).finally(() => setChecking(false));
    }, []);
    if (checking) return <Caption>جاري التحميل...</Caption>;
    if (!me) return <Login onLogin={setMe} />;
    const logout = () => { setToken(null); setMe(null); };
    return <Shell title={`أهلاً ${me.name}`}>
        <nav className="file-nav" aria-label="أقسام الموظفين">
            <NavLink to="/staff" end>الحجوزات</NavLink>
            <NavLink to="/staff/patients">المرضى</NavLink>
            <NavLink to="/staff/payments">المدفوعات</NavLink>
            <NavLink to="/staff/services">الخدمات</NavLink>
            {me.role === 'doctor' && <NavLink to="/staff/team">الموظفين</NavLink>}
            <button type="button" className="dc-mini" onClick={logout}>خروج</button>
        </nav>
        <Routes>
            <Route path="/" element={<Appointments />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/services" element={<Services me={me} />} />
            <Route path="/team" element={<Team me={me} />} />
        </Routes>
    </Shell>;
}
