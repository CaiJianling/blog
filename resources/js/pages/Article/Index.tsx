import { Head, router } from '@inertiajs/react';
import { FileText, Eye, MessageSquare, Calendar, Pencil, Plus, Search, Trash2, Send, CheckCircle, FileEdit, Inbox, RotateCcw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as articleActions from '@/actions/App/Http/Controllers/ArticleController';
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
import { index as articlesIndex } from '@/routes/articles';

interface Article {
    id: number;
    title: string;
    author_name: string;
    permalink: string;
    categories: string[];
    tags: string[];
    comment_count: number;
    created_at: string;
    views: number;
    status: string;
}

interface PaginatedArticles {
    data: Article[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

interface StatusCounts {
    all: number;
    publish: number;
    pending: number;
    draft: number;
    trash: number;
}

interface Props {
    articles: PaginatedArticles;
    statusCounts: StatusCounts;
    currentStatus: string;
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'outline' | 'destructive' | 'secondary' }> = {
    publish: { label: 'articles.status.publish', variant: 'default' },
    draft: { label: 'articles.status.draft', variant: 'secondary' },
    pending: { label: 'articles.status.pending', variant: 'outline' },
    trash: { label: 'articles.status.trash', variant: 'destructive' },
};

const STATUS_TABS = [
    { key: 'all', label: '全部' },
    { key: 'publish', label: '已发布' },
    { key: 'pending', label: '待审核' },
    { key: 'draft', label: '草稿' },
    { key: 'trash', label: '回收站' },
] as const;

export default function ArticleIndex({ articles: pageArticles, statusCounts, currentStatus }: Props) {
    const { t } = useTranslation();
    const articleList = pageArticles.data;
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
        const url = status === 'all' ? '/articles' : `/articles?status=${status}`;
        router.visit(url, { preserveScroll: true });
    };

    const allSelected = articleList.length > 0 && selectedIds.length === articleList.length;
    const someSelected = selectedIds.length > 0 && !allSelected;

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(articleList.map((a) => a.id));
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
        );
    };

    const handleBatchAction = (status: 'publish' | 'pending' | 'draft' | 'trash') => {
        router.post('/articles/batch', {
            ids: selectedIds,
            status,
        }, {
            preserveScroll: true,
            onSuccess: () => setSelectedIds([]),
        });
    };

    const handleTrash = (id: number) => {
        router.put(`/articles/${id}/trash`, {}, { preserveScroll: true });
    };

    const handleRestore = (id: number) => {
        router.put(`/articles/${id}/restore`, {}, { preserveScroll: true });
    };

    const [forceDeleteTarget, setForceDeleteTarget] = useState<{ id: number; title: string } | null>(null);

    const handleForceDelete = (id: number, title: string) => {
        setForceDeleteTarget({ id, title });
    };

    const executeForceDelete = () => {
        if (!forceDeleteTarget) {
return;
}

        router.delete(`/articles/${forceDeleteTarget.id}`, {
            preserveScroll: true,
            onFinish: () => setForceDeleteTarget(null),
        });
    };

    return (
        <>
            <Head title={t('articles.title')} />
            <div className="flex shrink-0 flex-col gap-5 overflow-x-auto p-4 sm:gap-5 sm:p-6">
                {/* Page header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-title-1 font-semibold tracking-tight">
                            {t('articles.title')}
                        </h1>
                        <p className="text-subheadline text-secondary-label">
                            管理你的所有文章内容。
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative min-w-0 flex-1 sm:flex-none">
                            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-foreground/50" />
                            <Input
                                placeholder="搜索文章..."
                                className="w-full pl-9 sm:w-56"
                            />
                        </div>
                        <Button className="shrink-0" onClick={() => router.visit(articleActions.create.url())}>
                            <Plus className="h-4 w-4" />
                            {t('articles.create')}
                        </Button>
                    </div>
                </div>

                {/* Status Filter Tabs */}
                <div className="inline-flex w-full items-center gap-1 overflow-x-auto rounded-2xl bg-neutral-200/60 p-1 backdrop-blur-sm dark:bg-neutral-700/60 sm:w-fit">
                    {STATUS_TABS.map((tab) => {
                        const isActive = currentStatus === tab.key;
                        const count = statusCounts[tab.key as keyof StatusCounts] ?? 0;

                        return (
                            <button
                                key={tab.key}
                                onClick={() => handleFilterChange(tab.key)}
                                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2 sm:text-[0.9375rem] ${
                                    isActive
                                        ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                        : 'text-muted-foreground hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800'
                                }`}
                            >
                                {tab.label}
                                <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums sm:h-5 sm:min-w-5 sm:px-1.5 sm:text-xs ${
                                    isActive
                                        ? 'bg-primary/15 text-primary'
                                        : 'bg-muted text-muted-foreground'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Overview Stats */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <Card className="!p-0 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/10">
                        <CardContent className="flex items-center justify-between p-2.5 sm:p-5">
                            <div className="flex min-w-0 flex-col gap-1 sm:gap-2">
                                <div className="text-[10px] font-medium uppercase tracking-wider text-secondary-label sm:text-footnote">
                                    全部文章
                                </div>
                                <div className="text-base font-semibold tracking-tight sm:text-title-2">
                                    {statusCounts.all}
                                </div>
                            </div>
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary sm:h-12 sm:w-12 sm:rounded-2xl">
                                <FileText className="h-4 w-4 sm:h-6 sm:w-6" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="!p-0 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/10">
                        <CardContent className="flex items-center justify-between p-2.5 sm:p-5">
                            <div className="flex min-w-0 flex-col gap-1 sm:gap-2">
                                <div className="text-[10px] font-medium uppercase tracking-wider text-secondary-label sm:text-footnote">
                                    总浏览量
                                </div>
                                <div className="text-base font-semibold tracking-tight sm:text-title-2">
                                    {articleList.reduce((sum, a) => sum + a.views, 0)}
                                </div>
                            </div>
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 sm:h-12 sm:w-12 sm:rounded-2xl">
                                <Eye className="h-4 w-4 sm:h-6 sm:w-6" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="!p-0 bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/10">
                        <CardContent className="flex items-center justify-between p-2.5 sm:p-5">
                            <div className="flex min-w-0 flex-col gap-1 sm:gap-2">
                                <div className="text-[10px] font-medium uppercase tracking-wider text-secondary-label sm:text-footnote">
                                    总评论
                                </div>
                                <div className="text-base font-semibold tracking-tight sm:text-title-2">
                                    {articleList.reduce((sum, a) => sum + a.comment_count, 0)}
                                </div>
                            </div>
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 sm:h-12 sm:w-12 sm:rounded-2xl">
                                <MessageSquare className="h-4 w-4 sm:h-6 sm:w-6" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Article Table */}
                <Card className="relative flex-1 overflow-hidden">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>
                                    {t('articles.list')}
                                </CardTitle>
                                <CardDescription>
                                    {t('articles.manageArticles')}
                                </CardDescription>
                            </div>
                            <div className="text-subheadline text-secondary-label">
                                {t('articles.articlesCount', {
                                    count: pageArticles.total,
                                })}
                            </div>
                        </div>
                    </CardHeader>

                    {/* Floating Batch Action Toolbar — translucent material overlay clipped to card radius */}
                    {showToolbar && (
                        <div className={`sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-background/70 px-4 py-3 backdrop-blur-xl backdrop-saturate-150 sm:px-6 sm:py-4 ${isExiting ? 'animate-out fade-out slide-out-to-top-2 duration-300' : 'animate-in fade-in slide-in-from-top-2 duration-300'} dark:border-white/5 dark:bg-background/60`}>
                            <div className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <CheckCircle className="h-4.5 w-4.5" />
                                </div>
                                <span className="truncate text-callout font-medium tracking-tight sm:whitespace-normal">
                                    已选择 <span className="text-primary tabular-nums">{selectedIds.length}</span> 篇文章
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 overflow-x-auto">
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
                                    onClick={() => handleBatchAction('pending')}
                                    className="gap-1.5"
                                >
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    移至待审核
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
                    <CardContent className="p-0 pb-2 sm:pb-0">
                        <Table className="min-w-[1000px]">
                            <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                    <TableHead className="h-11 w-11 pl-5 pr-0">
                                        <Checkbox
                                            checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead className="h-11 px-3 text-footnote font-semibold uppercase tracking-wider text-secondary-label">
                                        {t('articles.table.title')}
                                    </TableHead>
                                    <TableHead className="h-11 px-3 text-footnote font-semibold uppercase tracking-wider text-secondary-label">
                                        {t('articles.table.author')}
                                    </TableHead>
                                    <TableHead className="h-11 px-3 text-footnote font-semibold uppercase tracking-wider text-secondary-label">
                                        {t('articles.table.categories')}
                                    </TableHead>
                                    <TableHead className="h-11 px-3 text-footnote font-semibold uppercase tracking-wider text-secondary-label">
                                        {t('articles.table.tags')}
                                    </TableHead>
                                    <TableHead className="h-11 px-3 text-footnote font-semibold uppercase tracking-wider text-secondary-label">
                                        {t('articles.table.comments')}
                                    </TableHead>
                                    <TableHead className="h-11 px-3 text-footnote font-semibold uppercase tracking-wider text-secondary-label">
                                        {t('articles.table.date')}
                                    </TableHead>
                                    <TableHead className="h-11 px-3 text-footnote font-semibold uppercase tracking-wider text-secondary-label">
                                        {t('articles.table.views')}
                                    </TableHead>
                                    <TableHead className="h-11 px-5 text-footnote font-semibold uppercase tracking-wider text-secondary-label text-right">
                                        {t('articles.table.actions')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {articleList.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={9}
                                            className="py-12 text-center"
                                        >
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-muted text-muted-foreground/60">
                                                    {currentStatus === 'trash' ? (
                                                        <Inbox className="h-8 w-8" />
                                                    ) : (
                                                        <FileText className="h-8 w-8" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <div className="text-headline font-medium">
                                                        {currentStatus === 'trash'
                                                            ? '回收站为空'
                                                            : t('articles.noArticles')}
                                                    </div>
                                                    <div className="text-footnote text-tertiary-label">
                                                        {currentStatus === 'trash'
                                                            ? '没有文章被移至回收站'
                                                            : '开始创作你的第一篇文章吧'}
                                                    </div>
                                                </div>
                                                {currentStatus !== 'trash' && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => router.visit(articleActions.create.url())}
                                                        className="mt-2"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                        {t('articles.writeFirst')}
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    articleList.map((article) => {
                                        const isSelected = selectedIds.includes(article.id);

                                        return (
                                            <TableRow
                                                key={article.id}
                                                className={`border-b border-border/30 transition-colors duration-200 hover:bg-muted/20 ${isSelected ? 'bg-primary/5' : ''}`}
                                            >
                                                <TableCell className="w-11 pl-5 pr-0 py-3.5">
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleSelect(article.id)}
                                                    />
                                                </TableCell>
                                                <TableCell className="px-3 py-3.5">
                                                    <div className="flex items-center gap-2.5">
                                                        <Badge
                                                            variant={STATUS_MAP[article.status]?.variant || 'outline'}
                                                            className="shrink-0"
                                                        >
                                                            {t(STATUS_MAP[article.status]?.label || 'articles.status.unknown')}
                                                        </Badge>
                                                        <span className="text-body truncate font-medium">
                                                            {article.title}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-3 py-3.5">
                                                    <span className="text-callout text-secondary-label">
                                                        {article.author_name || '-'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="px-3 py-3.5">
                                                    {article.categories.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {article.categories.slice(0, 2).map((cat, i) => (
                                                                <Badge key={i} variant="outline" className="font-normal">
                                                                    {cat}
                                                                </Badge>
                                                            ))}
                                                            {article.categories.length > 2 && (
                                                                <Badge variant="outline" className="font-normal">
                                                                    +{article.categories.length - 2}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-callout text-tertiary-label">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="px-3 py-3.5">
                                                    {article.tags.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {article.tags.slice(0, 2).map((tag, i) => (
                                                                <Badge key={i} variant="secondary" className="font-normal">
                                                                    #{tag}
                                                                </Badge>
                                                            ))}
                                                            {article.tags.length > 2 && (
                                                                <Badge variant="secondary" className="font-normal">
                                                                    +{article.tags.length - 2}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-callout text-tertiary-label">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="px-3 py-3.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <MessageSquare className="h-4 w-4 text-tertiary-label" />
                                                        {article.status === 'publish' && article.permalink ? (
                                                            <a
                                                                href={`${article.permalink}#comments`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                title={t('articles.viewComments')}
                                                                className="text-callout tabular-nums text-primary hover:underline"
                                                            >
                                                                {article.comment_count}
                                                            </a>
                                                        ) : (
                                                            <span className="text-callout tabular-nums">{article.comment_count}</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-3 py-3.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="h-4 w-4 text-tertiary-label" />
                                                        <span className="text-callout">{article.created_at}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-3 py-3.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <Eye className="h-4 w-4 text-tertiary-label" />
                                                        <span className="text-callout tabular-nums">{article.views}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-5 py-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => router.visit(`/articles/${article.id}/edit`)}
                                                            className="h-8 gap-1.5 pl-2 pr-3"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                            <span>{t('articles.edit')}</span>
                                                        </Button>
                                                        {article.status === 'trash' ? (
                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleRestore(article.id)}
                                                                    className="h-8 gap-1.5 pl-2 pr-3 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400"
                                                                >
                                                                    <RotateCcw className="h-4 w-4" />
                                                                    <span>取出回收站</span>
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleForceDelete(article.id, article.title)}
                                                                    className="h-8 gap-1.5 pl-2 pr-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                    <span>永久删除</span>
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleTrash(article.id)}
                                                                className="h-8 gap-1.5 pl-2 pr-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                <span>回收站</span>
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
                    current={pageArticles.current_page}
                    last={pageArticles.last_page}
                    total={pageArticles.total}
                    perPage={pageArticles.per_page}
                    onPageChange={(page) => {
                        const params = new URLSearchParams();

                        if (currentStatus !== 'all') {
                            params.set('status', currentStatus);
                        }

                        params.set('page', String(page));
                        router.visit(`/articles?${params.toString()}`, { preserveScroll: true });
                    }}
                />
            </div>

            {/* Force delete confirmation dialog */}
            <Dialog open={!!forceDeleteTarget} onOpenChange={(open) => !open && setForceDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('articles.deleteConfirmTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('articles.deleteConfirmDescription', { title: forceDeleteTarget?.title ?? '' })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setForceDeleteTarget(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button variant="destructive" onClick={executeForceDelete}>
                            {t('common.confirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

ArticleIndex.layout = {
    breadcrumbs: [
        {
            title: 'articles.allArticles',
            href: articlesIndex().url,
        },
    ],
};
