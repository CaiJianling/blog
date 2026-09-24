import { Head, router } from '@inertiajs/react';
import {
    FileText,
    Eye,
    Heart,
    MessageSquare,
    Calendar,
    Pencil,
    Plus,
    Search,
    Trash2,
    Send,
    CheckCircle,
    FileEdit,
    Inbox,
    RotateCcw,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as pageActions from '@/actions/App/Http/Controllers/PageController';
import Pagination from '@/components/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { index as pagesIndex } from '@/routes/pages';

interface PageItem {
    id: number;
    title: string;
    author_name: string;
    slug: string;
    permalink: string;
    created_at: string;
    views: number;
    likes: number;
    comment_count: number;
    status: string;
}

interface PaginatedPages {
    data: PageItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

interface StatusCounts {
    all: number;
    publish: number;
    draft: number;
    trash: number;
}

interface Props {
    pages: PaginatedPages;
    statusCounts: StatusCounts;
    currentStatus: string;
}

const STATUS_MAP: Record<
    string,
    {
        label: string;
        variant: 'default' | 'outline' | 'destructive' | 'secondary';
    }
> = {
    publish: { label: 'pages.status.publish', variant: 'default' },
    draft: { label: 'pages.status.draft', variant: 'secondary' },
    trash: { label: 'pages.status.trash', variant: 'destructive' },
};

const STATUS_TABS = [
    { key: 'all', label: '全部' },
    { key: 'publish', label: '已发布' },
    { key: 'draft', label: '草稿' },
    { key: 'trash', label: '回收站' },
] as const;

export default function PageIndex({
    pages: pagePages,
    statusCounts,
    currentStatus,
}: Props) {
    const { t } = useTranslation();
    const pageList = pagePages.data;
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [showToolbar, setShowToolbar] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        if (selectedIds.length > 0) {
            setShowToolbar(true);
            setIsExiting(false);
        } else if (showToolbar) {
            setIsExiting(true);
            const timer = setTimeout(() => {
                setShowToolbar(false);
                setIsExiting(false);
            }, 300);

            return () => clearTimeout(timer);
        }
    }, [selectedIds]);

    const handleFilterChange = (status: string) => {
        const url =
            status === 'all' ? '/admin/pages' : `/admin/pages?status=${status}`;
        router.visit(url, { preserveScroll: true });
    };

    const allSelected =
        pageList.length > 0 && selectedIds.length === pageList.length;
    const someSelected = selectedIds.length > 0 && !allSelected;

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(pageList.map((p) => p.id));
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) =>
            prev.includes(id)
                ? prev.filter((sid) => sid !== id)
                : [...prev, id],
        );
    };

    const handleBatchAction = (status: 'publish' | 'draft' | 'trash') => {
        router.post(
            '/admin/pages/batch',
            {
                ids: selectedIds,
                status,
            },
            {
                preserveScroll: true,
                onSuccess: () => setSelectedIds([]),
            },
        );
    };

    const handleTrash = (id: number) => {
        router.put(`/admin/pages/${id}/trash`, {}, { preserveScroll: true });
    };

    const handleRestore = (id: number) => {
        router.put(`/admin/pages/${id}/restore`, {}, { preserveScroll: true });
    };

    const [forceDeleteTarget, setForceDeleteTarget] = useState<{
        id: number;
        title: string;
    } | null>(null);

    const handleForceDelete = (id: number, title: string) => {
        setForceDeleteTarget({ id, title });
    };

    const executeForceDelete = () => {
        if (!forceDeleteTarget) {
            return;
        }

        router.delete(`/admin/pages/${forceDeleteTarget.id}`, {
            preserveScroll: true,
            onFinish: () => setForceDeleteTarget(null),
        });
    };

    return (
        <>
            <Head title={t('pages.title')} />
            <div className="flex shrink-0 flex-col gap-5 overflow-x-auto p-6">
                {/* Page header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-title-1 font-semibold tracking-tight">
                            {t('pages.title')}
                        </h1>
                        <p className="text-subheadline text-muted-foreground">
                            管理你的所有页面内容。
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-foreground/50" />
                            <Input
                                placeholder="搜索页面..."
                                className="w-56 pl-9"
                            />
                        </div>
                        <Button
                            onClick={() =>
                                router.visit(pageActions.create.url())
                            }
                        >
                            <Plus className="h-4 w-4" />
                            {t('pages.create')}
                        </Button>
                    </div>
                </div>

                {/* Status Filter Tabs */}
                <div className="inline-flex w-fit items-center gap-1 overflow-x-auto rounded-2xl bg-neutral-200/60 p-1 backdrop-blur-sm dark:bg-neutral-700/60">
                    {STATUS_TABS.map((tab) => {
                        const isActive = currentStatus === tab.key;
                        const count =
                            statusCounts[tab.key as keyof StatusCounts] ?? 0;

                        return (
                            <button
                                key={tab.key}
                                onClick={() => handleFilterChange(tab.key)}
                                className={`text-callout flex items-center gap-2 rounded-xl px-4 py-2 font-medium transition-all duration-200 ${
                                    isActive
                                        ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                        : 'text-muted-foreground hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800'
                                }`}
                            >
                                {tab.label}
                                <span
                                    className={`text-caption flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-semibold tabular-nums ${
                                        isActive
                                            ? 'bg-primary/15 text-primary'
                                            : 'bg-muted text-muted-foreground'
                                    }`}
                                >
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Overview Stats */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-primary/10 bg-gradient-to-br from-primary/5 to-primary/10 !p-0">
                        <CardContent className="flex items-center justify-between p-5">
                            <div className="flex flex-col gap-1">
                                <div className="text-footnote font-medium tracking-wider text-muted-foreground uppercase">
                                    全部页面
                                </div>
                                <div className="text-title-2 font-semibold tracking-tight">
                                    {statusCounts.all}
                                </div>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                                <FileText className="h-6 w-6" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-emerald-500/10 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 !p-0">
                        <CardContent className="flex items-center justify-between p-5">
                            <div className="flex flex-col gap-1">
                                <div className="text-footnote font-medium tracking-wider text-muted-foreground uppercase">
                                    总浏览量
                                </div>
                                <div className="text-title-2 font-semibold tracking-tight">
                                    {pageList.reduce(
                                        (sum, p) => sum + p.views,
                                        0,
                                    )}
                                </div>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                <Eye className="h-6 w-6" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-blue-500/10 bg-gradient-to-br from-blue-500/5 to-blue-500/10 !p-0">
                        <CardContent className="flex items-center justify-between p-5">
                            <div className="flex flex-col gap-1">
                                <div className="text-footnote font-medium tracking-wider text-muted-foreground uppercase">
                                    总点赞
                                </div>
                                <div className="text-title-2 font-semibold tracking-tight">
                                    {pageList.reduce(
                                        (sum, p) => sum + p.likes,
                                        0,
                                    )}
                                </div>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                                <Heart className="h-6 w-6" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Page Table */}
                <Card className="relative flex-1 overflow-hidden">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>{t('pages.list')}</CardTitle>
                                <CardDescription>
                                    {t('pages.managePages')}
                                </CardDescription>
                            </div>
                            <div className="text-subheadline text-muted-foreground">
                                {t('pages.pagesCount', {
                                    count: pagePages.total,
                                })}
                            </div>
                        </div>
                    </CardHeader>

                    {/* Floating Batch Action Toolbar — translucent material overlay clipped to card radius */}
                    {showToolbar && (
                        <div
                            className={`absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-background/70 px-6 py-4 backdrop-blur-xl backdrop-saturate-150 ${isExiting ? 'animate-out duration-300 fade-out slide-out-to-top-2' : 'animate-in duration-300 fade-in slide-in-from-top-2'} dark:border-white/5 dark:bg-background/60`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <CheckCircle className="h-4.5 w-4.5" />
                                </div>
                                <span className="text-callout font-medium tracking-tight">
                                    已选择{' '}
                                    <span className="text-primary tabular-nums">
                                        {selectedIds.length}
                                    </span>{' '}
                                    个页面
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleBatchAction('publish')}
                                    className="gap-1.5"
                                >
                                    <Send className="h-3.5 w-3.5" />
                                    批量发布
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleBatchAction('draft')}
                                    className="gap-1.5"
                                >
                                    <FileEdit className="h-3.5 w-3.5" />
                                    移至草稿箱
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleBatchAction('trash')}
                                    className="gap-1.5"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    移至回收站
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedIds([])}
                                    className="ml-1"
                                >
                                    取消
                                </Button>
                            </div>
                        </div>
                    )}
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                    <TableHead className="h-11 w-11 shrink-0 pr-0 pl-5">
                                        <Checkbox
                                            checked={
                                                allSelected
                                                    ? true
                                                    : someSelected
                                                      ? 'indeterminate'
                                                      : false
                                            }
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead className="text-footnote h-11 min-w-[12rem] px-3 font-semibold tracking-wider text-muted-foreground uppercase">
                                        {t('pages.table.title')}
                                    </TableHead>
                                    <TableHead className="text-footnote h-11 w-1 px-3 font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase">
                                        {t('pages.table.author')}
                                    </TableHead>
                                    <TableHead className="text-footnote h-11 w-1 max-w-[10rem] px-3 font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase">
                                        {t('pages.table.slug')}
                                    </TableHead>
                                    <TableHead className="text-footnote h-11 w-1 px-3 font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase">
                                        {t('pages.table.date')}
                                    </TableHead>
                                    <TableHead className="text-footnote h-11 w-1 px-3 font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase">
                                        {t('pages.table.views')}
                                    </TableHead>
                                    <TableHead className="text-footnote h-11 w-1 px-3 font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase">
                                        {t('pages.table.comments')}
                                    </TableHead>
                                    <TableHead className="text-footnote h-11 w-1 px-5 text-right font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase">
                                        {t('pages.table.actions')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pageList.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={8}
                                            className="py-12 text-center"
                                        >
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-muted text-muted-foreground/60">
                                                    {currentStatus ===
                                                    'trash' ? (
                                                        <Inbox className="h-8 w-8" />
                                                    ) : (
                                                        <FileText className="h-8 w-8" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <div className="text-headline font-medium">
                                                        {currentStatus ===
                                                        'trash'
                                                            ? '回收站为空'
                                                            : t(
                                                                  'pages.noPages',
                                                              )}
                                                    </div>
                                                    <div className="text-footnote text-muted-foreground">
                                                        {currentStatus ===
                                                        'trash'
                                                            ? '没有页面被移至回收站'
                                                            : '开始创作你的第一个页面吧'}
                                                    </div>
                                                </div>
                                                {currentStatus !== 'trash' && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            router.visit(
                                                                pageActions.create.url(),
                                                            )
                                                        }
                                                        className="mt-2"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                        {t('pages.writeFirst')}
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    pageList.map((page) => {
                                        const isSelected = selectedIds.includes(
                                            page.id,
                                        );

                                        return (
                                            <TableRow
                                                key={page.id}
                                                className={`border-b border-border/30 transition-colors duration-200 hover:bg-muted/20 ${isSelected ? 'bg-primary/5' : ''}`}
                                            >
                                                <TableCell className="w-11 py-3.5 pr-0 pl-5">
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() =>
                                                            toggleSelect(
                                                                page.id,
                                                            )
                                                        }
                                                    />
                                                </TableCell>
                                                <TableCell className="max-w-[34rem] px-3 py-3.5">
                                                    <div className="flex items-start gap-2.5">
                                                        <Badge
                                                            variant={
                                                                STATUS_MAP[
                                                                    page.status
                                                                ]?.variant ||
                                                                'outline'
                                                            }
                                                            className="mt-0.5 shrink-0"
                                                        >
                                                            {t(
                                                                STATUS_MAP[
                                                                    page.status
                                                                ]?.label ||
                                                                    'pages.status.trash',
                                                            )}
                                                        </Badge>
                                                        {page.status ===
                                                            'publish' &&
                                                        page.permalink ? (
                                                            <a
                                                                href={
                                                                    page.permalink
                                                                }
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                title={t(
                                                                    'pages.openPage',
                                                                )}
                                                                className="text-body min-w-0 font-medium break-words hover:text-primary hover:underline"
                                                            >
                                                                {page.title}
                                                            </a>
                                                        ) : (
                                                            <span className="text-body min-w-0 font-medium break-words">
                                                                {page.title}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-3 py-3.5">
                                                    <span className="text-callout whitespace-nowrap text-muted-foreground">
                                                        {page.author_name ||
                                                            '-'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="max-w-[10rem] truncate px-3 py-3.5">
                                                    {page.slug ? (
                                                        <span className="text-callout font-mono text-muted-foreground">
                                                            {page.slug}
                                                        </span>
                                                    ) : (
                                                        <span className="text-callout text-muted-foreground/50">
                                                            -
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="px-3 py-3.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="h-4 w-4 text-muted-foreground/50" />
                                                        <span className="text-callout">
                                                            {page.created_at}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-3 py-3.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <Eye className="h-4 w-4 text-muted-foreground/50" />
                                                        <span className="text-callout tabular-nums">
                                                            {page.views}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-3 py-3.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <MessageSquare className="h-4 w-4 text-muted-foreground/50" />
                                                        {page.status ===
                                                            'publish' &&
                                                        page.permalink ? (
                                                            <a
                                                                href={`${page.permalink}#comments`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                title={t(
                                                                    'pages.viewComments',
                                                                )}
                                                                className="text-callout text-primary tabular-nums hover:underline"
                                                            >
                                                                {
                                                                    page.comment_count
                                                                }
                                                            </a>
                                                        ) : (
                                                            <span className="text-callout tabular-nums">
                                                                {
                                                                    page.comment_count
                                                                }
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-5 py-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                router.visit(
                                                                    `/admin/pages/${page.id}/edit`,
                                                                )
                                                            }
                                                            className="h-8 gap-1.5 pr-3 pl-2"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                            <span>
                                                                {t(
                                                                    'pages.edit',
                                                                )}
                                                            </span>
                                                        </Button>
                                                        {page.status ===
                                                        'trash' ? (
                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        handleRestore(
                                                                            page.id,
                                                                        )
                                                                    }
                                                                    className="h-8 gap-1.5 pr-3 pl-2 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400"
                                                                >
                                                                    <RotateCcw className="h-4 w-4" />
                                                                    <span>
                                                                        取出回收站
                                                                    </span>
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        handleForceDelete(
                                                                            page.id,
                                                                            page.title,
                                                                        )
                                                                    }
                                                                    className="h-8 gap-1.5 pr-3 pl-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                    <span>
                                                                        永久删除
                                                                    </span>
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() =>
                                                                    handleTrash(
                                                                        page.id,
                                                                    )
                                                                }
                                                                className="h-8 gap-1.5 pr-3 pl-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                <span>
                                                                    回收站
                                                                </span>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* 分页 */}
                <Pagination
                    current={pagePages.current_page}
                    last={pagePages.last_page}
                    total={pagePages.total}
                    perPage={pagePages.per_page}
                    onPageChange={(page) => {
                        const params = new URLSearchParams();

                        if (currentStatus !== 'all') {
                            params.set('status', currentStatus);
                        }

                        params.set('page', String(page));
                        router.visit(`/admin/pages?${params.toString()}`, {
                            preserveScroll: true,
                        });
                    }}
                />
            </div>

            {/* Force delete confirmation dialog */}
            <Dialog
                open={!!forceDeleteTarget}
                onOpenChange={(open) => !open && setForceDeleteTarget(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {t('pages.deleteConfirmTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('pages.deleteConfirmDescription', {
                                title: forceDeleteTarget?.title ?? '',
                            })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setForceDeleteTarget(null)}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={executeForceDelete}
                        >
                            {t('common.confirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

PageIndex.layout = {
    breadcrumbs: [
        {
            title: 'pages.allPages',
            href: pagesIndex().url,
        },
    ],
};
