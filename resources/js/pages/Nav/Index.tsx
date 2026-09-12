import { Head, router } from '@inertiajs/react';
import { BookOpen, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import PageSearch from '@/components/page-search';

type NavLink = {
    id: number;
    name: string;
    url: string;
    description: string | null;
    color: string;
    has_intro: boolean;
};

type NavCategoryData = {
    id: number;
    name: string;
    links: NavLink[];
};

type Props = {
    navigationCategories: NavCategoryData[];
};

export default function Index({ navigationCategories }: Props) {
    const [query, setQuery] = useState('');

    const keyword = query.trim().toLowerCase();

    const filteredCategories = navigationCategories
        .map((category) => ({
            ...category,
            links: keyword
                ? category.links.filter(
                    (link) =>
                        link.name.toLowerCase().includes(keyword)
                        || (link.description ?? '').toLowerCase().includes(keyword),
                )
                : category.links,
        }))
        .filter((category) => category.links.length > 0);

    const totalFiltered = filteredCategories.reduce((sum, category) => sum + category.links.length, 0);

    return (
        <>
            <Head title="网站导航" />

            <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
                <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-display">网站导航</h1>
                        <p className="mt-2 text-body text-muted-foreground">
                            精心整理的优质网站集合，点击卡片直接跳转，也可查看图文介绍
                        </p>
                    </div>
                    <PageSearch placeholder="搜索网站" buttonLabel="搜索网站" onSubmit={setQuery} />
                </div>

                {keyword && (
                    <p className="mb-8 text-body text-muted-foreground">
                        搜索“{query}”的网站，共 {totalFiltered} 个
                    </p>
                )}

                {keyword && totalFiltered === 0 && (
                    <div className="apple-card p-12 text-center text-muted-foreground">
                        没有找到与“{query}”相关的网站
                    </div>
                )}

                <div className="space-y-10">
                    {filteredCategories.map((category) => (
                        <section key={category.id}>
                            <h2 className="text-title mb-5 flex items-center gap-2">
                                {category.name}
                                <span className="text-footnote font-normal text-muted-foreground">
                                    ({category.links.length})
                                </span>
                            </h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {category.links.map((link) => (
                                    <a
                                        key={link.id}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="apple-card apple-press group flex items-start gap-3 p-4 hover:-translate-y-0.5"
                                    >
                                        <div
                                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                                            style={{ backgroundColor: link.color || '#6b7280' }}
                                        >
                                            {link.name.charAt(0)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1">
                                                <h3 className="truncate text-headline group-hover:text-primary transition-colors">
                                                    {link.name}
                                                </h3>
                                                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <p className="mt-0.5 text-footnote line-clamp-2 text-muted-foreground">
                                                {link.description}
                                            </p>
                                            {link.has_intro && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        router.visit(`/nav/links/${link.id}`);
                                                    }}
                                                    className="mt-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 -ml-1.5 text-xs font-medium text-primary/80 transition-colors hover:bg-primary/10 hover:text-primary"
                                                >
                                                    <BookOpen className="h-3 w-3" />
                                                    查看介绍
                                                </button>
                                            )}
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
