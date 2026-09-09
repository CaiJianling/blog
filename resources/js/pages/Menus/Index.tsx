import { Head, router } from '@inertiajs/react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ChevronDown,
    GripVertical,
    Link as LinkIcon,
    FileText,
    FileStack,
    FolderTree,
    Plus,
    Trash2,
    X,
    Save,
} from 'lucide-react';
import * as menuActions from '@/actions/App/Http/Controllers/MenuController';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ItemType = 'page' | 'article' | 'category' | 'custom';

interface MenuItemNode {
    clientId: string;
    parentClientId: string | null;
    type: ItemType;
    object_id: number;
    label: string;
    url: string;
    css_class: string;
    target: string;
    object_label: string;
}

interface CandidateItem {
    id: number;
    title: string;
}

interface MenuSummary {
    id: number;
    name: string;
    slug: string;
}

interface SelectedMenu extends MenuSummary {
    auto_add_pages: boolean;
}

interface ServerItem {
    id: number;
    parent_id: number;
    type: ItemType;
    object_id: number;
    label: string;
    url: string;
    css_class: string;
    target: string;
    object_label: string;
    display_label: string;
}

interface Props {
    menus: MenuSummary[];
    selectedMenu: SelectedMenu | null;
    items: ServerItem[];
    candidates: {
        pages: CandidateItem[];
        articles: CandidateItem[];
        categories: CandidateItem[];
    };
}

type DropPosition = 'before' | 'child' | 'after';

let clientIdSeq = 0;
const nextClientId = () => `new-${++clientIdSeq}-${Date.now()}`;

/** 将服务端扁平项构建为 DFS 顺序的前端节点 */
function buildInitialNodes(serverItems: ServerItem[]): MenuItemNode[] {
    const idToClient = new Map<number, string>();
    serverItems.forEach((item) => {
        idToClient.set(item.id, `srv-${item.id}`);
    });

    const nodes: MenuItemNode[] = serverItems.map((item) => ({
        clientId: idToClient.get(item.id)!,
        parentClientId: item.parent_id ? idToClient.get(item.parent_id) ?? null : null,
        type: item.type,
        object_id: item.object_id,
        label: item.label,
        url: item.url,
        css_class: item.css_class,
        target: item.target,
        object_label: item.object_label,
    }));

    // 服务端按全局 sort_order 返回，分组后兄弟顺序天然正确，DFS 展开即可
    const childrenMap = new Map<string | null, MenuItemNode[]>();
    nodes.forEach((node) => {
        const key = node.parentClientId;
        if (!childrenMap.has(key)) {
            childrenMap.set(key, []);
        }
        childrenMap.get(key)!.push(node);
    });

    const dfs: MenuItemNode[] = [];
    const walk = (parent: string | null) => {
        const children = childrenMap.get(parent) ?? [];
        children.forEach((child) => {
            dfs.push(child);
            walk(child.clientId);
        });
    };
    walk(null);

    return dfs;
}

export default function MenusIndex({ menus, selectedMenu, items, candidates }: Props) {
    const { t } = useTranslation();

    const [nodes, setNodes] = useState<MenuItemNode[]>(() => buildInitialNodes(items));
    const [menuName, setMenuName] = useState(selectedMenu?.name ?? '');
    const [autoAddPages, setAutoAddPages] = useState(selectedMenu?.auto_add_pages ?? false);
    const [createOpen, setCreateOpen] = useState(false);
    const [newMenuName, setNewMenuName] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);

    // 拖拽状态
    const [dragId, setDragId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<{ id: string; pos: DropPosition } | null>(null);

    // 添加面板
    const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({
        page: true,
        article: false,
        custom: false,
        category: false,
    });
    const [checked, setChecked] = useState<Record<string, Set<number>>>({
        page: new Set(),
        article: new Set(),
        category: new Set(),
    });
    const [customUrl, setCustomUrl] = useState('');
    const [customLabel, setCustomLabel] = useState('');

    const dragCounter = useRef(0);

    const childrenMap = useMemo(() => {
        const map = new Map<string | null, MenuItemNode[]>();
        nodes.forEach((node) => {
            if (!map.has(node.parentClientId)) {
                map.set(node.parentClientId, []);
            }
            map.get(node.parentClientId)!.push(node);
        });
        return map;
    }, [nodes]);

    const togglePanel = (key: string) => {
        setOpenPanels((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleChecked = (group: string, id: number) => {
        setChecked((prev) => {
            const next = new Set(prev[group]);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return { ...prev, [group]: next };
        });
    };

    const addNodes = (newNodes: MenuItemNode[]) => {
        setNodes((prev) => [...prev, ...newNodes]);
        setExpanded((prev) => {
            const next = new Set(prev);
            newNodes.forEach((n) => next.add(n.clientId));
            return next;
        });
    };

    const addCheckedItems = (type: ItemType, list: CandidateItem[]) => {
        const ids = checked[type];
        const newNodes: MenuItemNode[] = list
            .filter((c) => ids.has(c.id))
            .map((c) => ({
                clientId: nextClientId(),
                parentClientId: null,
                type,
                object_id: c.id,
                label: '',
                url: '',
                css_class: '',
                target: '',
                object_label: c.title,
            }));
        if (newNodes.length > 0) {
            addNodes(newNodes);
        }
        setChecked((prev) => ({ ...prev, [type]: new Set() }));
    };

    const addCustomLink = () => {
        if (!customUrl.trim() || !customLabel.trim()) {
            return;
        }
        addNodes([
            {
                clientId: nextClientId(),
                parentClientId: null,
                type: 'custom',
                object_id: 0,
                label: customLabel.trim(),
                url: customUrl.trim(),
                css_class: '',
                target: '',
                object_label: '',
            },
        ]);
        setCustomUrl('');
        setCustomLabel('');
    };

    const removeNode = (clientId: string) => {
        const descendants = collectDescendants(clientId);
        const removeSet = new Set([clientId, ...descendants]);
        setNodes((prev) => prev.filter((n) => !removeSet.has(n.clientId)));
    };

    const collectDescendants = (clientId: string): string[] => {
        const result: string[] = [];
        const walk = (parent: string) => {
            (childrenMap.get(parent) ?? []).forEach((child) => {
                result.push(child.clientId);
                walk(child.clientId);
            });
        };
        walk(clientId);
        return result;
    };

    const updateNode = (clientId: string, patch: Partial<MenuItemNode>) => {
        setNodes((prev) => prev.map((n) => (n.clientId === clientId ? { ...n, ...patch } : n)));
    };

    const toggleExpanded = (clientId: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(clientId)) {
                next.delete(clientId);
            } else {
                next.add(clientId);
            }
            return next;
        });
    };

    // ---------- 拖拽 ----------
    const getDescendantIds = (clientId: string): Set<string> => {
        return new Set([clientId, ...collectDescendants(clientId)]);
    };

    /** 计算拖拽块在 DFS 列表中的范围 [start, end) */
    const getBlockRange = (list: MenuItemNode[], clientId: string): [number, number] => {
        const start = list.findIndex((n) => n.clientId === clientId);
        if (start === -1) {
            return [-1, -1];
        }
        const descendants = new Set(collectDescendantsFromList(list, clientId));
        let end = start + 1;
        while (end < list.length && descendants.has(list[end].clientId)) {
            end++;
        }
        return [start, end];
    };

    const collectDescendantsFromList = (list: MenuItemNode[], clientId: string): string[] => {
        const childMap = new Map<string | null, MenuItemNode[]>();
        list.forEach((n) => {
            if (!childMap.has(n.parentClientId)) {
                childMap.set(n.parentClientId, []);
            }
            childMap.get(n.parentClientId)!.push(n);
        });
        const result: string[] = [];
        const walk = (parent: string) => {
            (childMap.get(parent) ?? []).forEach((c) => {
                result.push(c.clientId);
                walk(c.clientId);
            });
        };
        walk(clientId);
        return result;
    };

    const canDrop = (targetId: string): boolean => {
        if (!dragId || dragId === targetId) {
            return false;
        }
        // 不能拖到自己的后代上
        const descendants = getDescendantIds(dragId);
        return !descendants.has(targetId);
    };

    const handleDragStart = (clientId: string) => (e: React.DragEvent) => {
        setDragId(clientId);
        e.dataTransfer.effectAllowed = 'move';
        dragCounter.current = 0;
    };

    const handleDragOver = (targetId: string) => (e: React.DragEvent) => {
        if (!canDrop(targetId)) {
            return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientY - rect.top) / rect.height;
        let pos: DropPosition;
        if (ratio < 0.3) {
            pos = 'before';
        } else if (ratio > 0.7) {
            pos = 'after';
        } else {
            pos = 'child';
        }
        setDropTarget({ id: targetId, pos });
    };

    const handleDrop = (targetId: string) => (e: React.DragEvent) => {
        e.preventDefault();
        const draggedId = dragId;
        const target = dropTarget;
        setDragId(null);
        setDropTarget(null);
        if (!draggedId || !target || !canDrop(targetId)) {
            return;
        }

        setNodes((prev) => {
            const list = [...prev];

            // 取出拖动块
            const [dragStart, dragEnd] = getBlockRange(list, draggedId);
            if (dragStart === -1) {
                return prev;
            }
            const draggedBlock = list.slice(dragStart, dragEnd);
            const without = list.filter((_, i) => i < dragStart || i >= dragEnd);

            // 定位目标块
            const targetIndex = without.findIndex((n) => n.clientId === targetId);
            if (targetIndex === -1) {
                return prev;
            }
            const [, targetBlockEnd] = getBlockRange(without, targetId);
            const targetNode = without[targetIndex];

            let insertIndex: number;
            let newParent: string | null;

            if (target.pos === 'before') {
                insertIndex = targetIndex;
                newParent = targetNode.parentClientId;
            } else if (target.pos === 'after') {
                insertIndex = targetBlockEnd;
                newParent = targetNode.parentClientId;
            } else {
                // 作为子项：插到目标块末尾之后，父级为目标
                insertIndex = targetBlockEnd;
                newParent = targetNode.clientId;
            }

            // 重设拖动块父级：只改顶层块的 parent，后代保持相对关系
            const movedBlock = draggedBlock.map((n, i) =>
                i === 0 ? { ...n, parentClientId: newParent } : n,
            );

            const result = [
                ...without.slice(0, insertIndex),
                ...movedBlock,
                ...without.slice(insertIndex),
            ];
            return result;
        });
    };

    const handleDragEnd = () => {
        setDragId(null);
        setDropTarget(null);
    };

    // ---------- 保存 / 删除 ----------
    const handleSave = () => {
        if (!selectedMenu) {
            return;
        }
        setSaving(true);
        const payload = {
            name: menuName,
            auto_add_pages: autoAddPages ? '1' : '0',
            items: nodes.map((n) => ({
                clientId: n.clientId,
                parentClientId: n.parentClientId,
                type: n.type,
                object_id: n.object_id,
                label: n.label,
                url: n.type === 'custom' ? n.url : '',
                css_class: n.css_class,
                target: n.target,
            })),
        };
        router.put(menuActions.update.url(selectedMenu.id), payload, {
            preserveScroll: true,
            onFinish: () => setSaving(false),
        });
    };

    const handleDeleteMenu = () => {
        if (!selectedMenu) {
            return;
        }
        if (!window.confirm(t('menus.deleteConfirm'))) {
            return;
        }
        router.delete(menuActions.destroy.url(selectedMenu.id), { preserveScroll: true });
    };

    const handleCreateMenu = () => {
        if (!newMenuName.trim()) {
            return;
        }
        router.post(menuActions.store.url(), { name: newMenuName.trim() }, { preserveScroll: true });
        setCreateOpen(false);
        setNewMenuName('');
    };

    const switchMenu = (id: string) => {
        router.visit(menuActions.index.url({ query: { menu: id } }), { preserveScroll: true });
    };

    const typeLabel = (type: ItemType): string => {
        switch (type) {
            case 'page': return t('menus.typePage');
            case 'article': return t('menus.typeArticle');
            case 'category': return t('menus.typeCategory');
            case 'custom': return t('menus.typeCustom');
        }
    };

    const displayLabel = (n: MenuItemNode): string => n.label || n.object_label || t('menus.untitled');

    // ---------- 渲染 ----------
    const renderItem = (node: MenuItemNode, depth: number = 0): React.ReactNode => {
        const children = childrenMap.get(node.clientId) ?? [];
        const isExpanded = expanded.has(node.clientId);
        const hasChildren = children.length > 0;
        const isDropTarget = dropTarget?.id === node.clientId;
        const isDragging = dragId === node.clientId;

        return (
            <div key={node.clientId}>
                <div
                    draggable
                    onDragStart={handleDragStart(node.clientId)}
                    onDragOver={handleDragOver(node.clientId)}
                    onDrop={handleDrop(node.clientId)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                        'relative rounded-xl border border-border/60 bg-card transition-all',
                        isDragging && 'opacity-40',
                        isDropTarget && dropTarget?.pos === 'child' && 'ring-2 ring-primary ring-offset-1',
                    )}
                    style={{ marginLeft: depth * 24 }}
                >
                    {/* 上方落点 */}
                    {isDropTarget && dropTarget?.pos === 'before' && (
                        <div className="absolute -top-1 left-0 right-0 h-0.5 rounded bg-primary" />
                    )}
                    {/* 下方落点 */}
                    {isDropTarget && dropTarget?.pos === 'after' && (
                        <div className="absolute -bottom-1 left-0 right-0 h-0.5 rounded bg-primary" />
                    )}

                    <div className="flex items-center gap-2 px-3 py-2.5">
                        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/50 active:cursor-grabbing" />
                        <button
                            type="button"
                            onClick={() => toggleExpanded(node.clientId)}
                            className="flex items-center gap-1.5 text-muted-foreground"
                        >
                            <ChevronDown
                                className={cn('h-4 w-4 transition-transform', !isExpanded && '-rotate-90')}
                            />
                        </button>
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-callout font-medium">
                                {displayLabel(node)}
                                {hasChildren && (
                                    <span className="ml-2 text-caption text-muted-foreground">
                                        {t('menus.subItem')}
                                    </span>
                                )}
                            </div>
                        </div>
                        <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-caption text-muted-foreground">
                            {typeLabel(node.type)}
                        </span>
                        <button
                            type="button"
                            onClick={() => removeNode(node.clientId)}
                            className="shrink-0 cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title={t('menus.remove')}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {isExpanded && (
                        <div className="space-y-3 border-t border-border/40 bg-muted/30 px-4 py-3">
                            <div className="grid gap-1.5">
                                <Label className="text-caption text-muted-foreground">
                                    {t('menus.itemLabel')}
                                </Label>
                                <Input
                                    value={node.label}
                                    placeholder={node.object_label || t('menus.labelPlaceholder')}
                                    onChange={(e) => updateNode(node.clientId, { label: e.target.value })}
                                    className="h-9"
                                />
                            </div>
                            {node.type === 'custom' ? (
                                <div className="grid gap-1.5">
                                    <Label className="text-caption text-muted-foreground">
                                        {t('menus.itemUrl')}
                                    </Label>
                                    <Input
                                        value={node.url}
                                        placeholder="https://"
                                        onChange={(e) => updateNode(node.clientId, { url: e.target.value })}
                                        className="h-9"
                                    />
                                </div>
                            ) : (
                                node.url && (
                                    <div className="grid gap-1.5">
                                        <Label className="text-caption text-muted-foreground">
                                            {t('menus.itemUrl')}
                                        </Label>
                                        <div className="truncate text-footnote text-muted-foreground">{node.url}</div>
                                    </div>
                                )
                            )}
                            <div className="grid gap-1.5">
                                <Label className="text-caption text-muted-foreground">
                                    {t('menus.itemCss')}
                                </Label>
                                <Input
                                    value={node.css_class}
                                    placeholder="fa-home"
                                    onChange={(e) => updateNode(node.clientId, { css_class: e.target.value })}
                                    className="h-9"
                                />
                            </div>
                            <label className="flex cursor-pointer items-center gap-2">
                                <Checkbox
                                    checked={node.target === '_blank'}
                                    onCheckedChange={(v) =>
                                        updateNode(node.clientId, { target: v === true ? '_blank' : '' })
                                    }
                                />
                                <span className="text-footnote">{t('menus.openNewTab')}</span>
                            </label>
                        </div>
                    )}
                </div>

                {children.map((child) => renderItem(child, depth + 1))}
            </div>
        );
    };

    const renderAddPanel = (
        panelKey: string,
        icon: React.ReactNode,
        title: string,
        list: CandidateItem[],
        type: ItemType,
    ) => (
        <div className="rounded-xl border border-border/60 bg-card">
            <button
                type="button"
                onClick={() => togglePanel(panelKey)}
                className="flex w-full items-center justify-between px-4 py-3 text-callout font-medium"
            >
                <span className="flex items-center gap-2">{icon}{title}</span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', !openPanels[panelKey] && '-rotate-90')} />
            </button>
            {openPanels[panelKey] && (
                <div className="border-t border-border/40 p-3">
                    <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                        {list.length === 0 && (
                            <p className="py-3 text-center text-footnote text-muted-foreground">
                                {t('menus.noItems')}
                            </p>
                        )}
                        {list.map((c) => (
                            <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/60">
                                <Checkbox
                                    checked={checked[type]?.has(c.id) ?? false}
                                    onCheckedChange={() => toggleChecked(type, c.id)}
                                />
                                <span className="truncate text-footnote">{c.title}</span>
                            </label>
                        ))}
                    </div>
                    {list.length > 0 && (
                        <div className="mt-2 flex justify-end">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => addCheckedItems(type, list)}
                            >
                                <Plus className="h-4 w-4" />
                                {t('menus.addToMenu')}
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <>
            <Head title={t('menus.title')} />
            <div className="flex h-full flex-1 flex-col gap-5 overflow-x-auto p-6">
                <div className="flex flex-col gap-1">
                    <h1 className="text-title-1 font-semibold tracking-tight">{t('menus.title')}</h1>
                    <p className="text-subheadline text-muted-foreground">{t('menus.description')}</p>
                </div>

                {/* 菜单选择 */}
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card p-4">
                    <span className="text-callout text-muted-foreground">{t('menus.selectMenu')}</span>
                    <Select value={selectedMenu ? String(selectedMenu.id) : ''} onValueChange={switchMenu}>
                        <SelectTrigger className="w-64">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {menus.map((m) => (
                                <SelectItem key={m.id} value={String(m.id)}>
                                    {m.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <button
                        type="button"
                        onClick={() => setCreateOpen(true)}
                        className="cursor-pointer text-callout text-primary hover:underline"
                    >
                        {t('menus.createNew')}
                    </button>
                </div>

                <div className="grid flex-1 auto-rows-min items-start gap-5 lg:grid-cols-[320px_1fr]">
                    {/* 左侧：添加菜单项 */}
                    <div className="space-y-3">
                        <h2 className="text-headline font-semibold">{t('menus.addItems')}</h2>

                        {renderAddPanel('page', <FileStack className="h-4 w-4 text-primary" />, t('menus.pages'), candidates.pages, 'page')}
                        {renderAddPanel('article', <FileText className="h-4 w-4 text-blue-500" />, t('menus.articles'), candidates.articles, 'article')}
                        {renderAddPanel('category', <FolderTree className="h-4 w-4 text-amber-500" />, t('menus.categories'), candidates.categories, 'category')}

                        {/* 自定义链接 */}
                        <div className="rounded-xl border border-border/60 bg-card">
                            <button
                                type="button"
                                onClick={() => togglePanel('custom')}
                                className="flex w-full items-center justify-between px-4 py-3 text-callout font-medium"
                            >
                                <span className="flex items-center gap-2">
                                    <LinkIcon className="h-4 w-4 text-emerald-500" />
                                    {t('menus.customLinks')}
                                </span>
                                <ChevronDown className={cn('h-4 w-4 transition-transform', !openPanels.custom && '-rotate-90')} />
                            </button>
                            {openPanels.custom && (
                                <div className="space-y-2 border-t border-border/40 p-3">
                                    <div className="grid gap-1.5">
                                        <Label className="text-caption text-muted-foreground">{t('menus.customUrl')}</Label>
                                        <Input
                                            value={customUrl}
                                            placeholder="https://example.com"
                                            onChange={(e) => setCustomUrl(e.target.value)}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="text-caption text-muted-foreground">{t('menus.customText')}</Label>
                                        <Input
                                            value={customLabel}
                                            placeholder={t('menus.customTextPlaceholder')}
                                            onChange={(e) => setCustomLabel(e.target.value)}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={addCustomLink}
                                            disabled={!customUrl.trim() || !customLabel.trim()}
                                        >
                                            <Plus className="h-4 w-4" />
                                            {t('menus.addToMenu')}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 右侧：菜单结构 */}
                    <div className="space-y-4">
                        <h2 className="text-headline font-semibold">{t('menus.menuStructure')}</h2>

                        {selectedMenu ? (
                            <>
                                <div className="rounded-2xl border border-border/60 bg-card p-4">
                                    <div className="grid max-w-sm gap-1.5">
                                        <Label htmlFor="menu_name">{t('menus.menuName')}</Label>
                                        <Input
                                            id="menu_name"
                                            value={menuName}
                                            onChange={(e) => setMenuName(e.target.value)}
                                        />
                                    </div>
                                    <p className="mt-3 text-footnote text-muted-foreground">
                                        {t('menus.dragHint')}
                                    </p>
                                </div>

                                <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-4">
                                    {nodes.length === 0 ? (
                                        <div className="py-10 text-center">
                                            <FolderTree className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                                            <p className="text-callout text-muted-foreground">{t('menus.emptyMenu')}</p>
                                            <p className="mt-1 text-footnote text-muted-foreground">{t('menus.emptyHint')}</p>
                                        </div>
                                    ) : (
                                        (childrenMap.get(null) ?? []).map((node) => renderItem(node, 0))
                                    )}
                                </div>

                                {/* 菜单设置 */}
                                <div className="rounded-2xl border border-border/60 bg-card p-4">
                                    <h3 className="mb-3 text-callout font-semibold">{t('menus.menuSettings')}</h3>
                                    <label className="flex cursor-pointer items-center gap-2">
                                        <Checkbox
                                            checked={autoAddPages}
                                            onCheckedChange={(v) => setAutoAddPages(v === true)}
                                        />
                                        <span className="text-footnote">{t('menus.autoAddPages')}</span>
                                    </label>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Button onClick={handleSave} disabled={saving || !menuName.trim()}>
                                        <Save className="h-4 w-4" />
                                        {t('menus.save')}
                                    </Button>
                                    <Button variant="ghost" onClick={handleDeleteMenu} className="text-destructive hover:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                        {t('menus.deleteMenu')}
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-border py-16 text-center">
                                <p className="text-callout text-muted-foreground">{t('menus.noMenu')}</p>
                                <Button className="mt-3" onClick={() => setCreateOpen(true)}>
                                    <Plus className="h-4 w-4" />
                                    {t('menus.createNew')}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* 创建菜单弹窗 */}
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{t('menus.createTitle')}</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-2 py-2">
                            <Label htmlFor="new_menu_name">{t('menus.menuName')}</Label>
                            <Input
                                id="new_menu_name"
                                value={newMenuName}
                                onChange={(e) => setNewMenuName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateMenu()}
                                autoFocus
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCreateOpen(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button onClick={handleCreateMenu} disabled={!newMenuName.trim()}>
                                {t('common.confirm')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
