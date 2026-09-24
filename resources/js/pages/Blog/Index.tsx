import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Eye,
    FileText,
    Link as LinkIcon,
    MessageSquare,
    Clock,
    Timer,
    User,
    Heart,
} from 'lucide-react';
import PageSearch, { type SearchScope } from '@/components/page-search';
import { buildSeoMeta } from '@/lib/seo';
import blog from '@/routes/blog';

const SEARCH_SCOPES: SearchScope[] = [
    { value: 'title', label: '标题', placeholder: '搜索文章标题' },
    { value: 'content', label: '内容', placeholder: '搜索文章内容' },
    {
        value: 'title_content',
        label: '标题 + 内容',
        placeholder: '搜索标题和内容',
    },
];

type Article = {
    id: number;
    title: string;
    slug: string;
    permalink: string;
    excerpt: string;
    featured_image?: string | null;
    author_name: string;
    author_avatar: string;
    categories: { name: string; slug: string }[];
    tags: { name: string; slug: string }[];
    views: number;
    likes: number;
    comment_count: number;
    reading_time: number;
    created_at: string;
};

type Category = {
    name: string;
    slug: string;
    count: number;
};

type Sidebar = {
    blogger: {
        name: string;
        avatar_url: string | null;
        intro: string;
    };
    stats: {
        articles: number;
        views: number;
        comments: number;
    };
    menus: { name: string; url: string }[];
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
    currentScope?: string;
    sidebar: Sidebar;
};

export default function Index({
    articles,
    categories,
    currentCategory,
    currentTag,
    currentQuery,
    currentScope,
    sidebar,
}: Props) {
    const seo = usePage().props.seo;

    const doSearch = (value: string, scope?: string) => {
        router.get(
            blog.index().url,
            {
                q: value || undefined,
                scope: scope || undefined,
                category: currentCategory || undefined,
            },
            { preserveScroll: true },
        );
    };

    return (
        <>
            <Head title="博客">
                {buildSeoMeta({ site: seo, title: '博客' })}
            </Head>

            <div className="mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-14">
                <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-display">博客</h1>
                        <p className="text-body mt-2 text-muted-foreground">
                            技术教程、开发经验与生活随笔
                        </p>
                    </div>
                    <PageSearch
                        initial={currentQuery ?? ''}
                        placeholder="搜索文章标题"
                        buttonLabel="搜索文章"
                        scopes={SEARCH_SCOPES}
                        initialScope={currentScope ?? 'title'}
                        onSubmit={doSearch}
                    />
                </div>

                {currentQuery && (
                    <p className="text-body mb-6 text-muted-foreground">
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
                                href={blog.index({
                                    query: { category: cat.slug },
                                })}
                                className={`apple-press rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                                    currentCategory === cat.slug
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-foreground/80 hover:bg-accent'
                                }`}
                            >
                                {cat.name}
                                <span className="ml-1.5 opacity-60">
                                    {cat.count}
                                </span>
                            </Link>
                        ))}
                    </div>
                )}

                <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
                    {/* 右侧侧边栏 */}
                    <aside className="w-full shrink-0 space-y-5 lg:w-64">
                        {/* 博主信息 */}
                        <div className="apple-card p-5 text-center">
                            {sidebar.blogger.avatar_url ? (
                                <img
                                    src={sidebar.blogger.avatar_url}
                                    alt={sidebar.blogger.name}
                                    className="mx-auto h-20 w-20 rounded-full object-cover ring-4 ring-primary/10"
                                />
                            ) : (
                                <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary ring-4 ring-primary/10">
                                    {sidebar.blogger.name
                                        .charAt(0)
                                        .toUpperCase()}
                                </span>
                            )}
                            <h3 className="text-headline mt-3">
                                {sidebar.blogger.name}
                            </h3>
                            {sidebar.blogger.intro && (
                                <p className="text-footnote mt-1.5 leading-relaxed text-muted-foreground">
                                    {sidebar.blogger.intro}
                                </p>
                            )}
                            <div className="mt-4 grid grid-cols-3 divide-x divide-border/40 rounded-xl bg-muted/60 py-2.5">
                                <div>
                                    <p className="text-sm font-semibold tabular-nums">
                                        {sidebar.stats.articles}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                        文章
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold tabular-nums">
                                        {sidebar.stats.views}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                        阅读
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold tabular-nums">
                                        {sidebar.stats.comments}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                        评论
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 自定义菜单（后台维护） */}
                        {sidebar.menus.length > 0 && (
                            <div className="apple-card p-4">
                                <h3 className="text-callout mb-3 flex items-center gap-1.5 px-1 font-medium">
                                    <LinkIcon className="h-3.5 w-3.5 text-primary" />
                                    菜单
                                </h3>
                                <ul className="space-y-0.5">
                                    {sidebar.menus.map((menu, index) => (
                                        <li key={index}>
                                            {menu.url.startsWith('/') ||
                                            menu.url.startsWith('http') ? (
                                                menu.url.startsWith('http') ? (
                                                    <a
                                                        href={menu.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                                                    >
                                                        <span>{menu.name}</span>
                                                        <ExternalGlyph />
                                                    </a>
                                                ) : (
                                                    <Link
                                                        href={menu.url}
                                                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                                                    >
                                                        <span>{menu.name}</span>
                                                    </Link>
                                                )
                                            ) : (
                                                <a
                                                    href={menu.url}
                                                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                                                >
                                                    <span>{menu.name}</span>
                                                </a>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* 分类 */}
                        {categories.length > 0 && (
                            <div className="apple-card p-4">
                                <h3 className="text-callout mb-3 flex items-center gap-1.5 px-1 font-medium">
                                    <FileText className="h-3.5 w-3.5 text-primary" />
                                    分类
                                </h3>
                                <ul className="space-y-0.5">
                                    <li>
                                        <Link
                                            href={blog.index()}
                                            className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
                                        >
                                            <span>全部文章</span>
                                            <span className="text-footnote text-muted-foreground">
                                                {categories.reduce(
                                                    (sum, cat) =>
                                                        sum + cat.count,
                                                    0,
                                                )}
                                            </span>
                                        </Link>
                                    </li>
                                    {categories.map((cat) => (
                                        <li key={cat.slug}>
                                            <Link
                                                href={blog.index({
                                                    query: {
                                                        category: cat.slug,
                                                    },
                                                })}
                                                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted ${
                                                    currentCategory === cat.slug
                                                        ? 'bg-primary/10 text-primary'
                                                        : ''
                                                }`}
                                            >
                                                <span>{cat.name}</span>
                                                <span className="text-footnote text-muted-foreground">
                                                    {cat.count}
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </aside>
                    {/* 瀑布流文章列表 */}
                    <div className="min-w-0 flex-1">
                        {articles.data.length > 0 ? (
                            <div className="gap-5 md:columns-2">
                                {articles.data.map((article) => (
                                    <Link
                                        key={article.id}
                                        href={article.permalink}
                                        className="apple-card apple-press hover-glow group mb-5 block break-inside-avoid overflow-hidden p-5"
                                    >
                                        {article.featured_image && (
                                            <div className="mb-4 -mt-5 -mx-5 overflow-hidden">
                                                <img
                                                    src={article.featured_image}
                                                    alt={article.title}
                                                    className="aspect-[16/9] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                                    loading="lazy"
                                                />
                                            </div>
                                        )}
                                        {article.categories.length > 0 && (
                                            <div className="mb-3 flex flex-wrap gap-2">
                                                {article.categories.map(
                                                    (cat) => (
                                                        <span
                                                            key={cat.slug}
                                                            className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground"
                                                        >
                                                            {cat.name}
                                                        </span>
                                                    ),
                                                )}
                                            </div>
                                        )}
                                        <h2 className="text-headline leading-snug transition-colors group-hover:text-primary">
                                            {article.title}
                                        </h2>
                                        <p className="text-footnote mt-2 leading-relaxed text-muted-foreground">
                                            {article.excerpt || '暂无摘要'}
                                        </p>
                                        {article.tags.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                {article.tags
                                                    .slice(0, 3)
                                                    .map((tag) => (
                                                        <span
                                                            key={tag.slug}
                                                            className="text-[11px] text-muted-foreground/80"
                                                        >
                                                            #{tag.name}
                                                        </span>
                                                    ))}
                                            </div>
                                        )}
                                        <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
                                            <div className="flex items-center gap-2.5">
                                                <span className="inline-flex items-center gap-1">
                                                    <User className="h-3 w-3" />
                                                    {article.author_name}
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {article.created_at}
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <Timer className="h-3 w-3" />
                                                    {article.reading_time}
                                                    分钟
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2.5">
                                                <span className="inline-flex items-center gap-1">
                                                    <Eye className="h-3 w-3" />
                                                    {article.views}
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <Heart className="h-3 w-3" />
                                                    {article.likes}
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <MessageSquare className="h-3 w-3" />
                                                    {article.comment_count}
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="apple-card p-12 text-center text-muted-foreground">
                                {currentQuery
                                    ? `没有找到与“${currentQuery}”相关的文章`
                                    : '暂无文章'}
                            </div>
                        )}

                        {/* Pagination */}
                        {articles.last_page > 1 && (
                            <div className="mt-2 flex flex-wrap justify-center gap-1">
                                {articles.links.map((link, i) => (
                                    <Link
                                        key={i}
                                        href={link.url ?? '#'}
                                        className={`apple-press h-9 min-w-[2.25rem] rounded-lg px-3 text-sm font-medium transition-colors ${
                                            link.active
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted text-foreground/80 hover:bg-accent'
                                        } ${!link.url ? 'pointer-events-none opacity-40' : ''}`}
                                        dangerouslySetInnerHTML={{
                                            __html: link.label,
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

function ExternalGlyph() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-3 w-3 text-muted-foreground"
        >
            <path d="M15 3h6v6" />
            <path d="M10 14 21 3" />
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        </svg>
    );
}
