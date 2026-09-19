import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, Clock, Eye, Heart } from 'lucide-react';
import { useMemo } from 'react';
import CommentSection from '@/components/comments/comment-section';
import type {
    Captcha,
    CommentItem,
    SmileyGroupData,
} from '@/components/comments/comment-section';
import { useArticleLike } from '@/hooks/use-article-like';
import { blocknoteToHtml } from '@/lib/blocknote-to-html';
import { buildSeoMeta } from '@/lib/seo';

type MomentBlock = Record<string, unknown>;

export type MomentDetail = {
    id: number;
    content: MomentBlock[] | null;
    author_name: string;
    author_avatar: string;
    views: number;
    likes: number;
    comment_count: number;
    comment_status: string;
    liked_by_me: boolean | null;
    created_at: string;
    permalink: string;
};

type Props = {
    moment: MomentDetail;
    comments: CommentItem[];
    captcha: Captcha;
    smileyGroups: SmileyGroupData[];
    prevMoment: { id: number } | null;
    nextMoment: { id: number } | null;
};

export default function MomentShow({
    moment,
    comments,
    captcha,
    smileyGroups,
    prevMoment,
    nextMoment,
}: Props) {
    const seo = usePage().props.seo;
    const { likes, liked, sending, toggleLike } = useArticleLike(
        moment.id,
        moment.likes,
        moment.liked_by_me,
    );

    const html = useMemo(
        () => (moment.content ? blocknoteToHtml(moment.content) : ''),
        [moment.content],
    );

    return (
        <>
            <Head title="说说">
                {buildSeoMeta({ site: seo, title: '说说' })}
            </Head>

            <div className="mx-auto max-w-2xl px-5 py-10 md:px-8 md:py-14">
                {/* 返回说说流 */}
                <Link
                    href="/moments"
                    className="apple-press text-footnote mb-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    返回说说
                </Link>

                <article className="apple-card p-5 sm:p-6">
                    {/* 作者 + 时间 */}
                    <div className="flex items-center gap-3">
                        {moment.author_avatar ? (
                            <img
                                src={moment.author_avatar}
                                alt={moment.author_name}
                                className="h-11 w-11 rounded-full object-cover ring-2 ring-primary/10"
                            />
                        ) : (
                            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                {(moment.author_name || 'A')
                                    .charAt(0)
                                    .toUpperCase()}
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
                    </div>

                    {/* 内容 */}
                    {html !== '' && (
                        <div
                            className="moment-content prose-sm mt-4 leading-relaxed [&_img]:max-h-96 [&_img]:rounded-xl [&_img]:object-cover"
                            dangerouslySetInnerHTML={{ __html: html }}
                        />
                    )}

                    {/* 点赞 */}
                    <div className="mt-5 flex justify-center border-t border-border/40 pt-5">
                        <button
                            type="button"
                            onClick={toggleLike}
                            disabled={sending}
                            className={`apple-press inline-flex items-center gap-2 rounded-full border px-6 py-2.5 text-sm font-medium transition-all disabled:opacity-60 ${
                                liked
                                    ? 'border-rose-200 bg-rose-500/10 text-rose-500 dark:border-rose-500/30'
                                    : 'border-border text-muted-foreground hover:border-rose-200 hover:text-rose-500'
                            }`}
                        >
                            <Heart
                                className={`h-4.5 w-4.5 ${liked ? 'fill-rose-500 text-rose-500' : ''}`}
                            />
                            {liked ? '已赞' : '点赞'}
                            <span className="tabular-nums">{likes}</span>
                        </button>
                    </div>
                </article>

                {/* 评论区（与文章共用） */}
                <div className="mt-6">
                    <CommentSection
                        articleId={moment.id}
                        comments={comments}
                        captcha={captcha}
                        smileyGroups={smileyGroups}
                        commentStatus={moment.comment_status}
                    />
                </div>

                {/* 上一篇 / 下一篇说说 */}
                {(prevMoment || nextMoment) && (
                    <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {prevMoment ? (
                            <Link
                                href={`/moments/${prevMoment.id}`}
                                className="apple-card apple-press group flex items-center gap-3 p-4"
                            >
                                <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
                                <span className="text-footnote text-muted-foreground">
                                    上一条
                                </span>
                            </Link>
                        ) : (
                            <span />
                        )}
                        {nextMoment ? (
                            <Link
                                href={`/moments/${nextMoment.id}`}
                                className="apple-card apple-press group flex items-center justify-end gap-3 p-4"
                            >
                                <span className="text-footnote text-muted-foreground">
                                    下一条
                                </span>
                                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                            </Link>
                        ) : (
                            <span />
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
