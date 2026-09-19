<?php

namespace App\Http\Controllers;

use App\Services\CaptchaService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * 图形验证码图片接口：输出 PNG 并写入会话答案。
 * 未开启登录验证码时返回 404，减少无用攻击面。
 */
class CaptchaController extends Controller
{
    /**
     * 输出验证码图片（PNG）。
     */
    public function show(Request $request, CaptchaService $captcha): Response
    {
        if (! $captcha->isEnabled()) {
            abort(404);
        }

        $bytes = $captcha->generate();

        return response($bytes, 200, [
            'Content-Type' => 'image/png',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma' => 'no-cache',
        ]);
    }
}
