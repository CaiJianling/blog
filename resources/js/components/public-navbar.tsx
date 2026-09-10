import { Link, usePage } from '@inertiajs/react';
import { Moon, Sun, Monitor, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAppearance } from '@/hooks/use-appearance';
import { home, dashboard, login, register } from '@/routes';
import blog from '@/routes/blog';
import tools from '@/routes/tools';
import nav from '@/routes/nav';
import { cn } from '@/lib/utils';

const navItems = [
    { title: '首页', href: home() },
    { title: '博客', href: blog.index() },
    { title: '工具', href: tools.index() },
    { title: '导航', href: nav.index() },
];

export default function PublicNavbar() {
    const { auth, name, canRegister } = usePage().props as { auth: { user?: unknown }; name?: string; canRegister?: boolean };
    const { appearance, updateAppearance } = useAppearance();
    const [mobileOpen, setMobileOpen] = useState(false);

    const cycleAppearance = () => {
        const next = appearance === 'light' ? 'dark' : appearance === 'dark' ? 'system' : 'light';
        updateAppearance(next);
    };

    const ThemeIcon = appearance === 'light' ? Sun : appearance === 'dark' ? Moon : Monitor;

    return (
        <header className="sticky top-0 z-50">
            <div className="material-thin border-b-0">
                <div className="mx-auto flex h-14 max-w-6xl items-center px-5 md:px-8">
                    {/* Logo */}
                    <Link href={home()} className="apple-press flex items-center gap-2 rounded-xl px-1.5 py-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <span className="text-sm font-bold">{name?.charAt(0) ?? 'B'}</span>
                        </div>
                        <span className="text-headline hidden sm:block">{name}</span>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="ml-8 hidden items-center gap-1 md:flex">
                        {navItems.map((item) => (
                            <Link
                                key={item.title}
                                href={item.href}
                                className="apple-press rounded-full px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                            >
                                {item.title}
                            </Link>
                        ))}
                    </nav>

                    <div className="ml-auto flex items-center gap-1">
                        {/* Theme toggle */}
                        <button
                            type="button"
                            onClick={cycleAppearance}
                            className="apple-press inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 hover:bg-muted hover:text-foreground"
                            aria-label="切换主题"
                        >
                            <ThemeIcon className="h-[18px] w-[18px]" />
                        </button>

                        {/* Auth */}
                        {auth.user ? (
                            <Link
                                href={dashboard()}
                                className="apple-press ml-1 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                            >
                                控制台
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={login()}
                                    className="apple-press ml-1 rounded-full px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground"
                                >
                                    登录
                                </Link>
                                {canRegister && (
                                    <Link
                                        href={register()}
                                        className="apple-press ml-1 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                                    >
                                        注册
                                    </Link>
                                )}
                            </>
                        )}

                        {/* Mobile menu button */}
                        <button
                            type="button"
                            onClick={() => setMobileOpen(!mobileOpen)}
                            className="apple-press ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 hover:bg-muted hover:text-foreground md:hidden"
                            aria-label="菜单"
                        >
                            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Nav */}
            {mobileOpen && (
                <div className="material-thick border-t border-border/50 md:hidden">
                    <nav className="mx-auto flex max-w-6xl flex-col px-5 py-3">
                        {navItems.map((item) => (
                            <Link
                                key={item.title}
                                href={item.href}
                                onClick={() => setMobileOpen(false)}
                                className={cn(
                                    'apple-press rounded-xl px-4 py-3 text-base font-medium text-foreground/80 hover:bg-muted hover:text-foreground',
                                )}
                            >
                                {item.title}
                            </Link>
                        ))}
                        {!auth.user && (
                            <div className="mt-2 flex flex-col gap-2 border-t border-border/40 pt-3">
                                <Link
                                    href={login()}
                                    onClick={() => setMobileOpen(false)}
                                    className="apple-press rounded-xl px-4 py-3 text-base font-medium text-foreground/80 hover:bg-muted hover:text-foreground"
                                >
                                    登录
                                </Link>
                                {canRegister && (
                                    <Link
                                        href={register()}
                                        onClick={() => setMobileOpen(false)}
                                        className="apple-press rounded-xl bg-primary px-4 py-3 text-base font-medium text-primary-foreground hover:opacity-90"
                                    >
                                        注册
                                    </Link>
                                )}
                            </div>
                        )}
                    </nav>
                </div>
            )}
        </header>
    );
}
