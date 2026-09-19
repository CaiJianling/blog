import { Head, router } from '@inertiajs/react';
import { ArrowLeft, MessageSquare, Send, Save } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { store as momentsStore } from '@/routes/moments/admin';

export default function MomentsCreate() {
    const { t } = useTranslation();
    const [content, setContent] = useState<BlockNoteDocument | null>(null);
    const [status, setStatus] = useState('publish');
    const [commentStatus, setCommentStatus] = useState('open');
    const [saving, setSaving] = useState(false);

    const isEmpty = !content || content.length === 0;

    const handleSubmit = (overrideStatus?: string) => {
        if (isEmpty || saving) {
            return;
        }

        setSaving(true);
        router.post(
            momentsStore.url(),
            {
                content: content ?? [],
                status: overrideStatus ?? status,
                comment_status: commentStatus,
            },
            { onFinish: () => setSaving(false) },
        );
    };

    return (
        <>
            <Head title={t('moments.create')} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-4 sm:p-6">
                {/* 页头 */}
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.history.back()}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <h1 className="text-title-1 font-semibold tracking-tight">
                            {t('moments.create')}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            disabled={isEmpty || saving}
                            onClick={() => handleSubmit('draft')}
                            className="gap-1.5"
                        >
                            <Save className="h-4 w-4" />
                            存草稿
                        </Button>
                        <Button
                            disabled={isEmpty || saving}
                            onClick={() => handleSubmit('publish')}
                            className="gap-1.5"
                        >
                            <Send className="h-4 w-4" />
                            发布说说
                        </Button>
                    </div>
                </div>

                <div className="grid flex-1 auto-rows-min items-start gap-4 lg:grid-cols-[1fr_280px]">
                    {/* 编辑区 */}
                    <Card className="!p-0">
                        <CardContent className="p-4 sm:px-8 sm:py-6">
                            <BlockNoteEditor
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

                        <p className="text-footnote text-tertiary-label px-1 leading-relaxed">
                            {t('moments.createHint')}
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}

MomentsCreate.layout = {
    breadcrumbs: [
        {
            title: 'moments.title',
            href: '/moments-admin',
        },
    ],
};
