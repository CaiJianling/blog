import { Head, router } from '@inertiajs/react';
import {
    GripVertical,
    ImagePlus,
    Pencil,
    Plus,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type FriendLinkData = {
    id: number;
    link_url: string;
    link_name: string;
    link_image: string | null;
    link_target: string;
    link_description: string;
    link_visible: 'Y' | 'N';
    link_rating: number;
};

type Filter = 'all' | 'visible' | 'hidden';

interface Props {
    links: FriendLinkData[];
}

function getCsrfToken(): { headerName: string; value: string } | null {
    const meta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    if (meta) {
        return { headerName: 'X-CSRF-TOKEN', value: meta };
    }

    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

    if (match?.[1]) {
        return { headerName: 'X-XSRF-TOKEN', value: decodeURIComponent(match[1]) };
    }

    return null;
}

/**
 * 友链后台管理：列表（筛选 / 拖动排序）+ 弹窗编辑（新窗口 / 显示用复选框）+ 图片上传。
 * 图片走系统用途附件（parent_type=link_image）：更换时后端先删旧图再存新图，
 * 删除友链时后端一并清理其图片，避免文件库残留。
 */
export default function Links({ links }: Props) {
    const { t } = useTranslation();

    const [filter, setFilter] = useState<Filter>('all');
    const [keyword, setKeyword] = useState('');
    const [dragId, setDragId] = useState<number | null>(null);
    const [overId, setOverId] = useState<number | null>(null);
    const [dropPos, setDropPos] = useState<'before' | 'after' | null>(null);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<FriendLinkData | null>(null);
    const [form, setForm] = useState({
        link_url: '',
        link_name: '',
        link_description: '',
        newWindow: true,
        visible: true,
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageLink, setImageLink] = useState<number | null>(null);
    const [imageUploading, setImageUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filtered = links.filter((link) => {
        if (filter === 'visible' && link.link_visible !== 'Y') {
            return false;
        }

        if (filter === 'hidden' && link.link_visible !== 'N') {
            return false;
        }

        const kw = keyword.trim().toLowerCase();

        if (!kw) {
            return true;
        }

        return (
            link.link_name.toLowerCase().includes(kw) ||
            link.link_url.toLowerCase().includes(kw) ||
            (link.link_description || '').toLowerCase().includes(kw)
        );
    });

    useEffect(() => {
        const clear = () => {
            setDragId(null);
            setOverId(null);
            setDropPos(null);
        };

        window.addEventListener('dragend', clear);

        return () => window.removeEventListener('dragend', clear);
    }, []);

    const openDialog = (link: FriendLinkData | null) => {
        setEditing(link);
        setForm({
            link_url: link?.link_url ?? '',
            link_name: link?.link_name ?? '',
            link_description: link?.link_description ?? '',
            newWindow: (link?.link_target ?? '_blank') === '_blank',
            visible: (link?.link_visible ?? 'Y') === 'Y',
        });
        setImageFile(null);
        setDialogOpen(true);
    };

    const submit = () => {
        if (!form.link_url.trim() || !form.link_name.trim()) {
            return;
        }

        const data = {
            link_url: form.link_url.trim(),
            link_name: form.link_name.trim(),
            link_target: form.newWindow ? '_blank' : '',
            link_description: form.link_description.trim(),
            link_visible: form.visible ? 'Y' : 'N',
        };

        if (editing) {
            router.put(`/admin/settings/links/${editing.id}`, data, { preserveScroll: true });
        } else {
            router.post('/admin/settings/links', data, { preserveScroll: true });
        }

        setDialogOpen(false);
    };

    const uploadImage = (linkId: number, file: File) => {
        const csrf = getCsrfToken();

        if (!csrf) {
            return;
        }

        setImageUploading(true);

        const formData = new FormData();
        formData.append('file', file);

        fetch(`/admin/settings/links/${linkId}/image`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                [csrf.headerName]: csrf.value,
            },
            body: formData,
        })
            .then(async (response) => {
                const data = await response.json().catch(() => null);

                if (!response.ok) {
                    const message = Array.isArray(data?.errors?.file) ? data.errors.file[0] : data?.message;

                    toast.error(message ?? t('settings.links.imageUploadFailed'));

                    return;
                }

                toast.success(t('settings.links.imageUploadSuccess'));
                setImageFile(null);
                setImageLink(null);
                router.reload({ only: ['links'] });
            })
            .catch(() => toast.error(t('settings.links.imageUploadFailed')))
            .finally(() => setImageUploading(false));
    };

    const removeImage = (link: FriendLinkData) => {
        const csrf = getCsrfToken();

        if (!csrf) {
            return;
        }

        fetch(`/admin/settings/links/${link.id}/image`, {
            method: 'DELETE',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                [csrf.headerName]: csrf.value,
            },
        })
            .then(async (response) => {
                if (!response.ok) {
                    toast.error(t('settings.links.imageRemoveFailed'));

                    return;
                }

                toast.success(t('settings.links.imageRemoveSuccess'));
                router.reload({ only: ['links'] });
            })
            .catch(() => toast.error(t('settings.links.imageRemoveFailed')));
    };

    // 拖动排序：按当前（可能是筛选后的）顺序，把拖项移到目标位置，
    // 再映射回全量 id 列表提交，后端按新顺序重写 link_rating
    const dropOn = (targetId: number, position: 'before' | 'after') => {
        if (dragId === null || dragId === targetId) {
            return;
        }

        const ordered = links.filter((item) =>
            filtered.some((f) => f.id === item.id),
        );
        const rest = ordered.filter((item) => item.id !== dragId);
        const targetIndex = rest.findIndex((item) => item.id === targetId);

        if (targetIndex === -1) {
            return;
        }

        const insertAt = position === 'before' ? targetIndex : targetIndex + 1;
        const dragged = rest.splice(targetIndex, 1)[0];
        rest.splice(insertAt, 0, dragged);

        const allIds = [...rest.map((item) => item.id)];

        for (const link of links) {
            if (!allIds.includes(link.id)) {
                allIds.push(link.id);
            }
        }

        setDragId(null);
        setOverId(null);
        setDropPos(null);

        router.put('/admin/settings/links/reorder', { ids: allIds }, { preserveScroll: true });
    };

    return (
        <>
            <Head title={t('settings.links.title')} />

            {/* 友链页不走 SettingsLayout（左侧个人资料/安全/外观侧栏在此页无意义），
               改用 AppLayout，标题与内容居中。 */}
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
                <Heading variant="small" title={t('settings.links.heading')} description={t('settings.links.description')} />

                <div className="apple-card p-4">
                    {/* 顶部工具条：筛选 + 搜索 + 右上角新增 */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                            {(
                                [
                                    ['all', t('settings.links.filterAll')],
                                    ['visible', t('settings.links.filterVisible')],
                                    ['hidden', t('settings.links.filterHidden')],
                                ] as [Filter, string][]
                            ).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setFilter(value)}
                                    className={cn(
                                        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                        filter === value
                                            ? 'bg-background shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <div className="relative min-w-40 flex-1">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                placeholder={t('settings.links.search')}
                                className="h-8 pl-8 text-sm"
                            />
                        </div>
                        <Button type="button" size="sm" className="h-8 ml-auto" onClick={() => openDialog(null)}>
                            <Plus className="h-3.5 w-3.5" />
                            {t('settings.links.add')}
                        </Button>
                    </div>

                    {/* 列表（可拖动排序） */}
                    <div className="mt-3 space-y-2">
                        {filtered.length === 0 && (
                            <p className="py-10 text-center text-sm text-muted-foreground">
                                {keyword || filter !== 'all'
                                    ? t('settings.links.noResult')
                                    : t('settings.links.empty')}
                            </p>
                        )}

                        {filtered.map((link) => (
                            <div
                                key={link.id}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.effectAllowed = 'move';
                                    e.dataTransfer.setData('text/plain', String(link.id));
                                    setDragId(link.id);
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();

                                    if (dragId === link.id) {
                                        return;
                                    }

                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const midY = rect.top + rect.height / 2;
                                    const pos = e.clientY < midY ? 'before' : 'after';

                                    setOverId(link.id);
                                    setDropPos(pos);
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    dropOn(link.id, dropPos ?? 'after');
                                }}
                                onDragEnd={() => {
                                    setDragId(null);
                                    setOverId(null);
                                    setDropPos(null);
                                }}
                                className={cn(
                                    'flex items-center gap-3 rounded-xl border border-border/50 bg-background px-3 py-2',
                                    link.link_visible === 'N' && 'opacity-60',
                                    dragId === link.id && 'opacity-40',
                                    overId === link.id && dragId !== null && dragId !== link.id && 'ring-2 ring-primary/40',
                                )}
                            >
                                {overId === link.id && dragId !== null && dragId !== link.id && dropPos === 'before' && (
                                    <span className="absolute left-0 top-0 h-full w-0.5 rounded bg-primary" />
                                )}

                                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/40" />

                                {link.link_image ? (
                                    <img
                                        src={link.link_image}
                                        alt={link.link_name}
                                        className="h-9 w-9 shrink-0 rounded-lg object-cover"
                                    />
                                ) : (
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                                        {link.link_name.charAt(0).toUpperCase()}
                                    </div>
                                )}

                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                        {link.link_name}
                                        {link.link_visible === 'N' && (
                                            <span className="ml-1.5 text-xs text-muted-foreground">
                                                {t('settings.links.hiddenTag')}
                                            </span>
                                        )}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {link.link_url}
                                        {link.link_description ? ` · ${link.link_description}` : ''}
                                    </p>
                                </div>

                                <div className="flex shrink-0 items-center gap-0.5">
                                    {link.link_image ? (
                                        <button
                                            type="button"
                                            onClick={() => removeImage(link)}
                                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                            aria-label={t('settings.links.removeImage')}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setImageLink(link.id);
                                                fileInputRef.current?.click();
                                            }}
                                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                            aria-label={t('settings.links.uploadImage')}
                                        >
                                            <ImagePlus className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => openDialog(link)}
                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                        aria-label={t('settings.links.edit')}
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (window.confirm(t('settings.links.deleteConfirm', { name: link.link_name }))) {
                                                router.delete(`/admin/settings/links/${link.id}`, {
                                                    preserveScroll: true,
                                                });
                                            }
                                        }}
                                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                        aria-label={t('settings.links.delete')}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {links.length > 0 && (
                        <p className="mt-3 text-xs text-muted-foreground">
                            {t('settings.links.dragHint')}
                        </p>
                    )}
                </div>

                {/* 列表行图片上传（隐藏 input，点“添加图片”图标触发） */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];

                        if (file && imageLink !== null) {
                            uploadImage(imageLink, file);
                        }

                        e.target.value = '';
                    }}
                />

                {/* 新增 / 编辑弹窗 */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>{editing ? t('settings.links.edit') : t('settings.links.add')}</DialogTitle>
                            <DialogDescription>{t('settings.links.dialogDescription')}</DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="link-name">{t('settings.links.name')}</Label>
                                    <Input
                                        id="link-name"
                                        value={form.link_name}
                                        onChange={(e) => setForm((f) => ({ ...f, link_name: e.target.value }))}
                                        placeholder="GitHub"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="link-url">{t('settings.links.url')}</Label>
                                    <Input
                                        id="link-url"
                                        value={form.link_url}
                                        onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
                                        placeholder="https://github.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="link-desc">{t('settings.links.description')}</Label>
                                <Textarea
                                    id="link-desc"
                                    rows={2}
                                    value={form.link_description}
                                    onChange={(e) => setForm((f) => ({ ...f, link_description: e.target.value }))}
                                    placeholder="GitHub 官方仓库"
                                />
                            </div>

                            {/* 新窗口 / 是否显示：复选框 */}
                            <div className="space-y-2 rounded-xl border border-border/50 p-3">
                                <label className="flex cursor-pointer items-center gap-2.5">
                                    <Checkbox
                                        checked={form.newWindow}
                                        onCheckedChange={(checked) =>
                                            setForm((f) => ({ ...f, newWindow: checked === true }))
                                        }
                                    />
                                    <span className="text-sm">{t('settings.links.newWindow')}</span>
                                </label>
                                <label className="flex cursor-pointer items-center gap-2.5">
                                    <Checkbox
                                        checked={form.visible}
                                        onCheckedChange={(checked) =>
                                            setForm((f) => ({ ...f, visible: checked === true }))
                                        }
                                    />
                                    <span className="text-sm">{t('settings.links.visible')}</span>
                                </label>
                            </div>

                            {editing && (
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setImageLink(editing.id);
                                            fileInputRef.current?.click();
                                        }}
                                        className={cn(
                                            'apple-press flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border',
                                            editing.link_image
                                                ? 'border-transparent'
                                                : 'border-dashed border-border/60 text-muted-foreground hover:text-primary',
                                        )}
                                        aria-label={t('settings.links.uploadImage')}
                                    >
                                        {imageFile ? (
                                            <img
                                                src={URL.createObjectURL(imageFile)}
                                                alt=""
                                                className="h-full w-full object-cover"
                                            />
                                        ) : editing.link_image ? (
                                            <img
                                                src={editing.link_image}
                                                alt=""
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <ImagePlus className="h-4 w-4" />
                                        )}
                                    </button>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium">{t('settings.links.image')}</p>
                                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                                            {t('settings.links.imageHint')}
                                        </p>
                                        {imageFile && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                className="mt-2"
                                                disabled={imageUploading}
                                                onClick={() => uploadImage(editing.id, imageFile)}
                                            >
                                                {imageUploading
                                                    ? t('common.saving')
                                                    : editing.link_image
                                                        ? t('settings.links.replaceImage')
                                                        : t('settings.links.uploadImage')}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button onClick={submit} disabled={!form.link_url.trim() || !form.link_name.trim()}>
                                {t('common.save')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
