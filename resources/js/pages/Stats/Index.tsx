import { Head, router } from '@inertiajs/react';
import {
    Eye,
    Users,
    UserPlus,
    RotateCcw,
    ArrowRight,
    Globe,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BarList } from '@/components/stats/bar-list';
import { TrendLineChart } from '@/components/stats/line-chart';
import type { TrendPoint } from '@/components/stats/line-chart';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type Range = 7 | 30 | 90;

interface Overview {
    pv: number;
    uv: number;
    newVisitors: number;
    returningVisitors: number;
}

interface TopPage {
    path: string;
    title: string | null;
    page_type: string;
    views: number;
}

interface SourceClass {
    name: string;
    views: number;
    percent: number;
}

interface Referrer {
    host: string;
    path: string;
    views: number;
}

interface ProfileItem {
    name: string;
    views: number;
}

interface PathPair {
    from: string;
    to: string;
    views: number;
}

interface Landing {
    path: string;
    views: number;
}

interface Props {
    range: Range;
    isEmpty: boolean;
    overview: Overview;
    series: TrendPoint[];
    topPages: TopPage[];
    sources: { byClass: SourceClass[]; referrers: Referrer[] };
    profiles: {
        browsers: ProfileItem[];
        os: ProfileItem[];
        devices: ProfileItem[];
    };
    paths: PathPair[];
    landings: Landing[];
}

const PAGE_TYPE_LABELS: Record<string, string> = {
    article: '文章',
    tool: '工具',
    home: '首页',
    blog_list: '博客列表',
    nav: '导航',
    nav_link: '导航链接',
    link: '友链',
    other: '其他',
};

export default function StatsIndex({
    range,
    isEmpty,
    overview,
    series,
    topPages,
    sources,
    profiles,
    paths,
    landings,
}: Props) {
    const { t } = useTranslation();

    const formatNumber = (value: number): string => value.toLocaleString();

    const changeRange = (value: string) => {
        router.visit(`/admin/site-stats?range=${value}`, { preserveScroll: true });
    };

    const overviewCards = [
        {
            key: 'pv',
            icon: Eye,
            label: t('siteStats.overview.pv'),
            value: overview.pv,
            desc: t('siteStats.overview.pvDesc'),
        },
        {
            key: 'uv',
            icon: Users,
            label: t('siteStats.overview.uv'),
            value: overview.uv,
            desc: t('siteStats.overview.uvDesc'),
        },
        {
            key: 'new',
            icon: UserPlus,
            label: t('siteStats.overview.newVisitors'),
            value: overview.newVisitors,
            desc: t('siteStats.overview.newDesc'),
        },
        {
            key: 'returning',
            icon: RotateCcw,
            label: t('siteStats.overview.returningVisitors'),
            value: overview.returningVisitors,
            desc: t('siteStats.overview.returningDesc'),
        },
    ];

    return (
        <>
            <Head title={t('siteStats.title')} />
            <div className="flex h-full flex-1 flex-col gap-5 overflow-x-auto p-6">
                {/* Page header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-title-1 font-semibold tracking-tight text-foreground">
                            {t('siteStats.title')}
                        </h1>
                        <p className="text-subheadline text-secondary-label">
                            {t('siteStats.description')}
                        </p>
                    </div>
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        value={String(range)}
                        onValueChange={changeRange}
                        aria-label="time range"
                    >
                        <ToggleGroupItem value="7">
                            {t('siteStats.range7')}
                        </ToggleGroupItem>
                        <ToggleGroupItem value="30">
                            {t('siteStats.range30')}
                        </ToggleGroupItem>
                        <ToggleGroupItem value="90">
                            {t('siteStats.range90')}
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>

                {isEmpty ? (
                    <div className="flex flex-1 items-center justify-center">
                        <div className="flex flex-col items-center gap-3 py-16 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-muted text-muted-foreground/60">
                                <Globe className="h-8 w-8" />
                            </div>
                            <p className="text-headline font-medium">
                                {t('siteStats.empty')}
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Overview cards */}
                        <div className="grid auto-rows-min gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {overviewCards.map((card) => (
                                <Card key={card.key}>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-subheadline text-secondary-label font-medium">
                                            {card.label}
                                        </CardTitle>
                                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                            <card.icon className="h-5 w-5" />
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-large-title font-semibold tracking-tight">
                                            {formatNumber(card.value)}
                                        </div>
                                        <p className="text-footnote text-tertiary-label mt-1">
                                            {card.desc}
                                        </p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Traffic trend */}
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    {t('siteStats.trend.title')}
                                </CardTitle>
                                <CardDescription>
                                    {t('siteStats.trend.pv')} /{' '}
                                    {t('siteStats.trend.uv')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <TrendLineChart series={series} />
                            </CardContent>
                        </Card>

                        {/* Top pages + sources */}
                        <div className="grid auto-rows-min gap-4 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        {t('siteStats.topPages.title')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {topPages.length === 0 ? (
                                        <p className="text-footnote text-tertiary-label py-4 text-center">
                                            {t('siteStats.topPages.empty')}
                                        </p>
                                    ) : (
                                        <ul className="divide-y divide-border/40">
                                            {topPages.map((page) => (
                                                <li
                                                    key={page.path}
                                                    className="flex items-center justify-between gap-3 py-2.5"
                                                >
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <Badge
                                                            variant="outline"
                                                            className="shrink-0 font-normal"
                                                        >
                                                            {PAGE_TYPE_LABELS[
                                                                page.page_type
                                                            ] ?? page.page_type}
                                                        </Badge>
                                                        <span className="text-body truncate">
                                                            {page.title ??
                                                                page.path}
                                                        </span>
                                                    </div>
                                                    <span className="text-callout text-secondary-label shrink-0 tabular-nums">
                                                        {formatNumber(
                                                            page.views,
                                                        )}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        {t('siteStats.sources.title')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-6">
                                    <BarList
                                        items={sources.byClass.map((item) => ({
                                            name: t(
                                                `siteStats.sources.${item.name}`,
                                            ),
                                            value: item.views,
                                            hint: `${item.percent}%`,
                                        }))}
                                        valueLabel="PV"
                                    />
                                    {sources.referrers.length > 0 && (
                                        <div className="flex flex-col gap-2">
                                            <div className="text-footnote text-tertiary-label font-medium tracking-wider uppercase">
                                                {t(
                                                    'siteStats.sources.referrers',
                                                )}
                                            </div>
                                            <ul className="divide-y divide-border/40">
                                                {sources.referrers.map(
                                                    (referrer) => (
                                                        <li
                                                            key={`${referrer.host}-${referrer.path}`}
                                                            className="flex items-center justify-between gap-3 py-2"
                                                        >
                                                            <span className="text-callout truncate">
                                                                {referrer.host}
                                                                <span className="text-muted-foreground">
                                                                    {
                                                                        referrer.path
                                                                    }
                                                                </span>
                                                            </span>
                                                            <span className="text-callout text-secondary-label shrink-0 tabular-nums">
                                                                {formatNumber(
                                                                    referrer.views,
                                                                )}
                                                            </span>
                                                        </li>
                                                    ),
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Profiles + paths */}
                        <div className="grid auto-rows-min gap-4 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        {t('siteStats.profiles.title')}
                                    </CardTitle>
                                    <CardDescription>
                                        {t('siteStats.profiles.browser')} ·{' '}
                                        {t('siteStats.profiles.os')} ·{' '}
                                        {t('siteStats.profiles.device')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-6">
                                    {(
                                        [
                                            [
                                                profiles.browsers,
                                                t('siteStats.profiles.browser'),
                                            ],
                                            [
                                                profiles.os,
                                                t('siteStats.profiles.os'),
                                            ],
                                            [
                                                profiles.devices,
                                                t('siteStats.profiles.device'),
                                            ],
                                        ] as [ProfileItem[], string][]
                                    ).map(([items, label]) => (
                                        <div
                                            key={label}
                                            className="flex flex-col gap-2"
                                        >
                                            <div className="text-footnote text-tertiary-label flex items-center gap-2 font-medium tracking-wider uppercase">
                                                <Globe className="h-3.5 w-3.5" />
                                                {label}
                                            </div>
                                            {items.length === 0 ? (
                                                <p className="text-footnote text-tertiary-label">
                                                    {t(
                                                        'siteStats.topPages.empty',
                                                    )}
                                                </p>
                                            ) : (
                                                <BarList
                                                    items={items.map(
                                                        (item) => ({
                                                            name: item.name,
                                                            value: item.views,
                                                        }),
                                                    )}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        {t('siteStats.paths.title')}
                                    </CardTitle>
                                    <CardDescription>
                                        {t('siteStats.paths.from')} →{' '}
                                        {t('siteStats.paths.to')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-6">
                                    {paths.length === 0 ? (
                                        <p className="text-footnote text-tertiary-label py-4 text-center">
                                            {t('siteStats.paths.empty')}
                                        </p>
                                    ) : (
                                        <ul className="divide-y divide-border/40">
                                            {paths.map((pair) => (
                                                <li
                                                    key={`${pair.from}-${pair.to}`}
                                                    className="flex items-center gap-3 py-2.5"
                                                >
                                                    <div className="text-callout flex min-w-0 flex-1 items-center gap-2">
                                                        <span className="max-w-[40%] truncate">
                                                            {pair.from}
                                                        </span>
                                                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                        <span className="min-w-0 flex-1 truncate">
                                                            {pair.to}
                                                        </span>
                                                    </div>
                                                    <span className="text-callout text-secondary-label shrink-0 tabular-nums">
                                                        {formatNumber(
                                                            pair.views,
                                                        )}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {landings.length > 0 && (
                                        <div className="flex flex-col gap-2">
                                            <div className="text-footnote text-tertiary-label font-medium tracking-wider uppercase">
                                                {t('siteStats.paths.landings')}
                                            </div>
                                            <BarList
                                                items={landings.map((item) => ({
                                                    name: item.path,
                                                    value: item.views,
                                                }))}
                                            />
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

StatsIndex.layout = {
    breadcrumbs: [
        {
            title: 'siteStats.title',
            href: '/admin/site-stats',
        },
    ],
};
