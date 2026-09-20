import { Head, router } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    FileText,
    Image as ImageIcon,
    LayoutPanelLeft,
    Link as LinkIcon,
    Mail,
    Menu as MenuIcon,
    Plus,
    Trash2,
    Type,
    User,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import AdminSettingsShell from '@/components/admin-settings-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { renderMarkdown } from '@/lib/markdown';

type FooterLink = { name: string; url: string };
type SidebarMenu = { name: string; url: string };

interface Props {
    texts: Record<string, string>;
    sidebar: {
        sidebar_blogger_name: string;
        sidebar_blogger_intro: string;
        sidebar_blogger_avatar: { id: number; url: string } | null;
        sidebar_menus: SidebarMenu[];
    };
    footer: {
        resources: FooterLink[];
        contacts: FooterLink[];
        icp_markdown: string;
    };
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

export default function FrontendDisplay({ texts, sidebar, footer }: Props) {
    const { t } = useTranslation();

    // 首页文案
    const [homeValues, setHomeValues] = useState({
        home_badge: texts.home_badge,
        home_title: texts.home_title,
        home_title_accent: texts.home_title_accent,
        home_description: texts.home_description,
        home_latest_title: texts.home_latest_title,
        home_latest_desc: texts.home_latest_desc,
        home_tools_title: texts.home_tools_title,
        home_tools_desc: texts.home_tools_desc,
        home_nav_title: texts.home_nav_title,
        home_nav_desc: texts.home_nav_desc,
    });
    const [homeSaving, setHomeSaving] = useState(false);

    // 侧边栏
    const [bloggerName, setBloggerName] = useState(
        sidebar.sidebar_blogger_name,
    );
    const [bloggerIntro, setBloggerIntro] = useState(
        sidebar.sidebar_blogger_intro,
    );
    const [bloggerAvatar, setBloggerAvatar] = useState(
        sidebar.sidebar_blogger_avatar,
    );
    const [menus, setMenus] = useState(sidebar.sidebar_menus);
    const [sidebarSaving, setSidebarSaving] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    // 页脚
    const [resourceList, setResourceList] = useState(footer.resources);
    const [contactList, setContactList] = useState(footer.contacts);
    const [icpMarkdown, setIcpMarkdown] = useState(footer.icp_markdown);
    const [icpMode, setIcpMode] = useState<'edit' | 'preview'>('edit');
    const [footerSaving, setFooterSaving] = useState(false);

    const submitHome = (e: React.FormEvent) => {
        e.preventDefault();
        setHomeSaving(true);
        router.put('/admin/settings/home', homeValues, {
            onFinish: () => setHomeSaving(false),
        });
    };

    const submitSidebar = (e: React.FormEvent) => {
        e.preventDefault();
        setSidebarSaving(true);

        router.put(
            '/admin/settings/sidebar',
            {
                sidebar_blogger_name: bloggerName,
                sidebar_blogger_intro: bloggerIntro,
                menus: menus.map((menu) => ({
                    name: menu.name.trim(),
                    url: menu.url.trim(),
                })),
            },
            { onFinish: () => setSidebarSaving(false) },
        );
    };

    const submitFooter = (e: React.FormEvent) => {
        e.preventDefault();
        setFooterSaving(true);

        router.put(
            '/admin/settings/footer',
            {
                resources: resourceList.map((item) => ({
                    name: item.name.trim(),
                    url: item.url.trim(),
                })),
                contacts: contactList.map((item) => ({
                    name: item.name.trim(),
                    url: item.url.trim(),
                })),
                icp_markdown: icpMarkdown,
            },
            { onFinish: () => setFooterSaving(false) },
        );
    };

    const uploadAvatar = (file: File) => {
        const csrf = getCsrfToken();

        if (!csrf) {
            toast.error(t('settings.sidebar.uploadFailed'));

            return;
        }

        setAvatarUploading(true);

        const formData = new FormData();
        formData.append('file', file);

        fetch('/admin/settings/sidebar/avatar', {
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
                        data?.message ?? t('settings.sidebar.uploadFailed'),
                    );

                    return;
                }

                setBloggerAvatar({ id: data.id, url: data.url });
                toast.success(t('settings.sidebar.uploadSuccess'));
            })
            .catch(() => toast.error(t('settings.sidebar.uploadFailed')))
            .finally(() => setAvatarUploading(false));
    };

    const removeAvatar = () => {
        router.delete('/admin/settings/sidebar/avatar', { preserveScroll: true });
        setBloggerAvatar(null);
    };

    const moveItem = (
        setter: React.Dispatch<
            React.SetStateAction<FooterLink[] | SidebarMenu[]>
        >,
        index: number,
        direction: -1 | 1,
    ) => {
        setter((prev) => {
            const target = index + direction;

            if (target < 0 || target >= prev.length) {
                return prev;
            }

            const next = [...prev];
            [next[index], next[target]] = [next[target], next[index]];

            return next;
        });
    };

    const linkRow = (
        list: FooterLink[],
        setter: React.Dispatch<React.SetStateAction<FooterLink[]>>,
        index: number,
        urlPlaceholder: string,
        nameWidth = 'w-32',
    ) => (
        <div key={index} className="flex items-end gap-2">
            <div className={`${nameWidth} space-y-1`}>
                <Label className="text-[11px] text-muted-foreground">
                    {t('settings.footer.name')}
                </Label>
                <Input
                    value={list[index].name}
                    onChange={(e) =>
                        setter((prev) =>
                            prev.map((item, i) =>
                                i === index
                                    ? { ...item, name: e.target.value }
                                    : item,
                            ),
                        )
                    }
                    className="h-9"
                />
            </div>
            <div className="flex-1 space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                    {t('settings.footer.url')}
                </Label>
                <Input
                    value={list[index].url}
                    onChange={(e) =>
                        setter((prev) =>
                            prev.map((item, i) =>
                                i === index
                                    ? { ...item, url: e.target.value }
                                    : item,
                            ),
                        )
                    }
                    placeholder={urlPlaceholder}
                    className="h-9"
                />
            </div>
            <div className="flex items-center gap-0.5 pb-0.5">
                <button
                    type="button"
                    onClick={() => moveItem(setter, index, -1)}
                    disabled={index === 0}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                    aria-label={t('settings.footer.moveUp')}
                >
                    <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={() => moveItem(setter, index, 1)}
                    disabled={index === list.length - 1}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                    aria-label={t('settings.footer.moveDown')}
                >
                    <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={() =>
                        setter((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t('settings.footer.delete')}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );

    const cardHeader = (
        icon: React.ReactNode,
        title: string,
        badge?: React.ReactNode,
    ) => (
        <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
            <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    {icon}
                </div>
                <span className="text-callout font-medium">{title}</span>
            </div>
            {badge}
        </div>
    );

    const saveButton = (saving: boolean) => (
        <div className="flex items-center justify-end gap-3 border-t border-border/40 pt-4">
            <Button type="submit" disabled={saving}>
                {saving ? t('common.saving') : t('common.save')}
            </Button>
        </div>
    );

    return (
        <>
            <Head title={t('settings.home.title')} />

            <AdminSettingsShell
                title={t('settings.home.heading')}
                description={t('settings.home.description')}
                wide
            >
                <div className="space-y-6">
                    {/* 首页文案 */}
                    <form onSubmit={submitHome}>
                        <Card className="gap-0 overflow-hidden py-0">
                            {cardHeader(
                                <Type className="h-4 w-4" />,
                                t('settings.home.heading'),
                            )}
                            <CardContent className="space-y-4 px-6 py-5">
                                <div className="space-y-1.5">
                                    <Label htmlFor="home_badge">
                                        {t('settings.home.badge')}
                                    </Label>
                                    <Input
                                        id="home_badge"
                                        value={homeValues.home_badge}
                                        onChange={(e) =>
                                            setHomeValues({
                                                ...homeValues,
                                                home_badge: e.target.value,
                                            })
                                        }
                                        placeholder="博客 · 工具 · 导航 一站式"
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="home_title">
                                        {t('settings.home.mainTitle')}
                                    </Label>
                                    <Input
                                        id="home_title"
                                        value={homeValues.home_title}
                                        onChange={(e) =>
                                            setHomeValues({
                                                ...homeValues,
                                                home_title: e.target.value,
                                            })
                                        }
                                        placeholder="探索、创造与分享"
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="home_title_accent">
                                        {t('settings.home.accentTitle')}
                                    </Label>
                                    <Input
                                        id="home_title_accent"
                                        value={homeValues.home_title_accent}
                                        onChange={(e) =>
                                            setHomeValues({
                                                ...homeValues,
                                                home_title_accent:
                                                    e.target.value,
                                            })
                                        }
                                        placeholder="技术的无限可能"
                                        className="h-9"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t('settings.home.accentHint')}
                                    </p>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="home_description">
                                        {t('settings.home.desc')}
                                    </Label>
                                    <Textarea
                                        id="home_description"
                                        value={homeValues.home_description}
                                        onChange={(e) =>
                                            setHomeValues({
                                                ...homeValues,
                                                home_description:
                                                    e.target.value,
                                            })
                                        }
                                        className="min-h-[70px]"
                                    />
                                </div>
                                <div className="space-y-4 border-t border-border/40 pt-4">
                                    <p className="text-sm font-medium">
                                        {t('settings.home.sections')}
                                    </p>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] text-muted-foreground">
                                                {t(
                                                    'settings.home.latestSection',
                                                )}
                                            </Label>
                                            <Input
                                                value={
                                                    homeValues.home_latest_title
                                                }
                                                onChange={(e) =>
                                                    setHomeValues({
                                                        ...homeValues,
                                                        home_latest_title:
                                                            e.target.value,
                                                    })
                                                }
                                                className="h-9"
                                            />
                                            <Input
                                                value={
                                                    homeValues.home_latest_desc
                                                }
                                                onChange={(e) =>
                                                    setHomeValues({
                                                        ...homeValues,
                                                        home_latest_desc:
                                                            e.target.value,
                                                    })
                                                }
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] text-muted-foreground">
                                                {t(
                                                    'settings.home.toolsSection',
                                                )}
                                            </Label>
                                            <Input
                                                value={
                                                    homeValues.home_tools_title
                                                }
                                                onChange={(e) =>
                                                    setHomeValues({
                                                        ...homeValues,
                                                        home_tools_title:
                                                            e.target.value,
                                                    })
                                                }
                                                className="h-9"
                                            />
                                            <Input
                                                value={
                                                    homeValues.home_tools_desc
                                                }
                                                onChange={(e) =>
                                                    setHomeValues({
                                                        ...homeValues,
                                                        home_tools_desc:
                                                            e.target.value,
                                                    })
                                                }
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] text-muted-foreground">
                                                {t('settings.home.navSection')}
                                            </Label>
                                            <Input
                                                value={
                                                    homeValues.home_nav_title
                                                }
                                                onChange={(e) =>
                                                    setHomeValues({
                                                        ...homeValues,
                                                        home_nav_title:
                                                            e.target.value,
                                                    })
                                                }
                                                className="h-9"
                                            />
                                            <Input
                                                value={homeValues.home_nav_desc}
                                                onChange={(e) =>
                                                    setHomeValues({
                                                        ...homeValues,
                                                        home_nav_desc:
                                                            e.target.value,
                                                    })
                                                }
                                                className="h-9"
                                            />
                                        </div>
                                    </div>
                                </div>
                                {saveButton(homeSaving)}
                            </CardContent>
                        </Card>
                    </form>

                    {/* 侧边栏 */}
                    <form onSubmit={submitSidebar}>
                        <Card className="gap-0 overflow-hidden py-0">
                            {cardHeader(
                                <LayoutPanelLeft className="h-4 w-4" />,
                                t('settings.sidebar.heading'),
                            )}
                            <CardContent className="space-y-5 px-6 py-5">
                                <div className="space-y-1.5">
                                    <Label className="flex items-center gap-1.5">
                                        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                        {t('settings.sidebar.avatar')}
                                    </Label>
                                    <div className="flex items-center gap-3">
                                        {bloggerAvatar ? (
                                            <img
                                                src={bloggerAvatar.url}
                                                alt={bloggerName}
                                                className="h-14 w-14 rounded-full object-cover"
                                            />
                                        ) : (
                                            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                <User className="h-5 w-5" />
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
                                                      'settings.sidebar.changeAvatar',
                                                  )}
                                        </Button>
                                        {bloggerAvatar && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={removeAvatar}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                {t(
                                                    'settings.sidebar.removeAvatar',
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="sidebar-name">
                                        {t('settings.sidebar.name')}
                                    </Label>
                                    <Input
                                        id="sidebar-name"
                                        value={bloggerName}
                                        onChange={(e) =>
                                            setBloggerName(e.target.value)
                                        }
                                        className="h-9"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="sidebar-intro">
                                        {t('settings.sidebar.intro')}
                                    </Label>
                                    <Textarea
                                        id="sidebar-intro"
                                        value={bloggerIntro}
                                        onChange={(e) =>
                                            setBloggerIntro(e.target.value)
                                        }
                                        className="min-h-[60px]"
                                    />
                                </div>

                                <div className="space-y-3 border-t border-border/40 pt-4">
                                    <div className="flex items-center justify-between">
                                        <p className="flex items-center gap-1.5 text-sm font-medium">
                                            <MenuIcon className="h-3.5 w-3.5 text-primary" />
                                            {t('settings.sidebar.menus')}
                                        </p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setMenus((prev) => [
                                                    ...prev,
                                                    { name: '', url: '' },
                                                ])
                                            }
                                            disabled={menus.length >= 20}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            {t('settings.sidebar.addMenu')}
                                        </Button>
                                    </div>

                                    {menus.length === 0 && (
                                        <p className="py-3 text-center text-xs text-muted-foreground">
                                            {t('settings.sidebar.noMenus')}
                                        </p>
                                    )}

                                    {menus.map((menu, index) =>
                                        linkRow(
                                            menus,
                                            setMenus,
                                            index,
                                            'https:// 或 /tools',
                                            'w-28',
                                        ),
                                    )}

                                    <p className="text-xs text-muted-foreground">
                                        {t('settings.sidebar.menusHint')}
                                    </p>
                                </div>

                                {saveButton(sidebarSaving)}
                            </CardContent>
                        </Card>
                    </form>

                    {/* 页脚 */}
                    <form onSubmit={submitFooter}>
                        <Card className="gap-0 overflow-hidden py-0">
                            {cardHeader(
                                <LinkIcon className="h-4 w-4" />,
                                t('settings.footer.heading'),
                            )}
                            <CardContent className="space-y-6 px-6 py-5">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="flex items-center gap-1.5 text-sm font-medium">
                                            <LinkIcon className="h-3.5 w-3.5 text-primary" />
                                            {t('settings.footer.resources')}
                                        </p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setResourceList((prev) => [
                                                    ...prev,
                                                    { name: '', url: '' },
                                                ])
                                            }
                                            disabled={resourceList.length >= 20}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            {t('settings.footer.add')}
                                        </Button>
                                    </div>

                                    {resourceList.length === 0 && (
                                        <p className="py-2 text-center text-xs text-muted-foreground">
                                            {t('settings.footer.empty')}
                                        </p>
                                    )}

                                    {resourceList.map((item, index) =>
                                        linkRow(
                                            resourceList,
                                            setResourceList,
                                            index,
                                            'https://',
                                        ),
                                    )}
                                </div>

                                <div className="space-y-3 border-t border-border/40 pt-4">
                                    <div className="flex items-center justify-between">
                                        <p className="flex items-center gap-1.5 text-sm font-medium">
                                            <Mail className="h-3.5 w-3.5 text-primary" />
                                            {t('settings.footer.contacts')}
                                        </p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setContactList((prev) => [
                                                    ...prev,
                                                    { name: '', url: '' },
                                                ])
                                            }
                                            disabled={contactList.length >= 20}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            {t('settings.footer.add')}
                                        </Button>
                                    </div>

                                    {contactList.length === 0 && (
                                        <p className="py-2 text-center text-xs text-muted-foreground">
                                            {t('settings.footer.empty')}
                                        </p>
                                    )}

                                    {contactList.map((item, index) =>
                                        linkRow(
                                            contactList,
                                            setContactList,
                                            index,
                                            'https:// 或 mailto:',
                                        ),
                                    )}
                                </div>

                                <div className="space-y-3 border-t border-border/40 pt-4">
                                    <div className="flex items-center justify-between">
                                        <p className="flex items-center gap-1.5 text-sm font-medium">
                                            <FileText className="h-3.5 w-3.5 text-primary" />
                                            {t('settings.footer.icp')}
                                        </p>
                                        <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setIcpMode('edit')
                                                }
                                                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${icpMode === 'edit' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                            >
                                                {t('settings.footer.modeEdit')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setIcpMode('preview')
                                                }
                                                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${icpMode === 'preview' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                            >
                                                {t(
                                                    'settings.footer.modePreview',
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <p className="text-xs text-muted-foreground">
                                        {t('settings.footer.icpHint')}
                                    </p>

                                    {icpMode === 'edit' ? (
                                        <Textarea
                                            value={icpMarkdown}
                                            onChange={(e) =>
                                                setIcpMarkdown(e.target.value)
                                            }
                                            placeholder={t(
                                                'settings.footer.icpPlaceholder',
                                            )}
                                            className="min-h-[90px] font-mono leading-relaxed"
                                        />
                                    ) : (
                                        <div className="min-h-[90px] rounded-lg border border-border/40 bg-muted/20 px-4 py-3 text-sm leading-relaxed">
                                            {icpMarkdown.trim() ? (
                                                <div
                                                    className="[&_a]:text-primary [&_a]:underline"
                                                    dangerouslySetInnerHTML={{
                                                        __html: renderMarkdown(
                                                            icpMarkdown,
                                                        ),
                                                    }}
                                                />
                                            ) : (
                                                <p className="text-muted-foreground">
                                                    {t(
                                                        'settings.footer.icpPlaceholder',
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {saveButton(footerSaving)}
                            </CardContent>
                        </Card>
                    </form>
                </div>
            </AdminSettingsShell>
        </>
    );
}
