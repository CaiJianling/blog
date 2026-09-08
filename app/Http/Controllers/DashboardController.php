<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Models\Comment;
use App\Models\Page;
use App\Models\User;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Show the dashboard with aggregated real data.
     */
    public function index(): Response
    {
        $now = Carbon::now();
        $monthStart = $now->copy()->startOfMonth();
        $lastMonthStart = $now->copy()->subMonthNoOverflow()->startOfMonth();

        // ---- 统计卡片 ----
        $articleCount = Article::where('status', '!=', 'trash')->count();
        $pageCount = Page::where('status', '!=', 'trash')->count();
        $commentCount = Comment::where('status', '!=', 'trash')->count();
        $pendingCommentCount = Comment::where('status', '0')->count();
        $userCount = User::count();

        $totalViews = (int) Article::where('status', '!=', 'trash')->sum('views')
            + (int) Page::where('status', '!=', 'trash')->sum('views');

        $articlesThisMonth = Article::where('created_at', '>=', $monthStart)->count();
        $articlesLastMonth = Article::whereBetween('created_at', [$lastMonthStart, $monthStart])->count();
        $usersThisMonth = User::where('created_at', '>=', $monthStart)->count();

        $stats = [
            [
                'key' => 'articles',
                'value' => $articleCount,
                'delta' => $this->monthDelta($articlesThisMonth, $articlesLastMonth),
                'meta' => ['thisMonth' => $articlesThisMonth],
            ],
            [
                'key' => 'views',
                'value' => $totalViews,
                'delta' => null,
                'meta' => ['articles' => $articleCount, 'pages' => $pageCount],
            ],
            [
                'key' => 'comments',
                'value' => $commentCount,
                'delta' => null,
                'meta' => ['pending' => $pendingCommentCount],
            ],
            [
                'key' => 'users',
                'value' => $userCount,
                'delta' => null,
                'meta' => ['thisMonth' => $usersThisMonth],
            ],
        ];

        // ---- 最近动态（文章 / 评论 / 用户合并时间线）----
        $recentArticles = Article::where('status', '!=', 'trash')
            ->latest('updated_at')
            ->take(6)
            ->get(['id', 'title', 'updated_at', 'created_at'])
            ->map(function (Article $article) {
                $isCreate = $article->created_at->diffInMinutes($article->updated_at) < 1;

                return [
                    'type' => 'article',
                    'action' => $isCreate ? 'created' : 'updated',
                    'title' => $article->title,
                    'sort_time' => $article->updated_at->toIso8601String(),
                    'time_human' => $article->updated_at->diffForHumans(),
                ];
            });

        $recentComments = Comment::where('status', '!=', 'trash')
            ->latest('created_at')
            ->take(6)
            ->get(['comment_id', 'author_name', 'content', 'object_type', 'object_id', 'created_at']);

        // 批量取关联内容标题，避免 N+1
        $articleIds = $recentComments->where('object_type', 'article')->pluck('object_id')->unique();
        $pageIds = $recentComments->where('object_type', 'page')->pluck('object_id')->unique();
        $articleTitles = Article::whereIn('id', $articleIds)->pluck('title', 'id');
        $pageTitles = Page::whereIn('id', $pageIds)->pluck('title', 'id');

        $recentComments = $recentComments->map(function (Comment $comment) use ($articleTitles, $pageTitles) {
            $relatedTitle = $comment->object_type === 'page'
                ? $pageTitles->get($comment->object_id)
                : $articleTitles->get($comment->object_id);

            $content = (string) $comment->content;
            $snippet = mb_strlen($content) > 30 ? mb_substr($content, 0, 30).'…' : $content;

            return [
                'type' => 'comment',
                'author' => $comment->author_name ?: null,
                'related' => $relatedTitle,
                'snippet' => $snippet,
                'sort_time' => $comment->created_at->toIso8601String(),
                'time_human' => $comment->created_at->diffForHumans(),
            ];
        });

        $recentUsers = User::latest('created_at')
            ->take(5)
            ->get(['id', 'name', 'nickname', 'created_at'])
            ->map(function (User $user) {
                return [
                    'type' => 'user',
                    'name' => $user->nickname ?: $user->name,
                    'sort_time' => $user->created_at->toIso8601String(),
                    'time_human' => $user->created_at->diffForHumans(),
                ];
            });

        $activities = $recentArticles
            ->concat($recentComments)
            ->concat($recentUsers)
            ->sortByDesc('sort_time')
            ->take(8)
            ->values();

        return Inertia::render('dashboard', [
            'stats' => $stats,
            'activities' => $activities,
        ]);
    }

    /**
     * 环比上月增长率（百分比整数）；上月为 0 时返回 null。
     */
    private function monthDelta(int $thisMonth, int $lastMonth): ?int
    {
        if ($lastMonth <= 0) {
            return null;
        }

        return (int) round(($thisMonth - $lastMonth) / $lastMonth * 100);
    }
}
