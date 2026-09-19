import { Head, router } from '@inertiajs/react';
import {
    MessageCircle,
    Eye,
    Trash2,
    Pencil,
    Plus,
    Send,
    FileEdit,
    Inbox,
    RotateCcw,
    Heart,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as momentActions from '@/actions/App/Http/Controllers/MomentsController';
import Pagination from '@/components/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface Moment {
    id: number;
    snippet: string;
    author_name: string;
    permalink: string;
    comment_count: number;
    views: number;
    likes: number;
    status: string;
    created_at: string;
}

interface PaginatedMoments {
    data: Moment[];
    current_page: number;
    last_page: number;
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
    moments: PaginatedMoments;
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

export default function MomentsIndex({
    moments: pageMoments,
    statusCounts,
    currentStatus,
}: Props) {
    const { t } = useTranslation();
    const momentList = pageMoments.data;
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [forceDeleteTarget, setForceDeleteTarget] = useState<{
        id: number;
        snippet: string;
    } | null>(null);

    const allSelected =
        momentList.length > 0 && selectedIds.length === momentList.length;
    const someSelected = selectedIds.length > 0 && !allSelected;

    const toggleSelectAll = () => {
        setSelectedIds(allSelected ? [] : momentList.map((m) => m.id));
    };

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) =>
            prev.includes(id)
                ? prev.filter((sid) => sid !== id)
                : [...prev, id],
        );
    };

    const handleFilterChange = (status: string) => {
        const url =
            status === 'all'
                ? '/moments-admin'
                : `/moments-admin?status=${status}`;
        router.visit(url, { preserveScroll: true });
    };

    const handleBatchAction = (
        status: 'publish' | 'pending' | 'draft' | 'trash',
    ) => {
        router.post(
            momentActions.batchUpdate.url(),
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

    const executeForceDelete = () => {
        if (!forceDeleteTarget) {
            return;
        }

        router.delete(momentActions.destroy.url(forceDeleteTarget.id), {
            preserveScroll: true,
            onFinish: () => setForceDeleteTarget(null),
        });
    };

    return (
        <>
            <Head title={t('moments.title')} />
            <div className="flex shrink-0 flex-col gap-5 overflow-x-auto p-4 sm:p-6">
                {/* 页头 */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-title-1 font-semibold tracking-tight">
                            {t('moments.title')}
                        </h1>
                        <p className="text-subheadline text-secondary-label">
                            {t('moments.description')}
                        </p>
                    </div>
                    <Button
                        className="shrink-0"
                        onClick={() => router.visit(momentActions.create.url())}
                    >
                        <Plus className="h-4 w-4" />
                        {t('moments.create')}
                    </Button>
                </div>

                {/* 状态筛选 */}
                <div className="inline-flex w-full items-center gap-1 overflow-x-auto rounded-2xl bg-neutral-200/60 p-1 backdrop-blur-sm sm:w-fit dark:bg-neutral-700/60">
                    {STATUS_TABS.map((tab) => {
                        const isActive = currentStatus === tab.key;
                        const count =
                            statusCounts[tab.key as keyof StatusCounts] ?? 0;

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
                                <span
                                    className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums sm:h-5 sm:min-w-5 sm:px-1.5 sm:text-xs ${
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

                {/* 概览 */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <Card className="border-primary/10 bg-gradient-to-br from-primary/5 to-primary/10 !p-0">
                        <CardContent className="flex items-center justify-between p-2.5 sm:p-5">
                            <div className="flex min-w-0 flex-col gap-1 sm:gap-2">
                                <div className="text-secondary-label sm:text-footnote text-[10px] font-medium tracking-wider uppercase">
                                    {t('moments.stats.all')}
                                </div>
                                <div className="sm:text-title-2 text-base font-semibold tracking-tight">
                                    {statusCounts.all}
                                </div>
                            </div>
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary sm:h-12 sm:w-12 sm:rounded-2xl">
                                <MessageCircle className="h-4 w-4 sm:h-6 sm:w-6" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-rose-500/10 bg-gradient-to-br from-rose-500/5 to-rose-500/10 !p-0">
                        <CardContent className="flex items-center justify-between p-2.5 sm:p-5">
                            <div className="flex min-w-0 flex-col gap-1 sm:gap-2">
                                <div className="text-secondary-label sm:text-footnote text-[10px] font-medium tracking-wider uppercase">
                                    {t('moments.stats.likes')}
                                </div>
                                <div className="sm:text-title-2 text-base font-semibold tracking-tight">
                                    {momentList.reduce(
                                        (sum, m) => sum + m.likes,
                                        0,
                                    )}
                                </div>
                            </div>
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 sm:h-12 sm:w-12 sm:rounded-2xl dark:text-rose-400">
                                <Heart className="h-4 w-4 sm:h-6 sm:w-6" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-blue-500/10 bg-gradient-to-br from-blue-500/5 to-blue-500/10 !p-0">
                        <CardContent className="flex items-center justify-between p-2.5 sm:p-5">
                            <div className="flex min-w-0 flex-col gap-1 sm:gap-2">
                                <div className="text-secondary-label sm:text-footnote text-[10px] font-medium tracking-wider uppercase">
                                    {t('moments.stats.comments')}
                                </div>
                                <div className="sm:text-title-2 text-base font-semibold tracking-tight">
                                    {momentList.reduce(
                                        (sum, m) => sum + m.comment_count,
                                        0,
                                    )}
                                </div>
                            </div>
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 sm:h-12 sm:w-12 sm:rounded-2xl dark:text-blue-400">
                                <Eye className="h-4 w-4 sm:h-6 sm:w-6" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 批量操作条 */}
                {selectedIds.length > 0 && (
                    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-background/70 px-4 py-3 backdrop-blur-xl backdrop-saturate-150 dark:border-white/5 dark:bg-background/60">
                        <span className="text-callout font-medium tracking-tight">
                            已选择{' '}
                            <span className="text-primary tabular-nums">
                                {selectedIds.length}
                            </span>{' '}
                            条说说
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
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
                                移至草稿
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
                            >
                                取消
                            </Button>
                        </div>
                    </div>
                )}

                {/* 说说列表 */}
                <Card className="relative flex-1 overflow-hidden">
                    <CardContent className="p-2 sm:p-4">
                        {momentList.length > 0 && (
                            <label className="flex cursor-pointer items-center gap-2.5 px-2 pb-2 sm:px-3">
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
                                <span className="text-footnote text-muted-foreground">
                                    全选本页
                                </span>
                            </label>
                        )}
                        {momentList.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-12">
                                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-muted text-muted-foreground/60">
                                    {currentStatus === 'trash' ? (
                                        <Inbox className="h-8 w-8" />
                                    ) : (
                                        <MessageCircle className="h-8 w-8" />
                                    )}
                                </div>
                                <div className="flex flex-col gap-1 text-center">
                                    <div className="text-headline font-medium">
                                        {currentStatus === 'trash'
                                            ? '回收站为空'
                                            : t('moments.empty')}
                                    </div>
                                    <div className="text-footnote text-tertiary-label">
                                        {t('moments.emptyHint')}
                                    </div>
                                </div>
                                {currentStatus !== 'trash' && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-2"
                                        onClick={() =>
                                            router.visit(
                                                momentActions.create.url(),
                                            )
                                        }
                                    >
                                        <Plus className="h-4 w-4" />
                                        {t('moments.create')}
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col divide-y divide-border/30">
                                {momentList.map((moment) => {
                                    const isSelected = selectedIds.includes(
                                        moment.id,
                                    );

                                    return (
                                        <div
                                            key={moment.id}
                                            className={`flex items-start gap-3 px-2 py-3.5 transition-colors sm:px-3 ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/20'}`}
                                        >
                                            <Checkbox
                                                className="mt-1"
                                                checked={isSelected}
                                                onCheckedChange={() =>
                                                    toggleSelect(moment.id)
                                                }
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-body line-clamp-2">
                                                    {moment.snippet ||
                                                        '（无文字内容）'}
                                                </p>
                                                <div className="text-footnote text-tertiary-label mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                                                    <Badge
                                                        variant={
                                                            STATUS_MAP[
                                                                moment.status
                                                            ]?.variant ||
                                                            'outline'
                                                        }
                                                        className="h-5 px-1.5 text-[11px]"
                                                    >
                                                        {t(
                                                            STATUS_MAP[
                                                                moment.status
                                                            ]?.label ||
                                                                'articles.status.unknown',
                                                        )}
                                                    </Badge>
                                                    <span>
                                                        {moment.author_name ||
                                                            '-'}
                                                    </span>
                                                    <span>
                                                        {moment.created_at}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1">
                                                        <Eye className="h-3 w-3" />
                                                        {moment.views}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1">
                                                        <Heart className="h-3 w-3" />
                                                        {moment.likes}
                                                    </span>
                                                    {moment.status ===
                                                        'publish' && (
                                                        <a
                                                            href={
                                                                moment.permalink
                                                            }
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-primary hover:underline"
                                                        >
                                                            {t('moments.view')}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1">
                                                {moment.status === 'trash' ? (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                router.put(
                                                                    momentActions.restore.url(
                                                                        moment.id,
                                                                    ),
                                                                    {},
                                                                    {
                                                                        preserveScroll: true,
                                                                    },
                                                                )
                                                            }
                                                            className="h-8 gap-1.5 pr-3 pl-2 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400"
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                            恢复
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                setForceDeleteTarget(
                                                                    {
                                                                        id: moment.id,
                                                                        snippet:
                                                                            moment.snippet,
                                                                    },
                                                                )
                                                            }
                                                            className="h-8 gap-1.5 pr-3 pl-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            永久删除
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                router.visit(
                                                                    momentActions.edit.url(
                                                                        moment.id,
                                                                    ),
                                                                )
                                                            }
                                                            className="h-8 gap-1.5 pr-3 pl-2"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                            {t('moments.edit')}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                router.put(
                                                                    momentActions.trash.url(
                                                                        moment.id,
                                                                    ),
                                                                    {},
                                                                    {
                                                                        preserveScroll: true,
                                                                    },
                                                                )
                                                            }
                                                            className="h-8 gap-1.5 pr-3 pl-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            回收站
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {pageMoments.last_page > 1 && (
                    <Pagination
                        current={pageMoments.current_page}
                        last={pageMoments.last_page}
                        total={pageMoments.total}
                        perPage={10}
                        onPageChange={(page) => {
                            const params = new URLSearchParams();

                            if (currentStatus !== 'all') {
                                params.set('status', currentStatus);
                            }

                            params.set('page', String(page));
                            router.visit(
                                `/moments-admin?${params.toString()}`,
                                { preserveScroll: true },
                            );
                        }}
                    />
                )}
            </div>

            {/* 永久删除确认 */}
            <Dialog
                open={!!forceDeleteTarget}
                onOpenChange={(open) => !open && setForceDeleteTarget(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {t('moments.deleteConfirmTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('moments.deleteConfirmDescription')}
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

MomentsIndex.layout = {
    breadcrumbs: [
        {
            title: 'moments.title',
            href: '/moments-admin',
        },
    ],
};
