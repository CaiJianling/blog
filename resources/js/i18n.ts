/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-07-22 10:01:57
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-07-22 10:51:56
 * @FilePath: /blog/resources/js/i18n.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zh from './locales/zh.json';

export type Locale = 'zh' | 'en';

const resources = {
    zh: { translation: zh },
    en: { translation: en },
};

const getInitialLanguage = (): Locale => {
    if (typeof window === 'undefined') return 'zh';

    try {
        const stored = localStorage.getItem('locale');
        if (stored === 'en' || stored === 'zh') return stored as Locale;

        const cookieMatch = document.cookie.match(/locale=(en|zh)/);
        if (cookieMatch && (cookieMatch[1] === 'en' || cookieMatch[1] === 'zh')) {
            return cookieMatch[1] as Locale;
        }
    } catch {}

    return 'zh';
};

export const initialLanguage: Locale = getInitialLanguage();

if (typeof window !== 'undefined') {
    document.documentElement.lang = initialLanguage;
}

export const initPromise = new Promise<void>((resolve) => {
    i18n
        .use(initReactI18next)
        .init({
            resources,
            fallbackLng: 'zh',
            lng: initialLanguage,
            interpolation: {
                escapeValue: false,
            },
            react: {
                useSuspense: false,
            },
        }, () => {
            resolve();
        });
});

export default i18n;
