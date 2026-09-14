import { Head, router } from '@inertiajs/react';
import {
    Bot,
    Image as ImageIcon,
    KeyRound,
    Link2,
    Loader2,
    RefreshCw,
    Sparkles,
    Trash2,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import AdminSettingsShell from '@/components/admin-settings-shell';
import ErrorDetailDialog from '@/components/error-detail-dialog';
import type { AiErrorDetail } from '@/components/error-detail-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface AssistantProps {
    assistant_enabled: boolean;
    assistant_name: string;
    assistant_welcome: string;
    assistant_system_prompt: string;
    assistant_mode: 'standard' | 'fastgpt';
    assistant_api_url: string;
    assistant_model: string;
    assistant_api_key_masked: string;
    assistant_avatar: { id: number; url: string } | null;
}

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
    assistant: AssistantProps;
}

const API_FORMATS: Array<{ value: 'openai' | 'anthropic'; labelKey: string }> =
    [
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
    assistant,
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

    // AI 小助手表单状态
    const [assistantEnabled, setAssistantEnabled] = useState(
        assistant.assistant_enabled,
    );
    const [assistantName, setAssistantName] = useState(
        assistant.assistant_name,
    );
    const [assistantWelcome, setAssistantWelcome] = useState(
        assistant.assistant_welcome,
    );
    const [assistantPrompt, setAssistantPrompt] = useState(
        assistant.assistant_system_prompt,
    );
    const [assistantMode, setAssistantMode] = useState<'standard' | 'fastgpt'>(
        assistant.assistant_mode,
    );
    const [assistantApiUrl, setAssistantApiUrl] = useState(
        assistant.assistant_api_url,
    );
    const [assistantModel, setAssistantModel] = useState(
        assistant.assistant_model,
    );
    const [assistantApiKey, setAssistantApiKey] = useState('');
    const [assistantAvatar, setAssistantAvatar] = useState(
        assistant.assistant_avatar,
    );
    const [assistantSaving, setAssistantSaving] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);

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
                const message =
                    data?.message ?? t('settings.ai.modelsFetchFailed');

                toast.error(message, {
                    description: t('settings.ai.detailHint'),
                    action: {
                        label: t('settings.ai.viewDetail'),
                        onClick: () =>
                            setErrorDetail({ message, debug: data?.debug }),
                    },
                });

                return;
            }

            const list: string[] = Array.isArray(data?.data) ? data.data : [];

            setModels(list);
            setModelFilter('');

            if (list.length > 0) {
                toast.success(
                    t('settings.ai.modelsFetched', { count: list.length }),
                );
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

    const submitApi = (e: React.FormEvent) => {
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

    const submitAssistant = (e: React.FormEvent) => {
        e.preventDefault();
        setAssistantSaving(true);

        router.put(
            '/settings/assistant',
            {
                assistant_enabled: assistantEnabled ? '1' : '0',
                assistant_name: assistantName,
                assistant_welcome: assistantWelcome,
                assistant_system_prompt: assistantPrompt,
                assistant_mode: assistantMode,
                assistant_api_url: assistantApiUrl,
                assistant_model: assistantModel,
                assistant_api_key: assistantApiKey,
            },
            {
                onFinish: () => {
                    setAssistantSaving(false);
                    setAssistantApiKey('');
                },
            },
        );
    };

    const uploadAvatar = (file: File) => {
        const csrf = getCsrfToken();

        if (!csrf) {
            toast.error(t('settings.assistant.uploadFailed'));

            return;
        }

        setAvatarUploading(true);

        const formData = new FormData();
        formData.append('file', file);

        fetch('/settings/assistant/avatar', {
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
                    toast.error(
                        data?.message ?? t('settings.assistant.uploadFailed'),
                    );

                    return;
                }

                setAssistantAvatar({ id: data.id, url: data.url });
                toast.success(t('settings.assistant.uploadSuccess'));
            })
            .catch(() => toast.error(t('settings.assistant.uploadFailed')))
            .finally(() => setAvatarUploading(false));
    };

    const removeAvatar = () => {
        router.delete('/settings/assistant/avatar', { preserveScroll: true });
        setAssistantAvatar(null);
    };

    return (
        <>
            <Head title={t('settings.ai.title')} />

            <AdminSettingsShell
                title={t('settings.ai.heading')}
                description={t('settings.ai.description')}
            >
                <div className="space-y-6">
                    {/* AI 接口配置 */}
                    <Card className="gap-0 overflow-hidden py-0">
                        <CardContent className="!p-0">
                            <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                                        <Bot className="h-4 w-4" />
                                    </div>
                                    <span className="text-callout font-medium">
                                        {t('settings.ai.connection')}
                                    </span>
                                </div>
                                <Badge
                                    variant={
                                        ai_configured ? 'default' : 'secondary'
                                    }
                                >
                                    {ai_configured
                                        ? t('settings.ai.configured')
                                        : t('settings.ai.notConfigured')}
                                </Badge>
                            </div>

                            <form
                                onSubmit={submitApi}
                                className="space-y-5 px-6 py-5"
                            >
                                <div className="space-y-1.5">
                                    <Label>{t('settings.ai.format')}</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {API_FORMATS.map((item) => (
                                            <button
                                                key={item.value}
                                                type="button"
                                                onClick={() =>
                                                    setFormat(item.value)
                                                }
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
                                    <p className="text-xs text-muted-foreground">
                                        {t('settings.ai.formatHint')}
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label
                                        htmlFor="ai-api-url"
                                        className="flex items-center gap-1.5"
                                    >
                                        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                                        {t('settings.ai.apiUrl')}
                                    </Label>
                                    <Input
                                        id="ai-api-url"
                                        value={apiUrl}
                                        onChange={(e) =>
                                            setApiUrl(e.target.value)
                                        }
                                        placeholder={api_url_defaults[format]}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {format === 'anthropic'
                                            ? t(
                                                  'settings.ai.apiUrlHintAnthropic',
                                                  {
                                                      default:
                                                          api_url_defaults.anthropic,
                                                  },
                                              )
                                            : t(
                                                  'settings.ai.apiUrlHintOpenai',
                                                  {
                                                      default:
                                                          api_url_defaults.openai,
                                                  },
                                              )}
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label
                                        htmlFor="ai-api-key"
                                        className="flex items-center gap-1.5"
                                    >
                                        <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                                        {t('settings.ai.apiKey')}
                                    </Label>
                                    <Input
                                        id="ai-api-key"
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) =>
                                            setApiKey(e.target.value)
                                        }
                                        placeholder={
                                            ai_api_key_masked
                                                ? t(
                                                      'settings.ai.apiKeyPlaceholderConfigured',
                                                      {
                                                          masked: ai_api_key_masked,
                                                      },
                                                  )
                                                : t(
                                                      'settings.ai.apiKeyPlaceholder',
                                                  )
                                        }
                                        autoComplete="new-password"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t('settings.ai.apiKeyHint')}
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label
                                        htmlFor="ai-model"
                                        className="flex items-center gap-1.5"
                                    >
                                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                                        {t('settings.ai.model')}
                                    </Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="ai-model"
                                            value={model}
                                            onChange={(e) =>
                                                setModel(e.target.value)
                                            }
                                            placeholder="gpt-4o-mini"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="shrink-0"
                                            onClick={fetchModels}
                                            disabled={loadingModels}
                                            title={t(
                                                'settings.ai.fetchModelsHint',
                                            )}
                                        >
                                            {loadingModels ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    {t(
                                                        'settings.ai.fetchingModels',
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <RefreshCw className="h-4 w-4" />
                                                    {t(
                                                        'settings.ai.fetchModels',
                                                    )}
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {t('settings.ai.modelHint')}
                                    </p>

                                    {models.length > 0 && (
                                        <div className="rounded-xl border border-input">
                                            <div className="border-b border-border/40 p-2">
                                                <Input
                                                    value={modelFilter}
                                                    onChange={(e) =>
                                                        setModelFilter(
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder={t(
                                                        'settings.ai.filterModels',
                                                    )}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div className="max-h-56 overflow-y-auto p-1.5">
                                                {filteredModels.length === 0 ? (
                                                    <p className="py-4 text-center text-xs text-muted-foreground">
                                                        {t(
                                                            'settings.ai.noModelsMatch',
                                                        )}
                                                    </p>
                                                ) : (
                                                    filteredModels.map((id) => (
                                                        <button
                                                            key={id}
                                                            type="button"
                                                            onClick={() => {
                                                                setModel(id);
                                                                setModels([]);
                                                                setModelFilter(
                                                                    '',
                                                                );
                                                            }}
                                                            className={cn(
                                                                'block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-primary/10 hover:text-primary',
                                                                id === model &&
                                                                    'bg-primary/10 font-medium text-primary',
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
                                    <p className="text-xs text-muted-foreground">
                                        {t('settings.ai.usageHint')}
                                    </p>
                                    <Button type="submit" disabled={saving}>
                                        {saving
                                            ? t('common.saving')
                                            : t('common.save')}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* AI 小助手 */}
                    <Card className="gap-0 overflow-hidden py-0">
                        <CardContent className="!p-0">
                            <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                                        <Bot className="h-4 w-4" />
                                    </div>
                                    <span className="text-callout font-medium">
                                        {t('settings.assistant.title')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                        {t('settings.assistant.enable')}
                                    </span>
                                    <Switch
                                        checked={assistantEnabled}
                                        onCheckedChange={(checked) =>
                                            setAssistantEnabled(checked)
                                        }
                                    />
                                </div>
                            </div>

                            <form
                                onSubmit={submitAssistant}
                                className="space-y-5 px-6 py-5"
                            >
                                <div className="space-y-1.5">
                                    <Label className="flex items-center gap-1.5">
                                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                        {t('settings.assistant.avatar')}
                                    </Label>
                                    <div className="flex items-center gap-3">
                                        {assistantAvatar ? (
                                            <img
                                                src={assistantAvatar.url}
                                                alt={assistantName}
                                                className="h-12 w-12 rounded-full object-cover"
                                            />
                                        ) : (
                                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                                                <Bot className="h-5 w-5" />
                                            </span>
                                        )}
                                        <input
                                            ref={avatarInputRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/gif,image/webp"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file =
                                                    e.target.files?.[0];

                                                if (file) {
                                                    uploadAvatar(file);
                                                    e.target.value = '';
                                                }
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={avatarUploading}
                                            onClick={() =>
                                                avatarInputRef.current?.click()
                                            }
                                        >
                                            {avatarUploading
                                                ? t('common.saving')
                                                : t(
                                                      'settings.assistant.changeAvatar',
                                                  )}
                                        </Button>
                                        {assistantAvatar && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={removeAvatar}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                {t(
                                                    'settings.assistant.removeAvatar',
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="assistant-name">
                                        {t('settings.assistant.name')}
                                    </Label>
                                    <Input
                                        id="assistant-name"
                                        value={assistantName}
                                        onChange={(e) =>
                                            setAssistantName(e.target.value)
                                        }
                                        placeholder="AI 小助手"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="assistant-welcome">
                                        {t('settings.assistant.welcome')}
                                    </Label>
                                    <Textarea
                                        id="assistant-welcome"
                                        value={assistantWelcome}
                                        onChange={(e) =>
                                            setAssistantWelcome(e.target.value)
                                        }
                                        placeholder="你好！我是 AI 小助手…"
                                        className="min-h-[60px]"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="assistant-prompt">
                                        {t('settings.assistant.systemPrompt')}
                                    </Label>
                                    <Textarea
                                        id="assistant-prompt"
                                        value={assistantPrompt}
                                        onChange={(e) =>
                                            setAssistantPrompt(e.target.value)
                                        }
                                        placeholder={t(
                                            'settings.assistant.systemPromptPlaceholder',
                                        )}
                                        className="min-h-[100px]"
                                    />
                                    {assistantMode === 'fastgpt' && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400">
                                            {t(
                                                'settings.assistant.promptFastgptHint',
                                            )}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label>
                                        {t('settings.assistant.mode')}
                                    </Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['standard', 'fastgpt'] as const).map(
                                            (value) => (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() =>
                                                        setAssistantMode(value)
                                                    }
                                                    className={cn(
                                                        'apple-press rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                                                        assistantMode === value
                                                            ? 'border-primary bg-primary/10 text-primary'
                                                            : 'border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground',
                                                    )}
                                                >
                                                    {value === 'standard'
                                                        ? t(
                                                              'settings.assistant.modeStandard',
                                                          )
                                                        : t(
                                                              'settings.assistant.modeFastgpt',
                                                          )}
                                                </button>
                                            ),
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {assistantMode === 'fastgpt'
                                            ? t(
                                                  'settings.assistant.modeFastgptHint',
                                              )
                                            : t(
                                                  'settings.assistant.modeStandardHint',
                                              )}
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="assistant-api-url">
                                        {t('settings.assistant.apiUrl')}
                                    </Label>
                                    <Input
                                        id="assistant-api-url"
                                        value={assistantApiUrl}
                                        onChange={(e) =>
                                            setAssistantApiUrl(e.target.value)
                                        }
                                        placeholder={
                                            assistantMode === 'fastgpt'
                                                ? 'https://your-fastgpt.com/api/v1'
                                                : 'https://api.openai.com/v1'
                                        }
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="assistant-api-key">
                                        {t('settings.assistant.apiKey')}
                                    </Label>
                                    <Input
                                        id="assistant-api-key"
                                        type="password"
                                        value={assistantApiKey}
                                        onChange={(e) =>
                                            setAssistantApiKey(e.target.value)
                                        }
                                        placeholder={
                                            assistant.assistant_api_key_masked
                                                ? t(
                                                      'settings.assistant.apiKeyPlaceholderConfigured',
                                                      {
                                                          masked: assistant.assistant_api_key_masked,
                                                      },
                                                  )
                                                : t(
                                                      'settings.assistant.apiKeyPlaceholder',
                                                  )
                                        }
                                        autoComplete="new-password"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="assistant-model">
                                        {t('settings.assistant.model')}
                                    </Label>
                                    <Input
                                        id="assistant-model"
                                        value={assistantModel}
                                        onChange={(e) =>
                                            setAssistantModel(e.target.value)
                                        }
                                        placeholder={
                                            assistantMode === 'fastgpt'
                                                ? t(
                                                      'settings.assistant.modelFastgptPlaceholder',
                                                  )
                                                : 'gpt-4o-mini'
                                        }
                                    />
                                </div>

                                <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-4">
                                    <p className="text-xs text-muted-foreground">
                                        {t('settings.assistant.usageHint')}
                                    </p>
                                    <Button
                                        type="submit"
                                        disabled={assistantSaving}
                                    >
                                        {assistantSaving
                                            ? t('common.saving')
                                            : t('common.save')}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                <ErrorDetailDialog
                    detail={errorDetail}
                    onClose={() => setErrorDetail(null)}
                />
            </AdminSettingsShell>
        </>
    );
}
