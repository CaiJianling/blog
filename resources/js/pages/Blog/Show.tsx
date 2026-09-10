import { Head, Link, usePage } from '@inertiajs/react';
import { Eye, MessageSquare, Clock, ChevronRight, ArrowLeft, ArrowRight, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CommentSection, { type CommentItem, type SmileyGroupData } from '@/components/comments/comment-section';
import { blocknoteToHtml } from '@/lib/blocknote-to-html';
import blog from '@/routes/blog';
import { home } from '@/routes';
import type { BlockNoteDocument } from '@/components/blocknote-editor';

type Article = {
    id: number;
    title: string;
    content: BlockNoteDocument;
    excerpt: string;
    author_name: string;
    author_avatar: string;
    categories: { name: string; slug: string }[];
    tags: { name: string; slug: string }[];
    views: number;
    comment_count: number;
    created_at: string;
    permalink: string;
    comment_status: string;
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

export default function Show({ article, comments, captcha, smileyGroups, relatedArticles, prevArticle, nextArticle }: Props) {
    const { t } = useTranslation();
    const { name } = usePage().props as { name?: string };
    const firstCategory = article.categories[0];

    return (
        <>
            <Head title={article.title} />

            <div className="mx-auto max-w-4xl px-5 py-8 md:px-8 md:py-12">
                {/* 面包屑 */}
                <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1.5 text-footnote text-muted-foreground">
                    <Link href={home()} className="apple-press inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground">
                        <Home className="h-3.5 w-3.5" />
                        {name}
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                    <Link href={blog.index()} className="apple-press rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground">
                        {t('articlePage.blog')}
                    </Link>
                    {firstCategory && (
                        <>
                            <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                            <Link
                                href={blog.index({ query: { category: firstCategory.slug } })}
                                className="apple-press rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground"
                            >
                                {firstCategory.name}
                            </Link>
                        </>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                    <span className="line-clamp-1 max-w-[12rem] text-foreground/80">{article.title}</span>
                </nav>

                <article className="mt-6">
                    {/* 文章头部 */}
                    <header className="apple-card p-6 md:p-10">
                        {article.categories.length > 0 && (
                            <div className="mb-4 flex flex-wrap gap-2">
                                {article.categories.map((cat) => (
                                    <Link
                                        key={cat.slug}
                                        href={blog.index({ query: { category: cat.slug } })}
                                        className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground hover:opacity-80"
                                    >
                                        {cat.name}
                                    </Link>
                                ))}
                            </div>
                        )}

                        <h1 className="text-title leading-tight md:text-display md:leading-tight">
                            {article.title}
                        </h1>

                        {/* 元信息栏 */}
                        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border/40 pt-5 text-footnote text-muted-foreground">
                            <span className="inline-flex items-center gap-2">
                                {article.author_avatar ? (
                                    <img src={article.author_avatar} alt={article.author_name} className="h-6 w-6 rounded-full object-cover" />
                                ) : (
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                        {(article.author_name || 'A').charAt(0).toUpperCase()}
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
                                {t('publicComment.views', { count: article.views })}
                            </span>
                            <a href="#comments" className="inline-flex items-center gap-1.5 hover:text-foreground">
                                <MessageSquare className="h-3.5 w-3.5" />
                                {t('publicComment.commentsCount', { count: article.comment_count })}
                            </a>
                        </div>
                    </header>

                    {/* 正文 */}
                    <div className="apple-card mt-5 px-6 py-8 md:px-10 md:py-10">
                        {article.content && article.content.length > 0 ? (
                            <div
                                className="article-content"
                                dangerouslySetInnerHTML={{ __html: blocknoteToHtml(article.content) }}
                            />
                        ) : (
                            <p className="text-muted-foreground">{t('articlePage.noContent')}</p>
                        )}

                        {/* 标签 */}
                        {article.tags.length > 0 && (
                            <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-border/40 pt-6">
                                {article.tags.map((tag) => (
                                    <Link
                                        key={tag.slug}
                                        href={blog.index({ query: { tag: tag.slug } })}
                                        className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                                    >
                                        #{tag.name}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </article>

                {/* 上一篇 / 下一篇 */}
                {(prevArticle || nextArticle) && (
                    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {prevArticle ? (
                            <Link href={prevArticle.permalink} className="apple-card apple-press group flex items-center gap-3 p-5 hover:-translate-y-0.5">
                                <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
                                <div className="min-w-0">
                                    <p className="text-footnote text-muted-foreground">{t('articlePage.prev')}</p>
                                    <p className="mt-0.5 line-clamp-1 text-sm font-medium group-hover:text-primary transition-colors">
                                        {prevArticle.title}
                                    </p>
                                </div>
                            </Link>
                        ) : (
                            <div className="hidden sm:block" />
                        )}
                        {nextArticle && (
                            <Link href={nextArticle.permalink} className="apple-card apple-press group flex items-center justify-end gap-3 p-5 text-right hover:-translate-y-0.5">
                                <div className="min-w-0">
                                    <p className="text-footnote text-muted-foreground">{t('articlePage.next')}</p>
                                    <p className="mt-0.5 line-clamp-1 text-sm font-medium group-hover:text-primary transition-colors">
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
                        <h2 className="text-title mb-5">{t('articlePage.related')}</h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {relatedArticles.map((r) => (
                                <Link
                                    key={r.id}
                                    href={r.permalink}
                                    className="apple-card apple-press group p-5 hover:-translate-y-0.5"
                                >
                                    <h3 className="text-headline line-clamp-2 group-hover:text-primary transition-colors">
                                        {r.title}
                                    </h3>
                                    <span className="mt-2 text-footnote text-muted-foreground">{r.created_at}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* 评论 */}
                <CommentSection
                    articleId={article.id}
                    comments={comments}
                    captcha={captcha}
                    smileyGroups={smileyGroups}
                    commentStatus={article.comment_status}
                />
            </div>
        </>
    );
}
