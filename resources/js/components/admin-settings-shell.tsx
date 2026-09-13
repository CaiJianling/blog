import { Link, usePage } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import Heading from '@/components/heading';

export interface AdminSettingsSection {
    title: string;
    url: string;
}

/** 后台设置分区（顺序即子导航顺序）。 */
export const ADMIN_SETTING_SECTIONS: AdminSettingsSection[] = [
    { title: '站点设置', url: '/settings/site' },
    { title: '前台显示', url: '/settings/home' },
    { title: 'AI 设置', url: '/settings/ai' },
    { title: '固定链接', url: '/settings/permalink' },
    { title: '导航设置', url: '/settings/navigation' },
    { title: '表情管理', url: '/settings/smilies' },
];

interface AdminSettingsShellProps {
    /** 当前页面标题。 */
    title: string;
    /** 当前页面描述。 */
    description: string;
    /** 当前激活的分区路径（用于子导航高亮）。 */
    active: string;
    /** 内容区是否使用宽布局（默认居中限宽，适合表单）。 */
    wide?: boolean;
    children: React.ReactNode;
}

/**
 * 后台设置统一外壳：左侧分区子导航 + 右侧内容区，
 * 所有后台设置页面套用此布局以保证一致的外观。
 */
export default function AdminSettingsShell({
    title,
    description,
    active,
    wide = false,
    children,
}: AdminSettingsShellProps) {
    const { url: currentUrl } = usePage();

    const isActive = (url: string) => currentUrl === url || currentUrl.startsWith(`${url}/`);

    return (
        <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
            <Heading variant="small" title={title} description={description} />

            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                {/* 分区子导航 */}
                <nav className="w-full shrink-0 lg:sticky lg:top-24 lg:w-52" aria-label="设置分区">
                    <ul className="flex gap-1.5 overflow-x-auto rounded-xl border border-border/50 bg-card/60 p-1.5 lg:flex-col lg:overflow-visible">
                        {ADMIN_SETTING_SECTIONS.map((section) => (
                            <li key={section.url} className="shrink-0 lg:w-full">
                                <Link
                                    href={section.url}
                                    className={cn(
                                        'block whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors',
                                        isActive(section.url)
                                            ? 'bg-primary/10 font-medium text-primary'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                    )}
                                >
                                    {section.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* 内容区 */}
                <div className={cn('min-w-0 flex-1', wide ? '' : 'mx-auto w-full max-w-2xl lg:mx-0')}>
                    {children}
                </div>
            </div>
        </div>
    );
}
