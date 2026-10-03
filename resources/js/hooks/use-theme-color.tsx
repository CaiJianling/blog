import { useSyncExternalStore } from 'react';
import { applyThemeStyle, syncThemeColorMeta } from '@/lib/theme';

export type UseThemeColorReturn = {
    /** 用户自选主题色；空字符串表示跟随管理员后台设置的主题 */
    readonly themeColor: string;
    readonly updateThemeColor: (color: string) => void;
};

/**
 * 前台主题色偏好（仅保存在浏览器，不写入项目数据库）。
 *
 * 空字符串代表「默认」，即跟随管理员在后台「主题设置」里配置的颜色：
 * 此时清空主题覆盖样式，页面自然回落到 Blade 首屏注入的后台主题。
 */
const listeners = new Set<() => void>();

let currentThemeColor = '';

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

const getStoredThemeColor = (): string => {
    if (typeof window === 'undefined') {
        return '';
    }

    return localStorage.getItem('themeColor') ?? '';
};

export function initializeThemeColor(): void {
    if (typeof window === 'undefined') {
        return;
    }

    currentThemeColor = getStoredThemeColor();
    applyThemeStyle(currentThemeColor);
    syncThemeColorMeta();
}

export function updateThemeColor(color: string): void {
    currentThemeColor = color;

    localStorage.setItem('themeColor', color);
    setCookie('themeColor', color);

    applyThemeStyle(color);
    syncThemeColorMeta();
    notify();
}

export function useThemeColor(): UseThemeColorReturn {
    const themeColor: string = useSyncExternalStore(
        subscribe,
        () => currentThemeColor,
        () => '',
    );

    return { themeColor, updateThemeColor } as const;
}
