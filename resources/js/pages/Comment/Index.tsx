import { Head, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    MessageSquare,
    Search,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Trash2,
    RotateCcw,
    MoreVertical,
    ChevronDown,
    User,
    Calendar,
    Reply,
    Pencil,
    Zap,
} from 'lucide-react';
import * as commentActions from '@/actions/App/Http/Controllers/CommentController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Card,
    CardContent,
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from '@/components/ui/dialog';

interface Comment {
    comment_id: number;
    author_name: string;
    author_email: string;
    author_url: string;
    ip: string;
    content: string;
    like_num: number;
    status: string;
    status_text: string;
    parent_id: number;
    object_id: number;
    object_type: string;
    related_title: string | null;
    related_slug: string | null;
    created_at: string;
    created_at_human: string;
    is_author: boolean;
}

interface PaginatedComments {
    data: Comment[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

interface StatusCounts {
    all: number;
    mine: number;
    '0': number;
    '1': number;
    spam: number;
    trash: number;
}

interface Props {
    comments: PaginatedComments;
    statusCounts: StatusCounts;
    currentStatus: string;
    currentObjectType: string;
    currentSearch: string;
}

const STATUS_TABS = [
    { key: 'all', label: '全部' },
    { key: 'mine', label: '我的' },
    { key: '0', label: '待审' },
    { key: '1', label: '已批准' },
    { key: 'spam', label: '垃圾' },
    { key: 'trash', label: '回收站' },
] as const;

export default function CommentIndex({ comments: pageComments, statusCounts, currentStatus, currentObjectType, currentSearch }: Props) {
    const { t } = useTranslation();
    const commentList = pageComments.data;
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [showToolbar, setShowToolbar] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [searchInput, setSearchInput] = useState(currentSearch);
    const [actionDialog, setActionDialog] = useState<{ open: boolean; action: string; commentIds: number[] }>({ open: false, action: '', commentIds: [] });

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

    const buildUrl = (status: string, objectType: string, page: number, search: string) => {
        const params = new URLSearchParams();
        if (status !== 'all') params.set('status', status);
        if (objectType !== 'all') params.set('object_type', objectType);
        if (search) params.set('search', search);
        if (page > 1) params.set('page', String(page));
        const qs = params.toString();
        return `/comments${qs ? `?${qs}` : ''}`;
    };

    const handleFilterChange = (status: string) => {
        router.visit(buildUrl(status, currentObjectType, 1, currentSearch), { preserveScroll: true });
    };

    const handleObjectTypeChange = (type: string) => {
        router.visit(buildUrl(currentStatus, type, 1, currentSearch), { preserveScroll: true });
    };

    const handleSearch = () => {
        router.visit(buildUrl(currentStatus, currentObjectType, 1, searchInput), { preserveScroll: true });
    };

    const allSelected = commentList.length > 0 && selectedIds.length === commentList.length;
    const someSelected = selectedIds.length > 0 && !allSelected;

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(commentList.map((c) => c.comment_id));
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
        );
    };

    const handleSingleAction = (commentId: number, action: 'approve' | 'reject' | 'spam' | 'trash' | 'restore' | 'delete') => {
        if (action === 'delete') {
            router.delete(commentActions.destroy.url({ comment: commentId }), { preserveScroll: true });
            return;
        }
        const urlMap = {
            approve: commentActions.approve.url({ comment: commentId }),
            reject: commentActions.reject.url({ comment: commentId }),
            spam: commentActions.spam.url({ comment: commentId }),
            trash: commentActions.trash.url({ comment: commentId }),
            restore: commentActions.restore.url({ comment: commentId }),
        };
        router.put(urlMap[action], {}, { preserveScroll: true });
    };

    const handleBatchAction = (action: 'approve' | 'reject' | 'spam' | 'trash' | 'restore' | 'delete') => {
        router.post(commentActions.batchUpdate.url(), {
            ids: selectedIds,
            action,
        }, {
            preserveScroll: true,
            onSuccess: () => setSelectedIds([]),
        });
    };

    const openBatchDialog = (action: string) => {
        setActionDialog({ open: true, action, commentIds: selectedIds });
    };

    const confirmBatchAction = () => {
        handleBatchAction(actionDialog.action as any);
        setActionDialog({ open: false, action: '', commentIds: [] });
    };

    const openSingleDialog = (commentId: number, action: string) => {
        setActionDialog({ open: true, action, commentIds: [commentId] });
    };

    const confirmSingleAction = () => {
        if (actionDialog.commentIds.length === 1) {
            handleSingleAction(actionDialog.commentIds[0], actionDialog.action as any);
        } else {
            confirmBatchAction();
        }
        setActionDialog({ open: false, action: '', commentIds: [] });
    };

    const actionLabels: Record<string, string> = {
        approve: t('comments.approve'),
        reject: t('comments.reject'),
        spam: t('comments.markSpam'),
        trash: t('comments.moveTrash'),
        restore: t('comments.restore'),
        delete: t('comments.delete'),
    };

    const actionConfirmText = () => {
        const count = actionDialog.commentIds.length;
        const action = actionLabels[actionDialog.action];
        if (count === 1) {
            return `确定要${action}这${count}条评论吗？`;
        }
        return `确定要${action}选中的 ${count} 条评论吗？`;
    };

    return (
        <>
            <Head title={t('comments.title')} />
            <div className="flex h-full flex-1 flex-col gap-5 overflow-x-auto p-6">
                {/* Page header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-title-1 font-semibold tracking-tight">
                            {t('comments.title')}
                        </h1>
                        <p className="text-subheadline text-muted-foreground">
                            管理站点所有评论。
                        </p>
                    </div>
                </div>

                {/* Status Filter Tabs */}
                <div className="inline-flex self-start items-center gap-1 overflow-x-auto rounded-2xl bg-neutral-200/60 p-1 backdrop-blur-sm dark:bg-neutral-700/60">
                    {STATUS_TABS.map((tab) => {
                        const isActive = currentStatus === tab.key;
                        const count = statusCounts[tab.key as keyof StatusCounts] ?? 0;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => handleFilterChange(tab.key)}
                                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-callout font-medium transition-all duration-200 ${
                                    isActive
                                        ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                        : 'text-muted-foreground hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800'
                                }`}
                            >
                                {tab.label}
                                <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-caption font-semibold tabular-nums ${
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

                {/* Filter bar: bulk action + object type filter + search */}
                <div className="flex flex-wrap items-center gap-2">
                    <Select onValueChange={handleObjectTypeChange} value={currentObjectType}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder={t('comments.allTypes')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('comments.allTypes')}</SelectItem>
                            <SelectItem value="article">{t('comments.typeArticle')}</SelectItem>
                            <SelectItem value="page">{t('comments.typePage')}</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="relative w-64">
                        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-foreground/50" />
                        <Input
                            placeholder={t('comments.searchPlaceholder')}
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="pl-9"
                        />
                    </div>
                </div>

                {/* Comment Table */}
                <Card className="relative flex-1 overflow-hidden">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-base">{t('comments.title')}</CardTitle>
                                <Badge variant="secondary" className="font-normal">
                                    {pageComments.total} {t('comments.items')}
                                </Badge>
                            </div>
                            <div className="text-subheadline text-muted-foreground">
                                {pageComments.total} {t('comments.commentsCount')}
                            </div>
                        </div>
                    </CardHeader>

                    {/* Floating Batch Action Toolbar */}
                    {showToolbar && (
                        <div className={`absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 border-b border-border/40 bg-background/70 px-6 py-4 backdrop-blur-xl backdrop-saturate-150 ${isExiting ? 'animate-out fade-out slide-out-to-top-2 duration-300' : 'animate-in fade-in slide-in-from-top-2 duration-300'}`}>
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <CheckCircle className="h-4.5 w-4.5" />
                                </div>
                                <span className="text-callout font-medium tracking-tight">
                                    {t('comments.selected', { count: selectedIds.length })}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="sm" className="gap-1.5">
                                            {t('comments.batchAction')}
                                            <ChevronDown className="h-3.5 w-3.5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-44">
                                        <DropdownMenuItem onClick={() => openBatchDialog('approve')}>
                                            <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                                            {t('comments.approve')}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openBatchDialog('reject')}>
                                            <XCircle className="mr-2 h-4 w-4 text-orange-500" />
                                            {t('comments.reject')}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openBatchDialog('spam')}>
                                            <AlertTriangle className="mr-2 h-4 w-4 text-yellow-500" />
                                            {t('comments.markSpam')}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openBatchDialog('trash')}>
                                            <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                                            {t('comments.moveTrash')}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => openBatchDialog('restore')}>
                                            <RotateCcw className="mr-2 h-4 w-4 text-blue-500" />
                                            {t('comments.restore')}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openBatchDialog('delete')} className="text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            {t('comments.delete')}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])} className="ml-1">
                                    {t('comments.cancel')}
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
                                    <TableHead className="h-11 px-3 text-footnote font-semibold uppercase tracking-wider text-muted-foreground">
                                        {t('comments.author')}
                                    </TableHead>
                                    <TableHead className="h-11 px-3 text-footnote font-semibold uppercase tracking-wider text-muted-foreground">
                                        {t('comments.comment')}
                                    </TableHead>
                                    <TableHead className="h-11 px-3 text-footnote font-semibold uppercase tracking-wider text-muted-foreground">
                                        {t('comments.replyTo')}
                                    </TableHead>
                                    <TableHead className="h-11 px-3 text-footnote font-semibold uppercase tracking-wider text-muted-foreground">
                                        {t('comments.submittedAt')}
                                    </TableHead>
                                    <TableHead className="h-11 px-5 text-footnote font-semibold uppercase tracking-wider text-muted-foreground text-right">
                                        {t('comments.actions')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {commentList.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-muted text-muted-foreground/60">
                                                    <MessageSquare className="h-8 w-8" />
                                                </div>
                                                <div className="text-headline font-medium">{t('comments.noComments')}</div>
                                                <div className="text-footnote text-muted-foreground">{t('comments.noCommentsDesc')}</div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    commentList.map((comment) => {
                                        const isSelected = selectedIds.includes(comment.comment_id);
                                        return (
                                            <TableRow
                                                key={comment.comment_id}
                                                className={`border-b border-border/30 transition-colors duration-200 hover:bg-muted/20 ${isSelected ? 'bg-primary/5' : ''}`}
                                            >
                                                <TableCell className="w-11 pl-5 pr-0 py-3.5 align-top">
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleSelect(comment.comment_id)}
                                                    />
                                                </TableCell>
                                                <TableCell className="px-3 py-3.5 align-top">
                                                    <div className="flex items-start gap-2.5">
                                                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                                                            <User className="h-4 w-4" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-body font-medium text-foreground">
                                                                {comment.author_name}
                                                                {comment.is_author && (
                                                                    <span className="ml-1 text-caption text-primary">({t('comments.author')})</span>
                                                                )}
                                                            </span>
                                                            {comment.author_email && (
                                                                <span className="text-caption text-muted-foreground">
                                                                    {comment.author_email}
                                                                </span>
                                                            )}
                                                            {comment.ip && (
                                                                <span className="text-caption text-muted-foreground">
                                                                    {comment.ip}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-3 py-3.5 align-top">
                                                    <div className="max-w-md">
                                                        <p className="text-body leading-relaxed text-foreground">
                                                            {comment.content}
                                                        </p>
                                                        <div className="mt-1 flex items-center gap-2 text-caption text-muted-foreground">
                                                            {comment.like_num > 0 && (
                                                                <span className="inline-flex items-center gap-1">
                                                                    <CheckCircle className="h-3 w-3" />
                                                                    {comment.like_num}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-3 py-3.5 align-top">
                                                    {comment.related_title ? (
                                                        <div className="flex flex-col gap-1">
                                                            <Badge variant="outline" className="w-fit font-normal">
                                                                {comment.object_type === 'article' ? t('comments.typeArticle') : t('comments.typePage')}
                                                            </Badge>
                                                            <a
                                                                href={`/${comment.object_type === 'article' ? 'articles' : 'pages'}/${comment.object_id}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-callout font-medium text-primary hover:underline"
                                                            >
                                                                {comment.related_title}
                                                            </a>
                                                        </div>
                                                    ) : (
                                                        <span className="text-callout text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="px-3 py-3.5 align-top">
                                                    <div className="flex items-center gap-1.5 text-callout">
                                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-muted-foreground">{comment.created_at}</span>
                                                    </div>
                                                    <div className="text-caption text-muted-foreground">
                                                        {comment.created_at_human}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-5 py-3.5 align-top text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {comment.status === 'trash' ? (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => openSingleDialog(comment.comment_id, 'restore')}
                                                                    className="h-8 gap-1 pl-2 pr-3 text-blue-600 hover:bg-blue-500/10 hover:text-blue-600 dark:text-blue-400"
                                                                >
                                                                    <RotateCcw className="h-4 w-4" />
                                                                    {t('comments.restore')}
                                                                </Button>
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                                            <MoreVertical className="h-4 w-4" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="w-36">
                                                                        <DropdownMenuItem onClick={() => openSingleDialog(comment.comment_id, 'restore')}>
                                                                            <RotateCcw className="mr-2 h-4 w-4" />
                                                                            {t('comments.restore')}
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem onClick={() => openSingleDialog(comment.comment_id, 'delete')} className="text-destructive">
                                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                                            {t('comments.delete')}
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </>
                                                        ) : (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                                        <MoreVertical className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-40">
                                                                    <DropdownMenuItem onClick={() => openSingleDialog(comment.comment_id, 'reject')}>
                                                                        <XCircle className="mr-2 h-4 w-4" />
                                                                        {t('comments.reject')}
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => openSingleDialog(comment.comment_id, 'reply')}>
                                                                        <Reply className="mr-2 h-4 w-4" />
                                                                        {t('comments.reply')}
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => openSingleDialog(comment.comment_id, 'quickEdit')}>
                                                                        <Zap className="mr-2 h-4 w-4" />
                                                                        {t('comments.quickEdit')}
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => openSingleDialog(comment.comment_id, 'edit')}>
                                                                        <Pencil className="mr-2 h-4 w-4" />
                                                                        {t('comments.edit')}
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem onClick={() => openSingleDialog(comment.comment_id, 'spam')} className="text-yellow-500">
                                                                        <AlertTriangle className="mr-2 h-4 w-4" />
                                                                        {t('comments.markSpam')}
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => openSingleDialog(comment.comment_id, 'trash')} className="text-destructive">
                                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                                        {t('comments.moveTrash')}
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
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
                {pageComments.last_page > 1 && (
                    <div className="flex items-center justify-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pageComments.current_page === 1}
                            onClick={() => {
                                router.visit(buildUrl(currentStatus, currentObjectType, pageComments.current_page - 1, currentSearch), { preserveScroll: true });
                            }}
                        >
                            {t('comments.prevPage')}
                        </Button>
                        <span className="text-callout text-muted-foreground tabular-nums">
                            {pageComments.current_page} / {pageComments.last_page}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={pageComments.current_page === pageComments.last_page}
                            onClick={() => {
                                router.visit(buildUrl(currentStatus, currentObjectType, pageComments.current_page + 1, currentSearch), { preserveScroll: true });
                            }}
                        >
                            {t('comments.nextPage')}
                        </Button>
                    </div>
                )}
            </div>

            {/* Action Confirmation Dialog */}
            <Dialog open={actionDialog.open} onOpenChange={(open) => !open && setActionDialog({ open: false, action: '', commentIds: [] })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{actionLabels[actionDialog.action]}</DialogTitle>
                        <DialogDescription>{actionConfirmText()}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">{t('comments.cancel')}</Button>
                        </DialogClose>
                        <Button onClick={confirmSingleAction} variant={actionDialog.action === 'trash' ? 'destructive' : 'default'}>
                            {actionLabels[actionDialog.action]}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
