import { Head, router } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    ExternalLink,
    Pencil,
    Plus,
    Trash2,
    Wrench,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type ToolData = {
    id: number;
    tool_category_id: number;
    slug: string | null;
    name: string;
    url: string | null;
    description: string | null;
    icon: string;
    sort_order: number;
    is_external: boolean;
};

type ToolCategoryData = {
    id: number;
    name: string;
    sort_order: number;
    tools: ToolData[];
};

interface Props {
    categories: ToolCategoryData[];
}

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

const ICON_OPTIONS = Object.keys(ICON_GLYPHS);

function glyph(icon: string): string {
    return ICON_GLYPHS[icon] ?? '⚙';
}

export default function Tools({ categories }: Props) {
    const { t } = useTranslation();
    const [activeId, setActiveId] = useState<number | null>(
        categories[0]?.id ?? null,
    );
    const [newCategoryName, setNewCategoryName] = useState('');

    // 分组编辑弹窗
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] =
        useState<ToolCategoryData | null>(null);
    const [categoryName, setCategoryName] = useState('');

    // 工具编辑弹窗
    const [toolDialogOpen, setToolDialogOpen] = useState(false);
    const [editingTool, setEditingTool] = useState<ToolData | null>(null);
    const [toolForm, setToolForm] = useState({
        name: '',
        url: '',
        slug: '',
        description: '',
        icon: 'Wrench',
    });

    const active =
        categories.find((category) => category.id === activeId) ??
        categories[0] ??
        null;

    // 新建分组后自动选中它，避免后续"添加工具"落入旧分组
    const lastCreatedRef = useRef<string | null>(null);

    useEffect(() => {
        if (lastCreatedRef.current) {
            const created = categories.find(
                (category) => category.name === lastCreatedRef.current,
            );

            if (created) {
                setActiveId(created.id);
                lastCreatedRef.current = null;
            }
        }
    }, [categories]);

    const openCategoryDialog = (category: ToolCategoryData | null) => {
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
                `/settings/tools/categories/${editingCategory.id}`,
                { name },
                { preserveScroll: true },
            );
        } else {
            router.post(
                '/settings/tools/categories',
                { name },
                { preserveScroll: true },
            );
        }

        setCategoryDialogOpen(false);
    };

    const openToolDialog = (tool: ToolData | null) => {
        setEditingTool(tool);
        setToolForm({
            name: tool?.name ?? '',
            url: tool?.url ?? '',
            slug: tool?.slug ?? '',
            description: tool?.description ?? '',
            icon: tool?.icon ?? 'Wrench',
        });
        setToolDialogOpen(true);
    };

    const submitTool = () => {
        if (!active || !toolForm.name.trim()) {
            return;
        }

        const data = {
            tool_category_id: active.id,
            name: toolForm.name.trim(),
            url: toolForm.url.trim(),
            slug: toolForm.slug.trim(),
            description: toolForm.description.trim(),
            icon: toolForm.icon,
        };

        if (editingTool) {
            router.put(`/settings/tools/items/${editingTool.id}`, data, {
                preserveScroll: true,
            });
        } else {
            router.post('/settings/tools/items', data, {
                preserveScroll: true,
            });
        }

        setToolDialogOpen(false);
    };

    const reorder = (
        type: 'category' | 'tool',
        list: ToolCategoryData[] | ToolData[],
        index: number,
        direction: -1 | 1,
    ) => {
        const target = index + direction;

        if (target < 0 || target >= list.length) {
            return;
        }

        const next = [...list];
        [next[index], next[target]] = [next[target], next[index]];

        router.put(
            '/settings/tools/reorder',
            { type, ids: next.map((item) => item.id) },
            { preserveScroll: true },
        );
    };

    return (
        <>
            <Head title={t('settings.tools.title')} />

            <AdminSettingsShell
                title={t('settings.tools.heading')}
                description={t('settings.tools.description')}
                wide
            >
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
                    {/* 分组管理 */}
                    <div className="apple-card p-4">
                        <h3 className="text-callout flex items-center gap-2 font-medium">
                            <Wrench className="h-4 w-4 text-primary" />
                            {t('settings.tools.categories')}
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
                                            ({category.tools.length})
                                        </span>
                                    </button>
                                    <div className="flex shrink-0 items-center">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                reorder(
                                                    'category',
                                                    categories,
                                                    index,
                                                    -1,
                                                )
                                            }
                                            disabled={index === 0}
                                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                                            aria-label={t(
                                                'settings.tools.moveUp',
                                            )}
                                        >
                                            <ArrowUp className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                reorder(
                                                    'category',
                                                    categories,
                                                    index,
                                                    1,
                                                )
                                            }
                                            disabled={
                                                index === categories.length - 1
                                            }
                                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                                            aria-label={t(
                                                'settings.tools.moveDown',
                                            )}
                                        >
                                            <ArrowDown className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                openCategoryDialog(category)
                                            }
                                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                            aria-label={t(
                                                'settings.tools.editCategory',
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
                                                            'settings.tools.deleteCategoryConfirm',
                                                            {
                                                                name: category.name,
                                                            },
                                                        ),
                                                    )
                                                ) {
                                                    router.delete(
                                                        `/settings/tools/categories/${category.id}`,
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
                                                'settings.tools.deleteCategory',
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
                                    const name = newCategoryName.trim();

                                    lastCreatedRef.current = name;
                                    router.post(
                                        '/settings/tools/categories',
                                        { name },
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
                                    'settings.tools.newCategoryName',
                                )}
                                className="h-9 text-sm"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                aria-label={t('settings.tools.addCategory')}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </form>
                    </div>

                    {/* 工具管理 */}
                    <div className="apple-card p-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-callout font-medium">
                                {active
                                    ? t('settings.tools.categoryTools', {
                                          name: active.name,
                                      })
                                    : t('settings.tools.selectCategory')}
                            </h3>
                            {active && (
                                <Button
                                    type="button"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => openToolDialog(null)}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    {t('settings.tools.addTool')}
                                </Button>
                            )}
                        </div>

                        {active && (
                            <div className="mt-3 space-y-2">
                                {active.tools.length === 0 && (
                                    <p className="py-8 text-center text-sm text-muted-foreground">
                                        {t('settings.tools.noTools')}
                                    </p>
                                )}

                                {active.tools.map((tool, index) => (
                                    <div
                                        key={tool.id}
                                        className="flex items-center gap-3 rounded-xl border border-border/50 px-3 py-2"
                                    >
                                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-bold text-accent-foreground">
                                            {glyph(tool.icon)}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="flex items-center gap-1 truncate text-sm font-medium">
                                                {tool.name}
                                                {tool.is_external && (
                                                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                )}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {tool.is_external
                                                    ? tool.url
                                                    : `/tools/${tool.slug}`}
                                                {tool.description
                                                    ? ` · ${tool.description}`
                                                    : ''}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-0.5">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    reorder(
                                                        'tool',
                                                        active.tools,
                                                        index,
                                                        -1,
                                                    )
                                                }
                                                disabled={index === 0}
                                                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                                                aria-label={t(
                                                    'settings.tools.moveUp',
                                                )}
                                            >
                                                <ArrowUp className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    reorder(
                                                        'tool',
                                                        active.tools,
                                                        index,
                                                        1,
                                                    )
                                                }
                                                disabled={
                                                    index ===
                                                    active.tools.length - 1
                                                }
                                                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                                                aria-label={t(
                                                    'settings.tools.moveDown',
                                                )}
                                            >
                                                <ArrowDown className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openToolDialog(tool)
                                                }
                                                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                aria-label={t(
                                                    'settings.tools.editTool',
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
                                                                'settings.tools.deleteToolConfirm',
                                                                {
                                                                    name: tool.name,
                                                                },
                                                            ),
                                                        )
                                                    ) {
                                                        router.delete(
                                                            `/settings/tools/items/${tool.id}`,
                                                            {
                                                                preserveScroll: true,
                                                            },
                                                        );
                                                    }
                                                }}
                                                className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                                aria-label={t(
                                                    'settings.tools.deleteTool',
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

            {/* 分组编辑弹窗 */}
            <Dialog
                open={categoryDialogOpen}
                onOpenChange={setCategoryDialogOpen}
            >
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>
                            {editingCategory
                                ? t('settings.tools.editCategory')
                                : t('settings.tools.addCategory')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('settings.tools.categoryDialogDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="tool-category-name">
                            {t('settings.tools.name')}
                        </Label>
                        <Input
                            id="tool-category-name"
                            value={categoryName}
                            onChange={(e) => setCategoryName(e.target.value)}
                            placeholder={t('settings.tools.newCategoryName')}
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

            {/* 工具编辑弹窗 */}
            <Dialog open={toolDialogOpen} onOpenChange={setToolDialogOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingTool
                                ? t('settings.tools.editTool')
                                : t('settings.tools.addTool')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('settings.tools.toolDialogDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="tool-name">
                                {t('settings.tools.name')}
                            </Label>
                            <Input
                                id="tool-name"
                                value={toolForm.name}
                                onChange={(e) =>
                                    setToolForm({
                                        ...toolForm,
                                        name: e.target.value,
                                    })
                                }
                                placeholder="JSON 格式化"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="tool-url">
                                {t('settings.tools.url')}
                            </Label>
                            <Input
                                id="tool-url"
                                value={toolForm.url}
                                onChange={(e) =>
                                    setToolForm({
                                        ...toolForm,
                                        url: e.target.value,
                                    })
                                }
                                placeholder="https://"
                            />
                            <p className="text-xs text-muted-foreground">
                                {t('settings.tools.urlHint')}
                            </p>
                        </div>
                        {!toolForm.url.trim() && (
                            <div className="space-y-1.5">
                                <Label htmlFor="tool-slug">
                                    {t('settings.tools.slug')}
                                </Label>
                                <Input
                                    id="tool-slug"
                                    value={toolForm.slug}
                                    onChange={(e) =>
                                        setToolForm({
                                            ...toolForm,
                                            slug: e.target.value,
                                        })
                                    }
                                    placeholder="json-formatter"
                                />
                                <p className="text-xs text-muted-foreground">
                                    {t('settings.tools.slugHint')}
                                </p>
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <Label htmlFor="tool-description">
                                {t('settings.tools.description')}
                            </Label>
                            <Textarea
                                id="tool-description"
                                value={toolForm.description}
                                onChange={(e) =>
                                    setToolForm({
                                        ...toolForm,
                                        description: e.target.value,
                                    })
                                }
                                placeholder={t(
                                    'settings.tools.descriptionPlaceholder',
                                )}
                                className="min-h-[60px]"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>{t('settings.tools.icon')}</Label>
                            <Select
                                value={toolForm.icon}
                                onValueChange={(value) =>
                                    setToolForm({ ...toolForm, icon: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ICON_OPTIONS.map((icon) => (
                                        <SelectItem key={icon} value={icon}>
                                            <span className="flex items-center gap-2">
                                                <span className="w-6 text-center font-bold">
                                                    {glyph(icon)}
                                                </span>
                                                {icon}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setToolDialogOpen(false)}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            onClick={submitTool}
                            disabled={!toolForm.name.trim()}
                        >
                            {t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
