import { Head, router } from '@inertiajs/react';
import { FolderArchive, ImagePlus, Plus, Tag, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AdminSettingsShell from '@/components/admin-settings-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type SmileyData = {
    id: number;
    group_id: number;
    code: string;
    image: string;
    url: string;
    sort: number;
};

type GroupData = {
    id: number;
    name: string;
    sort: number;
    smileys: SmileyData[];
};

interface Props {
    groups: GroupData[];
}

export default function Smilies({ groups }: Props) {
    const { t } = useTranslation();
    const [activeId, setActiveId] = useState<number | null>(
        groups[0]?.id ?? null,
    );
    const [newGroupName, setNewGroupName] = useState('');
    const [newCode, setNewCode] = useState('');
    const [newImage, setNewImage] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);
    const packRef = useRef<HTMLInputElement>(null);
    const [uploadingPack, setUploadingPack] = useState(false);

    const active = groups.find((g) => g.id === activeId) ?? null;

    // 上传表情包：一个 zip（内含表情配置 json + 图片），后端解压后自动匹配建新分组
    const uploadPack = (file: File): void => {
        setUploadingPack(true);

        router.post(
            '/admin/smileys/pack',
            { pack: file } as never,
            {
                preserveScroll: true,
                onFinish: () => setUploadingPack(false),
            },
        );
    };

    const submit = (route: string, data: Record<string, unknown>) => {
        router.post(route, data as never, {
            preserveScroll: true,
            onSuccess: () => {
                if (route.includes('smileys')) {
                    setNewCode('');
                    setNewImage('');

                    if (fileRef.current) {
                        fileRef.current.value = '';
                    }
                } else {
                    setNewGroupName('');
                }
            },
        });
    };

    return (
        <>
            <Head title={t('settings.smilies.title')} />

            <AdminSettingsShell
                title={t('settings.smilies.heading')}
                description={t('settings.smilies.description')}
                wide
            >
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
                    {/* 分组（标签页）管理 */}
                    <div className="apple-card p-4">
                        <h3 className="text-callout flex items-center gap-2 font-medium">
                            <Tag className="h-4 w-4 text-primary" />
                            {t('settings.smilies.groups')}
                        </h3>
                        <div className="mt-3 space-y-1.5">
                            {groups.map((g) => (
                                <div
                                    key={g.id}
                                    className={cn(
                                        'apple-press flex items-center justify-between rounded-xl px-3 py-2',
                                        activeId === g.id
                                            ? 'bg-primary/10 text-primary'
                                            : 'hover:bg-muted',
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setActiveId(g.id)}
                                        className="min-w-0 flex-1 text-left text-sm"
                                    >
                                        {g.name}
                                        <span className="ml-1.5 text-xs text-muted-foreground">
                                            ({g.smileys.length})
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (
                                                window.confirm(
                                                    t(
                                                        'settings.smilies.deleteGroupConfirm',
                                                        { name: g.name },
                                                    ),
                                                )
                                            ) {
                                                router.delete(
                                                    `/admin/smiley-groups/${g.id}`,
                                                    { preserveScroll: true },
                                                );
                                            }
                                        }}
                                        className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                        aria-label={t(
                                            'settings.smilies.deleteGroup',
                                            { name: g.name },
                                        )}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <form
                            onSubmit={(e) => {
                                e.preventDefault();

                                if (newGroupName.trim()) {
                                    submit('/admin/smiley-groups', {
                                        name: newGroupName.trim(),
                                    });
                                }
                            }}
                            className="mt-4 flex gap-2 border-t border-border/40 pt-4"
                        >
                            <Input
                                value={newGroupName}
                                onChange={(e) =>
                                    setNewGroupName(e.target.value)
                                }
                                placeholder={t('settings.smilies.newGroupName')}
                                className="h-9 text-sm"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                aria-label={t('settings.smilies.addGroup')}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </form>
                    </div>

                    {/* 表情列表 */}
                    <div className="apple-card p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-callout font-medium">
                                {active
                                    ? t('settings.smilies.groupSmileys', {
                                          name: active.name,
                                      })
                                    : t('settings.smilies.selectGroup')}
                            </h3>
                            <input
                                ref={packRef}
                                type="file"
                                accept=".zip,application/zip"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];

                                    e.target.value = '';

                                    if (file) {
                                        uploadPack(file);
                                    }
                                }}
                                className="hidden"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9"
                                disabled={uploadingPack}
                                onClick={() => packRef.current?.click()}
                            >
                                <FolderArchive className="h-4 w-4" />
                                {uploadingPack
                                    ? t('settings.smilies.uploadingPack')
                                    : t('settings.smilies.uploadPack')}
                            </Button>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {t('settings.smilies.packHint')}
                        </p>

                        {active && (
                            <>
                                <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
                                    {active.smileys.map((s) => (
                                        <div
                                            key={s.id}
                                            className="group relative flex flex-col items-center gap-1 rounded-xl border border-border/50 p-2"
                                        >
                                            <img
                                                src={s.url}
                                                alt={s.code}
                                                className="h-8 w-8"
                                                loading="lazy"
                                            />
                                            <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                                                :{s.code}:
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    router.delete(
                                                        `/admin/smileys/${s.id}`,
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    )
                                                }
                                                className="absolute -top-1.5 -right-1.5 hidden rounded-full bg-destructive p-1 text-white group-hover:block"
                                                aria-label={t(
                                                    'settings.smilies.deleteSmiley',
                                                    { code: s.code },
                                                )}
                                            >
                                                <Trash2 className="h-2.5 w-2.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* 添加表情 */}
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        const file =
                                            fileRef.current?.files?.[0];
                                        const data: Record<string, unknown> = {
                                            group_id: active.id,
                                            code: newCode.trim(),
                                            image: newImage,
                                        };

                                        if (file) {
                                            data.image_file = file;
                                            data.image = '';
                                        }

                                        submit('/admin/smileys', data);
                                    }}
                                    className="mt-5 flex flex-wrap items-center gap-2 border-t border-border/40 pt-4"
                                >
                                    <Input
                                        value={newCode}
                                        onChange={(e) =>
                                            setNewCode(e.target.value)
                                        }
                                        placeholder={t(
                                            'settings.smilies.smileyCode',
                                        )}
                                        className="h-9 w-44 font-mono text-sm"
                                    />
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];

                                            if (file) {
                                                setNewImage(file.name);
                                            }
                                        }}
                                        className="hidden"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-9"
                                        onClick={() => fileRef.current?.click()}
                                    >
                                        <ImagePlus className="h-4 w-4" />
                                        {newImage
                                            ? t(
                                                  'settings.smilies.imageSelected',
                                              )
                                            : t('settings.smilies.uploadImage')}
                                    </Button>
                                    <Button
                                        type="submit"
                                        size="sm"
                                        className="h-9"
                                        disabled={!newCode.trim()}
                                    >
                                        {t('settings.smilies.addSmiley')}
                                    </Button>
                                </form>
                                <p className="mt-2 text-xs text-muted-foreground">
                                    {t('settings.smilies.urlHint')}
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </AdminSettingsShell>
        </>
    );
}
