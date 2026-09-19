<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Models\Option;
use App\Services\PermalinkService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * 前台归档时间轴：按年份分组展示文章（可选包含说说）。
 */
class ArchiveController extends Controller
{
    public function __construct(
        protected PermalinkService $permalinks,
    ) {}

    /**
     * 归档时间轴页。
     */
    public function index(Request $request): Response
    {
        $includeMoments = Option::get('timeline_include_moments', '0') === '1';

        $entries = collect();

        $articles = Article::where('status', 'publish')
            ->ofType(Article::TYPE_POST)
            ->orderByDesc('created_at')
            ->get(['id', 'title', 'slug', 'created_at']);

        foreach ($articles as $article) {
            $entries->push([
                'type' => 'article',
                'title' => $article->title,
                'url' => $this->permalinks->articlePath($article),
                'date' => $article->created_at->format('m-d'),
                'timestamp' => $article->created_at->timestamp,
                'reading_time' => $article->estimatedReadingMinutes(),
            ]);
        }

        if ($includeMoments) {
            $moments = Article::where('status', 'publish')
                ->ofType(Article::TYPE_MOMENT)
                ->orderByDesc('created_at')
                ->get(['id', 'content', 'created_at']);

            foreach ($moments as $moment) {
                $snippet = mb_substr(trim((string) Article::extractPlainText($moment->content)), 0, 60);

                $entries->push([
                    'type' => 'moment',
                    'title' => $snippet !== '' ? $snippet : '说说',
                    'url' => '/moments/'.$moment->id,
                    'date' => $moment->created_at->format('m-d'),
                    'timestamp' => $moment->created_at->timestamp,
                    'reading_time' => $moment->estimatedReadingMinutes(),
                ]);
            }
        }

        $entries = $entries->sortByDesc('timestamp')->values();

        $years = $entries
            ->groupBy(fn ($entry) => date('Y', (int) $entry['timestamp']))
            ->map(fn ($items, $year) => [
                // PHP 数组会把数字字符串键转 int，这里显式转回字符串
                'year' => (string) $year,
                'count' => $items->count(),
                'items' => $items->values()->all(),
            ])
            ->values()
            ->all();

        return Inertia::render('Archive/Index', [
            'years' => $years,
            'total' => $entries->count(),
        ]);
    }
}
