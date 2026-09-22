import { Link, usePage } from '@inertiajs/react';
import {
    ChevronDown,
    ExternalLink,
    Menu,
    Moon,
    Monitor,
    Sun,
    X,
} from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LiquidGlassPanel from '@/components/LiquidGlass/LiquidGlassPanel';
import { useAppearance } from '@/hooks/use-appearance';
import { EFFECT_LEVEL, useEffectsAtLeast } from '@/hooks/use-effects';
import { useGlassSurfaceSize } from '@/hooks/use-glass-surface-size';
import { cn } from '@/lib/utils';
import { home, dashboard, login, register } from '@/routes';
import blog from '@/routes/blog';
import links from '@/routes/links';
import nav from '@/routes/nav';
import tools from '@/routes/tools';
import type { RouteDefinition } from '@/wayfinder';

/**
 * 后台「菜单管理」（slug=top）解析出的导航节点；
 * 为空时回退到内置默认导航。
 * url 可以是后端菜单给出的字符串路径，也可以是默认导航的 Wayfinder 路由对象。
 */
type Href = string | RouteDefinition<'get'>;

type NavNode = {
    label: string;
    url: Href;
    target: string;
    children: NavNode[];
};

type PageProps = {
    auth: { user?: unknown };
    name?: string;
    canRegister?: boolean;
    top_nav?: NavNode[];
};

const urlOf = (url: Href): string => (typeof url === 'string' ? url : url.url);

const isExternalUrl = (url: Href): boolean => {
    const value = urlOf(url);

    return /^https?:\/\//i.test(value) || value.startsWith('//');
};

/**
 * 顶栏控件底衬：亮色半透黑、暗色半透白。
 *
 * 极致档下顶栏是液态玻璃（背板随页面内容变化、对比很低），无底色的文字按钮
 * 和图标按钮会糊在一起，所以链接与主题切换都垫一层中性色底，hover 再压深一档。
 */
const navChip =
    'bg-black/[0.06] text-foreground/90 hover:bg-black/[0.1] hover:text-foreground dark:bg-white/[0.12] dark:text-white/90 dark:hover:bg-white/20';

export default function PublicNavbar() {
    const { t } = useTranslation();
    const { auth, name, canRegister, top_nav } = usePage().props as PageProps;
    const { appearance, updateAppearance } = useAppearance();
    const barGlass = useEffectsAtLeast(EFFECT_LEVEL.ultimate);
    const [mobileOpen, setMobileOpen] = useState(false);
    // 移动端二级菜单展开状态（clientId 用 label 索引即可）
    const [mobileExpanded, setMobileExpanded] = useState<Set<string>>(
        new Set(),
    );

    const glassId = useId();
    const barRef = useRef<HTMLDivElement>(null);
    // 「极致」档起顶栏改用液态玻璃面板（磨砂度由「液态玻璃」滑块全局控制），
    // 位移图按面板尺寸生成，故需要实测顶栏大小
    const barSize = useGlassSurfaceSize(barRef, barGlass);

    // 默认导航（后台未维护 top 菜单或其项全部无效时回退）
    const defaultItems: NavNode[] = [
        { label: t('publicNav.home'), url: home(), target: '', children: [] },
        {
            label: t('publicNav.blog'),
            url: blog.index(),
            target: '',
            children: [],
        },
        {
            label: t('publicNav.moments'),
            url: '/moments',
            target: '',
            children: [],
        },
        {
            label: t('publicNav.archive'),
            url: '/archive',
            target: '',
            children: [],
        },
        {
            label: t('publicNav.tools'),
            url: tools.index(),
            target: '',
            children: [],
        },
        {
            label: t('publicNav.nav'),
            url: nav.index(),
            target: '',
            children: [],
        },
        {
            label: t('publicNav.links'),
            url: links.index(),
            target: '',
            children: [],
        },
    ];

    const items = (top_nav?.length ? top_nav : defaultItems).filter(
        (item) => urlOf(item.url) !== '' || item.children.length > 0,
    );

    const toggleMobileExpand = (label: string) => {
        setMobileExpanded((prev) => {
            const next = new Set(prev);

            if (next.has(label)) {
                next.delete(label);
            } else {
                next.add(label);
            }

            return next;
        });
    };

    const cycleAppearance = () => {
        const next =
            appearance === 'light'
                ? 'dark'
                : appearance === 'dark'
                  ? 'system'
                  : 'light';
        updateAppearance(next);
    };

    const ThemeIcon =
        appearance === 'light' ? Sun : appearance === 'dark' ? Moon : Monitor;

    /** 单条导航链接：站内走 Inertia 预取跳转，外链走原生 a */
    const renderLink = (
        item: NavNode,
        extraClass?: string,
        onClick?: () => void,
    ) => {
        const className = cn(
            'apple-press rounded-full px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground',
            extraClass,
        );

        if (isExternalUrl(item.url) || item.target === '_blank') {
            return (
                <a
                    href={urlOf(item.url)}
                    target={item.target === '_blank' ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    onClick={onClick}
                    className={className}
                >
                    {item.label}
                    {isExternalUrl(item.url) && (
                        <ExternalLink className="ml-1 inline h-3 w-3 opacity-60" />
                    )}
                </a>
            );
        }

        return (
            <Link
                href={item.url}
                prefetch
                onClick={onClick}
                className={className}
            >
                {item.label}
            </Link>
        );
    };

    return (
        <header className="sticky top-0 z-50">
            <div
                ref={barRef}
                className={cn(
                    'relative overflow-hidden',
                    // 极致档 = 液态玻璃背景（由 LiquidGlassPanel 承载）；
                    // 未达档位时回退到原有毛玻璃 material-thin
                    !barGlass && 'material-thin border-b-0',
                )}
            >
                {barGlass && barSize.width > 0 && barSize.height > 0 && (
                    <LiquidGlassPanel
                        id={glassId}
                        width={barSize.width}
                        height={barSize.height}
                        radius={12}
                        bezelWidth={10}
                    />
                )}

                <div className="relative mx-auto flex h-14 max-w-6xl items-center px-5 md:px-8">
                    {/* Logo */}
                    <Link
                        href={home()}
                        className="apple-press flex items-center gap-2 rounded-xl px-1.5 py-1"
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <span className="text-sm font-bold">
                                {name?.charAt(0) ?? 'B'}
                            </span>
                        </div>
                        <span className="text-headline hidden sm:block">
                            {name}
                        </span>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="ml-8 hidden items-center gap-1 md:flex">
                        {items.map((item) =>
                            item.children.length > 0 ? (
                                <div
                                    key={item.label}
                                    className="group relative"
                                >
                                    {urlOf(item.url) !== '' ? (
                                        isExternalUrl(item.url) ? (
                                            <a
                                                href={urlOf(item.url)}
                                                target={item.target === '_blank' ? '_blank' : undefined}
                                                rel="noopener noreferrer"
                                                className={cn(
                                                    'apple-press inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                                                    navChip,
                                                )}
                                            >
                                                {item.label}
                                                <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:rotate-180" />
                                            </a>
                                        ) : (
                                            <Link
                                                href={item.url}
                                                prefetch
                                                className={cn(
                                                    'apple-press inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                                                    navChip,
                                                )}
                                            >
                                                {item.label}
                                                <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:rotate-180" />
                                            </Link>
                                        )
                                    ) : (
                                        <span
                                            className={cn(
                                                'inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium',
                                                navChip,
                                            )}
                                        >
                                            {item.label}
                                            <ChevronDown className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:rotate-180" />
                                        </span>
                                    )}
                                    {/* 悬停下拉 */}
                                    <div className="invisible absolute top-full left-0 z-50 pt-1 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100">
                                        <div className="apple-card min-w-44 p-1.5">
                                            {item.children.map((child) => (
                                                <div
                                                    key={child.label}
                                                    className="px-1 py-0.5"
                                                >
                                                    {renderLink(
                                                        child,
                                                        'block rounded-lg px-3 py-2 hover:bg-muted hover:text-foreground',
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div key={item.label}>{renderLink(item, navChip)}</div>
                            ),
                        )}
                    </nav>

                    <div className="ml-auto flex items-center gap-1">
                        {/* Theme toggle */}
                        <button
                            type="button"
                            onClick={cycleAppearance}
                            className={cn(
                                'apple-press inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                                navChip,
                            )}
                            aria-label={t('publicNav.toggleTheme')}
                        >
                            <ThemeIcon className="h-[18px] w-[18px]" />
                        </button>

                        {/* Auth */}
                        {auth.user ? (
                            <Link
                                href={dashboard()}
                                className="apple-press ml-1 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                            >
                                {t('publicNav.dashboard')}
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={login()}
                                    className={cn(
                                        'apple-press ml-1 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                                        navChip,
                                    )}
                                >
                                    {t('publicNav.login')}
                                </Link>
                                {canRegister && (
                                    <Link
                                        href={register()}
                                        className="apple-press ml-1 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                                    >
                                        {t('publicNav.register')}
                                    </Link>
                                )}
                            </>
                        )}

                        {/* Mobile menu button */}
                        <button
                            type="button"
                            onClick={() => setMobileOpen(!mobileOpen)}
                            className={cn(
                                'apple-press ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors md:hidden',
                                navChip,
                            )}
                            aria-label={t('publicNav.menu')}
                        >
                            {mobileOpen ? (
                                <X className="h-5 w-5" />
                            ) : (
                                <Menu className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Nav */}
            {mobileOpen && (
                <div className="material-thick border-t border-border/50 md:hidden">
                    <nav className="mx-auto flex max-w-6xl flex-col px-5 py-3">
                        {items.map((item) => (
                            <div key={item.label}>
                                {item.children.length > 0 ? (
                                    <>
                                        <div className="flex items-center justify-between">
                                            {urlOf(item.url) !== '' ? (
                                                isExternalUrl(item.url) ? (
                                                    <a
                                                        href={urlOf(item.url)}
                                                        target={
                                                            item.target ===
                                                            '_blank'
                                                                ? '_blank'
                                                                : undefined
                                                        }
                                                        rel="noopener noreferrer"
                                                        onClick={() =>
                                                            setMobileOpen(false)
                                                        }
                                                        className="apple-press my-1 block flex-1 rounded-xl px-4 py-3 text-base font-medium text-foreground/80 hover:bg-muted"
                                                    >
                                                        {item.label}
                                                    </a>
                                                ) : (
                                                    <Link
                                                        href={item.url}
                                                        onClick={() =>
                                                            setMobileOpen(false)
                                                        }
                                                        className="apple-press my-1 block flex-1 rounded-xl px-4 py-3 text-base font-medium text-foreground/80 hover:bg-muted"
                                                    >
                                                        {item.label}
                                                    </Link>
                                                )
                                            ) : (
                                                <span className="my-1 block flex-1 px-4 py-3 text-base font-medium text-foreground/80">
                                                    {item.label}
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleMobileExpand(
                                                        item.label,
                                                    )
                                                }
                                                className="apple-press rounded-lg p-2 text-foreground/60 hover:bg-muted"
                                                aria-label="toggle"
                                            >
                                                <ChevronDown
                                                    className={cn(
                                                        'h-4 w-4 transition-transform',
                                                        !mobileExpanded.has(
                                                            item.label,
                                                        ) && '-rotate-90',
                                                    )}
                                                />
                                            </button>
                                        </div>
                                        {mobileExpanded.has(item.label) &&
                                            item.children.map((child) => (
                                                <div
                                                    key={child.label}
                                                    className="pl-4"
                                                >
                                                    {renderLink(
                                                        child,
                                                        'block px-4 py-2.5 text-sm text-foreground/70 hover:bg-muted',
                                                        () =>
                                                            setMobileOpen(
                                                                false,
                                                            ),
                                                    )}
                                                </div>
                                            ))}
                                    </>
                                ) : (
                                    renderLink(
                                        item,
                                        'block px-4 py-3 text-base text-foreground/80 hover:bg-muted',
                                        () => setMobileOpen(false),
                                    )
                                )}
                            </div>
                        ))}
                        {!auth.user && (
                            <div className="mt-2 flex flex-col gap-2 border-t border-border/40 pt-3">
                                <Link
                                    href={login()}
                                    onClick={() => setMobileOpen(false)}
                                    className="apple-press rounded-xl px-4 py-3 text-base font-medium text-foreground/80 hover:bg-muted"
                                >
                                    {t('publicNav.login')}
                                </Link>
                                {canRegister && (
                                    <Link
                                        href={register()}
                                        onClick={() => setMobileOpen(false)}
                                        className="apple-press rounded-xl bg-primary px-4 py-3 text-base font-medium text-primary-foreground hover:opacity-90"
                                    >
                                        {t('publicNav.register')}
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
