import { Head, router } from '@inertiajs/react';
import {
    Image as ImageIcon,
    Video,
    FileText,
    Plus,
    Search,
    Trash2,
    LayoutGrid,
    List,
    X,
    Calendar,
    User,
    Download,
    CheckCircle2,
    CheckSquare,
    Square,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Attachment {
    id: number;
    file_name: string;
    file_path: string;
    mime_type: string;
    file_size: number;
    width: number | null;
    height: number | null;
    parent_type: string | null;
    parent_id: number | null;
    author_name: string;
    created_at: string;
    type: 'image' | 'video' | 'document';
    thumbnail_url: string | null;
}

interface PaginatedAttachments {
    data: Attachment[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}

interface TypeCounts {
    all: number;
    image: number;
    video: number;
    document: number;
}

interface Props {
    attachments: PaginatedAttachments;
    typeCounts: TypeCounts;
    currentType: string;
    currentSearch: string;
    currentDate: string;
    availableDates: string[];
}

const TYPE_TABS = [
    { key: 'all', label: 'media.type.all', icon: null },
    { key: 'image', label: 'media.type.image', icon: ImageIcon },
    { key: 'video', label: 'media.type.video', icon: Video },
    { key: 'document', label: 'media.type.document', icon: FileText },
] as const;

function formatFileSize(bytes: number): string {
    if (bytes === 0) {
return '0 B';
}

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(type: Attachment['type']) {
    switch (type) {
        case 'image':
            return ImageIcon;
        case 'video':
            return Video;
        default:
            return FileText;
    }
}

export default function MediaIndex({ attachments, typeCounts, currentType, currentSearch, currentDate, availableDates }: Props) {
    const { t } = useTranslation();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchTerm, setSearchTerm] = useState(currentSearch);
    const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
    const [deleteAttachment, setDeleteAttachment] = useState<Attachment | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // 多选模式
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // 批量删除
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    // 删除确认弹窗的打开状态独立管理，避免与预览弹窗同时存在导致闪烁
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    // 同步 URL 搜索状态
    useEffect(() => {
        setSearchTerm(currentSearch);
    }, [currentSearch]);

    // 防抖搜索
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm !== currentSearch) {
                handleFilterChange(currentType, searchTerm);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleFilterChange = (type: string, search: string = currentSearch, date: string = currentDate) => {
        const params = new URLSearchParams();

        if (type !== 'all') {
params.set('type', type);
}

        if (search) {
params.set('search', search);
}

        if (date) {
params.set('date', date);
}

        const query = params.toString();
        router.visit(`/attachments${query ? `?${query}` : ''}`, { preserveScroll: true });
    };

    const handleDateChange = (date: string) => {
        handleFilterChange(currentType, searchTerm, date);
    };

    const handlePageChange = (url: string) => {
        router.visit(url, { preserveScroll: true });
    };

    const handleDelete = () => {
        if (!deleteAttachment) {
return;
}

        setIsDeleting(true);
        router.delete(`/attachments/${deleteAttachment.id}`, {
            preserveScroll: true,
            onFinish: () => {
                setIsDeleting(false);
                setDeleteAttachment(null);
                setConfirmDeleteOpen(false);
            },
        });
    };

    const attachmentList = attachments.data;

    /**
     * 从预览弹窗里发起删除：先关闭预览，再打开删除确认弹窗。
     * 删除确认弹窗的 open 状态由 confirmDeleteOpen 独立管理，两个 Dialog 不会同时存在。
     */
    const handleDeleteFromPreview = (attachment: Attachment) => {
        setPreviewAttachment(null);
        setDeleteAttachment(attachment);
        // 延迟一帧（而非 250ms），等预览 Dialog 关闭动画开始后再打开确认弹窗
        requestAnimationFrame(() => {
            setConfirmDeleteOpen(true);
        });
    };

    // ===== 多选操作 =====
    const toggleSelection = useCallback((id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });
    }, []);

    const selectAll = useCallback(() => {
        setSelectedIds(new Set(attachmentList.map((a) => a.id)));
    }, [attachmentList]);

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    const enterSelectionMode = () => {
        setSelectionMode(true);
        setSelectedIds(new Set());
    };

    const exitSelectionMode = () => {
        setSelectionMode(false);
        setSelectedIds(new Set());
    };

    const handleBulkDelete = () => {
        setIsBulkDeleting(true);
        router.delete('/attachments/bulk', {
            data: { ids: Array.from(selectedIds) },
            preserveScroll: true,
            onFinish: () => {
                setIsBulkDeleting(false);
                setBulkDeleteOpen(false);
                exitSelectionMode();
            },
        });
    };

    const clearSearch = () => {
        setSearchTerm('');
        handleFilterChange(currentType, '');
    };

    return (
        <>
            <Head title={t('media.library')} />
            <div className="flex h-full flex-1 flex-col gap-5 overflow-x-auto p-6">
                {/* Page Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-title-1 font-semibold tracking-tight">
                            {t('media.library')}
                        </h1>
                        <p className="text-subheadline text-secondary-label">
                            {t('media.allMedia')}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {selectionMode ? (
                            // 多选模式下的工具栏
                            <>
                                <span className="text-footnote font-medium text-secondary-label">
                                    {t('media.selected', { count: selectedIds.size })}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={selectAll}
                                    disabled={attachmentList.length === 0}
                                >
                                    <CheckSquare className="h-3.5 w-3.5" />
                                    {t('media.selectAll')}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={clearSelection}
                                    disabled={selectedIds.size === 0}
                                >
                                    <Square className="h-3.5 w-3.5" />
                                    {t('media.clearSelection')}
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setBulkDeleteOpen(true)}
                                    disabled={selectedIds.size === 0}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    {t('media.bulkDelete')}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={exitSelectionMode}
                                >
                                    {t('media.exitSelectionMode')}
                                </Button>
                            </>
                        ) : (
                            <>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-foreground/50" />
                                    <Input
                                        placeholder={t('media.searchPlaceholder')}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-56 pl-9 pr-9"
                                    />
                                    {searchTerm && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={clearSearch}
                                            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                </div>
                                {availableDates.length > 0 && (
                                    <Select
                                        value={currentDate || 'all'}
                                        onValueChange={(v) => handleDateChange(v === 'all' ? '' : v)}
                                    >
                                        <SelectTrigger size="sm" className="w-36 gap-1.5">
                                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">{t('media.allDates')}</SelectItem>
                                            {availableDates.map((d) => {
                                                const [y, m] = d.split('-');
                                                const label = `${y}-${m}`;

                                                return (
                                                    <SelectItem key={d} value={d}>
                                                        {label}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={enterSelectionMode}
                                    disabled={attachmentList.length === 0}
                                >
                                    <CheckSquare className="h-3.5 w-3.5" />
                                    {t('media.manage')}
                                </Button>
                                <Button onClick={() => router.visit('/attachments/create')}>
                                    <Plus className="h-4 w-4" />
                                    {t('media.addMedia')}
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Type Filter Tabs */}
                <div className="inline-flex w-fit items-center gap-1 overflow-x-auto rounded-2xl bg-neutral-200/60 p-1 backdrop-blur-sm dark:bg-neutral-700/60">
                    {TYPE_TABS.map((tab) => {
                        const isActive = currentType === tab.key;
                        const count = typeCounts[tab.key as keyof TypeCounts] ?? 0;
                        const Icon = tab.icon;

                        return (
                            <button
                                key={tab.key}
                                onClick={() => handleFilterChange(tab.key)}
                                className={cn(
                                    'flex items-center gap-2 rounded-xl px-4 py-2 text-callout font-medium transition-all duration-200',
                                    isActive
                                        ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                        : 'text-muted-foreground hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800',
                                )}
                            >
                                {Icon && <Icon className="h-4 w-4" />}
                                {t(tab.label)}
                                <span
                                    className={cn(
                                        'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-caption font-semibold tabular-nums',
                                        isActive
                                            ? 'bg-primary/15 text-primary'
                                            : 'bg-muted text-muted-foreground',
                                    )}
                                >
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* View Mode Toggle + Count */}
                <div className="flex items-center justify-between">
                    <p className="text-subheadline text-secondary-label">
                        {t('media.count', { count: attachments.total })}
                    </p>
                    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 p-1 backdrop-blur-sm">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                'flex h-7 w-7 items-center justify-center rounded-full transition-all',
                                viewMode === 'grid'
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                            )}
                            aria-label={t('media.gridView')}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn(
                                'flex h-7 w-7 items-center justify-center rounded-full transition-all',
                                viewMode === 'list'
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                            )}
                            aria-label={t('media.listView')}
                        >
                            <List className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                {attachmentList.length === 0 ? (
                    <Card className="flex-1">
                        <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-20">
                            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
                                <ImageIcon className="h-8 w-8" />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <p className="text-callout font-medium">{t('media.noMedia')}</p>
                                <p className="text-footnote text-secondary-label">
                                    {t('media.noMediaDescription')}
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.visit('/attachments/create')}
                            >
                                <Plus className="h-3.5 w-3.5" />
                                {t('media.addMedia')}
                            </Button>
                        </CardContent>
                    </Card>
                ) : viewMode === 'grid' ? (
                    /* Grid View */
                    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14">
                        {attachmentList.map((attachment) => {
                            const Icon = getFileIcon(attachment.type);
                            const isSelected = selectedIds.has(attachment.id);

                            return (
                                <Card
                                    key={attachment.id}
                                    className={cn(
                                        'group relative cursor-pointer overflow-hidden p-0 transition-shadow duration-300 hover:shadow-lg',
                                        isSelected &&
                                            'ring-2 ring-primary ring-offset-2 ring-offset-background',
                                    )}
                                    onClick={() =>
                                        selectionMode
                                            ? toggleSelection(attachment.id)
                                            : setPreviewAttachment(attachment)
                                    }
                                >
                                    <div className="relative aspect-square overflow-hidden bg-muted">
                                        {attachment.thumbnail_url ? (
                                            <img
                                                src={attachment.thumbnail_url}
                                                alt={attachment.file_name}
                                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
                                                <Icon className="h-7 w-7" />
                                                <span className="px-1.5 text-[10px] font-medium uppercase tracking-wider">
                                                    {attachment.mime_type.split('/')[1] ?? 'file'}
                                                </span>
                                            </div>
                                        )}

                                        {/* 多选模式下：选中标记（左上角） */}
                                        {selectionMode && (
                                            <div
                                                className={cn(
                                                    'absolute left-1.5 top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all',
                                                    isSelected
                                                        ? 'border-primary bg-primary text-primary-foreground shadow-md'
                                                        : 'border-white/80 bg-black/30 text-transparent backdrop-blur-sm',
                                                )}
                                            >
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                            </div>
                                        )}

                                        {/* 非多选模式下：删除按钮（右上角，始终可见） */}
                                        {!selectionMode && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeleteAttachment(attachment);
                                                    setConfirmDeleteOpen(true);
                                                }}
                                                className="absolute right-1.5 top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-red-500 hover:opacity-100 group-hover:opacity-100"
                                                aria-label={t('media.delete')}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        )}

                                        {/* Hover overlay - pointer-events-none 确保不拦截其他按钮点击 */}
                                        <div className="pointer-events-none absolute inset-0 z-10 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                            <p className="line-clamp-1 text-[10px] font-medium text-white">
                                                {attachment.file_name}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-0.5 p-2">
                                        <p className="line-clamp-1 text-[11px] font-medium tracking-tight">
                                            {attachment.file_name}
                                        </p>
                                        <p className="text-[10px] text-secondary-label">
                                            {formatFileSize(attachment.file_size)}
                                        </p>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                ) : (
                    /* List View */
                    <Card className="relative flex-1 overflow-hidden">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>{t('media.library')}</CardTitle>
                                    <CardDescription>{t('media.allMedia')}</CardDescription>
                                </div>
                                <div className="text-subheadline text-secondary-label">
                                    {t('media.count', { count: attachments.total })}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        {selectionMode && (
                                            <TableHead className="h-10 w-10 px-4">
                                                <button
                                                    onClick={() => {
                                                        const allSelected =
                                                            attachmentList.length > 0 &&
                                                            attachmentList.every((a) =>
                                                                selectedIds.has(a.id),
                                                            );

                                                        if (allSelected) {
                                                            clearSelection();
                                                        } else {
                                                            selectAll();
                                                        }
                                                    }}
                                                    className="text-muted-foreground hover:text-foreground"
                                                >
                                                    {attachmentList.length > 0 &&
                                                    attachmentList.every((a) =>
                                                        selectedIds.has(a.id),
                                                    ) ? (
                                                        <CheckSquare className="h-4 w-4 text-primary" />
                                                    ) : (
                                                        <Square className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </TableHead>
                                        )}
                                        <TableHead className="h-10 px-4">
                                            {t('media.fileName')}
                                        </TableHead>
                                        <TableHead className="h-10 px-4">
                                            {t('media.fileType')}
                                        </TableHead>
                                        <TableHead className="h-10 px-4">
                                            {t('media.fileSize')}
                                        </TableHead>
                                        <TableHead className="h-10 px-4">
                                            {t('media.uploadedBy')}
                                        </TableHead>
                                        <TableHead className="h-10 px-4">
                                            {t('media.uploadedAt')}
                                        </TableHead>
                                        {!selectionMode && (
                                            <TableHead className="h-10 px-4 text-right">
                                                {t('media.actions')}
                                            </TableHead>
                                        )}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {attachmentList.map((attachment) => {
                                        const Icon = getFileIcon(attachment.type);
                                        const isSelected = selectedIds.has(attachment.id);

                                        return (
                                            <TableRow
                                                key={attachment.id}
                                                className={cn(
                                                    'cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/30',
                                                    isSelected && 'bg-primary/5',
                                                )}
                                                onClick={() =>
                                                    selectionMode
                                                        ? toggleSelection(attachment.id)
                                                        : setPreviewAttachment(attachment)
                                                }
                                            >
                                                {selectionMode && (
                                                    <TableCell className="w-10 px-4 py-3">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleSelection(attachment.id);
                                                            }}
                                                            className="text-muted-foreground hover:text-foreground"
                                                        >
                                                            {isSelected ? (
                                                                <CheckSquare className="h-4 w-4 text-primary" />
                                                            ) : (
                                                                <Square className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    </TableCell>
                                                )}
                                                <TableCell className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                                                            {attachment.thumbnail_url ? (
                                                                <img
                                                                    src={attachment.thumbnail_url}
                                                                    alt={attachment.file_name}
                                                                    className="h-full w-full object-cover"
                                                                    loading="lazy"
                                                                />
                                                            ) : (
                                                                <Icon className="h-5 w-5 text-muted-foreground" />
                                                            )}
                                                        </div>
                                                        <span className="line-clamp-1 font-medium">
                                                            {attachment.file_name}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 py-3">
                                                    <Badge variant="outline" className="font-medium">
                                                        {t(`media.type.${attachment.type}`)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="px-4 py-3 tabular-nums text-secondary-label">
                                                    {formatFileSize(attachment.file_size)}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-secondary-label">
                                                    {attachment.author_name}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-secondary-label">
                                                    {attachment.created_at}
                                                </TableCell>
                                                {!selectionMode && (
                                                    <TableCell className="px-4 py-3 text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDeleteAttachment(attachment);
                                                                setConfirmDeleteOpen(true);
                                                            }}
                                                            className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                {/* Pagination */}
                {attachmentList.length > 0 && attachments.last_page > 1 && (
                    <div className="flex items-center justify-center gap-2">
                        {attachments.links.map((link, i) => (
                            <Button
                                key={i}
                                variant={link.active ? 'default' : 'outline'}
                                size="sm"
                                disabled={!link.url}
                                onClick={() => link.url && handlePageChange(link.url)}
                                className="min-w-9"
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Preview Dialog */}
            <Dialog
                open={!!previewAttachment}
                onOpenChange={(open) => !open && setPreviewAttachment(null)}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="line-clamp-1">
                            {previewAttachment?.file_name}
                        </DialogTitle>
                        <DialogDescription>{t('media.fileDetails')}</DialogDescription>
                    </DialogHeader>
                    {previewAttachment && (
                        <div className="flex flex-col gap-4">
                            {/* Preview Area */}
                            <div className="flex max-h-[50vh] items-center justify-center overflow-hidden rounded-xl bg-muted">
                                {previewAttachment.thumbnail_url ? (
                                    <img
                                        src={previewAttachment.thumbnail_url}
                                        alt={previewAttachment.file_name}
                                        className="max-h-[50vh] w-full object-contain"
                                    />
                                ) : (
                                    <div className="flex h-48 w-full flex-col items-center justify-center gap-3 text-muted-foreground">
                                        {(() => {
                                            const Icon = getFileIcon(previewAttachment.type);

                                            return <Icon className="h-12 w-12" />;
                                        })()}
                                        <p className="text-footnote">
                                            {previewAttachment.mime_type}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Details */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <div className="flex flex-col">
                                        <span className="text-caption text-secondary-label">
                                            {t('media.fileType')}
                                        </span>
                                        <span className="text-footnote font-medium">
                                            {previewAttachment.mime_type}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                                    <Download className="h-4 w-4 text-muted-foreground" />
                                    <div className="flex flex-col">
                                        <span className="text-caption text-secondary-label">
                                            {t('media.fileSize')}
                                        </span>
                                        <span className="text-footnote font-medium tabular-nums">
                                            {formatFileSize(previewAttachment.file_size)}
                                        </span>
                                    </div>
                                </div>
                                {previewAttachment.width && previewAttachment.height && (
                                    <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex flex-col">
                                            <span className="text-caption text-secondary-label">
                                                {t('media.dimensions')}
                                            </span>
                                            <span className="text-footnote font-medium tabular-nums">
                                                {previewAttachment.width} ×{' '}
                                                {previewAttachment.height}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <div className="flex flex-col">
                                        <span className="text-caption text-secondary-label">
                                            {t('media.uploadedBy')}
                                        </span>
                                        <span className="text-footnote font-medium">
                                            {previewAttachment.author_name}
                                        </span>
                                    </div>
                                </div>
                                <div className="col-span-2 flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <div className="flex flex-col">
                                        <span className="text-caption text-secondary-label">
                                            {t('media.uploadedAt')}
                                        </span>
                                        <span className="text-footnote font-medium">
                                            {previewAttachment.created_at}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="flex justify-between gap-2">
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                                previewAttachment && handleDeleteFromPreview(previewAttachment)
                            }
                        >
                            <Trash2 className="h-4 w-4" />
                            {t('media.delete')}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setPreviewAttachment(null)}
                        >
                            {t('media.close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={confirmDeleteOpen}
                onOpenChange={(open) => {
                    if (!open && !isDeleting) {
                        setConfirmDeleteOpen(false);
                        setDeleteAttachment(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('media.confirmDelete')}</DialogTitle>
                        <DialogDescription>
                            {t('media.confirmDeleteDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    {deleteAttachment && (
                        <div className="rounded-lg bg-muted/50 p-3">
                            <p className="line-clamp-1 text-footnote font-medium">
                                {deleteAttachment.file_name}
                            </p>
                            <p className="text-caption text-secondary-label">
                                {formatFileSize(deleteAttachment.file_size)} ·{' '}
                                {deleteAttachment.mime_type}
                            </p>
                        </div>
                    )}
                    <DialogFooter className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setConfirmDeleteOpen(false);
                                setDeleteAttachment(null);
                            }}
                            disabled={isDeleting}
                        >
                            {t('media.cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? t('common.saving') : t('media.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk Delete Confirmation Dialog */}
            <Dialog
                open={bulkDeleteOpen}
                onOpenChange={(open) => !open && !isBulkDeleting && setBulkDeleteOpen(false)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('media.confirmBulkDelete')}</DialogTitle>
                        <DialogDescription>
                            {t('media.confirmBulkDeleteDescription', {
                                count: selectedIds.size,
                            })}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg bg-destructive/5 p-3 ring-1 ring-destructive/20">
                        <p className="text-footnote font-medium text-destructive">
                            {t('media.selected', { count: selectedIds.size })}
                        </p>
                        <p className="text-caption text-secondary-label">
                            {t('media.bulkDeleteWarning')}
                        </p>
                    </div>
                    <DialogFooter className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setBulkDeleteOpen(false)}
                            disabled={isBulkDeleting}
                        >
                            {t('media.cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleBulkDelete}
                            disabled={isBulkDeleting}
                        >
                            {isBulkDeleting
                                ? t('common.saving')
                                : t('media.bulkDeleteButton', { count: selectedIds.size })}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
