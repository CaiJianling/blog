import { useSyncExternalStore } from 'react';

export type PageFilter = {
    /** 饱和度（%），100 为正常；0 为灰白 */
    readonly saturation: number;
    /** 亮度（%），100 为正常；可调暗页面便于夜间阅读 */
    readonly brightness: number;
};

export type UsePageFilterReturn = PageFilter & {
    readonly updatePageFilter: (saturation: number, brightness: number) => void;
    readonly resetPageFilter: () => void;
};

/** 默认值：100% 即原图，不产生任何滤镜。 */
export const DEFAULT_PAGE_FILTER: PageFilter = { saturation: 100, brightness: 100 };

/** 饱和度范围：0（灰白）到 200（更鲜艳）。 */
export const SATURATION_LIMITS = { min: 0, max: 200 } as const;
/** 亮度范围：20（最暗）到 100（正常，不可提亮）。 */
export const BRIGHTNESS_LIMITS = { min: 20, max: 100 } as const;

const STORAGE_KEY = 'pageFilter';

const listeners = new Set<() => void>();
let currentPageFilter: PageFilter = { ...DEFAULT_PAGE_FILTER };

const subscribe = (callback: () => void): (() => void) => {
    listeners.add(callback);

    return () => {
        listeners.delete(callback);
    };
};

const notify = (): void => listeners.forEach((listener) => listener());

const clampToLimit = (value: number, limit: { min: number; max: number }, fallback: number): number => {
    const parsed = Math.round(Number(value));

    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.max(limit.min, Math.min(limit.max, parsed));
};

const getStoredPageFilter = (): PageFilter => {
    if (typeof window === 'undefined') {
        return { ...DEFAULT_PAGE_FILTER };
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);

        if (!raw) {
            return { ...DEFAULT_PAGE_FILTER };
        }

        const parsed: unknown = JSON.parse(raw);

        if (typeof parsed !== 'object' || parsed === null) {
            return { ...DEFAULT_PAGE_FILTER };
        }

        const { saturation, brightness } = parsed as Partial<PageFilter>;

        return {
            saturation: clampToLimit(saturation ?? 100, SATURATION_LIMITS, 100),
            brightness: clampToLimit(brightness ?? 100, BRIGHTNESS_LIMITS, 100),
        };
    } catch {
        return { ...DEFAULT_PAGE_FILTER };
    }
};

/**
 * 前台页面滤镜偏好（仅保存在浏览器 localStorage）。
 *
 * 饱和度 / 亮度通过 CSS filter 作用于页面内容（见 public-layout），
 * 不影响右下角悬浮组件与小助手。登录用户的值额外同步到数据库
 * （users 表 filter_saturation / filter_brightness），由悬浮设置面板负责。
 */
export function initializePageFilter(): void {
    if (typeof window === 'undefined') {
        return;
    }

    currentPageFilter = getStoredPageFilter();
    // 初始页面在 createInertiaApp 时已按默认值渲染（初始化在本函数之前），
    // 必须通知订阅者重新渲染，localStorage 里的滤镜才会实际生效
    notify();
}

export function updatePageFilter(saturation: number, brightness: number): void {
    currentPageFilter = {
        saturation: clampToLimit(saturation, SATURATION_LIMITS, 100),
        brightness: clampToLimit(brightness, BRIGHTNESS_LIMITS, 100),
    };

    if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentPageFilter));
    }

    notify();
}

export function resetPageFilter(): void {
    updatePageFilter(DEFAULT_PAGE_FILTER.saturation, DEFAULT_PAGE_FILTER.brightness);
}

/**
 * 生成作用于页面内容的 CSS filter；全部为默认值时返回 null（不加 filter，
 * 避免整页多一层滤镜渲染开销）。
 */
export function pageFilterCss({ saturation, brightness }: PageFilter): string | null {
    if (saturation === DEFAULT_PAGE_FILTER.saturation && brightness === DEFAULT_PAGE_FILTER.brightness) {
        return null;
    }

    const parts: string[] = [];

    if (saturation !== DEFAULT_PAGE_FILTER.saturation) {
        parts.push(`saturate(${saturation}%)`);
    }

    if (brightness !== DEFAULT_PAGE_FILTER.brightness) {
        parts.push(`brightness(${brightness}%)`);
    }

    return parts.join(' ');
}

export function usePageFilter(): UsePageFilterReturn {
    const filter: PageFilter = useSyncExternalStore(
        subscribe,
        () => currentPageFilter,
        () => ({ ...DEFAULT_PAGE_FILTER }),
    );

    return {
        ...filter,
        updatePageFilter,
        resetPageFilter,
    };
}
