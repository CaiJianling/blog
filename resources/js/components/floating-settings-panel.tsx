import { usePage } from '@inertiajs/react';
import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Palette, Settings, Sparkles, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import GlassButtonBackground from '@/components/LiquidGlass/glass-button-background';
import LiquidGlassPanel from '@/components/LiquidGlass/LiquidGlassPanel';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEffects, updateEffectsEnabled } from '@/hooks/use-effects';
import { useLocale, updateLocale } from '@/hooks/use-locale';
import { useThemeColor, updateThemeColor } from '@/hooks/use-theme-color';
import type { Locale } from '@/i18n';
import { cn } from '@/lib/utils';
import { show as userSettingsShow, update as userSettingsUpdate } from '@/routes/user-settings';

type UserPreferences = {
    locale: Locale;
    effectsEnabled: boolean;
};

/**
 * 前台右下角悬浮设置入口：
 * - 界面特效开关（液态玻璃 / 半透明磨砂）
 * - 界面语言切换
 *
 * 未登录时设置仅保存在浏览器（localStorage）；登录用户的设置同步到
 * 项目数据库（users 表），登录后自动拉取覆盖本地值。
 *
 * 弹窗通过 portal 挂载到 body：悬浮组本身保持 z-40（位于小助手面板 z-50
 * 之下），仅弹窗以 z-60 盖住面板。
 */
export default function FloatingSettingsPanel() {
    const { t } = useTranslation();
    const { auth, theme } = usePage().props as unknown as {
        auth?: { user?: { id: number } | null };
        theme?: { defaultColor: string; presets: string[] };
    };
    const isAuthed = !!auth?.user;
    const defaultColor = theme?.defaultColor ?? '#0071e3';
    const presets = theme?.presets ?? [];

    const [open, setOpen] = useState(false);
    const [anchor, setAnchor] = useState<{ right: number; bottom: number } | null>(null);
    const [glassSize, setGlassSize] = useState({ width: 0, height: 0 });
    const gearRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const popoverBodyRef = useRef<HTMLDivElement>(null);
    const filterId = useId();
    const { effectsEnabled } = useEffects();
    const locale = useLocale();
    const themeColor = useThemeColor().themeColor;
    const lastSynced = useRef<UserPreferences | null>(null);

    // 弹窗脱离悬浮组的层叠上下文，打开时按齿轮按钮的实际位置计算 fixed 锚点（按钮左侧）
    const toggleOpen = (): void => {
        if (open) {
            setOpen(false);

            return;
        }

        const rect = gearRef.current?.getBoundingClientRect();

        if (!rect) {
            return;
        }

        setAnchor({ right: window.innerWidth - rect.left + 10, bottom: window.innerHeight - rect.bottom });
        setOpen(true);
    };

    // 特效开启时弹窗使用液态玻璃背景，需要实测弹窗尺寸生成位移图
    useEffect(() => {
        const el = popoverBodyRef.current;

        if (!open || !el) {
            setGlassSize({ width: 0, height: 0 });

            return;
        }

        const observer = new ResizeObserver(() => {
            setGlassSize({ width: el.offsetWidth, height: el.offsetHeight });
        });
        observer.observe(el);

        return () => observer.disconnect();
    }, [open]);

    // 点击弹窗与齿轮按钮之外时关闭
    useEffect(() => {
        if (!open) {
            return;
        }

        const onDown = (event: MouseEvent): void => {
            const target = event.target as Node;

            if (popoverRef.current?.contains(target) || gearRef.current?.contains(target)) {
                return;
            }

            setOpen(false);
        };

        document.addEventListener('mousedown', onDown);

        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    // 登录后从数据库拉取偏好设置并覆盖本地值
    useEffect(() => {
        if (!isAuthed) {
            lastSynced.current = null;

            return;
        }

        let cancelled = false;

        const fetchSettings = async () => {
            const data = await request<UserPreferences>(userSettingsShow.url(), { method: 'GET' });

            if (cancelled || !data) {
                return;
            }

            lastSynced.current = data;
            updateLocale(data.locale);
            updateEffectsEnabled(data.effectsEnabled);
        };

        void fetchSettings();

        return () => {
            cancelled = true;
        };
    }, [isAuthed]);

    // 登录状态下偏好变化时同步回数据库（仅在有差异时写入）
    useEffect(() => {
        const last = lastSynced.current;

        if (!isAuthed || !last) {
            return;
        }

        if (locale === last.locale && effectsEnabled === last.effectsEnabled) {
            return;
        }

        lastSynced.current = { locale, effectsEnabled };
        void request<UserPreferences>(userSettingsUpdate.url(), {
            method: 'PUT',
            body: JSON.stringify({ locale, effects_enabled: effectsEnabled }),
        });
    }, [isAuthed, locale, effectsEnabled]);

    return (
        <>
            {/* 弹窗 portal 到 body：z-60 盖住小助手面板，齿轮按钮留在悬浮组内位于面板之下 */}
            {typeof document !== 'undefined' &&
                createPortal(
                    <div
                        ref={popoverRef}
                        className="fixed z-[60] w-64"
                        style={anchor ? { right: anchor.right, bottom: anchor.bottom } : { right: -9999, bottom: -9999 }}
                    >
                        <AnimatePresence>
                            {open && (
                                <motion.div
                                    ref={popoverBodyRef}
                                    initial={{ y: 8, scale: 0.96 }}
                                    animate={{ y: 0, scale: 1 }}
                                    exit={{ y: 8, scale: 0.96 }}
                                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                                    style={{ transformOrigin: 'bottom right' }}
                                    className={cn(
                                        'relative overflow-hidden rounded-3xl border border-white/50 dark:border-white/10 p-3 text-popover-foreground shadow-[0_16px_48px_rgba(0,0,0,0.3)]',
                                        !effectsEnabled && 'bg-popover/90 backdrop-blur-xl',
                                    )}
                                >
                                    {/* 液态玻璃背景（特效开启），关闭时为磨砂底 */}
                                    {effectsEnabled && glassSize.width > 0 && glassSize.height > 0 && (
                                        <LiquidGlassPanel id={filterId} width={glassSize.width} height={glassSize.height} />
                                    )}

                                    <div className="relative">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-semibold">{t('settings.floating.title')}</p>
                                        <button
                                            type="button"
                                            onClick={() => setOpen(false)}
                                            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                            aria-label={t('common.close')}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>

                                    <div className="mt-3">
                                        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                            <Moon className="h-3.5 w-3.5" />
                                            {t('settings.floating.language')}
                                        </p>
                                        <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                                            {(['zh', 'en'] as const).map((value) => (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => updateLocale(value)}
                                                    className={cn(
                                                        'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                                                        locale === value
                                                            ? 'bg-background shadow-sm'
                                                            : 'text-muted-foreground hover:text-foreground',
                                                    )}
                                                >
                                                    {value === 'zh' ? t('settings.appearance.chinese') : t('settings.appearance.english')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                            <Sparkles className="h-3.5 w-3.5" />
                                            {t('settings.floating.effects')}
                                        </p>
                                        <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                                            <button
                                                type="button"
                                                onClick={() => updateEffectsEnabled(false)}
                                                className={cn(
                                                    'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                                                    !effectsEnabled ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                                )}
                                            >
                                                {t('settings.floating.disabled')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => updateEffectsEnabled(true)}
                                                className={cn(
                                                    'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                                                    effectsEnabled ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                                )}
                                            >
                                                {t('settings.floating.enabled')}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                            <Palette className="h-3.5 w-3.5" />
                                            {t('settings.floating.themeColor')}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {/* 默认 = 跟随管理员后台设置的主题色 */}
                                            <button
                                                type="button"
                                                onClick={() => updateThemeColor('')}
                                                style={{ backgroundColor: defaultColor }}
                                                title={t('settings.floating.themeDefault')}
                                                aria-label={t('settings.floating.themeDefault')}
                                                className={cn(
                                                    'h-6 w-6 rounded-full border border-black/10 transition-transform hover:scale-110',
                                                    themeColor === '' && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
                                                )}
                                            />
                                            {presets.map((preset) => (
                                                <button
                                                    key={preset}
                                                    type="button"
                                                    onClick={() => updateThemeColor(preset)}
                                                    style={{ backgroundColor: preset }}
                                                    title={preset}
                                                    aria-label={preset}
                                                    className={cn(
                                                        'h-6 w-6 rounded-full border border-black/10 transition-transform hover:scale-110',
                                                        themeColor === preset && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <p className="mt-3 border-t border-border/50 pt-2 text-[11px] leading-relaxed text-muted-foreground">
                                        {isAuthed ? t('settings.floating.synced') : t('settings.floating.local')}
                                    </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>,
                    document.body,
                )}

            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        ref={gearRef}
                        type="button"
                        onClick={toggleOpen}
                        className={cn(
                            'hover-glow relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border/60 text-muted-foreground shadow-md transition-all hover:text-primary',
                            !effectsEnabled && 'bg-popover',
                            open && 'text-primary',
                        )}
                        aria-label={t('settings.floating.open')}
                    >
                        <GlassButtonBackground size={40} />
                        <Settings className="relative h-4 w-4" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="tooltip-dark">
                    {t('settings.floating.open')}
                </TooltipContent>
            </Tooltip>
        </>
    );
}

async function request<T>(url: string, init: RequestInit): Promise<T | null> {
    const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
    const xsrf = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)?.[1];
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    if (csrf) {
        headers['X-CSRF-TOKEN'] = csrf;
    } else if (xsrf) {
        headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);
    }

    try {
        const response = await fetch(url, { ...init, headers });

        if (!response.ok) {
            return null;
        }

        return (await response.json()) as T;
    } catch {
        return null;
    }
}
