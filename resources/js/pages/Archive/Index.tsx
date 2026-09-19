import { Head, Link, usePage } from '@inertiajs/react';
import { Archive, MessageCircle, Clock3 } from 'lucide-react';
import { buildSeoMeta } from '@/lib/seo';

type Entry = {
    type: 'article' | 'moment';
    title: string;
    url: string;
    date: string;
    reading_time: number;
};

type YearGroup = {
    year: string;
    count: number;
    items: Entry[];
};

type Props = {
    years: YearGroup[];
    total: number;
};

export default function ArchiveIndex({ years, total }: Props) {
    const seo = usePage().props.seo;

    return (
        <>
            <Head title="归档">
                {buildSeoMeta({ site: seo, title: '归档' })}
            </Head>

            <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
                <div className="mb-10">
                    <h1 className="text-display flex items-center gap-3">
                        <Archive className="h-7 w-7 text-primary" />
                        归档
                    </h1>
                    <p className="text-body mt-2 text-muted-foreground">
                        共 {total} 篇内容，按时间倒序回望每一次记录
                    </p>
                </div>

                {years.length === 0 ? (
                    <div className="apple-card p-12 text-center text-muted-foreground">
                        暂无已发布的内容
                    </div>
                ) : (
                    <div className="flex flex-col gap-10">
                        {years.map((group) => (
                            <section key={group.year}>
                                {/* 年份标题 */}
                                <div className="mb-4 flex items-baseline gap-3">
                                    <h2 className="text-large-title font-semibold tracking-tight">
                                        {group.year}
                                    </h2>
                                    <span className="text-footnote text-muted-foreground">
                                        {group.count} 篇
                                    </span>
                                </div>

                                {/* 时间轴 */}
                                <div className="relative ml-2 border-l-2 border-border/60 pl-6">
                                    {group.items.map((entry, index) => (
                                        <div
                                            key={`${entry.url}-${index}`}
                                            className="relative pb-5 last:pb-0"
                                        >
                                            {/* 圆点 */}
                                            <span
                                                className={`absolute top-1.5 -left-[1.9rem] h-3 w-3 rounded-full border-2 border-background ring-2 ring-border/60 ${
                                                    entry.type === 'moment'
                                                        ? 'bg-amber-400'
                                                        : 'bg-primary'
                                                }`}
                                            />
                                            <Link
                                                href={entry.url}
                                                className="apple-press group -mx-2 flex items-start justify-between gap-4 rounded-xl px-2 py-2 transition-colors hover:bg-muted/60"
                                            >
                                                <div className="min-w-0">
                                                    <p
                                                        className={`text-body truncate font-medium transition-colors group-hover:text-primary ${
                                                            entry.type ===
                                                            'moment'
                                                                ? 'text-muted-foreground'
                                                                : ''
                                                        }`}
                                                    >
                                                        {entry.type ===
                                                            'moment' && (
                                                            <MessageCircle className="mr-1.5 inline h-3.5 w-3.5 text-amber-500" />
                                                        )}
                                                        {entry.title}
                                                    </p>
                                                    <p className="text-footnote mt-0.5 flex items-center gap-2 text-muted-foreground">
                                                        <span>
                                                            {entry.date}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1">
                                                            <Clock3 className="h-3 w-3" />
                                                            约{' '}
                                                            {entry.reading_time}{' '}
                                                            分钟
                                                        </span>
                                                    </p>
                                                </div>
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
