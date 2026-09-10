import { Link, usePage } from '@inertiajs/react';
import { Github, Twitter, Mail } from 'lucide-react';
import { home } from '@/routes';
import blog from '@/routes/blog';
import tools from '@/routes/tools';
import nav from '@/routes/nav';

export default function PublicFooter() {
    const { name } = usePage().props;

    return (
        <footer className="mt-20 border-t border-border/40">
            <div className="mx-auto max-w-6xl px-5 py-12 md:px-8">
                <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                    <div className="col-span-2 md:col-span-1">
                        <Link href={home()} className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                <span className="text-sm font-bold">{name?.charAt(0) ?? 'B'}</span>
                            </div>
                            <span className="text-headline">{name}</span>
                        </Link>
                        <p className="mt-3 text-footnote leading-relaxed">
                            记录技术与生活，分享实用工具，收集优质导航。
                        </p>
                    </div>

                    <div>
                        <h4 className="text-footnote font-semibold text-foreground">内容</h4>
                        <ul className="mt-3 space-y-2 text-sm">
                            <li>
                                <Link href={blog.index()} className="text-muted-foreground transition-colors hover:text-foreground">
                                    博客
                                </Link>
                            </li>
                            <li>
                                <Link href={tools.index()} className="text-muted-foreground transition-colors hover:text-foreground">
                                    工具
                                </Link>
                            </li>
                            <li>
                                <Link href={nav.index()} className="text-muted-foreground transition-colors hover:text-foreground">
                                    导航
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-footnote font-semibold text-foreground">资源</h4>
                        <ul className="mt-3 space-y-2 text-sm">
                            <li>
                                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-foreground">
                                    GitHub
                                </a>
                            </li>
                            <li>
                                <a href="https://laravel.com/docs" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-foreground">
                                    Laravel 文档
                                </a>
                            </li>
                            <li>
                                <a href="https://react.dev" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-foreground">
                                    React 文档
                                </a>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-footnote font-semibold text-foreground">联系</h4>
                        <div className="mt-3 flex gap-3">
                            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-foreground">
                                <Github className="h-5 w-5" />
                            </a>
                            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-muted-foreground transition-colors hover:text-foreground">
                                <Twitter className="h-5 w-5" />
                            </a>
                            <a href="mailto:hello@example.com" className="text-muted-foreground transition-colors hover:text-foreground">
                                <Mail className="h-5 w-5" />
                            </a>
                        </div>
                    </div>
                </div>

                <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border/30 pt-6 text-footnote sm:flex-row">
                    <p className="text-muted-foreground">
                        © {new Date().getFullYear()} {name}. All rights reserved.
                    </p>
                    <p className="text-muted-foreground">
                        Built with Laravel, Inertia & React.
                    </p>
                </div>
            </div>
        </footer>
    );
}
