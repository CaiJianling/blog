import { Head, Link, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import {
    FileText,
    Eye,
    Users,
    MessageSquare,
    TrendingUp,
    TrendingDown,
    Calendar,
    Sparkles,
    Image as ImageIcon,
    PenLine,
} from 'lucide-react';
import { dashboard } from '@/routes';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

type StatKey = 'articles' | 'views' | 'comments' | 'users';

interface StatItem {
    key: StatKey;
    value: number;
    delta: number | null;
    meta: Record<string, number>;
}

type ActivityType = 'article' | 'comment' | 'user';

interface ActivityItem {
    type: ActivityType;
    action?: 'created' | 'updated';
    title?: string;
    author?: string | null;
    related?: string | null;
    snippet?: string;
    name?: string;
    time_human: string;
}

interface Props {
    stats: StatItem[];
    activities: ActivityItem[];
}

const STAT_ICONS: Record<StatKey, typeof FileText> = {
    articles: FileText,
    views: Eye,
    comments: MessageSquare,
    users: Users,
};

export default function Dashboard({ stats, activities }: Props) {
    const { t } = useTranslation();
    const { auth } = usePage().props as any;
    const isAdmin = auth?.user?.role === 'administrator';
    const displayName = auth?.user?.nickname || auth?.user?.name || '';

    const statTitleMap: Record<StatKey, string> = {
        articles: t('dashboard.totalArticles'),
        views: t('dashboard.totalViews'),
        comments: t('dashboard.totalComments'),
        users: t('dashboard.totalUsers'),
    };

    const statDescription = (stat: StatItem): string => {
        switch (stat.key) {
            case 'articles':
                return t('dashboard.thisMonthNew', { count: stat.meta.thisMonth ?? 0 });
            case 'views':
                return t('dashboard.viewsDescription', {
                    articles: stat.meta.articles ?? 0,
                    pages: stat.meta.pages ?? 0,
                });
            case 'comments':
                return t('dashboard.pendingComments', { count: stat.meta.pending ?? 0 });
            case 'users':
                return t('dashboard.thisMonthNewUsers', { count: stat.meta.thisMonth ?? 0 });
        }
    };

    const formatNumber = (value: number): string => value.toLocaleString();

    const activityTitle = (item: ActivityItem): string => {
        switch (item.type) {
            case 'article':
                return item.action === 'created'
                    ? t('dashboard.activityArticleCreated', { title: item.title })
                    : t('dashboard.activityArticleUpdated', { title: item.title });
            case 'comment':
                return t('dashboard.activityComment', {
                    author: item.author || t('dashboard.anonymous'),
                    related: item.related || t('dashboard.contentDeleted'),
                    snippet: item.snippet,
                });
            case 'user':
                return t('dashboard.activityUser', { name: item.name });
        }
    };

    const quickActions = [
        {
            icon: PenLine,
            label: t('dashboard.writeArticle'),
            desc: t('dashboard.writeArticleDesc'),
            href: '/articles/create',
            accent: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
            adminOnly: false,
        },
        {
            icon: MessageSquare,
            label: t('dashboard.manageComments'),
            desc: t('dashboard.manageCommentsDesc'),
            href: '/comments',
            accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
            adminOnly: false,
        },
        {
            icon: ImageIcon,
            label: t('dashboard.mediaLibrary'),
            desc: t('dashboard.mediaLibraryDesc'),
            href: '/attachments',
            accent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            adminOnly: false,
        },
        {
            icon: Users,
            label: t('dashboard.userManagement'),
            desc: t('dashboard.userManagementDesc'),
            href: '/users',
            accent: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
            adminOnly: true,
        },
    ].filter((action) => !action.adminOnly || isAdmin);

    return (
        <>
            <Head title={t('dashboard.title')} />
            <div className="flex h-full flex-1 flex-col gap-5 overflow-x-auto p-6">
                {/* Welcome */}
                <div className="flex flex-col gap-1">
                    <h1 className="text-title-1 font-semibold text-foreground tracking-tight">
                        {t('dashboard.welcomeBack', { name: displayName })}
                    </h1>
                    <p className="text-subheadline text-secondary-label">
                        {t('dashboard.welcomeSubtitle')}
                    </p>
                </div>

                {/* Stats Cards */}
                <div className="grid auto-rows-min gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {stats.map((stat) => {
                        const Icon = STAT_ICONS[stat.key];
                        const hasDelta = stat.delta !== null && stat.delta !== 0;
                        const isUp = (stat.delta ?? 0) >= 0;

                        return (
                            <Card key={stat.key}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-subheadline font-medium text-secondary-label">
                                        {statTitleMap[stat.key]}
                                    </CardTitle>
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-baseline gap-2">
                                        <div className="text-large-title font-semibold tracking-tight">
                                            {formatNumber(stat.value)}
                                        </div>
                                        {hasDelta && (
                                            <div
                                                className={`flex items-center gap-0.5 text-caption font-medium ${
                                                    isUp
                                                        ? 'text-emerald-600 dark:text-emerald-500'
                                                        : 'text-rose-600 dark:text-rose-500'
                                                }`}
                                            >
                                                {isUp ? (
                                                    <TrendingUp className="h-3.5 w-3.5" />
                                                ) : (
                                                    <TrendingDown className="h-3.5 w-3.5" />
                                                )}
                                                {isUp ? '+' : ''}{stat.delta}%
                                            </div>
                                        )}
                                    </div>
                                    <p className="mt-1 text-footnote text-tertiary-label">
                                        {statDescription(stat)}
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Two columns */}
                <div className="grid flex-1 auto-rows-min gap-4 md:grid-cols-3">
                    {/* Recent activity / content area */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-primary" />
                                        {t('dashboard.recentActivity')}
                                    </CardTitle>
                                    <CardDescription>
                                        {t('dashboard.recentActivityDescription')}
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-1.5 text-footnote text-secondary-label">
                                    <Calendar className="h-4 w-4" />
                                    {t('dashboard.today')}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {activities.length === 0 ? (
                                <p className="py-6 text-center text-footnote text-tertiary-label">
                                    {t('dashboard.noActivity')}
                                </p>
                            ) : (
                                <div className="flex flex-col divide-y divide-border/40">
                                    {activities.map((item, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0"
                                        >
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                                                <span className="text-caption font-semibold">
                                                    {t(`dashboard.activityType.${item.type}`)}
                                                </span>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-body truncate font-medium">
                                                    {activityTitle(item)}
                                                </div>
                                                <div className="text-footnote text-tertiary-label">
                                                    {item.time_human}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Quick actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('dashboard.quickActions')}</CardTitle>
                            <CardDescription>{t('dashboard.quickActionsDescription')}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2">
                            <div className="flex flex-col gap-1">
                                {quickActions.map((action) => (
                                    <Link
                                        key={action.href}
                                        href={action.href}
                                        className="flex w-full cursor-pointer items-center gap-3 rounded-2xl p-3 text-left hover:bg-accent/60"
                                    >
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.accent}`}>
                                            <action.icon className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-callout font-medium">
                                                {action.label}
                                            </div>
                                            <div className="text-footnote text-tertiary-label">
                                                {action.desc}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'dashboard.title',
            href: dashboard(),
        },
    ],
};
