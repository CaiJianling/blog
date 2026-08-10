<?php

/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-08-10 09:21:42
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-08-10 09:31:55
 * @FilePath: /blog/app/Http/Middleware/SetLocale.php
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetLocale
{
    /**
     * Supported application locales.
     *
     * @var array<int, string>
     */
    protected array $supportedLocales = ['zh', 'en'];

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $locale = $this->resolveLocale($request);

        if (in_array($locale, $this->supportedLocales, true)) {
            app()->setLocale($locale);
        }

        return $next($request);
    }

    /**
     * Resolve the locale from the request, preferring the authenticated user's
     * stored preference and falling back to the locale cookie.
     */
    protected function resolveLocale(Request $request): ?string
    {
        $user = $request->user();

        if ($user && isset($user->locale) && in_array($user->locale, $this->supportedLocales, true)) {
            return $user->locale;
        }

        $cookieLocale = $request->cookie('locale');

        if (is_string($cookieLocale) && in_array($cookieLocale, $this->supportedLocales, true)) {
            return $cookieLocale;
        }

        return null;
    }
}
