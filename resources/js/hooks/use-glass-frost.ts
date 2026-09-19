import { useSyncExternalStore } from 'react';

/** 液态玻璃磨砂度取值范围：0（最通透）到 100（最磨砂）。 */
export const GLASS_FROST_LIMITS = { min: 0, max: 100 } as const;

/** 内置兜底默认（后台未配置「默认液态玻璃模糊值」或读不到 Inertia 初始 props 时使用）。 */
export const FALLBACK_GLASS_FROST = 50;

export type UseGlassFrostReturn = {
    /** 当前磨砂度（0-100，左=透明，右=模糊） */
    readonly frost: number;
    readonly updateGlassFrost: (value: number) => void;
    readonly resetGlassFrost: () => void;
};

const STORAGE_KEY = 'glassFrost';

const listeners = new Set<() => void>();
/** 后台「主题设置」配置的默认磨砂度；app.tsx 启动时按共享 props 注入。 */
let currentDefault = FALLBACK_GLASS_FROST;
let currentFrost = FALLBACK_GLASS_FROST;

const subscribe = (callback: () => void): (() => void) => {
    listeners.add(callback);

    return () => {
        listeners.delete(callback);
    };
};

const notify = (): void => listeners.forEach((listener) => listener());

const clampFrost = (value: number, fallback: number): number => {
    const parsed = Math.round(Number(value));

    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.max(GLASS_FROST_LIMITS.min, Math.min(GLASS_FROST_LIMITS.max, parsed));
};

/**
 * 由 app.tsx 在启动时调用：按后台「主题设置」的默认值覆盖前台兜底默认。
 * 须在 initializeGlassFrost() 之前调用，初始磨砂度才会以该值为回退。
 */
export function setGlassFrostDefault(value: number): void {
    currentDefault = clampFrost(value, FALLBACK_GLASS_FROST);
}

/** 当前生效的默认磨砂度（后台可配，缺省回退内置值）。 */
export function getGlassFrostDefault(): number {
    return currentDefault;
}

const getStoredFrost = (): number => {
    if (typeof window === 'undefined') {
        return currentDefault;
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);

        if (raw === null) {
            return currentDefault;
        }

        return clampFrost(Number(raw), currentDefault);
    } catch {
        return currentDefault;
    }
};

/**
 * 前台液态玻璃磨砂度偏好（仅保存在浏览器 localStorage，不写入数据库）。
 *
 * 数值 0-100：0 最通透（几乎无模糊、底色很淡），100 最磨砂（背景模糊强、
 * 玻璃底色浓）。由悬浮设置面板的「液态玻璃」滑块调整，作用于所有
 * 液态玻璃面板与玻璃按钮（见 LiquidGlassPanel）。未自定义者使用
 * 后台「主题设置」里配置的默认值（见 setGlassFrostDefault）。
 */
export function initializeGlassFrost(): void {
    if (typeof window === 'undefined') {
        return;
    }

    currentFrost = getStoredFrost();
    // 初始页面在 createInertiaApp 时已按默认值渲染（初始化在本函数之前），
    // 必须通知订阅者重新渲染，localStorage 里的磨砂度才会实际生效
    notify();
}

export function updateGlassFrost(value: number): void {
    currentFrost = clampFrost(value, currentDefault);

    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(STORAGE_KEY, String(currentFrost));
        } catch {
            // 隐私模式下写入失败：仅保留内存值
        }
    }

    notify();
}

export function resetGlassFrost(): void {
    updateGlassFrost(currentDefault);
}

/**
 * 磨砂度 → 玻璃面板的两个视觉参数：
 * - 背景模糊半径（backdrop-filter blur）：低值端几乎不模糊（通透），
 *   按幂曲线增长，100 时约 16px；
 * - 玻璃底色不透明度：15%（通透）到 85%（磨砂）。
 */
export function glassFrostToPanel(frost: number): { blurPx: number; tintAlpha: number } {
    const f = Math.max(0, Math.min(100, frost)) / 100;

    return {
        blurPx: Math.round(Math.pow(f, 1.5) * 16),
        tintAlpha: 0.15 + f * 0.7,
    };
}

export function useGlassFrost(): UseGlassFrostReturn {
    const frost: number = useSyncExternalStore(
        subscribe,
        () => currentFrost,
        () => currentDefault,
    );

    return {
        frost,
        updateGlassFrost,
        resetGlassFrost,
    };
}
