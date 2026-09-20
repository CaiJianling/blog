import { Head, router } from '@inertiajs/react';
import { Bot, Image as ImageIcon, KeyRound, Link2, Sparkles, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface Props {
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

export default function AssistantSettings({
    assistant_enabled,
    assistant_name,
    assistant_welcome,
    assistant_system_prompt,
    assistant_mode,
    assistant_api_url,
    assistant_model,
    assistant_api_key_masked,
    assistant_avatar,
}: Props) {
    const { t } = useTranslation();
    const [enabled, setEnabled] = useState(assistant_enabled);
    const [name, setName] = useState(assistant_name);
    const [welcome, setWelcome] = useState(assistant_welcome);
    const [systemPrompt, setSystemPrompt] = useState(assistant_system_prompt);
    const [mode, setMode] = useState<'standard' | 'fastgpt'>(assistant_mode);
    const [apiUrl, setApiUrl] = useState(assistant_api_url);
    const [model, setModel] = useState(assistant_model);
    const [apiKey, setApiKey] = useState('');
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [avatar, setAvatar] = useState(assistant_avatar);
    const fileRef = useRef<HTMLInputElement>(null);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        router.put(
            '/admin/settings/assistant',
            {
                assistant_enabled: enabled ? '1' : '0',
                assistant_name: name,
                assistant_welcome: welcome,
                assistant_system_prompt: systemPrompt,
                assistant_mode: mode,
                assistant_api_url: apiUrl,
                assistant_model: model,
                assistant_api_key: apiKey,
            },
            {
                onFinish: () => {
                    setSaving(false);
                    setApiKey('');
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

        setUploading(true);

        const formData = new FormData();
        formData.append('file', file);

        fetch('/admin/settings/assistant/avatar', {
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
                    toast.error(data?.message ?? t('settings.assistant.uploadFailed'));

                    return;
                }

                setAvatar({ id: data.id, url: data.url });
                toast.success(t('settings.assistant.uploadSuccess'));
            })
            .catch(() => toast.error(t('settings.assistant.uploadFailed')))
            .finally(() => setUploading(false));
    };

    const removeAvatar = () => {
        router.delete('/admin/settings/assistant/avatar', { preserveScroll: true });
        setAvatar(null);
    };

    return (
        <>
            <Head title={t('settings.assistant.title')} />

            <div className="flex min-h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="mx-auto w-full max-w-2xl space-y-6">
                    <Heading
                        variant="small"
                        title={t('settings.assistant.heading')}
                        description={t('settings.assistant.description')}
                    />

                    <Card className="overflow-hidden py-0 gap-0">
                        <CardContent className="!p-0">
                            <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                                        <Bot className="h-4 w-4" />
                                    </div>
                                    <span className="text-callout font-medium">{t('settings.assistant.basic')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">{t('settings.assistant.enable')}</span>
                                    <Switch checked={enabled} onCheckedChange={(checked) => setEnabled(checked)} />
                                </div>
                            </div>

                            <form onSubmit={submit} className="space-y-5 px-6 py-5">
                                {/* 头像 */}
                                <div className="space-y-1.5">
                                    <Label className="flex items-center gap-1.5">
                                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                        {t('settings.assistant.avatar')}
                                    </Label>
                                    <div className="flex items-center gap-3">
                                        {avatar ? (
                                            <img src={avatar.url} alt={name} className="h-12 w-12 rounded-full object-cover" />
                                        ) : (
                                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                                                <Bot className="h-5 w-5" />
                                            </span>
                                        )}
                                        <input
                                            ref={fileRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/gif,image/webp"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];

                                                if (file) {
                                                    uploadAvatar(file);
                                                    e.target.value = '';
                                                }
                                            }}
                                        />
                                        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                                            {uploading ? t('common.saving') : t('settings.assistant.changeAvatar')}
                                        </Button>
                                        {avatar && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={removeAvatar}
                                                aria-label={t('settings.assistant.removeAvatar')}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                {t('settings.assistant.removeAvatar')}
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">{t('settings.assistant.avatarHint')}</p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="assistant-name">{t('settings.assistant.name')}</Label>
                                    <Input
                                        id="assistant-name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="AI 小助手"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="assistant-welcome">{t('settings.assistant.welcome')}</Label>
                                    <Textarea
                                        id="assistant-welcome"
                                        value={welcome}
                                        onChange={(e) => setWelcome(e.target.value)}
                                        placeholder="你好！我是 AI 小助手…"
                                        className="min-h-[60px]"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="assistant-prompt" className="flex items-center gap-1.5">
                                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                                        {t('settings.assistant.systemPrompt')}
                                    </Label>
                                    <Textarea
                                        id="assistant-prompt"
                                        value={systemPrompt}
                                        onChange={(e) => setSystemPrompt(e.target.value)}
                                        placeholder={t('settings.assistant.systemPromptPlaceholder')}
                                        className="min-h-[100px]"
                                    />
                                    {mode === 'fastgpt' && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400">{t('settings.assistant.promptFastgptHint')}</p>
                                    )}
                                </div>

                                <div className="space-y-1.5 border-t border-border/40 pt-5">
                                    <Label className="flex items-center gap-1.5">
                                        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                                        {t('settings.assistant.mode')}
                                    </Label>
                                    <Select value={mode} onValueChange={(value) => setMode(value as 'standard' | 'fastgpt')}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="standard">{t('settings.assistant.modeStandard')}</SelectItem>
                                            <SelectItem value="fastgpt">{t('settings.assistant.modeFastgpt')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        {mode === 'fastgpt'
                                            ? t('settings.assistant.modeFastgptHint')
                                            : t('settings.assistant.modeStandardHint')}
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="assistant-api-url">{t('settings.assistant.apiUrl')}</Label>
                                    <Input
                                        id="assistant-api-url"
                                        value={apiUrl}
                                        onChange={(e) => setApiUrl(e.target.value)}
                                        placeholder={mode === 'fastgpt' ? 'https://your-fastgpt.com/api/v1' : 'https://api.openai.com/v1'}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {mode === 'fastgpt'
                                            ? t('settings.assistant.apiUrlFastgptHint')
                                            : t('settings.assistant.apiUrlStandardHint')}
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="assistant-api-key" className="flex items-center gap-1.5">
                                        <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                                        {t('settings.assistant.apiKey')}
                                    </Label>
                                    <Input
                                        id="assistant-api-key"
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder={
                                            assistant_api_key_masked
                                                ? t('settings.assistant.apiKeyPlaceholderConfigured', { masked: assistant_api_key_masked })
                                                : t('settings.assistant.apiKeyPlaceholder')
                                        }
                                        autoComplete="new-password"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="assistant-model" className="flex items-center gap-1.5">
                                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                                        {t('settings.assistant.model')}
                                    </Label>
                                    <Input
                                        id="assistant-model"
                                        value={model}
                                        onChange={(e) => setModel(e.target.value)}
                                        placeholder={mode === 'fastgpt' ? t('settings.assistant.modelFastgptPlaceholder') : 'gpt-4o-mini'}
                                    />
                                    <p className="text-xs text-muted-foreground">{t('settings.assistant.modelHint')}</p>
                                </div>

                                <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-4">
                                    <Badge variant={enabled ? 'default' : 'secondary'}>
                                        {enabled ? t('settings.assistant.enabledBadge') : t('settings.assistant.disabledBadge')}
                                    </Badge>
                                    <Button type="submit" disabled={saving}>
                                        {saving ? t('common.saving') : t('common.save')}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
