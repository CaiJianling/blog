import { Head, Link, usePage } from '@inertiajs/react';
import {
    ChevronRight,
    Clock,
    Eye,
    Heart,
    MessageSquare,
    Sparkles,
} from 'lucide-react';
import { useArticleLike } from '@/hooks/use-article-like';
import { blocknoteToHtml } from '@/lib/blocknote-to-html';
import { buildSeoMeta } from '@/lib/seo';

type MomentBlock = Record<string, unknown>;

export type MomentItem = {
    id: number;
    content: MomentBlock[] | null;
    author_name: string;
    author_avatar: string;
    views: number;
    likes: number;
    comment_count: number;
    liked_by_me: boolean | null;
    created_at: string;
    permalink: string;
};

type Props = {
    moments: {
        data: MomentItem[];
        current_page: number;
        last_page: number;
        total: number;
    };
};

export default function MomentIndex({ moments }: Props) {
    const seo = usePage().props.seo;

    return (
        <>
            <Head title="说说">
                {buildSeoMeta({ site: seo, title: '说说' })}
            </Head>

            <div className="mx-auto max-w-2xl px-5 py-10 md:px-8 md:py-14">
                <div className="mb-8">
                    <h1 className="text-display flex items-center gap-3">
                        <Sparkles className="h-7 w-7 text-primary" />
                        说说
                    </h1>
                    <p className="text-body mt-2 text-muted-foreground">
                        记录此刻的想法与日常
                    </p>
                </div>

                {moments.data.length === 0 ? (
                    <div className="apple-card p-12 text-center text-muted-foreground">
                        还没有发布说说，敬请期待
                    </div>
                ) : (
                    <div className="flex flex-col gap-5">
                        {moments.data.map((moment) => (
                            <MomentCard key={moment.id} moment={moment} />
                        ))}
                    </div>
                )}

                {/* 分页 */}
                {moments.last_page > 1 && (
                    <div className="mt-8 flex flex-wrap justify-center gap-1">
                        {Array.from(
                            { length: moments.last_page },
                            (_, i) => i + 1,
                        ).map((page) => (
                            <Link
                                key={page}
                                href={`/moments?page=${page}`}
                                preserveScroll
                                className={`apple-press flex h-9 min-w-9 items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors ${
                                    page === moments.current_page
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-foreground/80 hover:bg-accent'
                                }`}
                            >
                                {page}
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

function MomentCard({ moment }: { moment: MomentItem }) {
    const { likes, liked, sending, toggleLike } = useArticleLike(
        moment.id,
        moment.likes,
        moment.liked_by_me,
    );
    const html = moment.content ? blocknoteToHtml(moment.content) : '';
    const hasDetail =
        moment.comment_count > 0 || (moment.content?.length ?? 0) > 0;

    return (
        <article className="apple-card apple-press hover-glow group p-5">
            {/* 头部：作者 + 时间 */}
            <div className="flex items-center gap-3">
                {moment.author_avatar ? (
                    <img
                        src={moment.author_avatar}
                        alt={moment.author_name}
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-primary/10"
                        loading="lazy"
                    />
                ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {(moment.author_name || 'A').charAt(0).toUpperCase()}
                    </span>
                )}
                <div className="min-w-0 flex-1">
                    <p className="text-callout font-medium">
                        {moment.author_name}
                    </p>
                    <p className="text-footnote flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {moment.created_at}
                        <span className="mx-0.5">·</span>
                        <Eye className="h-3 w-3" />
                        {moment.views}
                    </p>
                </div>
                {hasDetail && (
                    <Link
                        href={moment.permalink}
                        className="apple-press text-footnote flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="查看详情"
                    >
                        详情
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                )}
            </div>

            {/* 内容 */}
            {html !== '' && (
                <div
                    className="moment-content prose-sm mt-3 leading-relaxed [&_img]:max-h-80 [&_img]:rounded-xl [&_img]:object-cover"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            )}

            {/* 互动 */}
            <div className="text-footnote mt-4 flex items-center gap-4 border-t border-border/40 pt-3 text-muted-foreground">
                <button
                    type="button"
                    onClick={toggleLike}
                    disabled={sending}
                    className={`inline-flex items-center gap-1.5 transition-colors hover:text-rose-500 disabled:opacity-60 ${
                        liked ? 'text-rose-500' : ''
                    }`}
                >
                    <Heart
                        className={`h-4 w-4 ${liked ? 'fill-rose-500 text-rose-500' : ''}`}
                    />
                    <span className="tabular-nums">{likes}</span>
                </button>
                <Link
                    href={moment.permalink}
                    className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                    <MessageSquare className="h-4 w-4" />
                    <span className="tabular-nums">{moment.comment_count}</span>
                </Link>
            </div>
        </article>
    );
}
