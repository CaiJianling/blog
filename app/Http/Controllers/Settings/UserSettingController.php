<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * 用户偏好设置（前台悬浮设置面板）：界面语言、界面特效开关与页面滤镜（饱和度/亮度）。
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
            'filter_saturation' => ['sometimes', 'required', 'integer', 'min:0', 'max:200'],
            'filter_brightness' => ['sometimes', 'required', 'integer', 'min:20', 'max:100'],
        ]);

        $user = auth()->user();

        if (array_key_exists('locale', $validated)) {
            $user->locale = $validated['locale'];
        }

        if (array_key_exists('effects_enabled', $validated)) {
            $user->effects_enabled = $validated['effects_enabled'];
        }

        if (array_key_exists('filter_saturation', $validated)) {
            $user->filter_saturation = $validated['filter_saturation'];
        }

        if (array_key_exists('filter_brightness', $validated)) {
            $user->filter_brightness = $validated['filter_brightness'];
        }

        $user->save();

        return response()->json($this->payload($user->fresh()));
    }

    /**
     * @return array{locale: string, effectsEnabled: bool, filterSaturation: int, filterBrightness: int}
     */
    protected function payload(User $user): array
    {
        return [
            'locale' => in_array($user->locale, ['zh', 'en'], true) ? $user->locale : 'zh',
            'effectsEnabled' => (bool) $user->effects_enabled,
            'filterSaturation' => clamp((int) $user->filter_saturation, 0, 200),
            'filterBrightness' => clamp((int) $user->filter_brightness, 20, 100),
        ];
    }
}
