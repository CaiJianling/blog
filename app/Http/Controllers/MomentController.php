<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Models\ArticleLike;
use App\Services\CommentService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * 前台说说：时间流列表 + 单条详情（含评论）。
 * 说说与文章共用 articles 表（post_type=moment），无标题。
 */
class MomentController extends Controller
{
    public function __construct(
        protected CommentService $commentService,
    ) {}

    /**
     * 说说时间流。
     */
    public function index(Request $request): Response
    {
        $moments = Article::where('status', 'publish')
            ->ofType(Article::TYPE_MOMENT)
            ->with('author')
            ->orderBy('created_at', 'desc')
            ->paginate(10)
            ->through(fn (Article $moment) => $this->formatMoment($moment, $request->user()));

        return Inertia::render('Moment/Index', [
            'moments' => $moments,
        ]);
    }

    /**
     * 单条说说详情（内容 + 点赞 + 评论）。
     */
    public function show(Article $moment, Request $request): Response
    {
        abort_unless($moment->isMoment() && $moment->status === 'publish', 404);

        $moment->increment('views');
        $moment->refresh();

        $user = $request->user();
        $commentTree = $this->commentService->threadTree('article', $moment->id, $user, $moment);
        $extras = $this->commentService->discussionExtras($user);

        // 上一篇 / 下一篇说说
        $previous = Article::where('status', 'publish')
            ->ofType(Article::TYPE_MOMENT)
            ->where('id', '<', $moment->id)
            ->orderBy('id', 'desc')
            ->first(['id']);
        $next = Article::where('status', 'publish')
            ->ofType(Article::TYPE_MOMENT)
            ->where('id', '>', $moment->id)
            ->orderBy('id')
            ->first(['id']);

        return Inertia::render('Moment/Show', [
            'moment' => array_merge($this->formatMoment($moment, $user), [
                'content' => $moment->content,
                'comment_status' => $moment->comment_status,
                'liked_by_me' => $user
                    ? ArticleLike::where('article_id', $moment->id)->where('user_id', $user->id)->exists()
                    : null,
            ]),
            'comments' => $commentTree,
            'captcha' => $extras['captcha'],
            'smileyGroups' => $extras['smileyGroups'],
            'prevMoment' => $previous ? ['id' => $previous->id] : null,
            'nextMoment' => $next ? ['id' => $next->id] : null,
        ]);
    }

    /**
     * 说说卡片数据。
     *
     * @return array<string, mixed>
     */
    private function formatMoment(Article $moment, ?object $user): array
    {
        return [
            'id' => $moment->id,
            'content' => $moment->content,
            'author_name' => $moment->author?->nickname ?: ($moment->author?->name ?? ''),
            'author_avatar' => $moment->author?->avatarUrl() ?? '',
            'views' => $moment->views,
            'likes' => $moment->likes,
            'comment_count' => $moment->comment_count,
            'reading_time' => $moment->estimatedReadingMinutes(),
            'liked_by_me' => $user
                ? ArticleLike::where('article_id', $moment->id)->where('user_id', $user->id)->exists()
                : null,
            'created_at' => $moment->created_at->format('Y-m-d H:i'),
            'permalink' => '/moments/'.$moment->id,
        ];
    }
}
