<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Models\Option;
use App\Services\PermalinkService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\Response;

/**
 * 博客 RSS 订阅：输出最新已发布文章（/feed）。
 */
class FeedController extends Controller
{
    private const FEED_LIMIT = 20;

    public function __construct(
        protected PermalinkService $permalinks,
    ) {}

    /**
     * RSS 2.0 订阅源。
     */
    public function index(Request $request): Response
    {
        $articles = Article::where('status', 'publish')
            ->ofType(Article::TYPE_POST)
            ->with('author')
            ->orderByDesc('created_at')
            ->take(self::FEED_LIMIT)
            ->get(['id', 'title', 'slug', 'excerpt', 'content', 'author_id', 'created_at', 'updated_at']);

        $items = $articles->map(function (Article $article) {
            $excerpt = trim((string) $article->excerpt);

            if ($excerpt === '') {
                $excerpt = mb_substr(trim((string) Article::extractPlainText($article->content)), 0, 300);
            }

            return [
                'title' => $article->title,
                'url' => url($this->permalinks->articlePath($article)),
                'guid' => 'article-'.$article->id,
                'author' => $article->author?->nickname ?: ($article->author?->name ?? ''),
                'summary' => $excerpt,
                'pubDate' => $article->created_at->toRfc2822String(),
            ];
        })->all();

        $xml = view('feed', [
            'siteTitle' => (string) Option::get('site_title', config('app.name')),
            'siteDescription' => (string) Option::get('seo_description', ''),
            'siteUrl' => url('/'),
            'feedUrl' => url('/feed'),
            'updated' => ($articles->first()?->updated_at ?? Carbon::now())->toRfc2822String(),
            'items' => $items,
        ])->render();

        return response($xml, 200, [
            'Content-Type' => 'application/rss+xml; charset=UTF-8',
        ]);
    }
}
