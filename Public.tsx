import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import lobby from './photos/lobby.jpg';
import room from './photos/room.jpg';
import smile from './photos/smile.jpg';
import { api, errText } from './api';
import { Callout, Caption, ChoiceRow, Closing, FileButton, Group, Photos, TextField } from './ui';

interface Service { id: string; name: string; price: number; description: string }
const egp = (n: number) => `${n.toLocaleString('en-US')}\u00A0ج.م`;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

export function PublicPage() {
    const [services, setServices] = useState<Service[] | null>(null);
    const [loadErr, setLoadErr] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [serviceId, setServiceId] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [note, setNote] = useState('');
    const [trap, setTrap] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => {
        api<{ services: Service[] }>('GET', '/api/services').then((r) => setServices(r.services)).catch((e) => { setLoadErr(errText(e)); setServices([]); });
    }, []);

    const valid = name.trim().length >= 2 && /^[0-9+\s-]{7,20}$/.test(phone.trim()) && date && time;
    const send = async () => {
        setBusy(true); setErr('');
        try {
            await api('POST', '/api/bookings', { name, phone, serviceId: serviceId || undefined, date, time, note: note || undefined, website: trap });
            setDone(true);
        } catch (e) { setErr(errText(e)); }
        setBusy(false);
    };

    return <>
        <div className="dc-hero" style={{ backgroundImage: `linear-gradient(180deg, rgb(10 52 56 / 0.55), rgb(10 52 56 / 0.82)), url(${lobby})` }}>
            <span className="dc-gold-tag">أهلاً بيك</span>
            <h1 className="dc-hero-title">مركز برايت</h1>
            <p className="dc-hero-text">اتعرف على خدماتنا وأسعارنا، واطلب ميعادك في دقيقة. هنتواصل معاك لتأكيد الحجز.</p>
        </div>
        <div className="dc-banner">
            <img src={smile} alt="صورة توضيحية لمريضة مبتسمة" className="dc-banner-img" />
            <div className="dc-banner-over">
                <h2 className="dc-banner-title">ابتسامتك تستحق الأفضل</h2>
                <a className="dc-cta" href="#book" onClick={(e) => { e.preventDefault(); document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' }); }}>اطلب ميعاد</a>
            </div>
        </div>
        <Group label="للمرضى" heading="الخدمات والأسعار">
            {services === null && <Caption>جاري التحميل...</Caption>}
            {loadErr && <Callout title="تعذر تحميل الخدمات" tone="warning">{loadErr}</Callout>}
            {services && services.length === 0 && !loadErr && <Callout title="الخدمات والأسعار هتتنشر هنا قريبًا" tone="note">المركز هيضيف الخدمات والأسعار الحقيقية.</Callout>}
            <div className="dc-services">
                {(services || []).map((s) => <div className="dc-service" key={s.id}>
                    <span className="dc-service-name">{s.name}</span>
                    {s.description && <span className="dc-service-detail">{s.description}</span>}
                    <span className="dc-service-price">{egp(s.price)}</span>
                </div>)}
            </div>
        </Group>
        <Photos label="صور توضيحية" items={[{ src: lobby, alt: 'صورة توضيحية لاستقبال عيادة' }, { src: room, alt: 'صورة توضيحية لغرفة علاج أسنان' }]} />
        <Caption>صور توضيحية مولدة بالذكاء الاصطناعي، مش صور المركز الحقيقية.</Caption>
        <div id="book" />
        <Group label="الحجز" heading="اطلبي ميعاد">
            {done ? <Callout title="وصل طلبك" tone="note">استلمنا طلب الحجز. هنتواصل معاك على الرقم اللي كتبته لتأكيد الميعاد. الطلب مش بيتأكد إلا بعد ما المركز يكلمك.</Callout> : <>
                <TextField label="الاسم" value={name} onChange={setName} required />
                <TextField label="رقم الموبايل" value={phone} onChange={setPhone} type="tel" ltr required />
                {services && services.length > 0 && <ChoiceRow label="الخدمة (اختياري)" value={serviceId} onChange={setServiceId}
                    options={[{ value: '', label: 'مش متأكد' }, ...services.map((s) => ({ value: s.id, label: s.name }))]} />}
                <TextField label="التاريخ المناسب" value={date} onChange={setDate} type="date" ltr required />
                <TextField label="الوقت المناسب" value={time} onChange={setTime} type="time" ltr required />
                <TextField label="ملاحظة (اختياري)" value={note} onChange={setNote} />
                <TextField label="Website" value={trap} onChange={setTrap} hidden />
                {date && date < today() && <Caption>اختاري تاريخ من النهاردة وبعده.</Caption>}
                {err && <Callout title="مقدرناش نبعت الطلب" tone="warning">{err}</Callout>}
                <div className="dc-actions"><FileButton variant="primary" pill disabled={!valid || busy || date < today()} onClick={send}>{busy ? 'جاري الإرسال...' : 'ابعت طلب الحجز'}</FileButton></div>
                <Caption>ده طلب حجز، مش حجز مؤكد. مش بنطلب أي بيانات طبية هنا.</Caption>
            </>}
        </Group>
        <Closing>مركز برايت · <Link to="/staff" className="dc-stafflink">دخول الموظفين</Link></Closing>
    </>;
}
