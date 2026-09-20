import { usePage } from '@inertiajs/react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { Contrast, GlassWater, Moon, Palette, Settings, Sparkles, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import GlassButtonBackground from '@/components/LiquidGlass/glass-button-background';
import GlassEdgeRing from '@/components/LiquidGlass/glass-edge-ring';
import LiquidGlassPanel from '@/components/LiquidGlass/LiquidGlassPanel';
import LiquidSlider from '@/components/LiquidGlass/LiquidSlider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EFFECT_LEVEL, EFFECT_LEVEL_OPTIONS, useEffects } from '@/hooks/use-effects';
import type { EffectLevel } from '@/hooks/use-effects';
import {
    GLASS_FROST_LIMITS,
    getGlassFrostDefault,
    useGlassFrost,
} from '@/hooks/use-glass-frost';
import { useLocale, updateLocale } from '@/hooks/use-locale';
import {
    BRIGHTNESS_LIMITS,
    DEFAULT_PAGE_FILTER,
    SATURATION_LIMITS,
    updatePageFilter,
    usePageFilter,
} from '@/hooks/use-page-filter';
import { useThemeColor, updateThemeColor } from '@/hooks/use-theme-color';
import type { Locale } from '@/i18n';
import { getCsrfHeaders } from '@/lib/csrf';
import { cn } from '@/lib/utils';
import { show as userSettingsShow, update as userSettingsUpdate } from '@/routes/user-settings';

type UserPreferences = {
    locale: Locale;
    effectsLevel: EffectLevel;
    filterSaturation: number;
    filterBrightness: number;
};

/**
 * 前台右下角悬浮设置入口：
 * - 界面特效档位（关闭 / 开启 / 进阶 / 极致）
 * - 界面语言切换
 * - 页面滤镜调整（饱和度 / 亮度，CSS filter 作用于页面内容）
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
    const gearRef = useRef<HTMLElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const popoverBodyRef = useRef<HTMLDivElement>(null);
    const filterId = useId();
    const { effectsLevel, updateEffectsLevel } = useEffects();
    // 「进阶」档起：设置弹窗与齿轮按钮改用液态玻璃面板
    const panelGlass = effectsLevel >= EFFECT_LEVEL.pro;
    const currentOption =
        EFFECT_LEVEL_OPTIONS.find(({ level }) => level === effectsLevel) ?? EFFECT_LEVEL_OPTIONS[0];
    const locale = useLocale();
    const themeColor = useThemeColor().themeColor;
    const { saturation, brightness, resetPageFilter } = usePageFilter();
    const { frost, updateGlassFrost, resetGlassFrost } = useGlassFrost();
    const pressGear = useAnimationControls();
    const lastSynced = useRef<UserPreferences | null>(null);

    // 按下缩放反馈（与小助手 FAB 的 whileTap 一致）
    const press = (controls: ReturnType<typeof useAnimationControls>): void => {
        void controls.start({ scale: 0.94, transition: { duration: 0.1, ease: 'easeOut' } });
    };

    const release = (controls: ReturnType<typeof useAnimationControls>): void => {
        void controls.start({ scale: 1, transition: { type: 'spring', stiffness: 420, damping: 26 } });
    };

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

        const update = () => {
            setGlassSize({ width: el.offsetWidth, height: el.offsetHeight });
        };

        // 立即测量一次（ResizeObserver 首次回调是异步的，直接测量可避免
        // 弹窗展开瞬间玻璃层缺失）；RO 负责后续尺寸变化，定时器兜底节流环境。
        update();

        const observer = new ResizeObserver(update);

        observer.observe(el);
        const fallback1 = window.setTimeout(update, 50);
        const fallback2 = window.setTimeout(update, 300);

        return () => {
            observer.disconnect();
            window.clearTimeout(fallback1);
            window.clearTimeout(fallback2);
        };
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
            updateEffectsLevel(data.effectsLevel);
            updatePageFilter(data.filterSaturation, data.filterBrightness);
        };

        void fetchSettings();

        return () => {
            cancelled = true;
        };
    }, [isAuthed]);

    // 登录状态下偏好变化时同步回数据库（仅在有差异时写入）。
    // 滤镜数值拖拽时每帧变化，延迟 1.2s 合并写入，避免高频请求。
    useEffect(() => {
        const last = lastSynced.current;

        if (!isAuthed || !last) {
            return;
        }

        const changed =
            locale !== last.locale ||
            effectsLevel !== last.effectsLevel ||
            saturation !== last.filterSaturation ||
            brightness !== last.filterBrightness;

        if (!changed) {
            return;
        }

        const timer = setTimeout(() => {
            lastSynced.current = { locale, effectsLevel, filterSaturation: saturation, filterBrightness: brightness };
            void request<UserPreferences>(userSettingsUpdate.url(), {
                method: 'PUT',
                body: JSON.stringify({
                    locale,
                    effects_level: effectsLevel,
                    filter_saturation: saturation,
                    filter_brightness: brightness,
                }),
            });
        }, 1200);

        return () => clearTimeout(timer);
    }, [isAuthed, locale, effectsLevel, saturation, brightness]);

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
                                        !panelGlass && 'bg-popover/90 backdrop-blur-xl',
                                    )}
                                >
                                    {/* 液态玻璃背景（进阶档起），未达档位时为磨砂底 */}
                                    {panelGlass && glassSize.width > 0 && glassSize.height > 0 && (
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
                                        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-0.5">
                                            {EFFECT_LEVEL_OPTIONS.map(({ level, labelKey }) => (
                                                <button
                                                    key={level}
                                                    type="button"
                                                    onClick={() => updateEffectsLevel(level)}
                                                    className={cn(
                                                        'truncate rounded-md px-1.5 py-1 text-xs font-medium transition-colors',
                                                        effectsLevel === level
                                                            ? 'bg-background shadow-sm'
                                                            : 'text-muted-foreground hover:text-foreground',
                                                    )}
                                                >
                                                    {t(`effects.levels.${labelKey}`)}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                                            {t(`effects.hints.${currentOption.labelKey}`)}
                                        </p>
                                    </div>

                                    <div className="mt-3">
                                        <div className="mb-1.5 flex items-center justify-between">
                                            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                                <GlassWater className="h-3.5 w-3.5" />
                                                {t('settings.floating.glassFrost')}
                                            </p>
                                            <div className="flex items-center gap-2">
                                                {frost !== getGlassFrostDefault() ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => resetGlassFrost()}
                                                        className="text-[11px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                                                    >
                                                        {t('settings.floating.resetGlassFrost')}
                                                    </button>
                                                ) : null}
                                                <span className="font-mono text-[11px] tabular-nums text-foreground">
                                                    {frost}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                                            <span title={t('settings.floating.glassFrostHint')}>
                                                {t('settings.floating.glassFrostClear')}
                                            </span>
                                            <span>{t('settings.floating.glassFrostFrosted')}</span>
                                        </div>
                                        <LiquidSlider
                                            size={0.5}
                                            fillContainer
                                            min={GLASS_FROST_LIMITS.min}
                                            max={GLASS_FROST_LIMITS.max}
                                            value={frost}
                                            onChange={(next) => updateGlassFrost(next)}
                                            aria-label={t('settings.floating.glassFrost')}
                                        />
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

                                    <div className="mt-3">
                                        <div className="mb-1.5 flex items-center justify-between">
                                            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                                <Contrast className="h-3.5 w-3.5" />
                                                {t('settings.floating.pageFilter')}
                                            </p>
                                            {saturation !== DEFAULT_PAGE_FILTER.saturation ||
                                            brightness !== DEFAULT_PAGE_FILTER.brightness ? (
                                                <button
                                                    type="button"
                                                    onClick={() => resetPageFilter()}
                                                    className="text-[11px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                                                >
                                                    {t('settings.floating.resetFilter')}
                                                </button>
                                            ) : null}
                                        </div>
                                        <div className="space-y-2.5">
                                            <div>
                                                <div className="mb-1 flex items-center justify-between">
                                                    <span
                                                        className="text-[11px] text-muted-foreground"
                                                        title={t('settings.floating.saturationHint')}
                                                    >
                                                        {t('settings.floating.saturation')}
                                                    </span>
                                                    <span className="font-mono text-[11px] tabular-nums text-foreground">
                                                        {saturation}%
                                                    </span>
                                                </div>
                                                <LiquidSlider
                                                    size={0.5}
                                                    fillContainer
                                                    min={SATURATION_LIMITS.min}
                                                    max={SATURATION_LIMITS.max}
                                                    value={saturation}
                                                    onChange={(next) => updatePageFilter(next, brightness)}
                                                    aria-label={t('settings.floating.saturation')}
                                                />
                                            </div>
                                            <div>
                                                <div className="mb-1 flex items-center justify-between">
                                                    <span
                                                        className="text-[11px] text-muted-foreground"
                                                        title={t('settings.floating.brightnessHint')}
                                                    >
                                                        {t('settings.floating.brightness')}
                                                    </span>
                                                    <span className="font-mono text-[11px] tabular-nums text-foreground">
                                                        {brightness}%
                                                    </span>
                                                </div>
                                                <LiquidSlider
                                                    size={0.5}
                                                    fillContainer
                                                    min={BRIGHTNESS_LIMITS.min}
                                                    max={BRIGHTNESS_LIMITS.max}
                                                    value={brightness}
                                                    onChange={(next) => updatePageFilter(saturation, next)}
                                                    aria-label={t('settings.floating.brightness')}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <p className="mt-3 border-t border-border/50 pt-2 text-[11px] leading-relaxed text-muted-foreground">
                                        {isAuthed ? t('settings.floating.synced') : t('settings.floating.local')}
                                    </p>
                                    </div>
                                </motion.div>
                            )}
                            {/* 外缘暗线环（iOS 27）：与弹窗同动画的外层 1px 渐淡暗线兄弟节点 */}
                            {open && panelGlass && (
                                <motion.div
                                    key="settings-popover-edge"
                                    initial={{ y: 8, scale: 0.96 }}
                                    animate={{ y: 0, scale: 1 }}
                                    exit={{ y: 8, scale: 0.96 }}
                                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                                    style={{ transformOrigin: 'bottom right' }}
                                    className="pointer-events-none absolute inset-0"
                                >
                                    <GlassEdgeRing variant="edges" radius={24} />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>,
                    document.body,
                )}

            <Tooltip>
                <TooltipTrigger asChild>
                    <motion.span
                        ref={gearRef}
                        animate={pressGear}
                        className="relative block h-10 w-10"
                    >
                        <button
                            type="button"
                            onClick={toggleOpen}
                            onPointerDown={() => press(pressGear)}
                            onPointerUp={() => release(pressGear)}
                            onPointerLeave={() => release(pressGear)}
                            className={cn(
                                'hover-glow relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border/60 text-muted-foreground shadow-md transition-colors hover:text-primary',
                                !panelGlass && 'bg-popover',
                                open && 'text-primary',
                            )}
                            aria-label={t('settings.floating.open')}
                        >
                            <GlassButtonBackground size={40} />
                            <Settings className="relative h-4 w-4" />
                        </button>
                        {panelGlass && <GlassEdgeRing variant="circle" />}
                    </motion.span>
                </TooltipTrigger>
                <TooltipContent side="left" className="tooltip-dark">
                    {t('settings.floating.open')}
                </TooltipContent>
            </Tooltip>
        </>
    );
}

async function request<T>(url: string, init: RequestInit): Promise<T | null> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        // 优先 XSRF-TOKEN cookie（服务端每个响应都会重发，始终与当前会话同步）；
        // meta csrf-token 只在整页加载时渲染，会话轮换/过期后会陈旧导致 419
        ...getCsrfHeaders(),
    };

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
