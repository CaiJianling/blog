<?php

namespace App\Http\Middleware;

use App\Services\CaptchaService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

/**
 * 注册验证码校验：拦截 POST /register，在 Fortify 建用户前验证验证码。
 * 仅当「注册验证码」开启时生效；无论对错都会消费会话中的图形验证码，防重放。
 */
class VerifyRegisterCaptcha
{
    public function __construct(protected CaptchaService $captcha) {}

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->is('register') || ! $request->isMethod('POST')) {
            return $next($request);
        }

        if (! $this->captcha->registerEnabled()) {
            return $next($request);
        }

        // 按验证码方式校验：math 用加密 token（一次性消费），image / image_math 用会话图形答案
        $verified = $this->captcha->registerType() === CaptchaService::TYPE_MATH
            ? $this->captcha->verifyMath(
                $request->input('captcha_token'),
                $request->input('captcha_answer'),
                consume: true,
            )
            : $this->captcha->verifyImage(CaptchaService::SCOPE_REGISTER, $request->input('captcha'));

        if (! $verified) {
            throw ValidationException::withMessages([
                'captcha' => '验证码不正确或已过期，请重新输入。',
            ]);
        }

        return $next($request);
    }
}
