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
import { getCsrfHeaders, getCsrfFallbackHeaders } from '@/lib/csrf';

export type AiArticleResult = {
    title: string;
    excerpt: string;
    markdown: string;
    /** SEO 元信息（AI 生成，可留空回退到标题/摘要） */
    meta_title?: string;
    meta_description?: string;
    /** AI 建议的标签/分类名（展示用） */
    tags?: string[];
    categories?: string[];
    /** 已解析/创建好的分类/标签 term_taxonomy_id（可直接选中） */
    category_ids?: number[];
    tag_ids?: number[];
    /** 本次 AI 新建的分类/标签（前端需回填到选择器列表以便展示） */
    created_categories?: Array<{ id: number; name: string }>;
    created_tags?: Array<{ id: number; name: string }>;
};

interface AiGenerateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** 生成成功后回调，把结果交给编辑器填充。 */
    onApply: (result: AiArticleResult) => void;
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
            const doFetch = (csrf: Record<string, string>): Promise<Response> =>
                fetch('/articles/ai-generate', {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        ...csrf,
                    },
                    body: JSON.stringify({ prompt: text }),
                });

            const primary = getCsrfHeaders();

            if (!primary) {
                throw new Error('CSRF token not found.');
            }

            let response = await doFetch(primary);

            if (response.status === 419) {
                // 主来源（XSRF cookie）陈旧时用备用来源（meta）重试一次；
                // 419 发生在 CSRF 中间件层，业务逻辑尚未执行，重试安全
                const fallback = getCsrfFallbackHeaders();

                if (fallback) {
                    response = await doFetch(fallback);
                }
            }

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                // 419 = CSRF 校验失败（通常是会话过期/被轮换），提示刷新页面可恢复
                const message = response.status === 419
                    ? t('articles.ai.csrfFailed')
                    : data?.message ?? t('articles.ai.failed');

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
