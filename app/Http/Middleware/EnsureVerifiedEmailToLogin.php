<?php

namespace App\Http\Middleware;

use App\Models\Option;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

/**
 * 强制邮箱验证登录：当后台「注册需验证邮箱」开启时，
 * 未验证邮箱的账号无法通过登录接口登录，须先完成邮箱验证。
 * 仅在开关开启且存在对应账号时拦截，其余请求直接放行。
 */
class EnsureVerifiedEmailToLogin
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->is('login') || ! $request->isMethod('POST')) {
            return $next($request);
        }

        if (Option::get('require_email_verification', '0') !== '1') {
            return $next($request);
        }

        $user = User::where('email', (string) $request->input('email'))->first();

        if ($user !== null && $user->email_verified_at === null) {
            throw ValidationException::withMessages([
                'email' => '该邮箱尚未完成验证，请先验证邮箱后再登录。',
            ]);
        }

        return $next($request);
    }
}
