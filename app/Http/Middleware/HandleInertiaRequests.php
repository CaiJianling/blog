<?php

/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-08-06 18:51:21
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-09-09 20:28:10
 * @FilePath: /blog/app/Http/Middleware/HandleInertiaRequests.php
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

namespace App\Http\Middleware;

use App\Http\Controllers\FooterSettingController;
use App\Models\Attachment;
use App\Models\Option;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Middleware;
use Laravel\Fortify\Features;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
            ],
            'canRegister' => Features::enabled(Features::registration()),
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'assistant' => $this->assistantProps(),
            'seo' => $this->seoProps(),
            'footer' => [
                'resources' => FooterSettingController::resources(),
                'contacts' => FooterSettingController::contacts(),
                'icp_markdown' => FooterSettingController::icpMarkdown(),
            ],
        ];
    }

    /**
     * AI 小助手前台配置（仅在启用时携带名称、头像与欢迎语）。
     *
     * @return array<string, mixed>
     */
    protected function assistantProps(): array
    {
        if (Option::get('assistant_enabled') !== '1') {
            return ['enabled' => false];
        }

        $avatarId = (int) Option::get('assistant_avatar', '');
        $avatarUrl = null;

        if ($avatarId > 0) {
            $attachment = Attachment::find($avatarId);

            if ($attachment && $attachment->isImage()) {
                /** @var FilesystemAdapter $publicDisk */
                $publicDisk = Storage::disk('public');
                $avatarUrl = $publicDisk->url($attachment->file_path);
            }
        }

        return [
            'enabled' => true,
            'name' => (string) Option::get('assistant_name', 'AI 小助手'),
            'avatarUrl' => $avatarUrl,
            'welcome' => (string) Option::get('assistant_welcome', ''),
        ];
    }

    /**
     * 站点级 SEO 配置，供前台各页输出 meta / OpenGraph / Twitter 标签。
     *
     * @return array<string, string>
     */
    protected function seoProps(): array
    {
        return [
            'title' => (string) Option::get('site_title', config('app.name')),
            'description' => (string) Option::get('seo_description', ''),
            'keywords' => (string) Option::get('seo_keywords', ''),
        ];
    }
}
