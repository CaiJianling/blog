import { Head, usePage } from '@inertiajs/react';
import { Clock, Eye, MessageSquare } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { BlockNoteDocument } from '@/components/blocknote-editor';
import CommentSection from '@/components/comments/comment-section';
import type {
    Captcha,
    CommentItem,
    SmileyGroupData,
} from '@/components/comments/comment-section';
import { blocknoteToHtml } from '@/lib/blocknote-to-html';
import { buildSeoMeta } from '@/lib/seo';

type PageData = {
    id: number;
    title: string;
    slug: string;
    content: BlockNoteDocument;
    meta_title: string;
    meta_description: string;
    author_name: string;
    views: number;
    likes: number;
    comment_count: number;
    comment_status: string;
    created_at: string;
    permalink: string;
};

type Props = {
    page: PageData;
    comments: CommentItem[];
    captcha: Captcha;
    smileyGroups: SmileyGroupData[];
};

export default function PageShow({ page, comments, captcha, smileyGroups }: Props) {
    const { t } = useTranslation();
    const seo = usePage().props.seo;

    const pageTitle = page.meta_title?.trim() || page.title;
    const pageDescription = page.meta_description?.trim() || '';

    const contentHtml = useMemo(
        () =>
            page.content && page.content.length > 0
                ? blocknoteToHtml(page.content)
                : '',
        [page.content],
    );

    return (
        <>
            <Head title={pageTitle}>
                {buildSeoMeta({
                    site: seo,
                    title: pageTitle,
                    description: pageDescription,
                    type: 'article',
                })}
            </Head>

            <div className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
                <header>
                    <h1 className="text-display">{page.title}</h1>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-footnote text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {page.created_at}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <Eye className="h-3.5 w-3.5" />
                            {t('publicComment.views', { count: page.views })}
                        </span>
                        <a
                            href="#comments"
                            className="inline-flex items-center gap-1.5 hover:text-foreground"
                        >
                            <MessageSquare className="h-3.5 w-3.5" />
                            {t('publicComment.commentsCount', { count: page.comment_count })}
                        </a>
                    </div>
                </header>

                <div className="apple-card mt-6 px-6 py-8 md:px-10 md:py-10">
                    {contentHtml ? (
                        <div
                            className="article-content"
                            dangerouslySetInnerHTML={{ __html: contentHtml }}
                        />
                    ) : (
                        <p className="text-muted-foreground">
                            {t('articlePage.noContent')}
                        </p>
                    )}
                </div>

                {/* 评论区：objectType=page，提交到页面评论 */}
                <div className="mt-12">
                    <CommentSection
                        articleId={page.id}
                        objectType="page"
                        comments={comments}
                        captcha={captcha}
                        smileyGroups={smileyGroups}
                        commentStatus={page.comment_status}
                    />
                </div>
            </div>
        </>
    );
}
