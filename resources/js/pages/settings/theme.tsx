import { Form, Head } from '@inertiajs/react';
import { GlassWater, Image as ImageIcon, Palette, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import * as themeActions from '@/actions/App/Http/Controllers/ThemeSettingController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import LiquidSlider from '@/components/LiquidGlass/LiquidSlider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppearance } from '@/hooks/use-appearance';
import { EFFECT_LEVEL, useEffectsAtLeast } from '@/hooks/use-effects';
import { GLASS_FROST_LIMITS } from '@/hooks/use-glass-frost';
import {
    applyThemeStyle,
    primaryForeground,
    syncThemeColorMeta,
    themePrimary,
} from '@/lib/theme';
import { cn } from '@/lib/utils';

interface BackgroundSettings {
    mode: string;
    opacity: number;
    url: string | null;
    customUrl: string | null;
    bingUrl: string | null;
}

interface Props {
    themeColor: string;
    defaultColor: string;
    presets: string[];
    background: BackgroundSettings;
    defaultGlassFrost: number;
}

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

/** 背景模式选项：不使用 / 自定义壁纸 / 必应每日壁纸。 */
const BG_MODES = [
    { value: '', labelKey: 'settings.theme.bgModeNone' },
    { value: 'custom', labelKey: 'settings.theme.bgModeCustom' },
    { value: 'bing', labelKey: 'settings.theme.bgModeBing' },
] as const;

/** 归一化为 #rrggbb 小写；不合法返回 null。 */
const normalizeHex = (raw: string): string | null => {
    let value = raw.trim();

    if (value === '') {
        return null;
    }

    if (value[0] !== '#') {
        value = '#'.concat(value);
    }

    value = value.toLowerCase();

    return HEX_RE.test(value) ? value : null;
};

function getCsrfToken(): { headerName: string; value: string } | null {
    const meta = document
        .querySelector('meta[name="csrf-token"]')
        ?.getAttribute('content');

    if (meta) {
        return { headerName: 'X-CSRF-TOKEN', value: meta };
    }

    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    if (match?.[1]) {
        return {
            headerName: 'X-XSRF-TOKEN',
            value: decodeURIComponent(match[1]),
        };
    }

    return null;
}

export default function Theme({
    themeColor,
    defaultColor,
    presets,
    background,
    defaultGlassFrost,
}: Props) {
    const { t } = useTranslation();
    const { resolvedAppearance } = useAppearance();
    const liquidSlider = useEffectsAtLeast(EFFECT_LEVEL.on);

    // 空值 = 使用内置默认蓝（浅/深各自默认），提交时据此决定发 '' 还是具体色值。
    const [color, setColor] = useState(themeColor || defaultColor);
    const [hexText, setHexText] = useState(themeColor || defaultColor);
    const [isDefault, setIsDefault] = useState(themeColor === '');

    // 背景设置：模式 / 透明度 / 两类壁纸的预览地址（保存或上传后由服务端 props 同步回来）
    const [bgMode, setBgMode] = useState(background?.mode ?? '');
    const [bgOpacity, setBgOpacity] = useState(background?.opacity ?? 100);
    const [customUrl, setCustomUrl] = useState<string | null>(background?.customUrl ?? null);
    const [bingUrl, setBingUrl] = useState<string | null>(background?.bingUrl ?? null);
    const [uploading, setUploading] = useState(false);
    const wallpaperInputRef = useRef<HTMLInputElement>(null);

    // 默认液态玻璃模糊值（0-100）：前台未自定义磨砂度者使用的兜底默认
    const [glassFrost, setGlassFrost] = useState(defaultGlassFrost);

    // 保存（Inertia 回跳）后用服务端最新背景状态同步本地预览
    useEffect(() => {
        if (!background) {
            return;
        }

        setBgMode(background.mode);
        setBgOpacity(background.opacity);
        setCustomUrl(background.customUrl);
        setBingUrl(background.bingUrl);
    }, [background]);

    const uploadWallpaper = (file: File) => {
        const csrf = getCsrfToken();

        if (!csrf) {
            toast.error(t('settings.theme.bgUploadFailed'));

            return;
        }

        setUploading(true);

        const formData = new FormData();
        formData.append('file', file);

        fetch('/settings/theme/background', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                [csrf.headerName]: csrf.value,
            },
            body: formData,
        })
            .then(async (response) => {
                const data = await response.json().catch(() => null);

                if (!response.ok) {
                    toast.error(data?.message ?? t('settings.theme.bgUploadFailed'));

                    return;
                }

                setCustomUrl(data.url);
                setBgMode('custom');
                toast.success(t('settings.theme.bgUploadSuccess'));
            })
            .catch(() => toast.error(t('settings.theme.bgUploadFailed')))
            .finally(() => setUploading(false));
    };

    const removeWallpaper = () => {
        const csrf = getCsrfToken();

        if (!csrf) {
            toast.error(t('settings.theme.bgUploadFailed'));

            return;
        }

        setUploading(true);

        fetch('/settings/theme/background', {
            method: 'DELETE',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                [csrf.headerName]: csrf.value,
            },
        })
            .then(async (response) => {
                if (!response.ok) {
                    toast.error(t('settings.theme.bgUploadFailed'));

                    return;
                }

                setCustomUrl(null);

                setBgMode((prev) => (prev === 'custom' ? '' : prev));
                toast.success(t('settings.theme.bgRemoveSuccess'));
            })
            .catch(() => toast.error(t('settings.theme.bgUploadFailed')))
            .finally(() => setUploading(false));
    };

    // 预览按当前外观取实际使用的主色（浅色较深、深色较浅），与全站一致。
    const previewColor = themePrimary(color, resolvedAppearance);
    const previewFg = primaryForeground(previewColor);

    const applyColor = (hex: string) => {
        setColor(hex);
        setHexText(hex);
        setIsDefault(hex === defaultColor);
    };

    const handleHexText = (value: string) => {
        setHexText(value);
        const normalized = normalizeHex(value);

        if (normalized !== null) {
            setColor(normalized);
            setIsDefault(normalized === defaultColor);
        }
    };

    const cardHeader = (icon: React.ReactNode, title: string) => (
        <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
            <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    {icon}
                </div>
                <span className="text-callout font-medium">{title}</span>
            </div>
        </div>
    );

    return (
        <>
            <Head title={t('settings.theme.title')} />

            <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
                <Heading variant="small" title={t('settings.theme.heading')} description={t('settings.theme.description')} />

                <Form
                    {...themeActions.update.form()}
                    options={{ preserveScroll: true }}
                    onFinish={() => {
                        applyThemeStyle(isDefault ? '' : color);
                        syncThemeColorMeta();
                    }}
                    className="space-y-6"
                >
                    {({ processing, errors }) => (
                        <>
                            <input
                                type="hidden"
                                name="theme_color"
                                value={isDefault ? '' : color}
                            />
                            <input
                                type="hidden"
                                name="background_mode"
                                value={bgMode}
                            />
                            <input
                                type="hidden"
                                name="background_opacity"
                                value={bgOpacity}
                            />
                            <input
                                type="hidden"
                                name="default_glass_frost"
                                value={glassFrost}
                            />

                            <Card className="gap-0 overflow-hidden py-0">
                                {cardHeader(
                                    <Palette className="h-4 w-4" />,
                                    t('settings.theme.primaryColor'),
                                )}
                                <CardContent className="space-y-5 px-6 py-5">
                                    <p className="text-sm text-muted-foreground">
                                        {t('settings.theme.primaryColorHint')}
                                    </p>

                                    {/* 选色：原生取色器 + HEX 文本 */}
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="color"
                                            value={color}
                                            onChange={(e) =>
                                                applyColor(
                                                    e.target.value.toLowerCase(),
                                                )
                                            }
                                            className="h-12 w-12 shrink-0 cursor-pointer rounded-lg border border-border/70 bg-transparent p-1"
                                            aria-label={t(
                                                'settings.theme.primaryColor',
                                            )}
                                        />
                                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                            <Label htmlFor="hex">
                                                {t('settings.theme.custom')}
                                            </Label>
                                            <Input
                                                id="hex"
                                                value={hexText}
                                                onChange={(e) =>
                                                    handleHexText(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="#0071e3"
                                                className="w-40 font-mono text-sm"
                                            />
                                            <InputError
                                                className="mt-1"
                                                message={errors.theme_color}
                                            />
                                        </div>
                                    </div>

                                    {/* 预设色板 */}
                                    <div className="flex flex-wrap gap-2.5">
                                        {presets.map((preset) => (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => applyColor(preset)}
                                                style={{
                                                    backgroundColor: preset,
                                                }}
                                                title={preset}
                                                aria-label={preset}
                                                className={cn(
                                                    'h-9 w-9 rounded-full border border-black/5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                    color === preset &&
                                                        !isDefault &&
                                                        'ring-2 ring-ring ring-offset-2 ring-offset-background',
                                                )}
                                            />
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <span className="text-callout font-medium text-foreground">
                                            {t('settings.theme.presets')}
                                        </span>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                applyColor(defaultColor)
                                            }
                                        >
                                            {t('settings.theme.reset')}
                                        </Button>
                                    </div>

                                    {/* 效果预览 */}
                                    <div className="space-y-3 rounded-xl border border-border/40 bg-muted/30 p-4">
                                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            {t('settings.theme.preview')}
                                        </span>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span
                                                className="rounded-lg px-4 py-2 text-sm font-medium"
                                                style={{
                                                    backgroundColor: previewColor,
                                                    color: previewFg,
                                                }}
                                            >
                                                主色按钮
                                            </span>
                                            <span
                                                className="text-sm font-medium underline underline-offset-4"
                                                style={{ color: previewColor }}
                                            >
                                                链接
                                            </span>
                                            <span
                                                className="rounded-lg px-3 py-1.5 text-sm"
                                                style={{
                                                    backgroundColor: `color-mix(in srgb, ${previewColor} 12%, transparent)`,
                                                    color: previewColor,
                                                }}
                                            >
                                                高亮
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end border-t border-border/40 pt-4">
                                        <Button type="submit" disabled={processing}>
                                            {processing
                                                ? t('common.saving')
                                                : t('settings.theme.save')}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* 液态玻璃：默认模糊值（前台未自定义磨砂度者使用的兜底默认） */}
                            <Card className="gap-0 overflow-hidden py-0">
                                {cardHeader(
                                    <GlassWater className="h-4 w-4" />,
                                    t('settings.theme.liquidGlass'),
                                )}
                                <CardContent className="space-y-5 px-6 py-5">
                                    <p className="text-sm text-muted-foreground">
                                        {t('settings.theme.liquidGlassHint')}
                                    </p>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label>
                                                {t('settings.theme.defaultGlassFrost')}
                                            </Label>
                                            <span className="font-mono text-sm tabular-nums text-foreground">
                                                {glassFrost}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>{t('settings.theme.glassFrostClear')}</span>
                                            <span>{t('settings.theme.glassFrostFrosted')}</span>
                                        </div>
                                        <LiquidSlider
                                            fillContainer
                                            size={0.5}
                                            min={GLASS_FROST_LIMITS.min}
                                            max={GLASS_FROST_LIMITS.max}
                                            value={glassFrost}
                                            onChange={setGlassFrost}
                                            aria-label={t('settings.theme.defaultGlassFrost')}
                                        />
                                    </div>

                                    <div className="flex items-center justify-end border-t border-border/40 pt-4">
                                        <Button type="submit" disabled={processing}>
                                            {processing
                                                ? t('common.saving')
                                                : t('settings.theme.save')}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="gap-0 overflow-hidden py-0">
                                {cardHeader(
                                    <ImageIcon className="h-4 w-4" />,
                                    t('settings.theme.background'),
                                )}
                                <CardContent className="space-y-5 px-6 py-5">
                                    <p className="text-sm text-muted-foreground">
                                        {t('settings.theme.backgroundHint')}
                                    </p>

                                    {/* 模式三选：不使用 / 自定义壁纸 / 必应每日壁纸 */}
                                    <div className="inline-flex w-fit items-center gap-1 rounded-2xl bg-muted p-1">
                                        {BG_MODES.map((mode) => (
                                            <button
                                                key={mode.value}
                                                type="button"
                                                onClick={() => setBgMode(mode.value)}
                                                className={cn(
                                                    'rounded-xl px-4 py-1.5 text-sm font-medium transition-all',
                                                    bgMode === mode.value
                                                        ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                                        : 'text-muted-foreground hover:text-foreground',
                                                )}
                                            >
                                                {t(mode.labelKey)}
                                            </button>
                                        ))}
                                    </div>

                                    {/* 壁纸透明度 */}
                                    {bgMode !== '' && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label htmlFor="bg-opacity">
                                                    {t('settings.theme.bgOpacity')}
                                                </Label>
                                                <span className="text-sm tabular-nums text-muted-foreground">
                                                    {bgOpacity}%
                                                </span>
                                            </div>
                                            {liquidSlider ? (
                                                <LiquidSlider
                                                    fillContainer
                                                    size={0.5}
                                                    min={0}
                                                    max={100}
                                                    value={bgOpacity}
                                                    onChange={setBgOpacity}
                                                    aria-label={t(
                                                        'settings.theme.bgOpacity',
                                                    )}
                                                />
                                            ) : (
                                                <input
                                                    id="bg-opacity"
                                                    type="range"
                                                    min={0}
                                                    max={100}
                                                    step={1}
                                                    value={bgOpacity}
                                                    onChange={(e) =>
                                                        setBgOpacity(
                                                            Number(e.target.value),
                                                        )
                                                    }
                                                    className="w-full accent-[var(--primary)]"
                                                />
                                            )}
                                            <p className="text-xs text-muted-foreground">
                                                {t('settings.theme.bgOpacityHint')}
                                            </p>
                                        </div>
                                    )}

                                    {/* 自定义壁纸：预览 + 上传/更换/移除 */}
                                    {bgMode === 'custom' && (
                                        <div className="space-y-3">
                                            {customUrl ? (
                                                <div className="overflow-hidden rounded-xl border border-border/50">
                                                    <img
                                                        src={customUrl}
                                                        alt={t('settings.theme.background')}
                                                        className="h-36 w-full object-cover"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                                                    {t('settings.theme.bgEmpty')}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={uploading}
                                                    onClick={() => wallpaperInputRef.current?.click()}
                                                >
                                                    <Upload className="h-4 w-4" />
                                                    {customUrl
                                                        ? t('settings.theme.bgReplace')
                                                        : t('settings.theme.bgUpload')}
                                                </Button>
                                                {customUrl && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-destructive hover:text-destructive"
                                                        disabled={uploading}
                                                        onClick={removeWallpaper}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        {t('settings.theme.bgRemove')}
                                                    </Button>
                                                )}
                                            </div>
                                            <input
                                                ref={wallpaperInputRef}
                                                type="file"
                                                accept="image/jpeg,image/png,image/gif,image/webp"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];

                                                    if (file) {
                                                        uploadWallpaper(file);
                                                    }

                                                    e.target.value = '';
                                                }}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                {t('settings.theme.bgCustomHint')}
                                            </p>
                                        </div>
                                    )}

                                    {/* 必应每日壁纸：预览 + 说明 */}
                                    {bgMode === 'bing' && (
                                        <div className="space-y-3">
                                            {bingUrl ? (
                                                <div className="overflow-hidden rounded-xl border border-border/50">
                                                    <img
                                                        src={bingUrl}
                                                        alt={t('settings.theme.bgModeBing')}
                                                        className="h-36 w-full object-cover"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                                                    {t('settings.theme.bgBingPending')}
                                                </div>
                                            )}
                                            <p className="text-xs text-muted-foreground">
                                                {t('settings.theme.bgBingHint')}
                                            </p>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-end border-t border-border/40 pt-4">
                                        <Button type="submit" disabled={processing}>
                                            {processing
                                                ? t('common.saving')
                                                : t('settings.theme.save')}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}
