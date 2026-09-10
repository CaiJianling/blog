import { Head, Link, router } from '@inertiajs/react';
import { Eye, MessageSquare, Clock } from 'lucide-react';
import PageSearch from '@/components/page-search';
import blog from '@/routes/blog';

type Article = {
    id: number;
    title: string;
    slug: string;
    permalink: string;
    excerpt: string;
    author_name: string;
    author_avatar: string;
    categories: { name: string; slug: string }[];
    tags: { name: string; slug: string }[];
    views: number;
    comment_count: number;
    created_at: string;
};

type Category = {
    name: string;
    slug: string;
    count: number;
};

type Props = {
    articles: {
        data: Article[];
        links: { url: string | null; label: string; active: boolean }[];
        current_page: number;
        last_page: number;
    };
    categories: Category[];
    currentCategory?: string;
    currentTag?: string;
    currentQuery?: string;
};

export default function Index({ articles, categories, currentCategory, currentTag, currentQuery }: Props) {
    const doSearch = (value: string) => {
        router.get(blog.index().url, {
            q: value || undefined,
            category: currentCategory || undefined,
        }, { preserveScroll: true });
    };

    return (
        <>
            <Head title="博客" />

            <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
                <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-display">博客</h1>
                        <p className="mt-2 text-body text-muted-foreground">
                            技术教程、开发经验与生活随笔
                        </p>
                    </div>
                    <PageSearch
                        initial={currentQuery ?? ''}
                        placeholder="搜索文章标题"
                        buttonLabel="搜索文章"
                        onSubmit={doSearch}
                    />
                </div>

                {currentQuery && (
                    <p className="mb-6 text-body text-muted-foreground">
                        搜索“{currentQuery}”的文章，共 {articles.data.length} 篇
                    </p>
                )}

                {/* Category filter */}
                {categories.length > 0 && (
                    <div className="mb-8 flex flex-wrap gap-2">
                        <Link
                            href={blog.index()}
                            className={`apple-press rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                                !currentCategory
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-foreground/80 hover:bg-accent'
                            }`}
                        >
                            全部
                        </Link>
                        {categories.map((cat) => (
                            <Link
                                key={cat.slug}
                                href={blog.index({ query: { category: cat.slug } })}
                                className={`apple-press rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                                    currentCategory === cat.slug
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-foreground/80 hover:bg-accent'
                                }`}
                            >
                                {cat.name}
                                <span className="ml-1.5 opacity-60">{cat.count}</span>
                            </Link>
                        ))}
                    </div>
                )}

                {/* Article list */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-5">
                        {articles.data.map((article) => (
                            <Link
                                key={article.id}
                                href={article.permalink}
                                className="apple-card apple-press group block p-6 hover:-translate-y-0.5"
                            >
                                {article.categories.length > 0 && (
                                    <div className="mb-3 flex flex-wrap gap-2">
                                        {article.categories.map((cat) => (
                                            <span key={cat.slug} className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                                                {cat.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <h2 className="text-title group-hover:text-primary transition-colors">
                                    {article.title}
                                </h2>
                                <p className="mt-2 text-body line-clamp-3 text-muted-foreground">
                                    {article.excerpt || '暂无摘要'}
                                </p>
                                <div className="mt-5 flex items-center justify-between text-footnote text-muted-foreground">
                                    <div className="flex items-center gap-3">
                                        <span>{article.author_name}</span>
                                        <span className="inline-flex items-center gap-1">
                                            <Clock className="h-3.5 w-3.5" />
                                            {article.created_at}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="inline-flex items-center gap-1">
                                            <Eye className="h-3.5 w-3.5" />
                                            {article.views}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <MessageSquare className="h-3.5 w-3.5" />
                                            {article.comment_count}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}

                        {articles.data.length === 0 && (
                            <div className="apple-card p-12 text-center text-muted-foreground">
                                暂无文章
                            </div>
                        )}

                        {/* Pagination */}
                        {articles.last_page > 1 && (
                            <div className="flex flex-wrap justify-center gap-1 pt-4">
                                {articles.links.map((link, i) => (
                                    <Link
                                        key={i}
                                        href={link.url ?? '#'}
                                        className={`apple-press h-9 min-w-[2.25rem] rounded-lg px-3 text-sm font-medium transition-colors ${
                                            link.active
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted text-foreground/80 hover:bg-accent'
                                        } ${!link.url ? 'opacity-40 pointer-events-none' : ''}`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <aside className="space-y-6">
                        <div className="apple-card p-6">
                            <h3 className="text-headline mb-4">分类</h3>
                            <ul className="space-y-1">
                                <li>
                                    <Link href={blog.index()} className="block rounded-lg px-3 py-2 text-sm hover:bg-muted">
                                        全部文章
                                    </Link>
                                </li>
                                {categories.map((cat) => (
                                    <li key={cat.slug}>
                                        <Link
                                            href={blog.index({ query: { category: cat.slug } })}
                                            className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-muted"
                                        >
                                            <span>{cat.name}</span>
                                            <span className="text-footnote text-muted-foreground">{cat.count}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </aside>
                </div>
            </div>
        </>
    );
}
