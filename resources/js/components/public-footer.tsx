import { Link, usePage } from '@inertiajs/react';
import { Github, Link2, Mail, Rss, Twitter } from 'lucide-react';
import { renderMarkdown } from '@/lib/markdown';
import { home } from '@/routes';
import blog from '@/routes/blog';
import { index as feed } from '@/actions/App/Http/Controllers/FeedController';
import links from '@/routes/links';
import nav from '@/routes/nav';
import tools from '@/routes/tools';

type FooterLink = {
    name: string;
    url: string;
};

function contactIcon(url: string) {
    const lower = url.toLowerCase();

    if (lower.includes('github')) {
        return Github;
    }

    if (lower.includes('twitter') || lower.includes('x.com')) {
        return Twitter;
    }

    if (lower.startsWith('mailto:')) {
        return Mail;
    }

    return Link2;
}

export default function PublicFooter() {
    const { name, footer } = usePage().props as unknown as {
        name?: string;
        footer?: {
            resources: FooterLink[];
            contacts: FooterLink[];
            icp_markdown?: string;
        };
    };

    const resources = footer?.resources ?? [];
    const contacts = footer?.contacts ?? [];
    const icpMarkdown = footer?.icp_markdown?.trim() ?? '';

    return (
        <footer className="mt-20 border-t border-border/40">
            <div className="mx-auto max-w-6xl px-5 py-12 md:px-8">
                <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                    <div className="col-span-2 md:col-span-1">
                        <Link href={home()} className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                <span className="text-sm font-bold">
                                    {name?.charAt(0) ?? 'B'}
                                </span>
                            </div>
                            <span className="text-headline">{name}</span>
                        </Link>
                        <p className="text-footnote mt-3 leading-relaxed">
                            记录技术与生活，分享实用工具，收集优质导航。
                        </p>
                    </div>

                    <div>
                        <h4 className="text-footnote font-semibold text-foreground">
                            内容
                        </h4>
                        <ul className="mt-3 space-y-2 text-sm">
                            <li>
                                <Link
                                    href={blog.index()}
                                    className="text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    博客
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href={tools.index()}
                                    className="text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    工具
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href={nav.index()}
                                    className="text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    导航
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href={links.index()}
                                    className="text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    友链
                                </Link>
                            </li>
                            <li>
                                <a
                                    href={feed().url}
                                    className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                                    title="RSS 订阅"
                                >
                                    <Rss className="h-3.5 w-3.5 text-orange-500" />
                                    RSS 订阅
                                </a>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-footnote font-semibold text-foreground">
                            资源
                        </h4>
                        <ul className="mt-3 space-y-2 text-sm">
                            {resources.map((item, index) => (
                                <li key={index}>
                                    <a
                                        href={item.url}
                                        target={
                                            item.url.startsWith('http')
                                                ? '_blank'
                                                : undefined
                                        }
                                        rel={
                                            item.url.startsWith('http')
                                                ? 'noopener noreferrer'
                                                : undefined
                                        }
                                        className="text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                        {item.name}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-footnote font-semibold text-foreground">
                            联系
                        </h4>
                        <div className="mt-3 flex gap-3">
                            {contacts.map((item, index) => {
                                const Icon = contactIcon(item.url);

                                return (
                                    <a
                                        key={index}
                                        href={item.url}
                                        target={
                                            item.url.startsWith('http')
                                                ? '_blank'
                                                : undefined
                                        }
                                        rel={
                                            item.url.startsWith('http')
                                                ? 'noopener noreferrer'
                                                : undefined
                                        }
                                        className="text-muted-foreground transition-colors hover:text-foreground"
                                        aria-label={item.name}
                                        title={item.name}
                                    >
                                        <Icon className="h-5 w-5" />
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {icpMarkdown && (
                    <div
                        className="text-footnote mt-10 text-center leading-relaxed text-muted-foreground"
                        dangerouslySetInnerHTML={{
                            __html: renderMarkdown(icpMarkdown),
                        }}
                    />
                )}

                <div className="text-footnote mt-8 flex flex-col items-center justify-between gap-4 border-t border-border/30 pt-6 sm:flex-row">
                    <p className="text-muted-foreground">
                        © {new Date().getFullYear()} {name}. All rights
                        reserved.
                    </p>
                    <p className="text-muted-foreground">
                        Built with Laravel, Inertia & React.
                    </p>
                </div>
            </div>
        </footer>
    );
}
