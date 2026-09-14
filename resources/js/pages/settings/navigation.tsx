import { Head, router } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    BookOpen,
    Globe,
    Pencil,
    Plus,
    Trash2,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import AdminSettingsShell from '@/components/admin-settings-shell';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type NavLinkData = {
    id: number;
    nav_category_id: number;
    name: string;
    url: string;
    color: string;
    description: string | null;
    icon_url: string | null;
    has_intro: boolean;
};

const ICON_GLYPHS: Record<string, string> = {
    Braces: '{}',
    CodeXml: '</>',
    Database: 'DB',
    Hash: '#',
    Binary: '01',
    Link: '∿',
    Type: 'T',
    Regex: '.*',
    GitCompare: '⇔',
    CaseSensitive: 'Aa',
    Ruler: '📏',
    Clock: '⏱',
    Wrench: '🔧',
    Calculator: '🧮',
    Globe: '🌐',
    Terminal: '⌨',
};

function glyph(icon: string): string {
    return ICON_GLYPHS[icon] ?? '⚙';
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

type NavCategoryData = {
    id: number;
    name: string;
    sort_order: number;
    links: NavLinkData[];
};

interface Props {
    categories: NavCategoryData[];
}

const DEFAULT_COLOR = '#6b7280';

export default function Navigation({ categories }: Props) {
    const { t } = useTranslation();
    const [activeId, setActiveId] = useState<number | null>(
        categories[0]?.id ?? null,
    );
    const [newCategoryName, setNewCategoryName] = useState('');

    // 分类编辑弹窗
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] =
        useState<NavCategoryData | null>(null);
    const [categoryName, setCategoryName] = useState('');

    // 链接编辑弹窗
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [editingLink, setEditingLink] = useState<NavLinkData | null>(null);
    const [linkForm, setLinkForm] = useState({
        name: '',
        url: '',
        color: DEFAULT_COLOR,
        description: '',
    });

    const active =
        categories.find((category) => category.id === activeId) ??
        categories[0] ??
        null;
    const iconInputRef = useRef<HTMLInputElement>(null);
    const [iconUploading, setIconUploading] = useState(false);

    const uploadIcon = (linkId: number, file: File) => {
        const csrf = getCsrfToken();

        if (!csrf) {
            return;
        }

        setIconUploading(true);

        const formData = new FormData();
        formData.append('file', file);

        fetch(`/settings/navigation/links/${linkId}/icon`, {
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
                        data?.message ??
                            t('settings.navigation.iconUploadFailed'),
                    );

                    return;
                }

                toast.success(t('settings.navigation.iconUploadSuccess'));
                setLinkDialogOpen(false);
                router.reload({ only: ['categories'] });
            })
            .catch(() => toast.error(t('settings.navigation.iconUploadFailed')))
            .finally(() => setIconUploading(false));
    };

    const resetIcon = (linkId: number) => {
        const csrf = getCsrfToken();

        if (!csrf) {
            return;
        }

        fetch(`/settings/navigation/links/${linkId}/icon`, {
            method: 'DELETE',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                [csrf.headerName]: csrf.value,
            },
        })
            .then(async (response) => {
                if (!response.ok) {
                    toast.error(t('settings.navigation.iconResetFailed'));

                    return;
                }

                toast.success(t('settings.navigation.iconResetSuccess'));
                setLinkDialogOpen(false);
                router.reload({ only: ['categories'] });
            })
            .catch(() => toast.error(t('settings.navigation.iconResetFailed')));
    };

    const openCategoryDialog = (category: NavCategoryData | null) => {
        setEditingCategory(category);
        setCategoryName(category?.name ?? '');
        setCategoryDialogOpen(true);
    };

    const submitCategory = () => {
        const name = categoryName.trim();

        if (!name) {
            return;
        }

        if (editingCategory) {
            router.put(
                `/settings/navigation/categories/${editingCategory.id}`,
                { name },
                { preserveScroll: true },
            );
        } else {
            router.post(
                '/settings/navigation/categories',
                { name },
                { preserveScroll: true },
            );
        }

        setCategoryDialogOpen(false);
    };

    const submitLink = () => {
        if (!active || !linkForm.name.trim() || !linkForm.url.trim()) {
            return;
        }

        const data = {
            nav_category_id: active.id,
            name: linkForm.name.trim(),
            url: linkForm.url.trim(),
            color: linkForm.color,
            description: linkForm.description.trim(),
        };

        if (editingLink) {
            router.put(`/settings/navigation/links/${editingLink.id}`, data, {
                preserveScroll: true,
            });
        } else {
            router.post('/settings/navigation/links', data, {
                preserveScroll: true,
            });
        }

        setLinkDialogOpen(false);
    };

    const openLinkDialog = (link: NavLinkData | null) => {
        setEditingLink(link);
        setLinkForm({
            name: link?.name ?? '',
            url: link?.url ?? '',
            color: link?.color || DEFAULT_COLOR,
            description: link?.description ?? '',
        });
        setLinkDialogOpen(true);
    };

    const move = (
        type: 'category' | 'link',
        list: NavCategoryData[] | NavLinkData[],
        index: number,
    ) => {
        if (index <= 0 || index >= list.length) {
            return;
        }

        const next = [...list];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];

        router.put(
            '/settings/navigation/reorder',
            { type, ids: next.map((item) => item.id) },
            { preserveScroll: true },
        );
    };

    return (
        <>
            <Head title={t('settings.navigation.title')} />

            <AdminSettingsShell
                title={t('settings.navigation.heading')}
                description={t('settings.navigation.description')}
                wide
            >
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
                    {/* 分类（大类）管理 */}
                    <div className="apple-card p-4">
                        <h3 className="text-callout flex items-center gap-2 font-medium">
                            <Globe className="h-4 w-4 text-primary" />
                            {t('settings.navigation.categories')}
                        </h3>
                        <div className="mt-3 space-y-1.5">
                            {categories.map((category, index) => (
                                <div
                                    key={category.id}
                                    className={cn(
                                        'apple-press flex items-center justify-between rounded-xl px-3 py-2',
                                        active?.id === category.id
                                            ? 'bg-primary/10 text-primary'
                                            : 'hover:bg-muted',
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setActiveId(category.id)}
                                        className="min-w-0 flex-1 text-left text-sm"
                                    >
                                        {category.name}
                                        <span className="ml-1.5 text-xs text-muted-foreground">
                                            ({category.links.length})
                                        </span>
                                    </button>
                                    <div className="flex shrink-0 items-center">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                move(
                                                    'category',
                                                    categories,
                                                    index,
                                                )
                                            }
                                            disabled={index === 0}
                                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                                            aria-label={t(
                                                'settings.navigation.moveUp',
                                            )}
                                        >
                                            <ArrowUp className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                openCategoryDialog(category)
                                            }
                                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                            aria-label={t(
                                                'settings.navigation.editCategory',
                                            )}
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (
                                                    window.confirm(
                                                        t(
                                                            'settings.navigation.deleteCategoryConfirm',
                                                            {
                                                                name: category.name,
                                                            },
                                                        ),
                                                    )
                                                ) {
                                                    router.delete(
                                                        `/settings/navigation/categories/${category.id}`,
                                                        {
                                                            preserveScroll: true,
                                                            onSuccess: () =>
                                                                setActiveId(
                                                                    null,
                                                                ),
                                                        },
                                                    );
                                                }
                                            }}
                                            className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                            aria-label={t(
                                                'settings.navigation.deleteCategory',
                                            )}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();

                                if (newCategoryName.trim()) {
                                    router.post(
                                        '/settings/navigation/categories',
                                        { name: newCategoryName.trim() },
                                        {
                                            preserveScroll: true,
                                            onSuccess: () =>
                                                setNewCategoryName(''),
                                        },
                                    );
                                }
                            }}
                            className="mt-4 flex gap-2 border-t border-border/40 pt-4"
                        >
                            <Input
                                value={newCategoryName}
                                onChange={(e) =>
                                    setNewCategoryName(e.target.value)
                                }
                                placeholder={t(
                                    'settings.navigation.newCategoryName',
                                )}
                                className="h-9 text-sm"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                aria-label={t(
                                    'settings.navigation.addCategory',
                                )}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </form>
                    </div>

                    {/* 链接管理 */}
                    <div className="apple-card p-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-callout font-medium">
                                {active
                                    ? t('settings.navigation.categoryLinks', {
                                          name: active.name,
                                      })
                                    : t('settings.navigation.selectCategory')}
                            </h3>
                            {active && (
                                <Button
                                    type="button"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => openLinkDialog(null)}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    {t('settings.navigation.addLink')}
                                </Button>
                            )}
                        </div>

                        {active && (
                            <div className="mt-3 space-y-2">
                                {active.links.length === 0 && (
                                    <p className="py-8 text-center text-sm text-muted-foreground">
                                        {t('settings.navigation.noLinks')}
                                    </p>
                                )}

                                {active.links.map((link, index) => (
                                    <div
                                        key={link.id}
                                        className="flex items-center gap-3 rounded-xl border border-border/50 px-3 py-2"
                                    >
                                        <span
                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                                            style={{
                                                backgroundColor:
                                                    link.color || DEFAULT_COLOR,
                                            }}
                                        >
                                            {link.name.charAt(0)}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">
                                                {link.name}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {link.url}
                                                {link.description
                                                    ? ` · ${link.description}`
                                                    : ''}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-0.5">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 gap-1 text-xs"
                                                onClick={() =>
                                                    router.visit(
                                                        `/settings/navigation/links/${link.id}/intro`,
                                                    )
                                                }
                                            >
                                                <BookOpen className="h-3.5 w-3.5" />
                                                {link.has_intro
                                                    ? t(
                                                          'settings.navigation.editIntro',
                                                      )
                                                    : t(
                                                          'settings.navigation.addIntro',
                                                      )}
                                            </Button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    move(
                                                        'link',
                                                        active.links,
                                                        index,
                                                    )
                                                }
                                                disabled={index === 0}
                                                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                                                aria-label={t(
                                                    'settings.navigation.moveUp',
                                                )}
                                            >
                                                <ArrowUp className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const next = [
                                                        ...active.links,
                                                    ];
                                                    [
                                                        next[index],
                                                        next[index + 1],
                                                    ] = [
                                                        next[index + 1],
                                                        next[index],
                                                    ];
                                                    router.put(
                                                        '/settings/navigation/reorder',
                                                        {
                                                            type: 'link',
                                                            ids: next.map(
                                                                (item) =>
                                                                    item.id,
                                                            ),
                                                        },
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    );
                                                }}
                                                disabled={
                                                    index ===
                                                    active.links.length - 1
                                                }
                                                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                                                aria-label={t(
                                                    'settings.navigation.moveDown',
                                                )}
                                            >
                                                <ArrowDown className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openLinkDialog(link)
                                                }
                                                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                aria-label={t(
                                                    'settings.navigation.editLink',
                                                )}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (
                                                        window.confirm(
                                                            t(
                                                                'settings.navigation.deleteLinkConfirm',
                                                                {
                                                                    name: link.name,
                                                                },
                                                            ),
                                                        )
                                                    ) {
                                                        router.delete(
                                                            `/settings/navigation/links/${link.id}`,
                                                            {
                                                                preserveScroll: true,
                                                            },
                                                        );
                                                    }
                                                }}
                                                className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                                aria-label={t(
                                                    'settings.navigation.deleteLink',
                                                )}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </AdminSettingsShell>

            {/* 分类编辑弹窗 */}
            <Dialog
                open={categoryDialogOpen}
                onOpenChange={setCategoryDialogOpen}
            >
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>
                            {editingCategory
                                ? t('settings.navigation.editCategory')
                                : t('settings.navigation.addCategory')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('settings.navigation.categoryDialogDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="category-name">
                            {t('settings.navigation.name')}
                        </Label>
                        <Input
                            id="category-name"
                            value={categoryName}
                            onChange={(e) => setCategoryName(e.target.value)}
                            placeholder={t(
                                'settings.navigation.newCategoryName',
                            )}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    submitCategory();
                                }
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setCategoryDialogOpen(false)}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            onClick={submitCategory}
                            disabled={!categoryName.trim()}
                        >
                            {t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 链接编辑弹窗 */}
            <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingLink
                                ? t('settings.navigation.editLink')
                                : t('settings.navigation.addLink')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('settings.navigation.linkDialogDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        {editingLink && (
                            <div className="space-y-1.5">
                                <Label>{t('settings.navigation.icon')}</Label>
                                <div className="flex items-center gap-3">
                                    {editingLink.icon_url ? (
                                        <img
                                            src={editingLink.icon_url}
                                            alt={editingLink.name}
                                            className="h-10 w-10 rounded-xl object-cover"
                                        />
                                    ) : (
                                        <span
                                            className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
                                            style={{
                                                backgroundColor:
                                                    linkForm.color || '#6b7280',
                                            }}
                                        >
                                            {glyph('Wrench')}
                                        </span>
                                    )}
                                    <input
                                        ref={iconInputRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/gif,image/webp"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];

                                            if (file && editingLink) {
                                                uploadIcon(
                                                    editingLink.id,
                                                    file,
                                                );
                                                e.target.value = '';
                                            }
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={iconUploading}
                                        onClick={() =>
                                            iconInputRef.current?.click()
                                        }
                                    >
                                        {iconUploading
                                            ? t('common.saving')
                                            : t(
                                                  'settings.navigation.uploadIcon',
                                              )}
                                    </Button>
                                    {editingLink.icon_url && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                resetIcon(editingLink.id)
                                            }
                                        >
                                            {t('settings.navigation.resetIcon')}
                                        </Button>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {t('settings.navigation.iconHint')}
                                </p>
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <Label htmlFor="link-name">
                                {t('settings.navigation.name')}
                            </Label>
                            <Input
                                id="link-name"
                                value={linkForm.name}
                                onChange={(e) =>
                                    setLinkForm({
                                        ...linkForm,
                                        name: e.target.value,
                                    })
                                }
                                placeholder="ChatGPT"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="link-url">
                                {t('settings.navigation.url')}
                            </Label>
                            <Input
                                id="link-url"
                                value={linkForm.url}
                                onChange={(e) =>
                                    setLinkForm({
                                        ...linkForm,
                                        url: e.target.value,
                                    })
                                }
                                placeholder="https://"
                            />
                        </div>
                        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="link-description">
                                    {t('settings.navigation.shortDescription')}
                                </Label>
                                <Textarea
                                    id="link-description"
                                    value={linkForm.description}
                                    onChange={(e) =>
                                        setLinkForm({
                                            ...linkForm,
                                            description: e.target.value,
                                        })
                                    }
                                    placeholder={t(
                                        'settings.navigation.shortDescriptionPlaceholder',
                                    )}
                                    className="min-h-[60px]"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="link-color">
                                    {t('settings.navigation.color')}
                                </Label>
                                <input
                                    id="link-color"
                                    type="color"
                                    value={linkForm.color}
                                    onChange={(e) =>
                                        setLinkForm({
                                            ...linkForm,
                                            color: e.target.value,
                                        })
                                    }
                                    className="h-9 w-14 cursor-pointer rounded-md border border-input bg-transparent"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setLinkDialogOpen(false)}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            onClick={submitLink}
                            disabled={
                                !linkForm.name.trim() || !linkForm.url.trim()
                            }
                        >
                            {t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
