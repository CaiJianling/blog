import { Head, router } from '@inertiajs/react';
import { FileText, Eye, MessageSquare, Calendar, Pencil, Plus, Search, Trash2, Send, CheckCircle, FileEdit, Inbox, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import * as articleActions from '@/actions/App/Http/Controllers/ArticleController';

interface Article {
    id: number;
    title: string;
    author_name: string;
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

    return (
        <>
            <Head title={t('articles.title')} />
            <div className="flex h-full flex-1 flex-col gap-5 overflow-x-auto p-6">
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
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-foreground/50" />
                            <Input
                                placeholder="搜索文章..."
                                className="w-56 pl-9"
                            />
                        </div>
                        <Button onClick={() => router.visit(articleActions.create.url())}>
                            <Plus className="h-4 w-4" />
                            {t('articles.create')}
                        </Button>
                    </div>
                </div>

                {/* Status Filter Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto rounded-2xl bg-muted/40 p-1 backdrop-blur-sm">
                    {STATUS_TABS.map((tab) => {
                        const isActive = currentStatus === tab.key;
                        const count = statusCounts[tab.key as keyof StatusCounts] ?? 0;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => handleFilterChange(tab.key)}
                                className={`apple-press flex items-center gap-2 rounded-xl px-4 py-2 text-callout font-medium transition-all duration-200 ${
                                    isActive
                                        ? 'bg-background text-foreground shadow-apple-xs'
                                        : 'text-secondary-label hover:text-foreground'
                                }`}
                            >
                                {tab.label}
                                <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-caption font-semibold tabular-nums ${
                                    isActive
                                        ? 'bg-primary/15 text-primary'
                                        : 'bg-muted text-tertiary-label'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Overview Stats */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="!p-0 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/10">
                        <CardContent className="flex items-center justify-between p-5">
                            <div className="flex flex-col gap-1">
                                <div className="text-footnote font-medium uppercase tracking-wider text-secondary-label">
                                    全部文章
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
                    <Card className="!p-0 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/10">
                        <CardContent className="flex items-center justify-between p-5">
                            <div className="flex flex-col gap-1">
                                <div className="text-footnote font-medium uppercase tracking-wider text-secondary-label">
                                    总浏览量
                                </div>
                                <div className="text-title-2 font-semibold tracking-tight">
                                    {articleList.reduce((sum, a) => sum + a.views, 0)}
                                </div>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                <Eye className="h-6 w-6" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="!p-0 bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/10">
                        <CardContent className="flex items-center justify-between p-5">
                            <div className="flex flex-col gap-1">
                                <div className="text-footnote font-medium uppercase tracking-wider text-secondary-label">
                                    总评论
                                </div>
                                <div className="text-title-2 font-semibold tracking-tight">
                                    {articleList.reduce((sum, a) => sum + a.comment_count, 0)}
                                </div>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                                <MessageSquare className="h-6 w-6" />
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
                        <div className={`absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-background/70 px-6 py-4 backdrop-blur-xl backdrop-saturate-150 ${isExiting ? 'animate-out fade-out slide-out-to-top-2 duration-300' : 'animate-in fade-in slide-in-from-top-2 duration-300'} dark:border-white/5 dark:bg-background/60`}>
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <CheckCircle className="h-4.5 w-4.5" />
                                </div>
                                <span className="text-callout font-medium tracking-tight">
                                    已选择 <span className="text-primary tabular-nums">{selectedIds.length}</span> 篇文章
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
                    <CardContent className="p-0">
                        <Table>
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
                                                        <span className="text-callout tabular-nums">{article.comment_count}</span>
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
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleRestore(article.id)}
                                                                className="h-8 gap-1.5 pl-2 pr-3 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400"
                                                            >
                                                                <RotateCcw className="h-4 w-4" />
                                                                <span>取出回收站</span>
                                                            </Button>
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

                {/* Pagination */}
                {pageArticles.last_page > 1 && (
                    <div className="flex items-center justify-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pageArticles.current_page === 1}
                            onClick={() => {
                                const params = new URLSearchParams();
                                if (currentStatus !== 'all') params.set('status', currentStatus);
                                params.set('page', String(pageArticles.current_page - 1));
                                router.visit(`/articles?${params.toString()}`, { preserveScroll: true });
                            }}
                        >
                            上一页
                        </Button>
                        <span className="text-callout text-secondary-label tabular-nums">
                            {pageArticles.current_page} / {pageArticles.last_page}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pageArticles.current_page === pageArticles.last_page}
                            onClick={() => {
                                const params = new URLSearchParams();
                                if (currentStatus !== 'all') params.set('status', currentStatus);
                                params.set('page', String(pageArticles.current_page + 1));
                                router.visit(`/articles?${params.toString()}`, { preserveScroll: true });
                            }}
                        >
                            下一页
                        </Button>
                    </div>
                )}
            </div>
        </>
    );
}
