<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Models\PageView;
use App\Models\Tool;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class StatsController extends Controller
{
    /**
     * 站点统计面板：访问趋势、流量来源、用户画像与访问途径。
     */
    public function index(Request $request): Response
    {
        $range = (int) $request->query('range', 30);
        $range = in_array($range, [7, 30, 90], true) ? $range : 30;

        $since = Carbon::today()->subDays($range - 1);
        $query = fn () => PageView::where('viewed_at', '>=', $since);

        $overview = $this->overview($query, $since);
        $series = $this->dailySeries($query, $since, $range);
        $topPages = $this->topPages($query);
        $sources = $this->sources($query);
        $profiles = $this->profiles($query);
        $paths = $this->accessPaths($query);
        $landings = $this->landingPages($query);

        $isEmpty = $overview['pv'] === 0;

        return Inertia::render('Stats/Index', [
            'range' => $range,
            'isEmpty' => $isEmpty,
            'overview' => $overview,
            'series' => $series,
            'topPages' => $topPages,
            'sources' => $sources,
            'profiles' => $profiles,
            'paths' => $paths,
            'landings' => $landings,
        ]);
    }

    /**
     * 概览卡片：PV、UV、新访客、回访访客。
     *
     * @return array<string, int>
     */
    private function overview(callable $query, Carbon $since): array
    {
        $pv = $query()->count();
        $uv = $query()->distinct('visitor_id')->count();

        $firstSeen = PageView::query()
            ->selectRaw('visitor_id, min(viewed_at) as first_seen')
            ->groupBy('visitor_id')
            ->get()
            ->mapWithKeys(fn ($row) => [$row->visitor_id => $row->first_seen]);

        $newVisitors = $query()
            ->distinct('visitor_id')
            ->pluck('visitor_id')
            ->filter(fn (string $id) => isset($firstSeen[$id]) && $firstSeen[$id] >= $since)
            ->count();

        return [
            'pv' => $pv,
            'uv' => $uv,
            'newVisitors' => $newVisitors,
            'returningVisitors' => max(0, $uv - $newVisitors),
        ];
    }

    /**
     * 按天 PV/UV 序列，缺失天补零。
     *
     * @return array<int, array{day: string, pv: int, uv: int}>
     */
    private function dailySeries(callable $query, Carbon $since, int $range): array
    {
        $rows = $query()
            ->selectRaw('date(viewed_at) as day, count(*) as pv, count(distinct visitor_id) as uv')
            ->groupBy('date(viewed_at)')
            ->get()
            ->mapWithKeys(fn ($row) => [$row->day => $row]);

        $series = [];
        for ($i = 0; $i < $range; $i++) {
            $day = $since->copy()->addDays($i)->format('Y-m-d');
            $row = $rows->get($day);

            $series[] = [
                'day' => $day,
                'pv' => $row ? (int) $row->pv : 0,
                'uv' => $row ? (int) $row->uv : 0,
            ];
        }

        return $series;
    }

    /**
     * Top 访问路径，article/tool 解析标题。
     *
     * @return array<int, array{path: string, title: string|null, page_type: string, views: int}>
     */
    private function topPages(callable $query): array
    {
        $rows = $query()
            ->selectRaw('path, page_type, object_id, count(*) as views')
            ->groupBy('path', 'page_type', 'object_id')
            ->orderByDesc('views')
            ->take(10)
            ->get();

        $articleIds = $rows->where('page_type', 'article')->pluck('object_id')->filter()->values();
        $toolIds = $rows->where('page_type', 'tool')->pluck('object_id')->filter()->values();

        $articleTitles = Article::whereIn('id', $articleIds)->pluck('title', 'id');
        $toolNames = Tool::whereIn('id', $toolIds)->pluck('name', 'id');

        return $rows->map(function ($row) use ($articleTitles, $toolNames) {
            $title = match ($row->page_type) {
                'article' => $articleTitles->get($row->object_id),
                'tool' => $toolNames->get($row->object_id),
                default => null,
            };

            return [
                'path' => $row->path,
                'title' => $title,
                'page_type' => $row->page_type,
                'views' => (int) $row->views,
            ];
        })->values()->all();
    }

    /**
     * 流量来源分布 + 外部 Top 参考来源。
     *
     * @return array{byClass: array<int, array{name: string, views: int, percent: float}>, referrers: array<int, array{host: string, path: string, views: int}>}
     */
    private function sources(callable $query): array
    {
        $total = $query()->count();

        $byClass = $query()
            ->selectRaw('referrer_class, count(*) as views')
            ->groupBy('referrer_class')
            ->orderByDesc('views')
            ->get()
            ->map(function ($row) use ($total) {
                return [
                    'name' => $row->referrer_class,
                    'views' => (int) $row->views,
                    'percent' => $total > 0 ? round($row->views / $total * 100, 1) : 0.0,
                ];
            })->all();

        $referrers = $query()
            ->where('referrer_class', PageView::SOURCE_EXTERNAL)
            ->whereNotNull('referrer')
            ->selectRaw('referrer, count(*) as views')
            ->groupBy('referrer')
            ->orderByDesc('views')
            ->take(8)
            ->get()
            ->map(fn ($row) => $this->referrerBreakdown($row->referrer, (int) $row->views))
            ->all();

        return ['byClass' => $byClass, 'referrers' => $referrers];
    }

    /**
     * 用户画像：浏览器 / 操作系统 / 设备分布。
     *
     * @return array{browsers: array, os: array, devices: array}
     */
    private function profiles(callable $query): array
    {
        return [
            'browsers' => $this->topByColumn($query, 'browser', 6),
            'os' => $this->topByColumn($query, 'os', 6),
            'devices' => $this->topByColumn($query, 'device', 5),
        ];
    }

    /**
     * 站内访问途径：referrer→path 跳转对。
     *
     * @return array<int, array{from: string, to: string, views: int}>
     */
    private function accessPaths(callable $query): array
    {
        return $query()
            ->where('referrer_class', PageView::SOURCE_INTERNAL)
            ->whereNotNull('referrer')
            ->selectRaw('referrer, path, count(*) as views')
            ->groupBy('referrer', 'path')
            ->orderByDesc('views')
            ->take(12)
            ->get()
            ->map(function ($row) {
                return [
                    'from' => $this->uriToPath((string) $row->referrer),
                    'to' => (string) $row->path,
                    'views' => (int) $row->views,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * 直接访问（无来源）的落地页分布。
     *
     * @return array<int, array{path: string, views: int}>
     */
    private function landingPages(callable $query): array
    {
        return $query()
            ->where('referrer_class', PageView::SOURCE_DIRECT)
            ->selectRaw('path, count(*) as views')
            ->groupBy('path')
            ->orderByDesc('views')
            ->take(5)
            ->get()
            ->map(fn ($row) => ['path' => (string) $row->path, 'views' => (int) $row->views])
            ->values()
            ->all();
    }

    /**
     * 某列的 Top N 计数分布。
     *
     * @return array<int, array{name: string, views: int}>
     */
    private function topByColumn(callable $query, string $column, int $limit): array
    {
        return $query()
            ->whereNotNull($column)
            ->selectRaw($column.' as name, count(*) as views')
            ->groupBy($column)
            ->orderByDesc('views')
            ->take($limit)
            ->get()
            ->map(fn ($row) => ['name' => (string) $row->name, 'views' => (int) $row->views])
            ->values()
            ->all();
    }

    /**
     * 参考来源 URL 拆解为主机 + 路径。
     *
     * @return array{host: string, path: string, views: int}
     */
    private function referrerBreakdown(string $referrer, int $views): array
    {
        $host = (string) (parse_url($referrer, PHP_URL_HOST) ?? '');

        return [
            'host' => $host,
            'path' => (string) (parse_url($referrer, PHP_URL_PATH) ?? ''),
            'views' => $views,
        ];
    }

    /**
     * 完整 URL 归一化为站点内路径（同域直接取 path）。
     */
    private function uriToPath(string $uri): string
    {
        if (str_starts_with($uri, 'http://') || str_starts_with($uri, 'https://')) {
            return (string) (parse_url($uri, PHP_URL_PATH) ?? $uri);
        }

        return $uri;
    }
}
