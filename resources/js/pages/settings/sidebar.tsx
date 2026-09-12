import { Head, router } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Image as ImageIcon, Menu as MenuIcon, Plus, Trash2, User } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
    sidebar_blogger_name: string;
    sidebar_blogger_intro: string;
    sidebar_blogger_avatar: { id: number; url: string } | null;
    sidebar_menus: { name: string; url: string }[];
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

export default function SidebarSettings({
    sidebar_blogger_name,
    sidebar_blogger_intro,
    sidebar_blogger_avatar,
    sidebar_menus,
}: Props) {
    const { t } = useTranslation();
    const [name, setName] = useState(sidebar_blogger_name);
    const [intro, setIntro] = useState(sidebar_blogger_intro);
    const [avatar, setAvatar] = useState(sidebar_blogger_avatar);
    const [menus, setMenus] = useState(sidebar_menus);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        router.put(
            '/settings/sidebar',
            {
                sidebar_blogger_name: name,
                sidebar_blogger_intro: intro,
                menus: menus.map((menu) => ({ name: menu.name.trim(), url: menu.url.trim() })),
            },
            { onFinish: () => setSaving(false) },
        );
    };

    const uploadAvatar = (file: File) => {
        const csrf = getCsrfToken();

        if (!csrf) {
            toast.error(t('settings.sidebar.uploadFailed'));

            return;
        }

        setUploading(true);

        const formData = new FormData();
        formData.append('file', file);

        fetch('/settings/sidebar/avatar', {
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
                    toast.error(data?.message ?? t('settings.sidebar.uploadFailed'));

                    return;
                }

                setAvatar({ id: data.id, url: data.url });
                toast.success(t('settings.sidebar.uploadSuccess'));
            })
            .catch(() => toast.error(t('settings.sidebar.uploadFailed')))
            .finally(() => setUploading(false));
    };

    const updateMenu = (index: number, field: 'name' | 'url', value: string) => {
        setMenus((prev) => prev.map((menu, i) => (i === index ? { ...menu, [field]: value } : menu)));
    };

    const moveMenu = (index: number, direction: -1 | 1) => {
        const target = index + direction;

        if (target < 0 || target >= menus.length) {
            return;
        }

        setMenus((prev) => {
            const next = [...prev];
            [next[index], next[target]] = [next[target], next[index]];

            return next;
        });
    };

    return (
        <>
            <Head title={t('settings.sidebar.title')} />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="mx-auto w-full max-w-2xl space-y-6">
                    <Heading
                        variant="small"
                        title={t('settings.sidebar.heading')}
                        description={t('settings.sidebar.description')}
                    />

                    <form onSubmit={submit} className="space-y-6">
                        {/* 博主信息 */}
                        <Card className="overflow-hidden py-0 gap-0">
                            <CardContent className="!p-0">
                                <div className="flex items-center gap-2.5 border-b border-border/40 px-6 py-4">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                                        <User className="h-4 w-4" />
                                    </div>
                                    <span className="text-callout font-medium">{t('settings.sidebar.blogger')}</span>
                                </div>

                                <div className="space-y-5 px-6 py-5">
                                    <div className="space-y-1.5">
                                        <Label className="flex items-center gap-1.5">
                                            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                            {t('settings.sidebar.avatar')}
                                        </Label>
                                        <div className="flex items-center gap-3">
                                            {avatar ? (
                                                <img src={avatar.url} alt={name} className="h-14 w-14 rounded-full object-cover" />
                                            ) : (
                                                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                    <User className="h-5 w-5" />
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
                                                {uploading ? t('common.saving') : t('settings.sidebar.changeAvatar')}
                                            </Button>
                                            {avatar && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        router.delete('/settings/sidebar/avatar', { preserveScroll: true });
                                                        setAvatar(null);
                                                    }}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    {t('settings.sidebar.removeAvatar')}
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="sidebar-name">{t('settings.sidebar.name')}</Label>
                                        <Input
                                            id="sidebar-name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="博主"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="sidebar-intro">{t('settings.sidebar.intro')}</Label>
                                        <Textarea
                                            id="sidebar-intro"
                                            value={intro}
                                            onChange={(e) => setIntro(e.target.value)}
                                            placeholder={t('settings.sidebar.introPlaceholder')}
                                            className="min-h-[60px]"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 自定义菜单 */}
                        <Card className="overflow-hidden py-0 gap-0">
                            <CardContent className="!p-0">
                                <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                                            <MenuIcon className="h-4 w-4" />
                                        </div>
                                        <span className="text-callout font-medium">{t('settings.sidebar.menus')}</span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setMenus((prev) => [...prev, { name: '', url: '' }])}
                                        disabled={menus.length >= 20}
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        {t('settings.sidebar.addMenu')}
                                    </Button>
                                </div>

                                <div className="space-y-3 px-6 py-5">
                                    {menus.length === 0 && (
                                        <p className="py-4 text-center text-xs text-muted-foreground">{t('settings.sidebar.noMenus')}</p>
                                    )}

                                    {menus.map((menu, index) => (
                                        <div key={index} className="flex items-end gap-2">
                                            <div className="w-28 space-y-1">
                                                <Label className="text-[11px] text-muted-foreground">{t('settings.sidebar.menuName')}</Label>
                                                <Input
                                                    value={menu.name}
                                                    onChange={(e) => updateMenu(index, 'name', e.target.value)}
                                                    placeholder="友链"
                                                    className="h-9"
                                                />
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <Label className="text-[11px] text-muted-foreground">{t('settings.sidebar.menuUrl')}</Label>
                                                <Input
                                                    value={menu.url}
                                                    onChange={(e) => updateMenu(index, 'url', e.target.value)}
                                                    placeholder="https:// 或 /blog"
                                                    className="h-9"
                                                />
                                            </div>
                                            <div className="flex items-center gap-0.5 pb-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => moveMenu(index, -1)}
                                                    disabled={index === 0}
                                                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                                                    aria-label={t('settings.sidebar.moveUp')}
                                                >
                                                    <ArrowUp className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => moveMenu(index, 1)}
                                                    disabled={index === menus.length - 1}
                                                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                                                    aria-label={t('settings.sidebar.moveDown')}
                                                >
                                                    <ArrowDown className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setMenus((prev) => prev.filter((_, i) => i !== index))}
                                                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                                    aria-label={t('settings.sidebar.deleteMenu')}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    <p className="text-xs text-muted-foreground">{t('settings.sidebar.menusHint')}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-end">
                            <Button type="submit" disabled={saving}>
                                {saving ? t('common.saving') : t('common.save')}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}
