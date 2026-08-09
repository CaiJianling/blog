import { Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { FileText, Eye, Users, TrendingUp, Calendar, Sparkles } from 'lucide-react';
import { dashboard } from '@/routes';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function Dashboard() {
    const { t } = useTranslation();

    const stats = [
        {
            title: '总文章数',
            value: '128',
            delta: '+12%',
            icon: FileText,
            description: '相比上月',
            trend: 'up' as const,
        },
        {
            title: '总浏览量',
            value: '24.8k',
            delta: '+23%',
            icon: Eye,
            description: '相比上月',
            trend: 'up' as const,
        },
        {
            title: '活跃用户',
            value: '1,249',
            delta: '+6%',
            icon: Users,
            description: '相比上月',
            trend: 'up' as const,
        },
    ];

    return (
        <>
            <Head title={t('dashboard.title')} />
            <div className="flex h-full flex-1 flex-col gap-5 overflow-x-auto p-6">
                {/* Welcome */}
                <div className="flex flex-col gap-1">
                    <h1 className="text-title-1 font-semibold text-foreground tracking-tight">
                        欢迎回来 👋
                    </h1>
                    <p className="text-subheadline text-secondary-label">
                        今天是美好的一天，让我们一起创作一些精彩内容。
                    </p>
                </div>

                {/* Stats Cards */}
                <div className="grid auto-rows-min gap-4 md:grid-cols-3">
                    {stats.map((stat) => (
                        <Card key={stat.title}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-subheadline font-medium text-secondary-label">
                                    {stat.title}
                                </CardTitle>
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                    <stat.icon className="h-5 w-5" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-baseline gap-2">
                                    <div className="text-large-title font-semibold tracking-tight">
                                        {stat.value}
                                    </div>
                                    <div className="flex items-center gap-0.5 text-caption font-medium text-emerald-600 dark:text-emerald-500">
                                        <TrendingUp className="h-3.5 w-3.5" />
                                        {stat.delta}
                                    </div>
                                </div>
                                <p className="mt-1 text-footnote text-tertiary-label">
                                    {stat.description}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
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
                                        最近动态
                                    </CardTitle>
                                    <CardDescription>
                                        你最近的创作和系统活动
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-1.5 text-footnote text-secondary-label">
                                    <Calendar className="h-4 w-4" />
                                    今天
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col divide-y divide-border/40">
                                {[
                                    { title: '发布了新文章「React 19 新特性全面解析」', time: '2 小时前', type: '发布' },
                                    { title: '收到了 12 条新评论', time: '5 小时前', type: '评论' },
                                    { title: '文章「Tailwind CSS 4.0 实战」浏览量突破 1k', time: '昨天', type: '热门' },
                                    { title: '新用户「张三」注册成功', time: '2 天前', type: '用户' },
                                ].map((item, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0"
                                    >
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                                            <span className="text-caption font-semibold">
                                                {item.type.slice(0, 1)}
                                            </span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-body truncate font-medium">
                                                {item.title}
                                            </div>
                                            <div className="text-footnote text-tertiary-label">
                                                {item.time}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle>快捷操作</CardTitle>
                            <CardDescription>常用的管理功能</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2">
                            <div className="flex flex-col gap-1">
                                {[
                                    { icon: FileText, label: '写文章', desc: '创作新内容', accent: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
                                    { icon: Users, label: '用户管理', desc: '查看所有用户', accent: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
                                    { icon: Eye, label: '查看数据', desc: '数据统计分析', accent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
                                    { icon: Calendar, label: '日程安排', desc: '内容排期', accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
                                ].map((action, i) => (
                                    <button
                                        key={i}
                                        className="apple-press flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-accent/60"
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
                                    </button>
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
