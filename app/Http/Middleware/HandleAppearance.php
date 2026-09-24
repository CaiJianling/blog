<?php

namespace App\Http\Middleware;

use App\Models\Attachment;
use App\Models\Option;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\View;
use Symfony\Component\HttpFoundation\Response;

class HandleAppearance
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        View::share('appearance', $request->cookie('appearance') ?? 'system');
        View::share('theme_color', (string) Option::get('theme_color', ''));
        View::share('site_icon', $this->siteIcon());

        return $next($request);
    }

    /**
     * 后台「站点设置 → 站点图标」上传的图标，供 app.blade.php 输出 favicon。
     *
     * URL 带上附件自身的更新时间做缓存版本：浏览器对 favicon 的缓存很顽固，
     * 不换 URL 的话换图标要等硬刷新才生效。
     *
     * @return array{url: string}|null
     */
    protected function siteIcon(): ?array
    {
        $attachment = Attachment::find((int) Option::get('site_icon', ''));

        if ($attachment === null || ! $attachment->isImage()) {
            return null;
        }

        $url = Storage::disk('public')->url($attachment->file_path);
        $version = $attachment->updated_at?->timestamp ?? 0;

        return ['url' => $url.'?v='.$version];
    }
}
