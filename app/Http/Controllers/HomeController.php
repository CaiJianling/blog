<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Services\PermalinkService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class HomeController extends Controller
{
    public function __construct(
        protected PermalinkService $permalinks,
    ) {}

    public function index(Request $request)
    {
        // 朴素结构：/?p=ID 直接跳转到规范固定链接
        if ($request->filled('p')) {
            $article = Article::where('status', 'publish')->find((int) $request->query('p'));

            if ($article) {
                return redirect()->to($this->permalinks->articlePath($article), 301);
            }
        }

        $latestArticles = Article::where('status', 'publish')
            ->with('author')
            ->orderBy('created_at', 'desc')
            ->take(6)
            ->get()
            ->map(function ($article) {
                return $this->formatArticle($article);
            });

        $tools = config('tools');
        $featuredTools = collect($tools)->flatten(1)->take(6)->values();

        $navigation = config('navigation');

        return Inertia::render('Home', [
            'latestArticles' => $latestArticles,
            'featuredTools' => $featuredTools,
            'navigationCategories' => $navigation,
        ]);
    }

    /**
     * 格式化文章数据供前端展示。
     *
     * @return array<string, mixed>
     */
    private function formatArticle(Article $article): array
    {
        return [
            'id' => $article->id,
            'title' => $article->title,
            'slug' => $article->slug,
            'permalink' => $this->permalinks->articlePath($article),
            'excerpt' => $article->excerpt,
            'author_name' => $article->author?->nickname ?: ($article->author?->name ?? ''),
            'author_avatar' => $article->author?->avatar ?? '',
            'views' => $article->views,
            'comment_count' => $article->comment_count,
            'created_at' => $article->created_at->format('Y-m-d'),
        ];
    }
}
