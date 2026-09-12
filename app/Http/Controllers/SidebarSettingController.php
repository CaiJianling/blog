<?php

namespace App\Http\Controllers;

use App\Models\Attachment;
use App\Models\Option;
use App\Services\AttachmentService;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * 博客侧边栏设置：博主信息（名称/头像/简介）与自定义菜单。
 */
class SidebarSettingController extends Controller
{
    public function __construct(
        protected AttachmentService $attachments,
    ) {}

    /**
     * 侧边栏设置页面。
     */
    public function edit(): Response
    {
        return Inertia::render('settings/sidebar', [
            'sidebar_blogger_name' => (string) Option::get('sidebar_blogger_name', ''),
            'sidebar_blogger_intro' => (string) Option::get('sidebar_blogger_intro', ''),
            'sidebar_blogger_avatar' => $this->avatar(),
            'sidebar_menus' => $this->menus(),
        ]);
    }

    /**
     * 保存侧边栏设置。
     */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'sidebar_blogger_name' => ['nullable', 'string', 'max:50'],
            'sidebar_blogger_intro' => ['nullable', 'string', 'max:500'],
            'menus' => ['nullable', 'array', 'max:20'],
            'menus.*.name' => ['required', 'string', 'max:20'],
            'menus.*.url' => ['required', 'string', 'max:500'],
        ], [
            'sidebar_blogger_name.max' => '博主名称不能超过 50 个字符。',
            'sidebar_blogger_intro.max' => '简介不能超过 500 个字符。',
            'menus.max' => '菜单最多 20 项。',
            'menus.*.name.required' => '菜单名称不能为空。',
            'menus.*.name.max' => '菜单名称不能超过 20 个字符。',
            'menus.*.url.required' => '菜单链接不能为空。',
            'menus.*.url.max' => '菜单链接不能超过 500 个字符。',
        ]);

        Option::set('sidebar_blogger_name', trim($validated['sidebar_blogger_name'] ?? ''));
        Option::set('sidebar_blogger_intro', trim($validated['sidebar_blogger_intro'] ?? ''));

        $menus = array_map(
            fn ($menu) => ['name' => trim($menu['name']), 'url' => trim($menu['url'])],
            $validated['menus'] ?? [],
        );

        Option::set('sidebar_menus', json_encode(array_values($menus), JSON_UNESCAPED_UNICODE));

        return to_route('sidebar.edit')->with('toast', ['type' => 'success', 'message' => '侧边栏设置已保存。']);
    }

    /**
     * 上传博主头像。
     */
    public function uploadAvatar(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => [
                'required',
                'file',
                'max:5120',
                'mimes:jpg,jpeg,png,gif,webp',
            ],
        ], [
            'file.required' => '请选择一个图片文件。',
            'file.max' => '头像不能超过 5 MB。',
            'file.mimes' => '仅支持 jpg/jpeg/png/gif/webp 格式。',
        ]);

        $meta = $this->attachments->validateUploadedFile($validated['file']);

        // 更换头像：先从文件库删除旧图
        $attachment = $this->attachments->replaceSystemImage('sidebar_avatar', null, $validated['file'], $meta);

        Option::set('sidebar_blogger_avatar', (string) $attachment->id);

        /** @var FilesystemAdapter $publicDisk */
        $publicDisk = Storage::disk('public');

        return response()->json([
            'id' => $attachment->id,
            'url' => $publicDisk->url($attachment->file_path),
        ]);
    }

    /**
     * 移除博主头像。
     */
    public function removeAvatar()
    {
        // 恢复默认头像：从文件库删除自定义头像
        $this->attachments->deleteByParent('sidebar_avatar', null);
        Option::set('sidebar_blogger_avatar', '');

        return to_route('sidebar.edit')->with('toast', ['type' => 'success', 'message' => '已恢复默认头像。']);
    }

    /**
     * 解析博主头像信息。
     */
    protected function avatar(): ?array
    {
        $avatarId = (int) Option::get('sidebar_blogger_avatar', '');

        if ($avatarId <= 0) {
            return null;
        }

        $attachment = Attachment::find($avatarId);

        if (! $attachment || ! $attachment->isImage()) {
            return null;
        }

        /** @var FilesystemAdapter $publicDisk */
        $publicDisk = Storage::disk('public');

        return [
            'id' => $attachment->id,
            'url' => $publicDisk->url($attachment->file_path),
        ];
    }

    /**
     * 解析自定义菜单列表。
     *
     * @return array<int, array{name: string, url: string}>
     */
    public static function menus(): array
    {
        $decoded = json_decode((string) Option::get('sidebar_menus', ''), true);

        if (! is_array($decoded)) {
            return [];
        }

        return array_values(array_filter(
            $decoded,
            fn ($item) => is_array($item) && isset($item['name'], $item['url']) && $item['name'] !== '' && $item['url'] !== '',
        ));
    }
}
