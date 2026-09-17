import { Head, usePage } from '@inertiajs/react';
import { ExternalLink, Link2 } from 'lucide-react';
import { useState } from 'react';
import PageSearch from '@/components/page-search';
import { buildSeoMeta } from '@/lib/seo';

type FriendLink = {
    id: number;
    link_url: string;
    link_name: string;
    link_image: string | null;
    link_target: string;
    link_description: string;
    link_rating: number;
};

type Props = {
    links: FriendLink[];
};

export default function Index({ links }: Props) {
    const seo = usePage().props.seo;
    const [query, setQuery] = useState('');

    const keyword = query.trim().toLowerCase();

    const filtered = keyword
        ? links.filter(
              (link) =>
                  link.link_name.toLowerCase().includes(keyword) ||
                  (link.link_description || '').toLowerCase().includes(keyword),
          )
        : links;

    const target = (link: FriendLink) =>
        link.link_target === '_blank' ? '_blank' : '_self';

    return (
        <>
            <Head title="友情链接">
                {buildSeoMeta({ site: seo, title: '友情链接' })}
            </Head>

            <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
                <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-display">友情链接</h1>
                        <p className="text-body mt-2 text-muted-foreground">
                            收录的优秀站点，感谢他们的陪伴与支持
                        </p>
                    </div>
                    <PageSearch
                        placeholder="搜索友链"
                        buttonLabel="搜索友链"
                        onSubmit={setQuery}
                    />
                </div>

                {keyword && (
                    <p className="text-body mb-8 text-muted-foreground">
                        搜索“{query}”的友链，共 {filtered.length} 个
                    </p>
                )}

                {links.length === 0 && (
                    <div className="apple-card flex flex-col items-center gap-3 p-16 text-center text-muted-foreground">
                        <Link2 className="h-8 w-8" />
                        还没有友情链接，敬请期待
                    </div>
                )}

                {links.length > 0 && filtered.length === 0 && (
                    <div className="apple-card p-12 text-center text-muted-foreground">
                        没有找到与“{query}”相关的友链
                    </div>
                )}

                {filtered.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {filtered.map((link) => (
                            <a
                                key={link.id}
                                href={link.link_url}
                                target={target(link)}
                                rel="noopener noreferrer"
                                className="apple-card apple-press hover-glow group flex items-center gap-3.5 p-4"
                            >
                                {link.link_image ? (
                                    <img
                                        src={link.link_image}
                                        alt={link.link_name}
                                        className="h-12 w-12 shrink-0 rounded-2xl object-cover"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
                                        {link.link_name.charAt(0).toUpperCase()}
                                    </div>
                                )}

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <h3 className="text-headline truncate transition-colors group-hover:text-primary">
                                            {link.link_name}
                                        </h3>
                                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                                    </div>
                                    {link.link_description && (
                                        <p className="text-footnote mt-1 line-clamp-2 text-muted-foreground">
                                            {link.link_description}
                                        </p>
                                    )}
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
