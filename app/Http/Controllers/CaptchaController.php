<?php

namespace App\Http\Controllers;

use App\Services\CaptchaService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * 图形验证码图片接口：输出 PNG 并写入会话答案。
 * - GET /captcha           登录用（按 login_captcha_type 渲染字符/算式图；math 或未开启时 404）
 * - GET /comment-captcha   评论用（按 comment_captcha_type 渲染；math 时 404）
 * - GET /register-captcha  注册用（按 register_captcha_type 渲染；math 或未开启时 404）
 */
class CaptchaController extends Controller
{
    /**
     * 登录验证码图片（PNG）。
     */
    public function show(Request $request, CaptchaService $captcha): Response
    {
        $type = $captcha->loginType();

        if (! $captcha->isEnabled() || $type === CaptchaService::TYPE_MATH) {
            abort(404);
        }

        return $this->imageResponse(
            $captcha->generateImage(CaptchaService::SCOPE_LOGIN, $type),
        );
    }

    /**
     * 评论验证码图片（PNG）。
     */
    public function commentShow(Request $request, CaptchaService $captcha): Response
    {
        $type = $captcha->commentType();

        if ($type === CaptchaService::TYPE_MATH) {
            abort(404);
        }

        return $this->imageResponse(
            $captcha->generateImage(CaptchaService::SCOPE_COMMENT, $type),
        );
    }

    /**
     * 注册验证码图片（PNG；未开启或简单计算方式时 404）。
     */
    public function registerShow(Request $request, CaptchaService $captcha): Response
    {
        $type = $captcha->registerType();

        if (! $captcha->registerEnabled() || $type === CaptchaService::TYPE_MATH) {
            abort(404);
        }

        return $this->imageResponse(
            $captcha->generateImage(CaptchaService::SCOPE_REGISTER, $type),
        );
    }

    /**
     * 统一的 PNG 响应（禁缓存）。
     */
    protected function imageResponse(string $bytes): Response
    {
        return response($bytes, 200, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma' => 'no-cache',
        ]);
    }
}
