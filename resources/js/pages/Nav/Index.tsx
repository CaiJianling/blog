import { Head } from '@inertiajs/react';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import PageSearch from '@/components/page-search';

type NavSite = {
    name: string;
    url: string;
    description: string;
    color: string;
};

type Props = {
    navigationCategories: Record<string, NavSite[]>;
};

export default function Index({ navigationCategories }: Props) {
    const [query, setQuery] = useState('');

    const filteredCategories = query
        ? Object.fromEntries(
            Object.entries(navigationCategories).map(([category, sites]) => [
                category,
                sites.filter((site) =>
                    site.name.toLowerCase().includes(query.toLowerCase())
                    || site.description.toLowerCase().includes(query.toLowerCase()),
                ),
            ]),
        )
        : navigationCategories;

    const totalFiltered = Object.values(filteredCategories).reduce((sum, sites) => sum + sites.length, 0);

    return (
        <>
            <Head title="网站导航" />

            <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
                <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-display">网站导航</h1>
                        <p className="mt-2 text-body text-muted-foreground">
                            精心整理的优质网站集合，覆盖 AI、搜索、视频、动漫等多个领域
                        </p>
                    </div>
                    <PageSearch placeholder="搜索网站" buttonLabel="搜索网站" onSubmit={setQuery} />
                </div>

                {query && (
                    <p className="mb-8 text-body text-muted-foreground">
                        搜索“{query}”的网站，共 {totalFiltered} 个
                    </p>
                )}

                {query && totalFiltered === 0 && (
                    <div className="apple-card p-12 text-center text-muted-foreground">
                        没有找到与“{query}”相关的网站
                    </div>
                )}

                <div className="space-y-10">
                    {Object.entries(filteredCategories)
                        .filter(([, sites]) => sites.length > 0)
                        .map(([category, sites]) => (
                            <section key={category}>
                                <h2 className="text-title mb-5 flex items-center gap-2">
                                    {category}
                                    <span className="text-footnote font-normal text-muted-foreground">
                                        ({sites.length})
                                    </span>
                                </h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {sites.map((site) => (
                                    <a
                                        key={site.name}
                                        href={site.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="apple-card apple-press group flex items-start gap-3 p-4 hover:-translate-y-0.5"
                                    >
                                        <div
                                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                                            style={{ backgroundColor: site.color }}
                                        >
                                            {site.name.charAt(0)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1">
                                                <h3 className="truncate text-headline group-hover:text-primary transition-colors">
                                                    {site.name}
                                                </h3>
                                                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <p className="mt-0.5 text-footnote line-clamp-2 text-muted-foreground">
                                                {site.description}
                                            </p>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </>
    );
}
