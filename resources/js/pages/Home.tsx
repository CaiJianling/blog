import { Link, usePage } from '@inertiajs/react';
import { ArrowRight, Eye, MessageSquare, ChevronRight } from 'lucide-react';
import HeroCanvas from '@/components/hero-canvas';
import blog from '@/routes/blog';
import tools from '@/routes/tools';
import nav from '@/routes/nav';

type Article = {
    id: number;
    title: string;
    slug: string;
    permalink: string;
    excerpt: string;
    author_name: string;
    views: number;
    comment_count: number;
    created_at: string;
};

type Tool = {
    slug: string;
    name: string;
    description: string;
    icon: string;
};

type NavSite = {
    name: string;
    url: string;
    description: string;
    color: string;
};

type HomeTexts = {
    home_badge: string;
    home_title: string;
    home_title_accent: string;
    home_description: string;
    home_latest_title: string;
    home_latest_desc: string;
    home_tools_title: string;
    home_tools_desc: string;
    home_nav_title: string;
    home_nav_desc: string;
};

export default function Home() {
    const { name } = usePage().props;
    const { latestArticles, featuredTools, navigationCategories, texts } = usePage<{
        latestArticles: Article[];
        featuredTools: Tool[];
        navigationCategories: Record<string, NavSite[]>;
        texts: HomeTexts;
    }>().props;

    return (
        <>
            {/* Hero：三层粒子背景（流体底色/可扰动网格/首字母点阵）+ 深色文案 */}
            <div className="dark">
                <section className="relative flex items-center overflow-hidden bg-[#08090c]">
                    <HeroCanvas name={name ?? 'B'} />
                    <div className="relative mx-auto w-full max-w-6xl px-5 pb-16 pt-20 md:px-8 md:pb-24 md:pt-28">
                    <div className="mx-auto max-w-3xl text-center">
                        <span className="inline-flex items-center rounded-full border border-border/60 bg-card/60 px-4 py-1.5 text-footnote text-muted-foreground backdrop-blur">
                            {texts.home_badge}
                        </span>
                        <h1 className="mt-6 text-display">
                            {texts.home_title}
                            <br />
                            <span className="bg-gradient-to-r from-primary via-accent-foreground to-primary bg-clip-text text-transparent">
                                {texts.home_title_accent}
                            </span>
                        </h1>
                        <p className="mx-auto mt-6 max-w-xl text-body text-muted-foreground">
                            {texts.home_description}
                        </p>
                        <div className="mt-10 flex items-center justify-center gap-3">
                            <Link
                                href={blog.index()}
                                className="apple-press inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-apple-md hover:opacity-90"
                            >
                                浏览博客
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link
                                href={tools.index()}
                                className="apple-press inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-6 py-3 text-sm font-medium text-foreground backdrop-blur hover:bg-muted"
                            >
                                在线工具
                            </Link>
                            <Link
                                href={nav.index()}
                                className="apple-press inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-6 py-3 text-sm font-medium text-foreground backdrop-blur hover:bg-muted"
                            >
                                导航
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
            </div>

            {/* Latest Articles */}
            <section className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
                <div className="flex items-end justify-between">
                    <div>
                        <h2 className="text-title">{texts.home_latest_title}</h2>
                        <p className="mt-1 text-footnote text-muted-foreground">{texts.home_latest_desc}</p>
                    </div>
                    <Link href={blog.index()} className="apple-press inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                        查看全部
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {latestArticles.map((article) => (
                        <Link
                                key={article.id}
                                href={article.permalink}
                                className="apple-card apple-press group flex flex-col p-6 hover:-translate-y-1"
                            >
                            <h3 className="text-headline line-clamp-2 group-hover:text-primary transition-colors">
                                {article.title}
                            </h3>
                            <p className="mt-2 text-body line-clamp-3 text-muted-foreground">
                                {article.excerpt || '暂无摘要'}
                            </p>
                            <div className="mt-auto pt-5 flex items-center justify-between text-footnote text-muted-foreground">
                                <span>{article.author_name}</span>
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
                    {latestArticles.length === 0 && (
                        <div className="col-span-full rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
                            还没有发布文章
                        </div>
                    )}
                </div>
            </section>

            {/* Featured Tools */}
            <section className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
                <div className="flex items-end justify-between">
                    <div>
                        <h2 className="text-title">{texts.home_tools_title}</h2>
                        <p className="mt-1 text-footnote text-muted-foreground">{texts.home_tools_desc}</p>
                    </div>
                    <Link href={tools.index()} className="apple-press inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                        全部工具
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {featuredTools.map((tool) => (
                        <Link
                            key={tool.slug}
                            href={tools.show({ slug: tool.slug })}
                            className="apple-card apple-press group flex items-start gap-4 p-5 hover:-translate-y-0.5"
                        >
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                                <ToolIcon name={tool.icon} />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-headline group-hover:text-primary transition-colors">
                                    {tool.name}
                                </h3>
                                <p className="mt-1 text-footnote line-clamp-2 text-muted-foreground">
                                    {tool.description}
                                </p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Navigation Preview */}
            <section className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
                <div className="flex items-end justify-between">
                    <div>
                        <h2 className="text-title">{texts.home_nav_title}</h2>
                        <p className="mt-1 text-footnote text-muted-foreground">{texts.home_nav_desc}</p>
                    </div>
                    <Link href={nav.index()} className="apple-press inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                        完整导航
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(navigationCategories).slice(0, 6).map(([category, sites]) => (
                        <div key={category} className="apple-card p-6">
                            <h3 className="text-headline mb-4">{category}</h3>
                            <div className="flex flex-wrap gap-2">
                                {sites.slice(0, 6).map((site) => (
                                    <a
                                        key={site.name}
                                        href={site.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="apple-press inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                                    >
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: site.color }} />
                                        {site.name}
                                    </a>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </>
    );
}

function ToolIcon({ name }: { name: string }) {
    const icons: Record<string, React.ReactNode> = {
        Braces: <span className="text-lg font-bold">{'{ }'}</span>,
        CodeXml: <span className="text-lg font-bold">{'</>'}</span>,
        Database: <span className="text-lg font-bold">DB</span>,
        Hash: <span className="text-lg font-bold">#</span>,
        Binary: <span className="text-lg font-bold">01</span>,
        Link: <span className="text-lg font-bold">∿</span>,
        Type: <span className="text-lg font-bold">T</span>,
        Regex: <span className="text-lg font-bold">.*</span>,
        GitCompare: <span className="text-lg font-bold">⇔</span>,
        CaseSensitive: <span className="text-lg font-bold">Aa</span>,
        Ruler: <span className="text-lg font-bold">📏</span>,
        Clock: <span className="text-lg font-bold">⏱</span>,
    };
    return <>{icons[name] ?? <span className="text-lg">⚙</span>}</>;
}
