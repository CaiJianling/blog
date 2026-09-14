import { useSyncExternalStore } from 'react';
import i18n, { initialLanguage } from '../i18n';
import type { Locale } from '../i18n';

const listeners = new Set<() => void>();

const subscribe = (callback: () => void) => {
    listeners.add(callback);

    return () => listeners.delete(callback);
};

const notify = (): void => listeners.forEach((listener) => listener());

const setCookie = (name: string, value: string, days = 365): void => {
    if (typeof document === 'undefined') {
        return;
    }

    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax`;
};

let currentLocale: Locale = initialLanguage;

// 首次加载时同步当前语言到 locale cookie，
// 使后端 SetLocale 中间件（登录、密码重置等场景）与前端语言保持一致。
if (typeof document !== 'undefined') {
    setCookie('locale', initialLanguage);
}

i18n.on('languageChanged', (lng) => {
    currentLocale = lng as Locale;
    localStorage.setItem('locale', lng);
    setCookie('locale', lng);
    notify();
});

export function useLocale(): Locale {
    const locale: Locale = useSyncExternalStore(
        subscribe,
        () => currentLocale,
        () => 'zh',
    );

    return locale;
}

export function updateLocale(locale: Locale): void {
    currentLocale = locale;
    document.documentElement.lang = locale;
    i18n.changeLanguage(locale);
    localStorage.setItem('locale', locale);
    setCookie('locale', locale);
    notify();
}
