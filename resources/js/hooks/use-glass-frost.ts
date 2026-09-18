import { useSyncExternalStore } from 'react';

/** 液态玻璃磨砂度取值范围：0（最通透）到 100（最磨砂）。 */
export const GLASS_FROST_LIMITS = { min: 0, max: 100 } as const;

/** 默认磨砂度。 */
export const DEFAULT_GLASS_FROST = 50;

export type UseGlassFrostReturn = {
    /** 当前磨砂度（0-100，左=透明，右=模糊） */
    readonly frost: number;
    readonly updateGlassFrost: (value: number) => void;
    readonly resetGlassFrost: () => void;
};

const STORAGE_KEY = 'glassFrost';

const listeners = new Set<() => void>();
let currentFrost = DEFAULT_GLASS_FROST;

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

const getStoredFrost = (): number => {
    if (typeof window === 'undefined') {
        return DEFAULT_GLASS_FROST;
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);

        if (raw === null) {
            return DEFAULT_GLASS_FROST;
        }

        return clampFrost(Number(raw), DEFAULT_GLASS_FROST);
    } catch {
        return DEFAULT_GLASS_FROST;
    }
};

/**
 * 前台液态玻璃磨砂度偏好（仅保存在浏览器 localStorage，不写入数据库）。
 *
 * 数值 0-100：0 最通透（几乎无模糊、底色很淡），100 最磨砂（背景模糊强、
 * 玻璃底色浓）。由悬浮设置面板的「液态玻璃」滑块调整，作用于所有
 * 液态玻璃面板与玻璃按钮（见 LiquidGlassPanel）。
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
    currentFrost = clampFrost(value, DEFAULT_GLASS_FROST);

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
    updateGlassFrost(DEFAULT_GLASS_FROST);
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
    const frost: number = useSyncExternalStore(subscribe, () => currentFrost, () => DEFAULT_GLASS_FROST);

    return {
        frost,
        updateGlassFrost,
        resetGlassFrost,
    };
}
