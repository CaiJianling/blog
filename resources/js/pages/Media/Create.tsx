import { Head, router } from '@inertiajs/react';
import {
    UploadCloud,
    File as FileIcon,
    Image as ImageIcon,
    Video,
    X,
    Check,
    AlertCircle,
    ArrowLeft,
    Loader2,
} from 'lucide-react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type UploadStatus = 'uploading' | 'success' | 'error';

interface UploadItem {
    id: string;
    file: File;
    status: UploadStatus;
    progress: number;
    error?: string;
    previewUrl?: string;
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileKind(file: File): 'image' | 'video' | 'document' {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    return 'document';
}

function getFileIcon(file: File) {
    switch (getFileKind(file)) {
        case 'image':
            return ImageIcon;
        case 'video':
            return Video;
        default:
            return FileIcon;
    }
}

export default function MediaCreate() {
    const { t } = useTranslation();
    const [items, setItems] = useState<UploadItem[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragCounter = useRef(0);

    const uploadFiles = useCallback(async (fileList: FileList | File[]) => {
        const files = Array.from(fileList);
        if (files.length === 0) return;

        setIsProcessing(true);

        // 1) 先把所有文件加入队列，状态为 uploading / 0%
        const newItems: UploadItem[] = files.map((file) => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            status: 'uploading' as UploadStatus,
            progress: 0,
            previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        }));

        setItems((prev) => [...newItems, ...prev]);

        // 2) 构造 FormData 并发起上传
        const formData = new FormData();
        files.forEach((file) => formData.append('files[]', file));

        const itemIds = newItems.map((i) => i.id);

        const updateItems = (updater: (item: UploadItem) => UploadItem) => {
            setItems((prev) =>
                prev.map((item) => (itemIds.includes(item.id) ? updater(item) : item)),
            );
        };

        // 获取 CSRF token：优先 meta 标签，回退到 XSRF-TOKEN cookie
        const getCsrfToken = (): { headerName: string; value: string } | null => {
            const meta = document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content');
            if (meta) {
                return { headerName: 'X-CSRF-TOKEN', value: meta };
            }
            // Laravel 自动写入的 XSRF-TOKEN cookie，需 URL decode 后用 X-XSRF-TOKEN 头发送
            const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
            if (match?.[1]) {
                return {
                    headerName: 'X-XSRF-TOKEN',
                    value: decodeURIComponent(match[1]),
                };
            }
            return null;
        };

        try {
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/attachments');
                xhr.withCredentials = true; // 携带 session cookie

                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const progress = Math.round((e.loaded / e.total) * 100);
                        updateItems((item) => ({ ...item, progress }));
                    }
                });

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 400) {
                        resolve();
                    } else {
                        // 尝试解析 Inertia / Laravel 错误
                        let message = `Upload failed (HTTP ${xhr.status})`;
                        try {
                            const json = JSON.parse(xhr.responseText);
                            if (json?.errors?.upload) {
                                message = json.errors.upload.join('；');
                            } else if (json?.errors?.['files.0']) {
                                message = json.errors['files.0'].join('；');
                            } else if (json?.message) {
                                message = json.message;
                            }
                        } catch {
                            // 非 JSON 响应，使用默认消息
                        }
                        reject(new Error(message));
                    }
                };

                xhr.onerror = () => reject(new Error('Network error'));

                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                xhr.setRequestHeader('Accept', 'application/json');

                const csrf = getCsrfToken();
                if (csrf) {
                    xhr.setRequestHeader(csrf.headerName, csrf.value);
                } else {
                    reject(new Error('CSRF token not found. Please refresh the page.'));
                    return;
                }

                xhr.send(formData);
            });

            // 成功：标记所有项为 success，进度 100%
            updateItems((item) => ({
                ...item,
                status: 'success' as UploadStatus,
                progress: 100,
            }));

            // 不自动跳转，让用户决定是否继续上传或手动返回
            setIsProcessing(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            updateItems((item) => ({
                ...item,
                status: 'error' as UploadStatus,
                error: message,
            }));
            setIsProcessing(false);
        }
    }, []);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;
        if (dragCounter.current === 0) {
            setIsDragging(false);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter.current = 0;
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                void uploadFiles(e.dataTransfer.files);
            }
        },
        [uploadFiles],
    );

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            void uploadFiles(e.target.files);
            e.target.value = '';
        }
    };

    const removeItem = (id: string) => {
        setItems((prev) => {
            const target = prev.find((i) => i.id === id);
            if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
            return prev.filter((item) => item.id !== id);
        });
    };

    // 清理所有预览 URL
    useEffect(() => {
        return () => {
            items.forEach((item) => {
                if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
            });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const successCount = items.filter((i) => i.status === 'success').length;
    const errorCount = items.filter((i) => i.status === 'error').length;
    const hasItems = items.length > 0;

    return (
        <>
            <Head title={t('media.addNew')} />
            <div className="flex h-[calc(100svh-7rem)] flex-col gap-5 overflow-hidden p-6">
                {/* Page Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.visit('/attachments')}
                                className="h-8 w-8 p-0"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <h1 className="text-title-1 font-semibold tracking-tight">
                                {t('media.addNew')}
                            </h1>
                        </div>
                        <p className="text-subheadline text-secondary-label">
                            {t('media.dragDrop')} · {t('media.maxSize')}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isProcessing}
                        >
                            <FileIcon className="h-4 w-4" />
                            {t('media.selectFile')}
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => router.visit('/attachments')}
                            disabled={isProcessing}
                        >
                            {t('media.cancel')}
                        </Button>
                    </div>
                </div>

                {/* Drop Zone — 内嵌上传队列，固定高度内部滚动 */}
                <Card
                    className={cn(
                        'relative flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-dashed transition-all duration-300',
                        isDragging
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/40 hover:bg-muted/20',
                    )}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <CardContent className="flex min-h-0 flex-1 flex-col p-6">
                        {!hasItems ? (
                            // 空状态：原始的拖入引导
                            <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10">
                                <div
                                    className={cn(
                                        'flex h-24 w-24 items-center justify-center rounded-full transition-all duration-300',
                                        isDragging
                                            ? 'scale-110 bg-primary/15 text-primary shadow-lg shadow-primary/20'
                                            : 'bg-muted text-muted-foreground',
                                    )}
                                >
                                    <UploadCloud
                                        className={cn(
                                            'h-12 w-12 transition-transform duration-300',
                                            isDragging && 'animate-bounce',
                                        )}
                                    />
                                </div>
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <h2 className="text-title-2 font-semibold tracking-tight">
                                        {t('media.dragDrop')}
                                    </h2>
                                    <p className="text-footnote text-secondary-label">
                                        {t('media.maxSize')}
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isProcessing}
                                >
                                    <FileIcon className="h-4 w-4" />
                                    {t('media.selectFile')}
                                </Button>
                            </div>
                        ) : (
                            // 有文件时：内嵌网格展示
                            <div className="flex min-h-0 flex-1 flex-col gap-4">
                                {/* 顶部状态条 */}
                                <div className="flex shrink-0 items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={cn(
                                                'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
                                                isProcessing
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'bg-muted text-muted-foreground',
                                            )}
                                        >
                                            {isProcessing ? (
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                            ) : (
                                                <UploadCloud className="h-5 w-5" />
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-callout font-semibold tracking-tight">
                                                {isProcessing
                                                    ? t('media.uploading')
                                                    : t('media.uploadDone')}
                                            </span>
                                            <span className="text-caption text-secondary-label">
                                                {t('media.count', { count: items.length })}
                                                {successCount > 0 &&
                                                    ` · ${successCount} ${t('media.uploadSuccess')}`}
                                                {errorCount > 0 &&
                                                    ` · ${errorCount} ${t('media.uploadError')}`}
                                            </span>
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isProcessing}
                                        className="h-8"
                                    >
                                        <FileIcon className="h-3.5 w-3.5" />
                                        {t('media.selectFile')}
                                    </Button>
                                </div>

                                {/* 文件网格 — 内嵌在拖入框中，平铺展示，内联滚动 */}
                                <div
                                    className="flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-y-auto pr-1"
                                    style={{ maxHeight: 'calc(100svh - 22rem)' }}
                                >
                                    {items.map((item) => {
                                        const Icon = getFileIcon(item.file);
                                        const kind = getFileKind(item.file);
                                        return (
                                            <div
                                                key={item.id}
                                                className={cn(
                                                    'group relative flex h-32 w-32 shrink-0 flex-col overflow-hidden rounded-xl border bg-card transition-all duration-300',
                                                    item.status === 'success'
                                                        ? 'border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                                                        : item.status === 'error'
                                                          ? 'border-red-500/40'
                                                          : 'border-border',
                                                )}
                                            >
                                                {/* 缩略图 / 图标区 */}
                                                <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-muted">
                                                    {kind === 'image' && item.previewUrl ? (
                                                        <img
                                                            src={item.previewUrl}
                                                            alt={item.file.name}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                                                            <Icon className="h-7 w-7" />
                                                            <span className="px-1 text-[10px] font-medium uppercase tracking-wider">
                                                                {item.file.type.split('/')[1] ??
                                                                    'file'}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* 上传中：环形进度遮罩 */}
                                                    {item.status === 'uploading' && (
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/60 backdrop-blur-sm">
                                                            <div className="relative flex h-10 w-10 items-center justify-center">
                                                                <svg
                                                                    className="h-10 w-10 -rotate-90"
                                                                    viewBox="0 0 40 40"
                                                                >
                                                                    <circle
                                                                        cx="20"
                                                                        cy="20"
                                                                        r="17"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        strokeWidth="3"
                                                                        className="text-muted"
                                                                    />
                                                                    <circle
                                                                        cx="20"
                                                                        cy="20"
                                                                        r="17"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        strokeWidth="3"
                                                                        strokeLinecap="round"
                                                                        className="text-primary transition-all duration-300"
                                                                        strokeDasharray={`${(item.progress / 100) * 106.8} 106.8`}
                                                                    />
                                                                </svg>
                                                                <span className="absolute text-[10px] font-bold tabular-nums text-primary">
                                                                    {item.progress}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* 成功：角落小徽章，不遮挡图片 */}
                                                    {item.status === 'success' && (
                                                        <div className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 shadow-md ring-2 ring-white">
                                                            <Check
                                                                className="h-3 w-3 text-white"
                                                                strokeWidth={3}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* 错误：红色角标 */}
                                                    {item.status === 'error' && (
                                                        <div className="absolute inset-0 bg-red-500/20">
                                                            <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 shadow-md">
                                                                <AlertCircle
                                                                    className="h-3 w-3 text-white"
                                                                    strokeWidth={2.5}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* 删除按钮（仅在非上传中显示） */}
                                                    {item.status !== 'uploading' && (
                                                        <button
                                                            onClick={() => removeItem(item.id)}
                                                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-foreground/70 opacity-0 backdrop-blur-sm transition-all hover:bg-background hover:text-foreground group-hover:opacity-100"
                                                            aria-label={t('media.delete')}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* 文件名 + 大小条 */}
                                                <div className="flex flex-col gap-0 p-1.5">
                                                    <p
                                                        className="line-clamp-1 text-[10px] font-medium tracking-tight"
                                                        title={item.file.name}
                                                    >
                                                        {item.file.name}
                                                    </p>
                                                    <span className="text-[9px] text-secondary-label tabular-nums">
                                                        {formatFileSize(item.file.size)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* 末尾的"继续添加"卡片 */}
                                    {!isProcessing && (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex h-32 w-32 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-all hover:border-primary/40 hover:bg-muted/30 hover:text-foreground"
                                        >
                                            <UploadCloud className="h-6 w-6" />
                                            <span className="text-[10px] font-medium">
                                                {t('media.selectFile')}
                                            </span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                />
            </div>

            {/* 弹出动画 keyframes */}
            <style>{`
                @keyframes pop {
                    0% { transform: scale(0); opacity: 0; }
                    60% { transform: scale(1.15); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </>
    );
}
