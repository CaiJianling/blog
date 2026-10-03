import { Check, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { BlockNoteDocument } from '@/components/blocknote-editor';
import ErrorDetailDialog from '@/components/error-detail-dialog';
import type { AiErrorDetail } from '@/components/error-detail-dialog';
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
import { getCsrfHeaders, getCsrfFallbackHeaders } from '@/lib/csrf';

/** 后端 articles.ai-assist 支持的补全目标。 */
type AssistTarget = 'excerpt' | 'seo' | 'categories' | 'tags';

/** AI 补全所需的当前草稿（取编辑区实时值，而非已保存的文章）。 */
export type DraftSnapshot = {
    title: string;
    excerpt: string;
    content: BlockNoteDocument | null;
};

export type AiTermSuggestion = {
    id: number;
    name: string;
    created: boolean;
};

const ENDPOINT = '/admin/articles/ai-assist';

/** 合并两组词条 id 并去重（保留原有顺序，新 id 追加在后）。 */
export function mergeUniqueIds(base: number[], extra: number[]): number[] {
    if (extra.length === 0) {
        return base;
    }

    return Array.from(new Set([...base, ...extra]));
}

/** 把不在列表里的词条追加进去（按 id 去重），用于展示 AI 新建的分类/标签。 */
export function mergeUniqueItems<T extends { id: number; name: string }>(
    base: T[],
    extra: T[],
): T[] {
    const existing = new Set(base.map((item) => item.id));
    const fresh = extra.filter((item) => !existing.has(item.id));

    return fresh.length ? [...base, ...fresh] : base;
}

/**
 * 调用一次 AI 补全。失败时返回 null，并已通过 toast（含「查看详情」）提示作者，
 * 错误处理与 AI 生成文章弹窗保持一致。
 */
async function requestAssist(
    target: AssistTarget,
    draft: DraftSnapshot,
    t: (key: string, options?: Record<string, unknown>) => string,
    onFailure: (detail: AiErrorDetail) => void,
): Promise<Record<string, unknown> | null> {
    const doFetch = (csrf: Record<string, string>) =>
        fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                ...csrf,
            },
            body: JSON.stringify({
                target,
                title: draft.title,
                excerpt: draft.excerpt,
                content: draft.content ?? [],
            }),
        });

    try {
        const primary = getCsrfHeaders();

        if (!primary) {
            throw new Error('CSRF token not found.');
        }

        let response = await doFetch(primary);

        // 419 说明主来源的 XSRF cookie 陈旧，用 meta 里的 token 重试一次
        if (response.status === 419) {
            const fallback = getCsrfFallbackHeaders();

            if (fallback) {
                response = await doFetch(fallback);
            }
        }

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            const message =
                response.status === 419
                    ? t('articles.ai.csrfFailed')
                    : (data?.message ?? t('articles.ai.failed'));

            toast.error(message, {
                description: t('articles.ai.detailHint'),
                action: {
                    label: t('articles.ai.viewDetail'),
                    onClick: () => onFailure({ message, debug: data?.debug }),
                },
            });

            return null;
        }

        return (data ?? {}) as Record<string, unknown>;
    } catch {
        toast.error(t('articles.ai.failed'));

        return null;
    }
}

function AssistTrigger({
    label,
    busy,
    onClick,
}: {
    label: string;
    busy: boolean;
    onClick: () => void;
}) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={busy}
            className="h-7 gap-1.5 self-end px-2 text-xs text-primary hover:bg-primary/10"
        >
            {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
                <Sparkles className="h-3.5 w-3.5" />
            )}
            {label}
        </Button>
    );
}

/**
 * 「AI 生成摘要 / AI 生成 SEO」：按当前标题与正文补全字段后直接回填，
 * 作者仍可再手动修改，未保存前不会写入数据库。
 */
export function AiFieldButton({
    target,
    label,
    getDraft,
    onApply,
}: {
    target: Extract<AssistTarget, 'excerpt' | 'seo'>;
    label: string;
    getDraft: () => DraftSnapshot;
    onApply: (result: {
        excerpt?: string;
        meta_title?: string;
        meta_description?: string;
    }) => void;
}) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [errorDetail, setErrorDetail] = useState<AiErrorDetail | null>(null);

    const run = async () => {
        if (busy) {
            return;
        }

        setBusy(true);

        const data = await requestAssist(target, getDraft(), t, setErrorDetail);

        if (data) {
            const excerpt =
                typeof data.excerpt === 'string' ? data.excerpt : '';
            const metaTitle =
                typeof data.meta_title === 'string' ? data.meta_title : '';
            const metaDescription =
                typeof data.meta_description === 'string'
                    ? data.meta_description
                    : '';

            if (target === 'excerpt' && excerpt === '') {
                toast.info(t('articles.ai.assist.none'));
            } else if (
                target === 'seo' &&
                metaTitle === '' &&
                metaDescription === ''
            ) {
                toast.info(t('articles.ai.assist.none'));
            } else {
                onApply({
                    ...(excerpt ? { excerpt } : {}),
                    ...(metaTitle ? { meta_title: metaTitle } : {}),
                    ...(metaDescription
                        ? { meta_description: metaDescription }
                        : {}),
                });
                toast.success(t('articles.ai.assist.applied'));
            }
        }

        setBusy(false);
    };

    return (
        <>
            <AssistTrigger label={label} busy={busy} onClick={run} />
            <ErrorDetailDialog
                detail={errorDetail}
                onClose={() => setErrorDetail(null)}
            />
        </>
    );
}

/**
 * 「AI 分类 / AI 标签」：AI 给出建议词条（缺失的词条后端已建好并标记 created），
 * 弹窗让作者勾选后再加入，避免未经确认就改动文章归类。
 */
export function AiTermButton({
    target,
    label,
    taxonomyName,
    selectedIds,
    getDraft,
    onConfirm,
}: {
    target: Extract<AssistTarget, 'categories' | 'tags'>;
    label: string;
    taxonomyName: string;
    selectedIds: number[];
    getDraft: () => DraftSnapshot;
    onConfirm: (terms: AiTermSuggestion[]) => void;
}) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<AiTermSuggestion[]>([]);
    const [picked, setPicked] = useState<number[]>([]);
    const [errorDetail, setErrorDetail] = useState<AiErrorDetail | null>(null);

    const run = async () => {
        if (busy) {
            return;
        }

        setBusy(true);

        const data = await requestAssist(target, getDraft(), t, setErrorDetail);

        if (data) {
            const terms = (
                Array.isArray(data.terms) ? data.terms : []
            ) as AiTermSuggestion[];
            // 已经选中的词条不必再让作者重复勾选
            const fresh = terms.filter(
                (term) => !selectedIds.includes(term.id),
            );

            if (fresh.length === 0) {
                toast.info(t('articles.ai.assist.none'));
            } else {
                setSuggestions(fresh);
                setPicked(fresh.map((term) => term.id));
                setOpen(true);
            }
        }

        setBusy(false);
    };

    const toggle = (id: number) => {
        setPicked((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    };

    const confirm = () => {
        onConfirm(suggestions.filter((term) => picked.includes(term.id)));
        setOpen(false);
    };

    return (
        <>
            <AssistTrigger label={label} busy={busy} onClick={run} />

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            {t('articles.ai.assist.pickTitle', {
                                name: taxonomyName,
                            })}
                        </DialogTitle>
                        <DialogDescription>
                            {t('articles.ai.assist.pickDescription')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
                        {suggestions.map((term) => (
                            <label
                                key={term.id}
                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/60"
                            >
                                <Checkbox
                                    checked={picked.includes(term.id)}
                                    onCheckedChange={() => toggle(term.id)}
                                />
                                <span className="text-callout flex-1 truncate">
                                    {term.name}
                                </span>
                                {term.created && (
                                    <span className="text-tertiary-label inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-xs">
                                        {t('articles.ai.assist.newTerm')}
                                    </span>
                                )}
                            </label>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            onClick={confirm}
                            disabled={picked.length === 0}
                        >
                            <Check className="h-4 w-4" />
                            {t('articles.ai.assist.addSelected', {
                                count: picked.length,
                            })}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ErrorDetailDialog
                detail={errorDetail}
                onClose={() => setErrorDetail(null)}
            />
        </>
    );
}
