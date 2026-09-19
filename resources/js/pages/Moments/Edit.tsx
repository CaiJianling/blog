import { Head, router } from '@inertiajs/react';
import { ArrowLeft, MessageSquare, Trash2, Save, Send } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as momentActions from '@/actions/App/Http/Controllers/MomentsController';
import { BlockNoteEditor } from '@/components/blocknote-editor';
import type { BlockNoteDocument } from '@/components/blocknote-editor';
import MediaQuickUpload from '@/components/media-quick-upload';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface MomentData {
    id: number;
    content: BlockNoteDocument | null;
    status: string;
    comment_status: string;
    permalink: string;
    created_at: string;
}

interface Props {
    moment: MomentData;
}

export default function MomentsEdit({ moment }: Props) {
    const { t } = useTranslation();
    const [content, setContent] = useState<BlockNoteDocument | null>(
        moment.content,
    );
    const [status, setStatus] = useState(moment.status);
    const [commentStatus, setCommentStatus] = useState(moment.comment_status);
    const [saving, setSaving] = useState(false);

    const handleSave = (overrideStatus?: string) => {
        if (saving) {
            return;
        }

        setSaving(true);
        router.put(
            momentActions.update.url(moment.id),
            {
                content: content ?? [],
                status: overrideStatus ?? status,
                comment_status: commentStatus,
            },
            { preserveScroll: true, onFinish: () => setSaving(false) },
        );
    };

    const handleDelete = () => {
        if (!window.confirm(t('moments.deleteConfirmTitle'))) {
            return;
        }

        router.delete(momentActions.destroy.url(moment.id), {
            onSuccess: () => router.visit('/moments-admin'),
        });
    };

    return (
        <>
            <Head title={t('moments.edit')} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-4 sm:p-6">
                {/* 页头 */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.visit('/moments-admin')}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-title-1 font-semibold tracking-tight">
                                {t('moments.edit')}
                            </h1>
                            <p className="text-footnote text-tertiary-label">
                                {moment.created_at} ·{' '}
                                {moment.status === 'publish' ? (
                                    <a
                                        href={moment.permalink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline"
                                    >
                                        {t('moments.view')}
                                    </a>
                                ) : (
                                    t(
                                        STATUS_LABEL[moment.status] ??
                                            'articles.status.draft',
                                    )
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            disabled={saving}
                            onClick={() => handleSave('draft')}
                            className="gap-1.5"
                        >
                            <Save className="h-4 w-4" />
                            存草稿
                        </Button>
                        <Button
                            disabled={saving}
                            onClick={() => handleSave('publish')}
                            className="gap-1.5"
                        >
                            <Send className="h-4 w-4" />
                            {t('articles.status.publish')}
                        </Button>
                        <Button
                            variant="ghost"
                            disabled={saving}
                            onClick={handleDelete}
                            className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                            <Trash2 className="h-4 w-4" />
                            {t('common.delete')}
                        </Button>
                    </div>
                </div>

                <div className="grid flex-1 auto-rows-min items-start gap-4 lg:grid-cols-[1fr_280px]">
                    {/* 编辑区 */}
                    <Card className="!p-0">
                        <CardContent className="p-4 sm:px-8 sm:py-6">
                            <BlockNoteEditor
                                initialContent={moment.content}
                                onChange={(document) => setContent(document)}
                            />
                        </CardContent>
                    </Card>

                    {/* 设置栏 */}
                    <div className="flex flex-col gap-3">
                        <Card className="!p-0">
                            <CardContent className="flex flex-col gap-4 p-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-footnote font-medium text-muted-foreground">
                                        {t('articles.form.status')}
                                    </label>
                                    <Select
                                        value={status}
                                        onValueChange={setStatus}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="publish">
                                                {t('articles.status.publish')}
                                            </SelectItem>
                                            <SelectItem value="draft">
                                                {t('articles.status.draft')}
                                            </SelectItem>
                                            <SelectItem value="pending">
                                                {t('articles.status.pending')}
                                            </SelectItem>
                                            <SelectItem value="trash">
                                                {t('articles.status.trash')}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <label className="flex cursor-pointer items-center gap-2">
                                    <Checkbox
                                        checked={commentStatus === 'open'}
                                        onCheckedChange={(v) =>
                                            setCommentStatus(
                                                v === true ? 'open' : 'close',
                                            )
                                        }
                                    />
                                    <span className="text-footnote flex items-center gap-1.5">
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        {t('articles.form.allowComments')}
                                    </span>
                                </label>
                            </CardContent>
                        </Card>

                        <MediaQuickUpload parentType="article" />
                    </div>
                </div>
            </div>
        </>
    );
}

const STATUS_LABEL: Record<string, string> = {
    publish: 'articles.status.publish',
    draft: 'articles.status.draft',
    pending: 'articles.status.pending',
    trash: 'articles.status.trash',
};

MomentsEdit.layout = {
    breadcrumbs: [
        {
            title: 'moments.title',
            href: '/moments-admin',
        },
    ],
};
