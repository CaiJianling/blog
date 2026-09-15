/** 覆盖样式的 DOM id，与 Blade 中的 `<style id="theme-override">` 对应。 */
export const THEME_STYLE_ID = 'theme-override';

/** 浅色外观下主色亮度上限（%），保证作为文字/图标在白底可读。 */
const LIGHT_MAX_L = 48;
/** 深色外观下主色亮度下限（%），保证在黑底可读。 */
const DARK_MIN_L = 55;

/**
 * 主色过浅时用深色文字保证对比度，否则用白色。
 * 阈值 0.35 依据 WCAG 相对亮度；与 `ThemeSettingController::primaryForeground()` 保持一致。
 */
export function primaryForeground(color: string): string {
    return relativeLuminance(color) > 0.35 ? '#0f172a' : '#ffffff';
}

/** 相对亮度（WCAG，线性化 sRGB，0–1）。非法颜色返回 0。 */
function relativeLuminance(color: string): number {
    const hex = color.replace('#', '');

    if (hex.length !== 6) {
        return 0;
    }

    const channel = (i: number): number => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;

        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };

    return (
        0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
    );
}

/**
 * 派生指定外观下实际使用的主色（Material 浅色/深色取不同亮度）。
 * 与 `ThemeSettingController::themePrimary()` 必须保持一致。
 */
export function themePrimary(color: string, mode: 'light' | 'dark'): string {
    const hex = color.replace('#', '');

    if (hex.length !== 6) {
        return color.toLowerCase();
    }

    const [h, s, l] = rgbToHsl(
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
    );
    const clamped =
        mode === 'light' ? Math.min(l, LIGHT_MAX_L) : Math.max(l, DARK_MIN_L);
    const [r, g, b] = hslToRgb(h, s, clamped);

    return (
        '#' +
        [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
    );
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) {
        return [0, 0, Math.round(l * 100)];
    }

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h: number;

    if (max === r) {
        h = (g - b) / d + (g < b ? 6 : 0);
    } else if (max === g) {
        h = (b - r) / d + 2;
    } else {
        h = (r - g) / d + 4;
    }

    h *= 60;
    if (h < 0) {
        h += 360;
    }

    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    h /= 360;
    s /= 100;
    l /= 100;

    if (s === 0) {
        const v = Math.round(l * 255);

        return [v, v, v];
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const hue = (t: number): number => {
        if (t < 0) {
            t += 1;
        }

        if (t > 1) {
            t -= 1;
        }

        if (t < 1 / 6) {
            return p + (q - p) * 6 * t;
        }

        if (t < 1 / 2) {
            return q;
        }

        if (t < 2 / 3) {
            return p + (q - p) * (2 / 3 - t) * 6;
        }

        return p;
    };

    return [
        Math.round(hue(h + 1 / 3) * 255),
        Math.round(hue(h) * 255),
        Math.round(hue(h - 1 / 3) * 255),
    ];
}

/**
 * 由主色派生的覆盖 CSS（浅色 + 深色，各自取不同亮度）。
 * 与 `ThemeSettingController::styleCss()` 必须保持一致：前者用于首屏 SSR、后者用于保存后即时生效。
 */
export function themeStyleFor(color: string): string {
    const light = themePrimary(color, 'light');
    const dark = themePrimary(color, 'dark');
    const lightFg = primaryForeground(light);
    const darkFg = primaryForeground(dark);

    return `:root {
    --primary: ${light};
    --primary-foreground: ${lightFg};
    --accent-foreground: ${light};
    --accent: color-mix(in srgb, ${light} 10%, transparent);
    --ring: color-mix(in srgb, ${light} 45%, transparent);
    --chart-1: ${light};
    --sidebar-primary: ${light};
    --sidebar-primary-foreground: ${lightFg};
    --sidebar-accent-foreground: ${light};
    --sidebar-accent: color-mix(in srgb, ${light} 10%, transparent);
    --sidebar-ring: color-mix(in srgb, ${light} 35%, transparent);
}

.dark {
    --primary: ${dark};
    --primary-foreground: ${darkFg};
    --accent-foreground: ${dark};
    --accent: color-mix(in srgb, ${dark} 16%, transparent);
    --ring: color-mix(in srgb, ${dark} 55%, transparent);
    --chart-1: ${dark};
    --sidebar-primary: ${dark};
    --sidebar-primary-foreground: ${darkFg};
    --sidebar-accent-foreground: ${dark};
    --sidebar-accent: color-mix(in srgb, ${dark} 18%, transparent);
    --sidebar-ring: color-mix(in srgb, ${dark} 45%, transparent);
}`;
}

/** 写入/更新主题覆盖样式，使保存后的颜色即时生效（无需整页刷新）。 */
export function applyThemeStyle(color: string): void {
    if (typeof document === 'undefined') {
        return;
    }

    let el = document.getElementById(
        THEME_STYLE_ID,
    ) as HTMLStyleElement | null;

    if (!el) {
        el = document.createElement('style');
        el.id = THEME_STYLE_ID;
        document.head.appendChild(el);
    }

    el.textContent = color ? themeStyleFor(color) : '';
}

/** 让浏览器 chrome（`<meta name="theme-color">`）跟随当前实际生效的主色。 */
export function syncThemeColorMeta(): void {
    if (typeof document === 'undefined') {
        return;
    }

    const primary = getComputedStyle(document.documentElement)
        .getPropertyValue('--primary')
        .trim();

    if (!primary) {
        return;
    }

    let meta = document.querySelector('meta[name="theme-color"]');

    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'theme-color');
        document.head.appendChild(meta);
    }

    meta.setAttribute('content', primary);
}
