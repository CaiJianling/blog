import { Head, Link, usePage } from '@inertiajs/react';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import PageSearch from '@/components/page-search';
import { buildSeoMeta } from '@/lib/seo';

type Tool = {
    id: number;
    slug: string | null;
    name: string;
    url: string | null;
    description: string | null;
    icon: string;
};

type ToolCategoryData = {
    id: number;
    name: string;
    tools: Tool[];
};

type Props = {
    toolCategories: ToolCategoryData[];
};

const iconMap: Record<string, string> = {
    Braces: '{}',
    CodeXml: '</>',
    Database: 'DB',
    Hash: '#',
    Binary: '01',
    Link: '∿',
    Type: 'T',
    Regex: '.*',
    GitCompare: '⇔',
    CaseSensitive: 'Aa',
    Ruler: '📏',
    Clock: '⏱',
    Wrench: '🔧',
    Calculator: '🧮',
    Globe: '🌐',
    Terminal: '⌨',
};

export default function Index({ toolCategories }: Props) {
    const seo = usePage().props.seo;
    const [query, setQuery] = useState('');

    const keyword = query.trim().toLowerCase();

    const filteredCategories = toolCategories
        .map((category) => ({
            ...category,
            tools: keyword
                ? category.tools.filter(
                      (tool) =>
                          tool.name.toLowerCase().includes(keyword) ||
                          (tool.description ?? '')
                              .toLowerCase()
                              .includes(keyword),
                  )
                : category.tools,
        }))
        .filter((category) => category.tools.length > 0);

    const totalFiltered = filteredCategories.reduce(
        (sum, category) => sum + category.tools.length,
        0,
    );

    return (
        <>
            <Head title="在线工具">
                {buildSeoMeta({ site: seo, title: '在线工具' })}
            </Head>

            <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
                <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-display">在线工具</h1>
                        <p className="text-body mt-2 text-muted-foreground">
                            实用的在线开发工具，无需安装，即开即用
                        </p>
                    </div>
                    <PageSearch
                        placeholder="搜索工具"
                        buttonLabel="搜索工具"
                        onSubmit={setQuery}
                    />
                </div>

                {keyword && (
                    <p className="text-body mb-8 text-muted-foreground">
                        搜索“{query}”的工具，共 {totalFiltered} 个
                    </p>
                )}

                {totalFiltered === 0 && (
                    <div className="apple-card p-12 text-center text-muted-foreground">
                        {keyword
                            ? `没有找到与“${query}”相关的工具`
                            : '暂无工具'}
                    </div>
                )}

                {filteredCategories.map((category) => (
                    <section key={category.id} className="mb-10">
                        <h2 className="text-title mb-5">{category.name}</h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {category.tools.map((tool) => {
                                const isExternal = !!tool.url;

                                const inner = (
                                    <>
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                                            <span className="text-lg font-bold">
                                                {iconMap[tool.icon] ?? '⚙'}
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-headline transition-colors group-hover:text-primary">
                                                {tool.name}
                                            </h3>
                                            <p className="text-footnote mt-1 line-clamp-2 text-muted-foreground">
                                                {tool.description}
                                            </p>
                                        </div>
                                        {isExternal && (
                                            <ExternalLink className="h-3.5 w-3.5 shrink-0 self-start text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                                        )}
                                    </>
                                );

                                return isExternal ? (
                                    <a
                                        key={tool.id}
                                        href={tool.url ?? '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="apple-card apple-press hover-glow group flex items-start gap-4 p-5"
                                    >
                                        {inner}
                                    </a>
                                ) : (
                                    <Link
                                        key={tool.id}
                                        href={`/tools/${tool.slug}`}
                                        className="apple-card apple-press hover-glow group flex items-start gap-4 p-5"
                                    >
                                        {inner}
                                    </Link>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>
        </>
    );
}
