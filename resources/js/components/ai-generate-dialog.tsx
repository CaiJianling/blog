import { Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import ErrorDetailDialog from '@/components/error-detail-dialog';
import type { AiErrorDetail } from '@/components/error-detail-dialog';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export type AiArticleResult = {
    title: string;
    excerpt: string;
    markdown: string;
};

interface AiGenerateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** 生成成功后回调，把结果交给编辑器填充。 */
    onApply: (result: AiArticleResult) => void;
}

function getCsrfToken(): { headerName: string; value: string } | null {
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
}

/**
 * AI 写作弹窗：输入写作提示 → 后端生成标题/摘要/Markdown → 回调填入编辑器，
 * 作者检查确认后再手动保存录入。
 */
export default function AiGenerateDialog({ open, onOpenChange, onApply }: AiGenerateDialogProps) {
    const { t } = useTranslation();
    const [prompt, setPrompt] = useState('');
    const [generating, setGenerating] = useState(false);
    const [errorDetail, setErrorDetail] = useState<AiErrorDetail | null>(null);

    const generate = async () => {
        const text = prompt.trim();

        if (!text || generating) {
            return;
        }

        setGenerating(true);

        try {
            const csrf = getCsrfToken();

            if (!csrf) {
                throw new Error('CSRF token not found.');
            }

            const response = await fetch('/articles/ai-generate', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    [csrf.headerName]: csrf.value,
                },
                body: JSON.stringify({ prompt: text }),
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                const message = data?.message ?? t('articles.ai.failed');

                // toast 上提供"查看详情"入口，点开可见接口真实返回
                toast.error(message, {
                    description: t('articles.ai.detailHint'),
                    action: {
                        label: t('articles.ai.viewDetail'),
                        onClick: () => setErrorDetail({ message, debug: data?.debug }),
                    },
                });

                return;
            }

            onOpenChange(false);
            onApply(data as AiArticleResult);
            toast.success(t('articles.ai.success'));
        } catch {
            toast.error(t('articles.ai.failed'));
        } finally {
            setGenerating(false);
        }
    };

    return (
        <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        {t('articles.ai.dialogTitle')}
                    </DialogTitle>
                    <DialogDescription>{t('articles.ai.dialogDescription')}</DialogDescription>
                </DialogHeader>

                <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={t('articles.ai.promptPlaceholder')}
                    className="min-h-[140px] resize-y"
                    disabled={generating}
                />

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
                        {t('common.cancel')}
                    </Button>
                    <Button onClick={generate} disabled={generating || !prompt.trim()}>
                        {generating
                            ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {t('articles.ai.generating')}
                                </>
                            )
                            : (
                                <>
                                    <Sparkles className="h-4 w-4" />
                                    {t('articles.ai.generate')}
                                </>
                            )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <ErrorDetailDialog detail={errorDetail} onClose={() => setErrorDetail(null)} />
        </>
    );
}
