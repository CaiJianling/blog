import {
    ImagePlus,
    RefreshCw,
    Trash2,
    Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { getCsrfHeaders } from '@/lib/csrf';
import { cn } from '@/lib/utils';

export type FeaturedSelection = { id: number; url: string } | null;

type MediaItem = {
    id: number;
    file_name: string;
    url: string;
};

interface FeaturedImagePickerProps {
    selected: FeaturedSelection;
    onSelect: (item: FeaturedSelection) => void;
    /** 上传新图时关联的父对象（article / page）。 */
    parentType?: string;
    parentId?: number | null;
}

/**
 * 特色图片选择器：从媒体库选取或上传图片，回传 {id, url}。
 * - 预览框：已选则显示缩略图 + 更换/移除；未选显示占位 + 选择按钮
 * - 对话框：拉取 /attachments?type=image 网格 + 直接上传
 */
export default function FeaturedImagePicker({
    selected,
    onSelect,
    parentType = 'article',
    parentId,
}: FeaturedImagePickerProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadMedia = async () => {
        setLoading(true);

        try {
            const res = await fetch('/admin/attachments?type=image&per_page=60', {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (!res.ok) {
                throw new Error('fetch failed');
            }

            const data = await res.json();
            const list: MediaItem[] = (data.data ?? []).map((it: any) => ({
                id: it.id,
                file_name: it.file_name,
                url: it.thumbnail_url || `/storage/${it.file_path}`,
            }));

            setItems(list);
        } catch {
            toast.error(t('articles.featuredImage.loadError'));
        } finally {
            setLoading(false);
        }
    };

    const openDialog = () => {
        setOpen(true);
        void loadMedia();
    };

    const handleUpload = async (file: File) => {
        setUploading(true);

        try {
            const form = new FormData();
            form.append('files[]', file);
            form.append('parent_type', parentType);

            if (parentId) {
                form.append('parent_id', String(parentId));
            }

            const res = await fetch('/admin/attachments', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    ...getCsrfHeaders(),
                },
                body: form,
            });

            if (!res.ok) {
                throw new Error('upload failed');
            }

            const data = await res.json();
            const created = data.data?.[0];

            if (created) {
                onSelect({ id: created.id, url: created.url });
                setOpen(false);
                toast.success(t('articles.featuredImage.uploadSuccess'));
            }
        } catch {
            toast.error(t('articles.featuredImage.uploadError'));
        } finally {
            setUploading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];

        if (file) {
            void handleUpload(file);
        }

        e.target.value = '';
    };

    const pick = (item: MediaItem) => {
        onSelect({ id: item.id, url: item.url });
        setOpen(false);
    };

    return (
        <div className="flex flex-col gap-2">
            {/* 预览 */}
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border/60 bg-muted/40">
                {selected ? (
                    <>
                        <img
                            src={selected.url}
                            alt={t('articles.featuredImage.title')}
                            className="h-full w-full image-alpha-bg object-cover"
                        />
                        <div className="absolute inset-0 flex items-end justify-end gap-1 bg-gradient-to-t from-black/40 to-transparent p-2 opacity-0 transition-opacity focus-within:opacity-100 hover:opacity-100">
                            <button
                                type="button"
                                onClick={openDialog}
                                className="apple-press flex items-center gap-1 rounded-lg bg-background/90 px-2 py-1 text-xs font-medium shadow-sm"
                                title={t('articles.featuredImage.change')}
                            >
                                <RefreshCw className="h-3 w-3" />
                                {t('articles.featuredImage.change')}
                            </button>
                            <button
                                type="button"
                                onClick={() => onSelect(null)}
                                className="apple-press flex items-center gap-1 rounded-lg bg-background/90 px-2 py-1 text-xs font-medium text-destructive shadow-sm"
                                title={t('articles.featuredImage.remove')}
                            >
                                <Trash2 className="h-3 w-3" />
                                {t('articles.featuredImage.remove')}
                            </button>
                        </div>
                    </>
                ) : (
                    <button
                        type="button"
                        onClick={openDialog}
                        className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ImagePlus className="h-7 w-7" />
                        <span className="text-xs">{t('articles.featuredImage.placeholder')}</span>
                    </button>
                )}
            </div>

            {/* 选择按钮（未选择时显式入口） */}
            {!selected && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openDialog}
                >
                    <ImagePlus className="h-4 w-4" />
                    {t('articles.featuredImage.select')}
                </Button>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {t('articles.featuredImage.dialogTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('articles.featuredImage.dialogDescription')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center justify-between">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploading}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="h-4 w-4" />
                            {uploading
                                ? t('articles.featuredImage.uploading')
                                : t('articles.featuredImage.upload')}
                        </Button>
                    </div>

                    <div className="max-h-[46vh] overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                                {t('articles.featuredImage.loading')}
                            </div>
                        ) : items.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
                                <ImagePlus className="h-7 w-7 opacity-40" />
                                {t('articles.featuredImage.empty')}
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                {items.map((item) => {
                                    const isSelected = selected?.id === item.id;

                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => pick(item)}
                                            title={item.file_name}
                                            className={cn(
                                                'apple-press relative aspect-square overflow-hidden rounded-lg border-2 transition-all',
                                                isSelected
                                                    ? 'border-primary ring-2 ring-primary/30'
                                                    : 'border-transparent hover:border-border',
                                            )}
                                        >
                                            <img
                                                src={item.url}
                                                alt={item.file_name}
                                                loading="lazy"
                                                className="h-full w-full image-alpha-bg object-cover"
                                            />
                                            {isSelected && (
                                                <span className="absolute right-1 top-1 rounded-full bg-primary p-1 text-white">
                                                    <CheckMark />
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function CheckMark() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="h-3 w-3"
        >
            <path d="M5 13l4 4L19 7" />
        </svg>
    );
}
