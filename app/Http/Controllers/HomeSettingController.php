<?php

namespace App\Http\Controllers;

use App\Models\Option;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * 首页文案设置：Hero 区与各栏目的标题/描述均可后台维护。
 * 留空的字段回退为默认文案。
 */
class HomeSettingController extends Controller
{
    /**
     * 文案键与默认值。
     */
    public const DEFAULTS = [
        'home_badge' => '博客 · 工具 · 导航 一站式',
        'home_title' => '探索、创造与分享',
        'home_title_accent' => '技术的无限可能',
        'home_description' => '这里是我的个人空间 —— 记录技术教程与经验分享，提供实用的在线开发工具，以及精心整理的优质网站导航。',
        'home_latest_title' => '最新文章',
        'home_latest_desc' => '技术教程与经验分享',
        'home_tools_title' => '精选工具',
        'home_tools_desc' => '常用的在线开发工具',
        'home_nav_title' => '网站导航',
        'home_nav_desc' => '精选优质网站集合',
    ];

    /**
     * 前台显示设置页面（首页文案 + 侧边栏 + 页脚）。
     */
    public function edit(): Response
    {
        return Inertia::render('settings/home', [
            'texts' => self::texts(),
            'sidebar' => SidebarSettingController::props(),
            'footer' => [
                'resources' => FooterSettingController::resources(),
                'contacts' => FooterSettingController::contacts(),
            ],
        ]);
    }

    /**
     * 保存首页文案。留空的字段回退为默认值。
     */
    public function update(Request $request)
    {
        $rules = [];
        $messages = [];

        foreach (array_keys(self::DEFAULTS) as $key) {
            $rules[$key] = ['nullable', 'string', 'max:300'];
        }

        $rules['home_badge'][] = 'max:60';

        $validated = $request->validate($rules, [
            'home_badge.max' => '徽章文案不能超过 60 个字符。',
            '*.max' => '文案不能超过 300 个字符。',
        ]);

        foreach (array_keys(self::DEFAULTS) as $key) {
            Option::set($key, trim($validated[$key] ?? ''));
        }

        return to_route('home.edit')->with('toast', ['type' => 'success', 'message' => '首页文案已保存。']);
    }

    /**
     * 供首页使用：读取全部文案（空值回退默认）。
     *
     * @return array<string, string>
     */
    public static function texts(): array
    {
        $texts = [];

        foreach (self::DEFAULTS as $key => $default) {
            $value = trim((string) Option::get($key, ''));

            $texts[$key] = $value !== '' ? $value : $default;
        }

        return $texts;
    }
}
