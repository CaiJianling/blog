import { useSyncExternalStore } from 'react';

/**
 * 界面特效档位（与后端 User::EFFECT_LEVEL_MIN/MAX 对应）。
 *
 * 每一档在上一档之上叠加液态玻璃的作用范围：
 * - 关闭：无特效，全部使用纯色 / material-* 磨砂底
 * - 开启：液态玻璃开关（LiquidSwitch）与液态玻璃滑块（LiquidSlider）
 * - 进阶：+ 前台右下角悬浮窗（设置弹窗、齿轮、小助手、回顶与评论按钮）的液态玻璃面板
 * - 极致：+ 前台与后台顶部栏的液态玻璃面板
 */
export const EFFECT_LEVEL = {
    off: 1,
    on: 2,
    pro: 3,
    ultimate: 4,
} as const;

export type EffectLevel = (typeof EFFECT_LEVEL)[keyof typeof EFFECT_LEVEL];

/** 由低到高的档位序列：设置界面的分段按钮按此顺序渲染（文案见 locales 的 effects.levels.*）。 */
export const EFFECT_LEVEL_OPTIONS = [
    { level: EFFECT_LEVEL.off, labelKey: 'off' },
    { level: EFFECT_LEVEL.on, labelKey: 'on' },
    { level: EFFECT_LEVEL.pro, labelKey: 'pro' },
    { level: EFFECT_LEVEL.ultimate, labelKey: 'ultimate' },
] as const;

const HIGHEST_LEVEL =
    EFFECT_LEVEL_OPTIONS[EFFECT_LEVEL_OPTIONS.length - 1].level;

export type UseEffectsReturn = {
    readonly effectsLevel: EffectLevel;
    readonly updateEffectsLevel: (level: EffectLevel) => void;
};

const STORAGE_KEY = 'effectsLevel';
/** 旧版本只有开关两态，其 localStorage / cookie 键。 */
const LEGACY_STORAGE_KEY = 'effectsEnabled';

const listeners = new Set<() => void>();
let currentLevel: EffectLevel = EFFECT_LEVEL.off;

const clampLevel = (value: unknown): EffectLevel => {
    const parsed = Math.round(Number(value));

    if (!Number.isFinite(parsed)) {
        return EFFECT_LEVEL.off;
    }

    return Math.min(
        HIGHEST_LEVEL,
        Math.max(EFFECT_LEVEL.off, parsed),
    ) as EffectLevel;
};

const setCookie = (name: string, value: string, days = 365): void => {
    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax`;
};

const readStoredLevel = (): EffectLevel => {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored !== null) {
        return clampLevel(stored);
    }

    // 首次升级：旧「开启」覆盖的界面集合（开关滑块 + 悬浮窗 + 顶栏）正好是新的极致档
    return localStorage.getItem(LEGACY_STORAGE_KEY) === 'true'
        ? EFFECT_LEVEL.ultimate
        : EFFECT_LEVEL.off;
};

// 模块加载即从浏览器本地存储同步档位，使首次客户端渲染就落在正确档位：
// 否则硬刷新后台页时，顶栏玻璃要等 createInertiaApp 之后的 initializeEffects()
// 才补齐，首帧会先以 material-thin 渲染再闪变成玻璃。
// 仅客户端执行；SSR/服务端保持 off（本应用未启用 Inertia SSR，不影响）。
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    currentLevel = readStoredLevel();
}

const subscribe = (callback: () => void) => {
    listeners.add(callback);

    return () => listeners.delete(callback);
};

const notify = (): void => listeners.forEach((listener) => listener());

export function initializeEffects(): void {
    if (typeof window === 'undefined') {
        return;
    }

    currentLevel = readStoredLevel();

    localStorage.setItem(STORAGE_KEY, String(currentLevel));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    setCookie(STORAGE_KEY, String(currentLevel));

    // 初始页面在 createInertiaApp 时已按默认档位渲染（初始化在本函数之前），
    // 必须通知订阅者重新渲染，localStorage 里的档位才会实际生效
    notify();
}

export function updateEffectsLevel(level: EffectLevel): void {
    currentLevel = clampLevel(level);

    if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, String(currentLevel));
        setCookie(STORAGE_KEY, String(currentLevel));
    }

    notify();
}

/** 订阅当前档位（设置界面用它渲染分段选择器并写回档位）。 */
export function useEffects(): UseEffectsReturn {
    const effectsLevel: EffectLevel = useSyncExternalStore(
        subscribe,
        () => currentLevel,
        () => EFFECT_LEVEL.off,
    );

    return { effectsLevel, updateEffectsLevel } as const;
}

/** 当前档位是否达到 `minimum`。 */
export function useEffectsAtLeast(minimum: EffectLevel): boolean {
    return useSyncExternalStore(
        subscribe,
        () => currentLevel >= minimum,
        () => minimum <= EFFECT_LEVEL.off,
    );
}
