import React, { useMemo, useRef, useState } from 'react';
import { Callout, Caption, ChoiceRow, CloseButton, Closing, Facts, FileButton, FileCard, Group, Link, NavLink, Paragraph, Photos, Route, Routes, Row, Rows, StackedBar, TextField } from './ui';
import hero from './photos/dental-hero.png';
import lobby from './photos/lobby.jpg';
import room from './photos/room.jpg';
import smile from './photos/smile.jpg';

type AppointmentStatus = 'confirmed' | 'waiting' | 'done' | 'canceled';

interface Patient {
    id: string;
    name: string;
    age: number;
    phone: string;
    since: string;
    note?: string;
    history: { date: string; treatment: string; cost: number }[];
}

interface Appointment {
    id: string;
    day: 'today' | 'tomorrow' | 'later';
    time: string;
    patient: string;
    treatment: string;
    status: AppointmentStatus;
}

interface Invoice {
    id: string;
    patient: string;
    treatment: string;
    date: string;
    total: number;
    paid: boolean;
}

const clinic = { name: 'مركز برايت', doctor: 'د. عبدالله عصام ' };

const statusLabel: Record<AppointmentStatus, string> = {
    confirmed: 'مؤكد',
    waiting: 'في الانتظار',
    done: 'تم',
    canceled: 'ملغي',
};

const treatments = [
    { value: 'checkup', label: 'كشف', price: 300 },
    { value: 'cleaning', label: 'تنظيف وتلميع', price: 800 },
    { value: 'filling', label: 'حشو تجميلي', price: 900 },
    { value: 'root', label: 'حشو عصب', price: 2500 },
    { value: 'extraction', label: 'خلع ضرس', price: 700 },
    { value: 'whitening', label: 'تبييض', price: 4000 },
];

const patients: Patient[] = [];

const initialAppointments: Appointment[] = [];

const invoices: Invoice[] = [];

const egp = (n: number) => `${n.toLocaleString('en-US')}\u00A0ج.م`;

function StatCards({ appointments }: { appointments: Appointment[] }) {
    const todayCount = appointments.filter((a) => a.day === 'today' && a.status !== 'canceled').length;
    const waiting = appointments.filter((a) => a.day === 'today' && a.status === 'waiting').length;
    const monthTotal = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const unpaid = invoices.filter((inv) => !inv.paid).reduce((sum, inv) => sum + inv.total, 0);
    const stats = [
        { label:  'مواعيد اليوم', value: `${todayCount}`, note: waiting ? `${waiting} في الانتظار` : 'لا يوجد مواعيد بعد' },
        { label: 'إجمالي المرضى', value: `${patients.length}`, note: 'لا يوجد ملفات بعد' },
        { label: 'دخل الشهر', value: egp(monthTotal), note: 'لا يوجد فواتير' },
        { label: 'مستحقات لم تُدفع', value: egp(unpaid), note: `${invoices.filter((inv) => !inv.paid).length} فواتير` },
    ];
    return <div className="dc-stats">
        {stats.map((s) => <div className="dc-stat" key={s.label}>
            <span className="dc-stat-label">{s.label}</span>
            <span className="dc-stat-value">{s.value}</span>
            <span className="dc-stat-note">{s.note}</span>
        </div>)}
    </div>;
}

function AppointmentRows({ items, onChangeStatus }: { items: Appointment[]; onChangeStatus: (id: string, status: AppointmentStatus) => void }) {
    if (items.length === 0) return <Caption>لا يوجد مواعيد مطابقة للاختيار ده.</Caption>;
    return <div className="dc-appts">
        {items.map((a) => <div className={`dc-appt dc-appt-${a.status}`} key={a.id}>
            <span className="dc-appt-time" dir="ltr">{a.time}</span>
            <span className="dc-appt-main">
                <span className="dc-appt-patient">{a.patient}</span>
                <span className="dc-appt-treatment">{a.treatment}</span>
            </span>
            <span className="dc-appt-side">
                <span className={`dc-badge dc-badge-${a.status}`}>{statusLabel[a.status]}</span>
                {a.status === 'confirmed' && <button type="button" className="dc-mini" onClick={() => onChangeStatus(a.id, 'done')}>تم الكشف</button>}
                {a.status === 'waiting' && <button type="button" className="dc-mini" onClick={() => onChangeStatus(a.id, 'done')}>دخل</button>}
            </span>
        </div>)}
    </div>;
}

function Dashboard({ appointments, onChangeStatus }: { appointments: Appointment[]; onChangeStatus: (id: string, status: AppointmentStatus) => void }) {
    const today = appointments.filter((a) => a.day === 'today');
    return <>
        <Photos label="رسم توضيحي" items={[{ src: hero, alt: 'رسم توضيحي لسن بجانب تقويم مواعيد ورسم بياني' }]} />
        <Caption>رسم توضيحي.</Caption>
        <StatCards appointments={appointments} />
        <Group label="الخميس 26 نوفمبر" heading="مواعيد اليوم">
            <AppointmentRows items={today} onChangeStatus={onChangeStatus} />
        </Group>
    </>;
}

function Appointments({ appointments, onChangeStatus, onAdd }: {
    appointments: Appointment[];
    onChangeStatus: (id: string, status: AppointmentStatus) => void;
    onAdd: (a: { patient: string; treatment: string; time: string }) => void;
}) {
    const [day, setDay] = useState('today');
    const [status, setStatus] = useState('all');
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [name, setName] = useState('');
    const [treatment, setTreatment] = useState('checkup');
    const [time, setTime] = useState('6:00 م');
    const [addedNote, setAddedNote] = useState('');

    const filtered = appointments.filter((a) => a.day === day && (status === 'all' || a.status === status));
    const dayCount = appointments.filter((a) => a.day === day).length;

    const openDialog = () => dialogRef.current?.showModal();
    const closeDialog = () => dialogRef.current?.close();
    const book = () => {
        const clean = name.trim();
        if (!clean) return;
        const t = treatments.find((x) => x.value === treatment);
        onAdd({ patient: clean, treatment: t ? t.label : treatment, time });
        setName('');
        closeDialog();
        setAddedNote(`تم تسجيل الموعد بنجاح.`);
    };

    return <>
        <Group label={`${dayCount} مواعيد في اليوم المختار`} heading="جدول المواعيد">
            <ChoiceRow label="اليوم" value={day} onChange={setDay} options={[
                { value: 'today', label: 'النهاردة' },
                { value: 'tomorrow', label: 'بكرة' },
                { value: 'later', label: 'الأسبوع الجاي' },
            ]} />
            <ChoiceRow label="الحالة" value={status} onChange={setStatus} options={[
                { value: 'all', label: 'الكل' },
                { value: 'confirmed', label: 'مؤكد' },
                { value: 'waiting', label: 'في الانتظار' },
                { value: 'done', label: 'تم' },
                { value: 'canceled', label: 'ملغي' },
            ]} />
            <AppointmentRows items={filtered} onChangeStatus={onChangeStatus} />
            <div className="dc-actions">
                <FileButton variant="primary" pill onClick={openDialog}>حجز موعد جديد</FileButton>
            </div>
            <Callout title="احجز الان" tone="warning">تم الحجز بنجاح.</Callout>
            {addedNote && <Caption>{addedNote}</Caption>}
        </Group>
        <dialog ref={dialogRef} className="dc-dialog">
            <CloseButton onClick={closeDialog} />
            <h2 className="dc-dialog-title">موعد جديد</h2>
            <TextField label="اسم المريض" value={name} onChange={setName} />
            <ChoiceRow label="نوع الكشف" value={treatment} onChange={setTreatment} options={treatments.map((t) => ({ value: t.value, label: t.label }))} />
            <ChoiceRow label="الميعاد" value={time} onChange={setTime} options={[
                { value: '6:00 م', label: '6:00 م' },
                { value: '6:30 م', label: '6:30 م' },
                { value: '7:00 م', label: '7:00 م' },
                { value: '7:30 م', label: '7:30 م' },
            ]} />
            <div className="dc-actions">
                <FileButton variant="primary" pill disabled={!name.trim()} onClick={book}>تسجيل الموعد</FileButton>
            </div>
            <Caption>تم ارسال الموعد لمركز برايت وجاري المراجعة.</Caption>
        </dialog>
    </>;
}

function Patients() {
    const [query, setQuery] = useState('');
    const [openId, setOpenId] = useState<string | null>(null);
    const shown = patients.filter((p) => p.name.includes(query.trim()) || p.phone.includes(query.trim()));
    const open = patients.find((p) => p.id === openId) || null;
    const totalSpent = (p: Patient) => p.history.reduce((s, h) => s + h.cost, 0);

    return <>
        <Group label={`${shown.length} من ${patients.length} مرضى`} heading="ملفات المرضى">
            <TextField label="ابحث بالاسم أو رقم الموبايل" value={query} onChange={setQuery} />
            <div className="dc-patients">
                {shown.map((p) => <button type="button" className="dc-patient" key={p.id} onClick={() => setOpenId(p.id)}>
                    <span className="dc-patient-avatar" aria-hidden>{p.name.trim()[0]}</span>
                    <span className="dc-patient-main">
                        <span className="dc-patient-name file-hover-underline">{p.name}</span>
                        <span className="dc-patient-sub">آخر زيارة: {p.history[0]?.date} - {p.history[0]?.treatment}</span>
                    </span>
                    <span className="dc-patient-value">{egp(totalSpent(p))}</span>
                </button>)}
                {shown.length === 0 && <Caption>{patients.length === 0 ? 'لايوجد ملفات مرضى بعد.' : 'لايوجد مريض بهذا الاسم أو الرقم .'}</Caption>}
            </div>
        </Group>
        {open && <dialog open className="dc-dialog dc-dialog-open">
            <CloseButton onClick={() => setOpenId(null)} />
            <h2 className="dc-dialog-title">{open.name}</h2>
            <Facts items={[
                { label: 'السن', value: `${open.age} سنة` },
                { label: 'الموبايل', value: open.phone },
                { label: 'مريض من', value: open.since },
                { label: 'إجمالي ما دُفع', value: egp(totalSpent(open)) },
            ]} />
            {open.note && <Callout title="ملاحظة طبية" tone="warning">{open.note}</Callout>}
            <h3 className="dc-dialog-sub">سجل الزيارات</h3>
            <Rows>
                {open.history.map((h, i) => <Row key={i} name={h.treatment} detail={h.date} value={egp(h.cost)} valueKnown />)}
            </Rows>
        </dialog>}
    </>;
}

function Billing() {
    const [filter, setFilter] = useState('all');
    const total = invoices.reduce((s, i) => s + i.total, 0);
    const paid = invoices.filter((i) => i.paid).reduce((s, i) => s + i.total, 0);
    const remaining = total - paid;
    const shown = invoices.filter((i) => filter === 'all' || (filter === 'paid') === i.paid);
    const paidShare = total === 0 ? 0 : Math.round((paid / total) * 100);

    return <>
        <Group label="نوفمبر 2026" heading="الفواتير والتحصيل">
            <Facts items={[
                { label: 'إجمالي فواتير الشهر', value: egp(total) },
                { label: 'تم التحصيل', value: egp(paid) },
                { label: ' مستحق', value: egp(remaining) },
            ]} />
            <StackedBar label="نسبة التحصيل" parts={[
                { label: `تم التحصل ${paidShare} في المية`, share: paidShare },
                { label: `مستحق ${100 - paidShare} في المية`, share: 100 - paidShare },
            ]} />
            <ChoiceRow label="عرض" value={filter} onChange={setFilter} options={[
                { value: 'all', label: 'الكل' },
                { value: 'paid', label: 'المدفوعة' },
                { value: 'unpaid', label: 'المستحقة' },
            ]} />
            {shown.length === 0 && <Caption>لا توجد فواتير بعد.</Caption>}
            <Rows>
                {shown.map((inv) => <Row key={inv.id} name={inv.patient}
                    detail={`${inv.treatment} - ${inv.date} - ${inv.paid ? 'مدفوعة' : 'مستحقة'}`}
                    value={egp(inv.total)} valueKnown={inv.paid} />)}
            </Rows>
        </Group>
    </>;
}


const services = [
    'كشف واستشارة', 'تنظيف وتلميع', 'حشو تجميلي', 'علاج عصب',
    'تقويم الأسنان', 'زراعة الأسنان', 'تبييض الأسنان', 'طب أسنان الأطفال',
];

function Offers() {
    return <>
        <div className="dc-banner">
            <img src={smile} alt="صورة توضيحية لمريضة مبتسمة" className="dc-banner-img" />
            <div className="dc-banner-over">
                <span className="dc-gold-tag">احنا معاك</span>
                <h2 className="dc-banner-title">ابتسامتك تستحق الأفضل</h2>
                <p className="dc-banner-text">مرحبًا بك في مركز برايت.</p>
                <Link className="dc-cta" to="/appointments">احجز موعدك</Link>
                <span className="dc-soon">راحتك مهمتنا وابتسامتك سر سعادتنا</span>
            </div>
        </div>
        <Group label="اسال علي الخصم" heading="العروض والخصومات">
            <Callout title="العروض هتتنشر هنا قريبًا" tone="note">.</Callout>
        </Group>
        <Photos label="صور توضيحية" items={[{ src: lobby, alt: 'صورة توضيحية لاستقبال عيادة' }, { src: room, alt: 'صورة توضيحية لغرفة علاج أسنان' }]} />
        <Caption>.</Caption>
        <Group label="في انتظار تأكيد المركز" heading="أمثلة على الخدمات">
            <div className="dc-services">
                {services.map((name) => <div className="dc-service" key={name}>
                    <span className="dc-service-name">{name}</span>
                </div>)}
            </div>
            <Caption>.</Caption>
        </Group>
        <div className="dc-final"><span>جاهز لابتسامة جديدة؟</span><Link className="dc-cta" to="/appointments">احجز الآن</Link><span className="dc-soon">مركز برايت لطب وجراحة الفم والاسنان</span></div>
    </>;
}

export function App() {
    const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);

    const changeStatus = (id: string, status: AppointmentStatus) => {
        setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    };
    const addAppointment = ({ patient, treatment, time }: { patient: string; treatment: string; time: string }) => {
        setAppointments((prev) => [...prev, { id: `new-${prev.length + 1}`, day: 'today', time, patient, treatment, status: 'confirmed' }]);
    };

    return <FileCard lang="ar" dir="rtl">
        <div className="dc-hero" style={{ backgroundImage: `linear-gradient(180deg, rgb(10 52 56 / 0.55), rgb(10 52 56 / 0.82)), url(${lobby})` }}>
            <span className="dc-gold-tag">***</span>
            <h1 className="dc-hero-title">{clinic.name}</h1>
            <p className="dc-hero-text">نظام إدارة المركز: مواعيد، ملفات مرضى، وفواتير، ومساعدة المرضى..</p>
        </div>
        <nav className="file-nav" aria-label="أقسام النظام">
            <NavLink to="/" end>الرئيسية</NavLink>
            <NavLink to="/appointments">المواعيد</NavLink>
            <NavLink to="/patients">المرضى</NavLink>
            <NavLink to="/billing">الفواتير</NavLink>
            <NavLink to="/offers">العروض والخدمات</NavLink>
        </nav>
        <Routes>
            <Route path="/" element={<Dashboard appointments={appointments} onChangeStatus={changeStatus} />} />
            <Route path="/appointments" element={<Appointments appointments={appointments} onChangeStatus={changeStatus} onAdd={addAppointment} />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/offers" element={<Offers />} />
        </Routes>
        <Closing>@2026 All Rights Reserved. This Website and Its Content Are the Exclusive Intellectual Property of Eng. Enas Essam.</Closing>
    </FileCard>;
}
