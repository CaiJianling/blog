<?php

namespace App\Http\Middleware;

use App\Services\CaptchaService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

/**
 * 登录图形验证码校验：拦截 POST /login，在 Fortify 处理凭据前验证验证码。
 * 本中间件挂在 Fortify 全部路由上（config/fortify.php middleware），
 * 非登录 POST 请求一律直接放行。
 *
 * 无论对错都会消费会话中的验证码：错误后必须重新获取，防止重放。
 */
class VerifyLoginCaptcha
{
    public function __construct(protected CaptchaService $captcha) {}

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->is('login') || ! $request->isMethod('POST')) {
            return $next($request);
        }

        if (! $this->captcha->isEnabled()) {
            return $next($request);
        }

        // 按验证码方式校验：math 用加密 token（一次性消费），image / image_math 用会话图形答案
        $verified = $this->captcha->loginType() === CaptchaService::TYPE_MATH
            ? $this->captcha->verifyMath(
                $request->input('captcha_token'),
                $request->input('captcha_answer'),
                consume: true,
            )
            : $this->captcha->verifyImage(CaptchaService::SCOPE_LOGIN, $request->input('captcha'));

        if (! $verified) {
            throw ValidationException::withMessages([
                'captcha' => '验证码不正确或已过期，请重新输入。',
            ]);
        }

        return $next($request);
    }
}
