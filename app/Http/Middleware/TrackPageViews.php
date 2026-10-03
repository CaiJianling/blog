<?php

namespace App\Http\Middleware;

use App\Models\PageView;
use App\Models\Tool;
use App\Services\PermalinkService;
use App\Services\UserAgentInspector;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * 前台页面访问跟踪：记录页面浏览日志（PV/UV、来源、设备画像），
 * 供后台「站点统计」使用。IP 只存 SHA256 哈希，访客指纹只存 cookie 的哈希。
 */
class TrackPageViews
{
    public const VISITOR_COOKIE = 'blog_visitor';

    private const VISITOR_COOKIE_DAYS = 365;

    private const DEDUPE_SECONDS = 60;

    private const BOT_PATTERN = '/bot|crawler|spider|slurp|headless|lighthouse|phantomjs|preview|pingback/i';

    public function __construct(
        protected UserAgentInspector $userAgentInspector,
        protected PermalinkService $permalinks,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        try {
            $this->track($request);
        } catch (\Throwable $e) {
            // 跟踪失败不影响前台页面
            Log::warning('Page view tracking failed', ['error' => $e->getMessage()]);
        }

        return $response;
    }

    /**
     * 判断是否记录本次访问；满足条件写入一条 page_views。
     */
    protected function track(Request $request): void
    {
        if ($request->method() !== 'GET') {
            return;
        }

        $userAgent = $request->userAgent() ?: '';

        if (preg_match(self::BOT_PATTERN, $userAgent) === 1) {
            return;
        }

        $visitor = $this->ensureVisitorCookie($request);

        if ($this->isDuplicateVisit($visitor['id'], $request->getRequestUri())) {
            return;
        }

        $referrer = $request->header('referer') ? (string) $request->header('referer') : null;
        $refHost = $this->hostOf((string) $referrer);

        $inspected = $this->userAgentInspector->inspect($userAgent);

        PageView::create([
            'visitor_id' => $visitor['id'],
            'user_id' => $request->user()?->id,
            'page_type' => $this->pageType($request),
            'object_id' => $this->objectId($request),
            'path' => $request->getRequestUri(),
            'referrer' => mb_strlen((string) $referrer) > 490 ? mb_substr((string) $referrer, 0, 490) : $referrer,
            'referrer_class' => $this->classifyReferrer($referrer, (string) $request->getHost(), $refHost),
            'browser' => $inspected['browser'],
            'os' => $inspected['os'],
            'device' => $inspected['device'],
            'ip_hash' => hash('sha256', $request->ip().'|'.config('app.key')),
            'viewed_at' => Carbon::now(),
        ]);

        Cache::put($this->dedupeKey($visitor['id'], $request->getRequestUri()), true, self::DEDUPE_SECONDS);
    }

    /**
     * 获取（必要时签发）访客指纹 cookie，返回其 SHA256 摘要。
     * 新签发的 cookie 经 Cookie::queue 合并进响应（web 组 QueueCookies 中间件），
     * 再由 EncryptCookies 加密，数据库中只存摘要。
     *
     * @return array{id: string}
     */
    protected function ensureVisitorCookie(Request $request): array
    {
        $raw = $request->cookie(self::VISITOR_COOKIE);

        if (is_string($raw) && preg_match('/^[0-9a-f]{32}$/', $raw) === 1) {
            return ['id' => hash('sha256', $raw)];
        }

        $raw = bin2hex(random_bytes(16));

        Cookie::queue(
            self::VISITOR_COOKIE,
            $raw,
            self::VISITOR_COOKIE_DAYS * 24 * 60,
            '/',
            null,
            false,
            true,
            false,
            'Lax',
        );

        return ['id' => hash('sha256', $raw)];
    }

    /**
     * 同一访客短时间内重复访问同一路径只记一条，避免刷新灌水。
     */
    protected function isDuplicateVisit(string $visitorId, string $uri): bool
    {
        return Cache::get($this->dedupeKey($visitorId, $uri)) === true;
    }

    /**
     * 根据路由名归类页面类型。
     */
    protected function pageType(Request $request): string
    {
        $routeName = $request->route()?->getName() ?? '';

        return match (true) {
            $routeName === 'home' => 'home',
            $routeName === 'blog.index' => 'blog_list',
            in_array($routeName, ['blog.show', 'blog.permalink'], true) => 'article',
            in_array($routeName, ['tools.index', 'tools.show'], true) => 'tool',
            $routeName === 'nav.index' => 'nav',
            $routeName === 'nav.show' => 'nav_link',
            $routeName === 'links.index' => 'link',
            default => 'other',
        };
    }

    /**
     * 解析被访问对象的 ID（文章/工具/导航链接），解析失败返回 null。
     */
    protected function objectId(Request $request): ?int
    {
        try {
            $routeName = $request->route()?->getName() ?? '';

            return match (true) {
                // blog.show 的路由模型绑定后，article 参数已是 Article 实例
                $routeName === 'blog.show' => $request->route('article')?->id,
                // permalink 为原始路径字符串，需解析
                $routeName === 'blog.permalink' => $this->permalinks->resolve((string) $request->route('permalink'))?->id,
                // tools.show 未绑定模型，slug 为字符串，需查库
                $routeName === 'tools.show' => (int) Tool::where('slug', $request->route('slug'))->value('id') || null,
                // nav.show 绑定后 link 参数已是 NavLink 实例
                $routeName === 'nav.show' => $request->route('link')?->id,
                default => null,
            };
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * 来源分类：无来源=direct，同域=internal，搜索引擎/社交平台/其他外部。
     */
    protected function classifyReferrer(?string $referrer, string $currentHost, string $refHost): string
    {
        if ($referrer === null || $refHost === '') {
            return PageView::SOURCE_DIRECT;
        }

        if ($refHost === $currentHost) {
            return PageView::SOURCE_INTERNAL;
        }

        if ($this->endsWithAny($refHost, [
            'baidu.com', 'baidu.cn', 'google.com', 'google.cn', 'bing.com',
            'sogou.com', 'so.com', '360.cn', 'duckduckgo.com', 'yandex.com', 'yandex.ru',
        ])) {
            return PageView::SOURCE_SEARCH;
        }

        if ($this->endsWithAny($refHost, [
            'weibo.com', 'weibo.cn', 'zhihu.com', 'douyin.com', 'pinduoduo.com',
            'taobao.com', 'alipay.com', 'twitter.com', 'facebook.com',
            'linkedin.com', 'reddit.com', 'tiktok.com', 'qq.com',
        ]) || $refHost === 'x.com') {
            return PageView::SOURCE_SOCIAL;
        }

        return PageView::SOURCE_EXTERNAL;
    }

    /**
     * @param  array<int, string>  $suffixes
     */
    private function endsWithAny(string $host, array $suffixes): bool
    {
        foreach ($suffixes as $suffix) {
            if ($host === $suffix || str_ends_with($host, '.'.$suffix)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 从 URL 中取小写 host，解析失败返回空串。
     */
    private function hostOf(string $url): string
    {
        if ($url === '') {
            return '';
        }

        $host = parse_url($url, PHP_URL_HOST);

        return is_string($host) ? strtolower($host) : '';
    }

    private function dedupeKey(string $visitorId, string $uri): string
    {
        return 'pageview_dedupe:'.md5($visitorId.'|'.$uri);
    }
}
