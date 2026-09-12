import { Head, router } from '@inertiajs/react';
import { Bot, KeyRound, Link2, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import ErrorDetailDialog from '@/components/error-detail-dialog';
import type { AiErrorDetail } from '@/components/error-detail-dialog';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Props {
    ai_api_format: 'openai' | 'anthropic';
    ai_api_url: string;
    ai_model: string;
    ai_api_key_masked: string;
    ai_configured: boolean;
    api_url_defaults: {
        openai: string;
        anthropic: string;
    };
}

const API_FORMATS: Array<{ value: 'openai' | 'anthropic'; labelKey: string }> = [
    { value: 'openai', labelKey: 'settings.ai.formatOpenai' },
    { value: 'anthropic', labelKey: 'settings.ai.formatAnthropic' },
];

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

export default function AiSettings({
    ai_api_format,
    ai_api_url,
    ai_model,
    ai_api_key_masked,
    ai_configured,
    api_url_defaults,
}: Props) {
    const { t } = useTranslation();
    const [format, setFormat] = useState<'openai' | 'anthropic'>(ai_api_format);
    const [apiUrl, setApiUrl] = useState(ai_api_url);
    const [model, setModel] = useState(ai_model);
    const [apiKey, setApiKey] = useState('');
    const [saving, setSaving] = useState(false);
    const [models, setModels] = useState<string[]>([]);
    const [modelFilter, setModelFilter] = useState('');
    const [loadingModels, setLoadingModels] = useState(false);
    const [errorDetail, setErrorDetail] = useState<AiErrorDetail | null>(null);

    const fetchModels = async () => {
        if (loadingModels) {
            return;
        }

        setLoadingModels(true);

        try {
            const csrf = getCsrfToken();

            if (!csrf) {
                throw new Error('CSRF token not found.');
            }

            const response = await fetch('/settings/ai/models', {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    [csrf.headerName]: csrf.value,
                },
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                const message = data?.message ?? t('settings.ai.modelsFetchFailed');

                toast.error(message, {
                    description: t('settings.ai.detailHint'),
                    action: {
                        label: t('settings.ai.viewDetail'),
                        onClick: () => setErrorDetail({ message, debug: data?.debug }),
                    },
                });

                return;
            }

            const list: string[] = Array.isArray(data?.data) ? data.data : [];

            setModels(list);
            setModelFilter('');

            if (list.length > 0) {
                toast.success(t('settings.ai.modelsFetched', { count: list.length }));
            } else {
                toast.error(t('settings.ai.modelsFetchFailed'));
            }
        } catch {
            toast.error(t('settings.ai.modelsFetchFailed'));
        } finally {
            setLoadingModels(false);
        }
    };

    const filteredModels = models.filter((id) =>
        id.toLowerCase().includes(modelFilter.trim().toLowerCase()),
    );

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        router.put(
            '/settings/ai',
            {
                ai_api_format: format,
                ai_api_url: apiUrl,
                ai_model: model,
                ai_api_key: apiKey,
            },
            {
                onFinish: () => {
                    setSaving(false);
                    setApiKey('');
                },
            },
        );
    };

    return (
        <>
            <Head title={t('settings.ai.title')} />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="mx-auto w-full max-w-2xl space-y-6">
                    <Heading
                        variant="small"
                        title={t('settings.ai.heading')}
                        description={t('settings.ai.description')}
                    />

                    <Card className="overflow-hidden py-0 gap-0">
                        <CardContent className="!p-0">
                            <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                                        <Bot className="h-4 w-4" />
                                    </div>
                                    <span className="text-callout font-medium">{t('settings.ai.connection')}</span>
                                </div>
                                <Badge variant={ai_configured ? 'default' : 'secondary'}>
                                    {ai_configured ? t('settings.ai.configured') : t('settings.ai.notConfigured')}
                                </Badge>
                            </div>

                            <form onSubmit={submit} className="space-y-5 px-6 py-5">
                                <div className="space-y-1.5">
                                    <Label>{t('settings.ai.format')}</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {API_FORMATS.map((item) => (
                                            <button
                                                key={item.value}
                                                type="button"
                                                onClick={() => setFormat(item.value)}
                                                className={cn(
                                                    'apple-press rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                                                    format === item.value
                                                        ? 'border-primary bg-primary/10 text-primary'
                                                        : 'border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                                                )}
                                            >
                                                {t(item.labelKey)}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground">{t('settings.ai.formatHint')}</p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="ai-api-url" className="flex items-center gap-1.5">
                                        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                                        {t('settings.ai.apiUrl')}
                                    </Label>
                                    <Input
                                        id="ai-api-url"
                                        value={apiUrl}
                                        onChange={(e) => setApiUrl(e.target.value)}
                                        placeholder={api_url_defaults[format]}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {format === 'anthropic'
                                            ? t('settings.ai.apiUrlHintAnthropic', { default: api_url_defaults.anthropic })
                                            : t('settings.ai.apiUrlHintOpenai', { default: api_url_defaults.openai })}
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="ai-api-key" className="flex items-center gap-1.5">
                                        <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                                        {t('settings.ai.apiKey')}
                                    </Label>
                                    <Input
                                        id="ai-api-key"
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder={
                                            ai_api_key_masked
                                                ? t('settings.ai.apiKeyPlaceholderConfigured', { masked: ai_api_key_masked })
                                                : t('settings.ai.apiKeyPlaceholder')
                                        }
                                        autoComplete="new-password"
                                    />
                                    <p className="text-xs text-muted-foreground">{t('settings.ai.apiKeyHint')}</p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="ai-model" className="flex items-center gap-1.5">
                                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                                        {t('settings.ai.model')}
                                    </Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="ai-model"
                                            value={model}
                                            onChange={(e) => setModel(e.target.value)}
                                            placeholder="gpt-4o-mini"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="shrink-0"
                                            onClick={fetchModels}
                                            disabled={loadingModels}
                                            title={t('settings.ai.fetchModelsHint')}
                                        >
                                            {loadingModels
                                                ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        {t('settings.ai.fetchingModels')}
                                                    </>
                                                )
                                                : (
                                                    <>
                                                        <RefreshCw className="h-4 w-4" />
                                                        {t('settings.ai.fetchModels')}
                                                    </>
                                                )}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{t('settings.ai.modelHint')}</p>

                                    {models.length > 0 && (
                                        <div className="rounded-xl border border-input">
                                            <div className="border-b border-border/40 p-2">
                                                <Input
                                                    value={modelFilter}
                                                    onChange={(e) => setModelFilter(e.target.value)}
                                                    placeholder={t('settings.ai.filterModels')}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div className="max-h-56 overflow-y-auto p-1.5">
                                                {filteredModels.length === 0 ? (
                                                    <p className="py-4 text-center text-xs text-muted-foreground">
                                                        {t('settings.ai.noModelsMatch')}
                                                    </p>
                                                ) : (
                                                    filteredModels.map((id) => (
                                                        <button
                                                            key={id}
                                                            type="button"
                                                            onClick={() => {
                                                                setModel(id);
                                                                setModels([]);
                                                                setModelFilter('');
                                                            }}
                                                            className={cn(
                                                                'block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-primary/10 hover:text-primary',
                                                                id === model && 'bg-primary/10 font-medium text-primary',
                                                            )}
                                                        >
                                                            {id}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                            <p className="border-t border-border/40 px-2.5 py-1.5 text-xs text-muted-foreground">
                                                {t('settings.ai.modelListHint')}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-4">
                                    <p className="text-xs text-muted-foreground">{t('settings.ai.usageHint')}</p>
                                    <Button type="submit" disabled={saving}>
                                        {saving ? t('common.saving') : t('common.save')}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <ErrorDetailDialog detail={errorDetail} onClose={() => setErrorDetail(null)} />
        </>
    );
}
