<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * 用户偏好设置（前台悬浮设置面板）：界面语言与界面特效开关。
 *
 * 前台游客使用浏览器 localStorage 持久化；登录用户的设置同步到本表，
 * 登录后由前端自动拉取本接口覆盖本地值。
 */
class UserSettingController extends Controller
{
    /**
     * 当前登录用户的偏好设置。
     */
    public function show(): JsonResponse
    {
        return response()->json($this->payload(auth()->user()));
    }

    /**
     * 更新当前登录用户的偏好设置（支持部分字段）。
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'locale' => ['sometimes', 'required', Rule::in(['zh', 'en'])],
            'effects_enabled' => ['sometimes', 'required', 'boolean'],
        ]);

        $user = auth()->user();

        if (array_key_exists('locale', $validated)) {
            $user->locale = $validated['locale'];
        }

        if (array_key_exists('effects_enabled', $validated)) {
            $user->effects_enabled = $validated['effects_enabled'];
        }

        $user->save();

        return response()->json($this->payload($user->fresh()));
    }

    /**
     * @return array{locale: string, effectsEnabled: bool}
     */
    protected function payload(User $user): array
    {
        return [
            'locale' => in_array($user->locale, ['zh', 'en'], true) ? $user->locale : 'zh',
            'effectsEnabled' => (bool) $user->effects_enabled,
        ];
    }
}
