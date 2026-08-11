import {
    Copy,
    Image as ImageIcon,
    Video,
    FileText,
    UploadCloud,
    CheckCheck,
    Plus,
} from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AttachmentItem {
    id: number;
    file_name: string;
    file_path: string;
    mime_type: string;
    file_size: number;
    thumbnail_url?: string;
    url?: string;
}

interface MediaQuickUploadProps {
    parentType?: string;
    parentId?: number;
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) {
return '0 B';
}

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

type TabKey = 'current' | 'all';

export default function MediaQuickUpload({ parentType, parentId }: MediaQuickUploadProps) {
    const { t } = useTranslation();
    const hasArticle = !!(parentType && parentId);

    const [tab, setTab] = useState<TabKey>(hasArticle ? 'current' : 'all');
    const [items, setItems] = useState<AttachmentItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [fetchVersion, setFetchVersion] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragCounter = useRef(0);

    useEffect(() => {
        let ignore = false;

        async function loadFiles() {
            setLoading(true);

            try {
                const params = new URLSearchParams();

                if (tab === 'current' && hasArticle) {
                    params.set('parent_type', parentType!);
                    params.set('parent_id', String(parentId!));
                }

                params.set('per_page', '50');

                const response = await fetch(`/attachments?${params.toString()}`, {
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch');
                }

                const data = await response.json();
                const attachments: AttachmentItem[] = (data.data || []).map((item: any) => ({
                    ...item,
                    url: item.url || `/storage/${item.file_path}`,
                    thumbnail_url: item.thumbnail_url || (item.mime_type?.startsWith('image/')
                        ? `/storage/${item.file_path}`
                        : undefined),
                }));

                if (!ignore) {
                    setItems(attachments);
                }
            } catch {
                if (!ignore) {
                    toast.error(t('media.fetchError'));
                }
            } finally {
                if (!ignore) {
                    setLoading(false);
                }
            }
        }

        loadFiles();

        return () => {
            ignore = true;
        };
    }, [tab, parentType, parentId, hasArticle, t, fetchVersion]);

    const copyLink = useCallback((url: string) => {
        const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;

        // Try Clipboard API first, fall back to execCommand
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(fullUrl).then(() => {
                toast.success(t('media.linkCopied'), {
                    icon: <CheckCheck className="h-4 w-4" />,
                });
            }).catch(() => {
                toast.error(t('media.copyFailed'));
            });
        } else {
            // Legacy fallback for non-HTTPS / insecure contexts
            try {
                const ta = document.createElement('textarea');
                ta.value = fullUrl;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                toast.success(t('media.linkCopied'), {
                    icon: <CheckCheck className="h-4 w-4" />,
                });
            } catch {
                toast.error(t('media.copyFailed'));
            }
        }
    }, [t]);

    const getCsrfToken = (): { headerName: string; value: string } | null => {
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
    };

    const uploadFiles = useCallback(
        async (fileList: FileList | File[]) => {
            const files = Array.from(fileList);

            if (files.length === 0) {
return;
}

            setUploading(true);

            const formData = new FormData();
            files.forEach((file) => formData.append('files[]', file));

            if (tab === 'current' && hasArticle) {
                formData.append('parent_type', parentType!);
                formData.append('parent_id', String(parentId!));
            } else if (tab === 'current' && !hasArticle) {
                formData.append('parent_type', parentType || '');
            }

            try {
                await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', '/attachments');
                    xhr.withCredentials = true;

                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 400) {
                            resolve();
                        } else {
                            let message = `Upload failed (HTTP ${xhr.status})`;

                            try {
                                const json = JSON.parse(xhr.responseText);

                                if (json?.message) {
message = json.message;
}
                            } catch { /* ignore */ }

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
                        reject(new Error('CSRF token not found.'));

                        return;
                    }

                    xhr.send(formData);
                });

                toast.success(t('media.uploadSuccess'));
                setFetchVersion(v => v + 1);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                toast.error(message);
            } finally {
                setUploading(false);
            }
        },
        [tab, parentType, parentId, hasArticle, t],
    );

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

    function getFileIcon(mimeType: string) {
        if (mimeType.startsWith('image/')) {
return ImageIcon;
}

        if (mimeType.startsWith('video/')) {
return Video;
}

        return FileText;
    }

    const isImage = (mimeType: string) => mimeType.startsWith('image/');

    return (
        <Card className="overflow-hidden">
            <CardContent
                className="!p-0"
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {/* Tabs + add button */}
                <div className="flex items-center justify-between border-b border-border/40 px-4 py-2">
                    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
                        {hasArticle && (
                            <button
                                type="button"
                                onClick={() => setTab('current')}
                                className={cn(
                                    'rounded-md px-3 py-1 text-xs font-medium transition-all',
                                    tab === 'current'
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-tertiary-label hover:text-secondary-label',
                                )}
                            >
                                {hasArticle ? t('media.currentArticle') : t('media.currentArticle')}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setTab('all')}
                            className={cn(
                                'rounded-md px-3 py-1 text-xs font-medium transition-all',
                                tab === 'all'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-tertiary-label hover:text-secondary-label',
                            )}
                        >
                            {t('media.allMedia')}
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-tertiary-label transition-all hover:bg-muted hover:text-secondary-label"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        {t('media.addMedia')}
                    </button>
                </div>

                {/* Drop zone area */}
                <div className="relative">
                    {/* Drag overlay */}
                    {isDragging && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center border-2 border-dashed border-primary bg-primary/5">
                            <div className="flex flex-col items-center gap-2 rounded-xl bg-primary/10 px-6 py-4">
                                <UploadCloud className="h-8 w-8 animate-bounce text-primary" />
                                <span className="text-sm font-medium text-primary">
                                    {t('media.dropToUpload')}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* File grid */}
                    <div className="min-h-[120px] p-4">
                        {loading ? (
                            <div className="flex items-center justify-center py-10 text-sm text-tertiary-label">
                                {t('media.loading')}
                            </div>
                        ) : items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-8">
                                <UploadCloud className="h-8 w-8 text-muted-foreground/40" />
                                <p className="text-xs text-tertiary-label">
                                    {t('media.dragOrClickToUpload')}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-xs font-medium text-primary hover:underline"
                                >
                                    {t('media.selectFile')}
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                                {items.map((item) => {
                                    const Icon = getFileIcon(item.mime_type);
                                    const itemUrl = item.url || `/storage/${item.file_path}`;

                                    return (
                                        <div
                                            key={item.id}
                                            className="group relative flex flex-col overflow-hidden rounded-lg border border-border/60 bg-background"
                                        >
                                            {/* Thumbnail */}
                                            <div className="relative aspect-square overflow-hidden bg-muted/50">
                                                {isImage(item.mime_type) && itemUrl ? (
                                                    <img
                                                        src={itemUrl}
                                                        alt={item.file_name}
                                                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center">
                                                        <Icon className="h-6 w-6 text-muted-foreground/60" />
                                                    </div>
                                                )}

                                                {/* Copy button on hover */}
                                                <button
                                                    type="button"
                                                    onClick={() => copyLink(itemUrl)}
                                                    className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 text-xs font-medium text-white opacity-0 backdrop-blur-[2px] transition-all group-hover:opacity-100"
                                                >
                                                    <Copy className="h-3.5 w-3.5" />
                                                    {t('media.copyLink')}
                                                </button>
                                            </div>

                                            {/* File name */}
                                            <div className="flex flex-col gap-0 p-1.5">
                                                <p
                                                    className="line-clamp-1 text-[10px] font-medium leading-tight"
                                                    title={item.file_name}
                                                >
                                                    {item.file_name}
                                                </p>
                                                <span className="text-[9px] tabular-nums text-tertiary-label">
                                                    {formatFileSize(item.file_size)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
                />
            </CardContent>
        </Card>
    );
}
