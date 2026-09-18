import { router, usePage } from '@inertiajs/react';
import { ChevronDown, ChevronUp, Eye, Lock, MessageCircle, Pencil, Send, Smile, Reply } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type CommentItem = {
    comment_id: number;
    parent_id: number;
    author_name: string;
    author_url: string;
    author_qq: string | null;
    avatar: string;
    html: string;
    /** 原文（未渲染），供本人编辑时回填 */
    content: string;
    user_id: number;
    is_private: boolean;
    is_markdown: boolean;
    is_own: boolean;
    /** 本人评论是否有待审批的编辑修订 */
    has_pending_edit: boolean;
    /** 待审修订原文（本人评论，无则为 null） */
    pending_edit: string | null;
    /** 最近一次编辑生效时间（null = 未编辑过） */
    edited_at: string | null;
    created_at: string;
    replies?: CommentItem[];
};

export type SmileyGroupData = {
    id: number;
    name: string;
    smileys: { code: string; url: string }[];
};

type Captcha = { question: string; token: string } | null;

type AuthUser = { id: number; name: string; nickname: string | null; email: string; role?: string } | null;

interface Props {
    articleId: number;
    comments: CommentItem[];
    captcha: Captcha;
    smileyGroups: SmileyGroupData[];
    commentStatus: string;
}

const AUTHOR_STORAGE_KEY = 'comment_guest_info';

function readGuestInfo(): { name: string; email: string; url: string } {
    try {
        return JSON.parse(localStorage.getItem(AUTHOR_STORAGE_KEY) ?? '{}');
    } catch {
        return { name: '', email: '', url: '' };
    }
}

function GuestAvatar({ name, src }: { name: string; src?: string }) {
    if (src) {
        return <img src={src} alt={name} className="h-9 w-9 shrink-0 rounded-full object-cover" loading="lazy" />;
    }

    return (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {(name || '?').charAt(0).toUpperCase()}
        </span>
    );
}

function AuthorName({ comment }: { comment: CommentItem }) {
    const { t } = useTranslation();

    const name = comment.author_name || t('publicComment.anonymous');

    if (comment.author_url) {
        return (
            <a
                href={comment.author_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-sm font-medium hover:text-primary"
            >
                {name}
            </a>
        );
    }

    return <span className="text-sm font-medium">{name}</span>;
}

function CommentBody({ html }: { html: string }) {
    return (
        <div
            className="comment-content mt-1.5 text-sm leading-relaxed text-foreground/90 break-words"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

function CommentItemView({ comment, onReply }: { comment: CommentItem; onReply: (c: CommentItem) => void }) {
    const { t } = useTranslation();
    const { auth } = usePage().props as { auth: { user: AuthUser } };
    const user = auth.user;

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);

    const startEdit = () => {
        setDraft(comment.pending_edit ?? comment.content);
        setEditing(true);
    };

    const saveEdit = () => {
        if (!draft.trim() || saving) {
            return;
        }

        setSaving(true);
        const isAdmin = user?.role === 'administrator';

        router.put(`/comments/${comment.comment_id}`, { content: draft }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(isAdmin ? t('publicComment.editSaved') : t('publicComment.editPendingSubmitted'));
                router.reload({ only: ['comments', 'article'] });
            },
            onError: (errors) => {
                const first = errors.message ?? Object.values(errors)[0];
                toast.error(Array.isArray(first) ? first[0] : (first ?? t('publicComment.editFailed')));
            },
            onFinish: () => setSaving(false),
        });
    };

    return (
        <div className="flex gap-3" id={`comment-${comment.comment_id}`}>
            <GuestAvatar name={comment.author_name} src={comment.avatar} />
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <AuthorName comment={comment} />
                    {comment.is_own && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                            {t('publicComment.authorBadge')}
                        </span>
                    )}
                    {comment.is_private && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                            <Lock className="h-2.5 w-2.5" />
                            {t('publicComment.privateBadge')}
                        </span>
                    )}
                    {comment.has_pending_edit && (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                            {t('publicComment.pendingEdit')}
                        </span>
                    )}
                    <span className="text-xs text-muted-foreground">{comment.created_at}</span>
                    {comment.edited_at && (
                        <span className="text-xs text-muted-foreground">
                            {t('publicComment.edited')} · {comment.edited_at}
                        </span>
                    )}
                </div>

                {editing ? (
                    <div className="mt-2">
                        <Textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            rows={Math.min(8, Math.max(3, draft.split('\n').length + 1))}
                            className="resize-y text-sm"
                            autoFocus
                        />
                        <div className="mt-2 flex items-center gap-2">
                            <Button size="sm" className="h-7 rounded-full px-4 text-xs" onClick={saveEdit} disabled={saving || !draft.trim()}>
                                {saving ? t('publicComment.editing') : t('publicComment.save')}
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 rounded-full px-3 text-xs"
                                onClick={() => setEditing(false)}
                                disabled={saving}
                            >
                                {t('publicComment.cancel')}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <CommentBody html={comment.html} />
                        <div className="mt-1.5 flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => onReply(comment)}
                                className="apple-press inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                                <Reply className="h-3 w-3" />
                                {t('publicComment.reply')}
                            </button>
                            {comment.is_own && (
                                <button
                                    type="button"
                                    onClick={startEdit}
                                    className="apple-press inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                    <Pencil className="h-3 w-3" />
                                    {t('publicComment.edit')}
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function CommentSection({ articleId, comments, captcha, smileyGroups, commentStatus }: Props) {
    const { t } = useTranslation();
    const { auth } = usePage().props as { auth: { user: AuthUser } };
    const user = auth.user;

    const guest = readGuestInfo();

    const [content, setContent] = useState('');
    const [authorName, setAuthorName] = useState(guest.name ?? '');
    const [authorEmail, setAuthorEmail] = useState(guest.email ?? '');
    const [authorUrl, setAuthorUrl] = useState(guest.url ?? '');
    const [captchaAnswer, setCaptchaAnswer] = useState('');
    const [isMarkdown, setIsMarkdown] = useState(true);
    const [isPrivate, setIsPrivate] = useState(false);
    const [notifyMail, setNotifyMail] = useState(false);
    const [websiteOpen, setWebsiteOpen] = useState((guest.url ?? '') !== '');
    const [smileyOpen, setSmileyOpen] = useState(false);
    const [activeGroup, setActiveGroup] = useState(0);
    const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
    const [error, setError] = useState('');
    const contentRef = useRef<HTMLTextAreaElement>(null);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!content.trim()) {
            setError(t('publicComment.emptyContent'));

            return;
        }

        router.post('/comments', {
            object_id: articleId,
            parent_id: replyTo?.comment_id ?? null,
            content,
            author_name: user ? null : authorName,
            author_email: user ? null : authorEmail,
            author_url: user ? null : authorUrl,
            captcha_token: user ? null : captcha?.token,
            captcha_answer: user ? null : Number(captchaAnswer),
            is_markdown: isMarkdown,
            is_private: isPrivate,
            notify_mail: notifyMail,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setContent('');
                setCaptchaAnswer('');
                setReplyTo(null);
                setSmileyOpen(false);

                if (!user) {
                    localStorage.setItem(AUTHOR_STORAGE_KEY, JSON.stringify({ name: authorName, email: authorEmail, url: authorUrl }));
                }

                router.reload({ only: ['comments', 'captcha', 'article'] });
            },
            onError: (errors) => {
                const first = errors.message ?? Object.values(errors)[0];
                setError(Array.isArray(first) ? first[0] : (first ?? 'Error'));
            },
        });
    };

    const insertSmiley = (code: string) => {
        setContent((prev) => `${prev}:${code}: `);
        contentRef.current?.focus();
    };

    const total = comments.reduce((sum, c) => sum + 1 + (c.replies?.length ?? 0), 0);

    if (commentStatus !== 'open' && total === 0) {
        return (
            <div id="comments" className="mt-12 scroll-mt-20">
                <h2 className="text-title mb-5">{t('publicComment.title')}</h2>
                <div className="apple-card p-8 text-center text-muted-foreground">{t('publicComment.closed')}</div>
            </div>
        );
    }

    return (
        <div id="comments" className="mt-12 scroll-mt-20">
            <h2 className="text-title mb-5">{t('publicComment.count', { count: total })}</h2>

            {/* 评论列表 */}
            {total > 0 ? (
                <div className="space-y-6">
                    {comments.map((c) => (
                        <div key={c.comment_id} className="apple-card p-5">
                            <CommentItemView comment={c} onReply={setReplyTo} />
                            {c.replies && c.replies.length > 0 && (
                                <div className="mt-4 space-y-4 border-l-2 border-border/50 pl-4">
                                    {c.replies.map((r) => (
                                        <CommentItemView key={r.comment_id} comment={r} onReply={setReplyTo} />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                commentStatus === 'open' && (
                    <div className="apple-card p-8 text-center text-muted-foreground">{t('publicComment.empty')}</div>
                )
            )}

            {/* 评论表单 */}
            {commentStatus === 'open' && (
                <form onSubmit={submit} className="apple-card mt-6 p-5 md:p-6">
                    <h3 className="text-headline flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-primary" />
                        {replyTo ? t('publicComment.replyTo', { name: replyTo.author_name }) : t('publicComment.title')}
                    </h3>

                    {replyTo && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            {t('publicComment.replyingTo', { name: replyTo.author_name })}
                            <button
                                type="button"
                                onClick={() => setReplyTo(null)}
                                className="apple-press rounded-md px-1.5 py-0.5 hover:bg-muted"
                            >
                                {t('publicComment.cancel')}
                            </button>
                        </div>
                    )}

                    <Textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={t('publicComment.placeholder')}
                        rows={4}
                        className="mt-4 resize-y"
                    />

                    {/* 游客信息 + 验证码 */}
                    {!user && (
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="relative">
                                <Input
                                    value={authorName}
                                    onChange={(e) => setAuthorName(e.target.value)}
                                    placeholder={t('publicComment.nickname')}
                                    className="pl-9"
                                />
                                <Smile className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            </div>
                            <div className="relative">
                                <Input
                                    value={authorEmail}
                                    onChange={(e) => setAuthorEmail(e.target.value)}
                                    placeholder={t('publicComment.emailOrQq')}
                                    className="pl-9"
                                />
                                <Eye className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            </div>
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={captchaAnswer}
                                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                                    placeholder={t('publicComment.captcha')}
                                    className="pl-9"
                                />
                                <Lock className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                {captcha && (
                                    <span className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md bg-secondary px-2 py-0.5 text-xs font-mono text-secondary-foreground">
                                        {captcha.question} =
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {user && (
                        <p className="mt-3 text-xs text-muted-foreground">
                            {t('publicComment.identity', { name: user.nickname || user.name })}
                        </p>
                    )}

                    {/* 折叠：网站输入 */}
                    {!user && (
                        <button
                            type="button"
                            onClick={() => setWebsiteOpen((v) => !v)}
                            className="apple-press mt-3 flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={t('publicComment.websiteToggle')}
                        >
                            {websiteOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                    )}
                    {!user && websiteOpen && (
                        <div className="relative mt-3">
                            <Input
                                value={authorUrl}
                                onChange={(e) => setAuthorUrl(e.target.value)}
                                placeholder={t('publicComment.website')}
                                className="pl-9"
                                type="url"
                            />
                            <Smile className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        </div>
                    )}

                    {/* 选项行 */}
                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <Checkbox checked={isMarkdown} onCheckedChange={(v) => setIsMarkdown(v === true)} />
                            {t('publicComment.markdown')}
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <Checkbox checked={isPrivate} onCheckedChange={(v) => setIsPrivate(v === true)} />
                            {t('publicComment.private')}
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <Checkbox checked={notifyMail} onCheckedChange={(v) => setNotifyMail(v === true)} />
                            {t('publicComment.notify')}
                        </label>

                        <div className="ml-auto flex items-center gap-2">
                            {/* 表情按钮 */}
                            <div className="relative">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSmileyOpen((v) => !v)}
                                    aria-label="Emoji"
                                    className="rounded-full"
                                >
                                    <Smile className={cn('h-5 w-5', smileyOpen && 'text-primary')} />
                                </Button>
                                {smileyOpen && smileyGroups.length > 0 && (
                                    <div className="absolute right-0 bottom-10 z-20 w-72 rounded-2xl border border-border/60 bg-popover p-3 shadow-apple-lg">
                                        {/* 分组标签页 */}
                                        <div className="mb-2 flex flex-wrap gap-1">
                                            {smileyGroups.map((g, i) => (
                                                <button
                                                    key={g.id}
                                                    type="button"
                                                    onClick={() => setActiveGroup(i)}
                                                    className={cn(
                                                        'apple-press rounded-lg px-2.5 py-1 text-xs',
                                                        activeGroup === i
                                                            ? 'bg-primary text-primary-foreground'
                                                            : 'text-muted-foreground hover:bg-muted',
                                                    )}
                                                >
                                                    {g.name}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="grid max-h-44 grid-cols-6 gap-1 overflow-y-auto">
                                            {smileyGroups[activeGroup]?.smileys.map((s) => (
                                                <button
                                                    key={s.code}
                                                    type="button"
                                                    onClick={() => insertSmiley(s.code)}
                                                    title={s.code}
                                                    className="apple-press rounded-lg p-1.5 hover:bg-muted"
                                                >
                                                    <img src={s.url} alt={s.code} className="h-6 w-6" loading="lazy" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button type="submit" className="rounded-full px-5">
                                <Send className="h-4 w-4" />
                                {t('publicComment.send')}
                            </Button>
                        </div>
                    </div>

                    {isPrivate && (
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                            <Lock className="h-3 w-3" />
                            {t('publicComment.privateHint')}
                        </p>
                    )}
                    {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
                </form>
            )}
        </div>
    );
}
