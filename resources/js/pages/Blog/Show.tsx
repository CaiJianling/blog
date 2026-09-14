import { Head, Link, usePage } from '@inertiajs/react';
import {
    Eye,
    MessageSquare,
    Clock,
    ChevronRight,
    ArrowLeft,
    ArrowRight,
    Home,
    ListTree,
    Heart,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BlockNoteDocument } from '@/components/blocknote-editor';
import CommentSection from '@/components/comments/comment-section';
import type {
    CommentItem,
    SmileyGroupData,
} from '@/components/comments/comment-section';
import { blocknoteToHtml } from '@/lib/blocknote-to-html';
import { buildSeoMeta } from '@/lib/seo';
import { home } from '@/routes';
import blog from '@/routes/blog';

type Article = {
    id: number;
    title: string;
    content: BlockNoteDocument;
    excerpt: string;
    meta_title: string | null;
    meta_description: string | null;
    author_name: string;
    author_avatar: string;
    categories: { name: string; slug: string }[];
    tags: { name: string; slug: string }[];
    views: number;
    comment_count: number;
    created_at: string;
    permalink: string;
    comment_status: string;
    likes: number;
    liked_by_me: boolean | null;
};

type Related = {
    id: number;
    title: string;
    slug: string;
    permalink: string;
    created_at: string;
};

type PrevNext = {
    title: string;
    permalink: string;
} | null;

type Props = {
    article: Article;
    comments: CommentItem[];
    captcha: { question: string; token: string } | null;
    smileyGroups: SmileyGroupData[];
    relatedArticles: Related[];
    prevArticle: PrevNext;
    nextArticle: PrevNext;
};

/** 游客读取本地点赞记录 */
function readGuestLiked(articleId: number): boolean {
    try {
        const likedList: number[] = JSON.parse(
            localStorage.getItem('blog-liked-articles') ?? '[]',
        );

        return likedList.includes(articleId);
    } catch {
        return false;
    }
}

type TocItem = {
    id: string;
    text: string;
    level: number;
};

/** 从 BlockNote 内容中提取标题生成文章大纲。 */
function extractHeadings(content: BlockNoteDocument): TocItem[] {
    const items: TocItem[] = [];

    const walk = (blocks: BlockNoteDocument) => {
        for (const block of blocks) {
            if ((block as { type?: string }).type === 'heading') {
                const typed = block as {
                    props?: { level?: number };
                    content?: unknown;
                };
                const level = Math.min(
                    Math.max(Number(typed.props?.level) || 1, 1),
                    4,
                );
                const text = Array.isArray(typed.content)
                    ? typed.content
                          .map((inline) =>
                              typeof inline === 'object' &&
                              inline !== null &&
                              'text' in inline
                                  ? String(
                                        (inline as { text?: unknown }).text ??
                                            '',
                                    )
                                  : '',
                          )
                          .join('')
                    : '';

                if (text.trim() !== '') {
                    items.push({
                        id: `heading-${items.length}`,
                        text: text.trim(),
                        level,
                    });
                }
            }

            const children = (block as { children?: BlockNoteDocument })
                .children;

            if (Array.isArray(children)) {
                walk(children);
            }
        }
    };

    walk(content ?? []);

    return items;
}

export default function Show({
    article,
    comments,
    captcha,
    smileyGroups,
    relatedArticles,
    prevArticle,
    nextArticle,
}: Props) {
    const { t } = useTranslation();
    const { name } = usePage().props as { name?: string };
    const seo = usePage().props.seo;
    const pageTitle = article.meta_title?.trim() || article.title;
    const pageDescription = article.meta_description?.trim() || article.excerpt;
    const firstCategory = article.categories[0];

    const tocItems = useMemo(
        () => extractHeadings(article.content ?? []),
        [article.content],
    );
    const [activeHeading, setActiveHeading] = useState<string | null>(null);

    const isLoggedIn = !!usePage().props.auth?.user;
    const [likes, setLikes] = useState(article.likes);
    const [liked, setLiked] = useState<boolean>(
        // 游客根据浏览器本地记录判断是否点赞过
        article.liked_by_me ?? readGuestLiked(article.id),
    );
    const [likeSending, setLikeSending] = useState(false);

    const guestId = useCallback((): string => {
        let id = localStorage.getItem('blog-guest-id');

        if (!id) {
            id =
                typeof crypto !== 'undefined' && 'randomUUID' in crypto
                    ? crypto.randomUUID()
                    : `guest-${Date.now()}`;
            localStorage.setItem('blog-guest-id', id);
        }

        return id;
    }, []);

    const toggleLike = async () => {
        if (likeSending) {
            return;
        }

        setLikeSending(true);

        try {
            const csrf =
                document
                    .querySelector('meta[name="csrf-token"]')
                    ?.getAttribute('content') ?? '';
            const xsrf = document.cookie.match(
                /(?:^|;\s*)XSRF-TOKEN=([^;]+)/,
            )?.[1];
            const headers: Record<string, string> = {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            };

            if (csrf) {
                headers['X-CSRF-TOKEN'] = csrf;
            } else if (xsrf) {
                headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);
            }

            const response = await fetch(`/articles/${article.id}/like`, {
                method: 'POST',
                headers,
                body: JSON.stringify(isLoggedIn ? {} : { guestId: guestId() }),
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(data?.message ?? '点赞失败');
            }

            setLikes(data.likes);
            setLiked(data.liked);

            // 游客的点赞状态记录在浏览器本地
            if (!isLoggedIn) {
                const likedList: number[] = JSON.parse(
                    localStorage.getItem('blog-liked-articles') ?? '[]',
                );
                const next = data.liked
                    ? [
                          ...likedList.filter((id) => id !== article.id),
                          article.id,
                      ]
                    : likedList.filter((id) => id !== article.id);

                localStorage.setItem(
                    'blog-liked-articles',
                    JSON.stringify(next),
                );
            }
        } catch {
            // 静默失败，不打断阅读
        } finally {
            setLikeSending(false);
        }
    };

    // 为渲染后的标题 DOM 按顺序写入锚点 id
    useEffect(() => {
        if (tocItems.length === 0) {
            return;
        }

        const nodes = document.querySelectorAll(
            '.article-content h1, .article-content h2, .article-content h3, .article-content h4',
        );

        nodes.forEach((node, index) => {
            if (tocItems[index]) {
                node.id = tocItems[index].id;
                (node as HTMLElement).style.scrollMarginTop = '5.5rem';
            }
        });
    }, [tocItems]);

    // 滚动高亮当前所在章节
    useEffect(() => {
        if (tocItems.length === 0) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveHeading(entry.target.id);
                    }
                }
            },
            { rootMargin: '-20% 0px -70% 0px' },
        );

        tocItems.forEach((item) => {
            const node = document.getElementById(item.id);

            if (node) {
                observer.observe(node);
            }
        });

        return () => observer.disconnect();
    }, [tocItems]);

    return (
        <>
            <Head title={pageTitle}>
                {buildSeoMeta({
                    site: seo,
                    title: pageTitle,
                    description: pageDescription,
                    type: 'article',
                })}
            </Head>

            <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-12">
                {/* 面包屑 */}
                <nav
                    aria-label="breadcrumb"
                    className="text-footnote flex flex-wrap items-center gap-1.5 text-muted-foreground"
                >
                    <Link
                        href={home()}
                        className="apple-press inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground"
                    >
                        <Home className="h-3.5 w-3.5" />
                        {name}
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                    <Link
                        href={blog.index()}
                        className="apple-press rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground"
                    >
                        {t('articlePage.blog')}
                    </Link>
                    {firstCategory && (
                        <>
                            <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                            <Link
                                href={blog.index({
                                    query: { category: firstCategory.slug },
                                })}
                                className="apple-press rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground"
                            >
                                {firstCategory.name}
                            </Link>
                        </>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                    <span className="line-clamp-1 max-w-[12rem] text-foreground/80">
                        {article.title}
                    </span>
                </nav>

                <div className="mt-6 flex items-start gap-6">
                    {/* 文章大纲 */}
                    {tocItems.length > 0 && (
                        <aside className="top-24 hidden w-60 shrink-0 self-start xl:sticky xl:block">
                            <div className="apple-card p-4">
                                <h3 className="text-callout mb-2.5 flex items-center gap-1.5 px-1 font-medium">
                                    <ListTree className="h-3.5 w-3.5 text-primary" />
                                    大纲
                                </h3>
                                <nav className="max-h-[60vh] space-y-0.5 overflow-y-auto">
                                    {tocItems.map((item) => (
                                        <a
                                            key={item.id}
                                            href={`#${item.id}`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                document
                                                    .getElementById(item.id)
                                                    ?.scrollIntoView({
                                                        behavior: 'smooth',
                                                    });
                                            }}
                                            className={`block truncate rounded-lg py-1.5 pr-2 text-xs transition-colors hover:text-primary ${
                                                activeHeading === item.id
                                                    ? 'font-medium text-primary'
                                                    : 'text-muted-foreground'
                                            } ${item.level === 2 ? 'pl-2.5' : item.level === 3 ? 'pl-5' : 'pl-1.5'}`}
                                            title={item.text}
                                        >
                                            {item.text}
                                        </a>
                                    ))}
                                </nav>
                            </div>
                        </aside>
                    )}
                    <div className="min-w-0 flex-1">
                        <article className="mt-0">
                            {/* 文章头部 */}
                            <header className="apple-card p-6 md:p-10">
                                {article.categories.length > 0 && (
                                    <div className="mb-4 flex flex-wrap gap-2">
                                        {article.categories.map((cat) => (
                                            <Link
                                                key={cat.slug}
                                                href={blog.index({
                                                    query: {
                                                        category: cat.slug,
                                                    },
                                                })}
                                                className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground hover:opacity-80"
                                            >
                                                {cat.name}
                                            </Link>
                                        ))}
                                    </div>
                                )}

                                <h1 className="text-title md:text-display leading-tight md:leading-tight">
                                    {article.title}
                                </h1>

                                {/* 元信息栏 */}
                                <div className="text-footnote mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border/40 pt-5 text-muted-foreground">
                                    <span className="inline-flex items-center gap-2">
                                        {article.author_avatar ? (
                                            <img
                                                src={article.author_avatar}
                                                alt={article.author_name}
                                                className="h-6 w-6 rounded-full object-cover"
                                            />
                                        ) : (
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                                {(article.author_name || 'A')
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </span>
                                        )}
                                        {article.author_name}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5" />
                                        {article.created_at}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <Eye className="h-3.5 w-3.5" />
                                        {t('publicComment.views', {
                                            count: article.views,
                                        })}
                                    </span>
                                    <a
                                        href="#comments"
                                        className="inline-flex items-center gap-1.5 hover:text-foreground"
                                    >
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        {t('publicComment.commentsCount', {
                                            count: article.comment_count,
                                        })}
                                    </a>
                                </div>
                            </header>

                            {/* 正文 */}
                            <div className="apple-card mt-5 px-6 py-8 md:px-10 md:py-10">
                                {article.content &&
                                article.content.length > 0 ? (
                                    <div
                                        className="article-content"
                                        dangerouslySetInnerHTML={{
                                            __html: blocknoteToHtml(
                                                article.content,
                                            ),
                                        }}
                                    />
                                ) : (
                                    <p className="text-muted-foreground">
                                        {t('articlePage.noContent')}
                                    </p>
                                )}

                                {/* 标签 */}
                                {article.tags.length > 0 && (
                                    <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-border/40 pt-6">
                                        {article.tags.map((tag) => (
                                            <Link
                                                key={tag.slug}
                                                href={blog.index({
                                                    query: { tag: tag.slug },
                                                })}
                                                className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                                            >
                                                #{tag.name}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </article>

                        {/* 点赞 */}
                        <div className="mt-5 flex justify-center">
                            <button
                                type="button"
                                onClick={() => void toggleLike()}
                                disabled={likeSending}
                                className={`apple-press flex items-center gap-2 rounded-full border px-6 py-2.5 text-sm font-medium transition-all disabled:opacity-60 ${
                                    liked
                                        ? 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400'
                                        : 'border-border/60 bg-popover text-muted-foreground hover:border-rose-200 hover:text-rose-500 dark:hover:border-rose-500/30'
                                }`}
                                aria-pressed={liked}
                            >
                                <Heart
                                    className={`h-4 w-4 ${liked ? 'fill-rose-500 text-rose-500 dark:fill-rose-400 dark:text-rose-400' : ''}`}
                                />
                                {liked ? '已点赞' : '点赞'}
                                <span className="tabular-nums">{likes}</span>
                            </button>
                        </div>

                        {/* 评论：置于正文之后、上下篇之前 */}
                        <div className="mt-12">
                            <CommentSection
                                articleId={article.id}
                                comments={comments}
                                captcha={captcha}
                                smileyGroups={smileyGroups}
                                commentStatus={article.comment_status}
                            />
                        </div>

                        {/* 上一篇 / 下一篇 */}
                        {(prevArticle || nextArticle) && (
                            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {prevArticle ? (
                                    <Link
                                        href={prevArticle.permalink}
                                        className="apple-card apple-press group flex items-center gap-3 p-5 hover:-translate-y-0.5"
                                    >
                                        <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
                                        <div className="min-w-0">
                                            <p className="text-footnote text-muted-foreground">
                                                {t('articlePage.prev')}
                                            </p>
                                            <p className="mt-0.5 line-clamp-1 text-sm font-medium transition-colors group-hover:text-primary">
                                                {prevArticle.title}
                                            </p>
                                        </div>
                                    </Link>
                                ) : (
                                    <div className="hidden sm:block" />
                                )}
                                {nextArticle && (
                                    <Link
                                        href={nextArticle.permalink}
                                        className="apple-card apple-press group flex items-center justify-end gap-3 p-5 text-right hover:-translate-y-0.5"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-footnote text-muted-foreground">
                                                {t('articlePage.next')}
                                            </p>
                                            <p className="mt-0.5 line-clamp-1 text-sm font-medium transition-colors group-hover:text-primary">
                                                {nextArticle.title}
                                            </p>
                                        </div>
                                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                                    </Link>
                                )}
                            </div>
                        )}

                        {/* 相关文章 */}
                        {relatedArticles.length > 0 && (
                            <div className="mt-12">
                                <h2 className="text-title mb-5">
                                    {t('articlePage.related')}
                                </h2>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {relatedArticles.map((r) => (
                                        <Link
                                            key={r.id}
                                            href={r.permalink}
                                            className="apple-card apple-press group p-5 hover:-translate-y-0.5"
                                        >
                                            <h3 className="text-headline line-clamp-2 transition-colors group-hover:text-primary">
                                                {r.title}
                                            </h3>
                                            <span className="text-footnote mt-2 text-muted-foreground">
                                                {r.created_at}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
