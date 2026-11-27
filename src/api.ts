import { API_URL } from './config';

const KEY = 'bc_token';
export const getToken = () => sessionStorage.getItem(KEY);
export const setToken = (t: string | null) => (t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY));

export class ApiError extends Error {
    constructor(public status: number, public code: string) { super(code); }
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    if (!API_URL) throw new ApiError(0, 'no_api_url');
    const token = getToken();
    let res: Response;
    try {
        res = await fetch(`${API_URL}${path}`, {
            method,
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch {
        throw new ApiError(0, 'network');
    }
    let data: any = null;
    try { data = await res.json(); } catch { /* empty */ }
    if (!res.ok) {
        if (res.status === 401 && token) setToken(null);
        throw new ApiError(res.status, (data && data.error) || 'error');
    }
    return data as T;
}

const messages: Record<string, string> = {
    no_api_url: 'الموقع لسه مش مربوط بالسيرفر (VITE_API_URL).',
    network: 'مفيش اتصال بالسيرفر. جربي تاني بعد شوية.',
    server_not_configured: 'السيرفر مش متظبط (متغيرات البيئة ناقصة).',
    database_unavailable: 'قاعدة البيانات مش متاحة دلوقتي.',
    wrong_credentials: 'الإيميل أو الباسورد غلط.',
    locked: 'الحساب اتقفل 15 دقيقة بسبب محاولات غلط كتير.',
    too_many_requests: 'محاولات كتير. استني شوية وجربي تاني.',
    invalid_input: 'في بيانات ناقصة أو غلط.',
    invalid_date: 'اختاري تاريخ من النهاردة وبعده.',
    forbidden: 'مش مسموح.',
    email_exists: 'الإيميل ده مستخدم قبل كده.',
    already_set_up: 'الإعداد الأول اتعمل قبل كده.',
};
export const errText = (e: unknown) => (e instanceof ApiError ? messages[e.code] || 'حصلت مشكلة. جربي تاني.' : 'حصلت مشكلة. جربي تاني.');
