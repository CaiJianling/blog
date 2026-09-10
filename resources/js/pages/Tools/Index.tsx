import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import PageSearch from '@/components/page-search';
import tools from '@/routes/tools';

type Tool = {
    slug: string;
    name: string;
    description: string;
    icon: string;
};

type Props = {
    toolCategories: Record<string, Tool[]>;
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
};

export default function Index({ toolCategories }: Props) {
    const [query, setQuery] = useState('');

    const filteredCategories = query
        ? Object.fromEntries(
            Object.entries(toolCategories).map(([category, items]) => [
                category,
                items.filter((tool) =>
                    tool.name.toLowerCase().includes(query.toLowerCase())
                    || tool.description.toLowerCase().includes(query.toLowerCase()),
                ),
            ]),
        )
        : toolCategories;

    const totalFiltered = Object.values(filteredCategories).reduce((sum, items) => sum + items.length, 0);

    return (
        <>
            <Head title="在线工具" />

            <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
                <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-display">在线工具</h1>
                        <p className="mt-2 text-body text-muted-foreground">
                            实用的在线开发工具，无需安装，即开即用
                        </p>
                    </div>
                    <PageSearch placeholder="搜索工具" buttonLabel="搜索工具" onSubmit={setQuery} />
                </div>

                {query && (
                    <p className="mb-8 text-body text-muted-foreground">
                        搜索“{query}”的工具，共 {totalFiltered} 个
                    </p>
                )}

                {!query && totalFiltered === 0 && (
                    <div className="apple-card p-12 text-center text-muted-foreground">暂无工具</div>
                )}

                {query && totalFiltered === 0 && (
                    <div className="apple-card p-12 text-center text-muted-foreground">
                        没有找到与“{query}”相关的工具
                    </div>
                )}

                {Object.entries(filteredCategories)
                    .filter(([, items]) => items.length > 0)
                    .map(([category, items]) => (
                        <section key={category} className="mb-10">
                            <h2 className="text-title mb-5">{category}</h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map((tool) => (
                                <Link
                                    key={tool.slug}
                                    href={tools.show({ slug: tool.slug })}
                                    className="apple-card apple-press group flex items-start gap-4 p-5 hover:-translate-y-0.5"
                                >
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                                        <span className="text-lg font-bold">{iconMap[tool.icon] ?? '⚙'}</span>
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
                ))}
            </div>
        </>
    );
}
