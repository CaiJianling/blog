import { Form, Head } from '@inertiajs/react';
import { Palette } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as themeActions from '@/actions/App/Http/Controllers/ThemeSettingController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppearance } from '@/hooks/use-appearance';
import {
    applyThemeStyle,
    primaryForeground,
    syncThemeColorMeta,
    themePrimary,
} from '@/lib/theme';
import { cn } from '@/lib/utils';

interface Props {
    themeColor: string;
    defaultColor: string;
    presets: string[];
}

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

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

export default function Theme({ themeColor, defaultColor, presets }: Props) {
    const { t } = useTranslation();
    const { resolvedAppearance } = useAppearance();

    // 空值 = 使用内置默认蓝（浅/深各自默认），提交时据此决定发 '' 还是具体色值。
    const [color, setColor] = useState(themeColor || defaultColor);
    const [hexText, setHexText] = useState(themeColor || defaultColor);
    const [isDefault, setIsDefault] = useState(themeColor === '');

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
                        </>
                    )}
                </Form>
            </div>
        </>
    );
}
