<?php

namespace App\Http\Controllers;

use App\Models\NavCategory;
use App\Models\NavLink;
use App\Services\AttachmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * 导航页后台管理：分类（大类）、链接与图文介绍的维护。
 */
class NavigationSettingController extends Controller
{
    public function __construct(
        protected AttachmentService $attachments,
    ) {}

    /**
     * 导航管理页面。
     */
    public function edit(): Response
    {
        $categories = NavCategory::orderBy('sort_order')
            ->with('links')
            ->get()
            ->map(fn (NavCategory $category) => $this->formatCategory($category))
            ->values();

        return Inertia::render('settings/navigation', [
            'categories' => $categories,
        ]);
    }

    /**
     * 新建分类。
     */
    public function storeCategory(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ], [
            'name.required' => '请输入分类名称。',
            'name.max' => '分类名称不能超过 100 个字符。',
        ]);

        NavCategory::create([
            'name' => trim($validated['name']),
            'sort_order' => (int) NavCategory::max('sort_order') + 1,
        ]);

        return back()->with('toast', ['type' => 'success', 'message' => '分类已创建。']);
    }

    /**
     * 更新分类。
     */
    public function updateCategory(Request $request, NavCategory $category)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ], [
            'name.required' => '请输入分类名称。',
            'name.max' => '分类名称不能超过 100 个字符。',
        ]);

        $category->update([
            'name' => trim($validated['name']),
        ]);

        return back()->with('toast', ['type' => 'success', 'message' => '分类已更新。']);
    }

    /**
     * 删除分类（同时删除其下所有链接）。
     */
    public function destroyCategory(NavCategory $category)
    {
        $category->links()->delete();
        $category->delete();

        return back()->with('toast', ['type' => 'success', 'message' => '分类及其链接已删除。']);
    }

    /**
     * 新建链接。
     */
    public function storeLink(Request $request)
    {
        $validated = $this->validateLink($request);

        NavLink::create([
            'nav_category_id' => (int) $validated['nav_category_id'],
            'name' => trim($validated['name']),
            'url' => trim($validated['url']),
            'color' => $validated['color'] ?? '',
            'description' => $validated['description'] ?? null,
            'sort_order' => (int) NavLink::where('nav_category_id', (int) $validated['nav_category_id'])->max('sort_order') + 1,
        ]);

        return back()->with('toast', ['type' => 'success', 'message' => '链接已添加。']);
    }

    /**
     * 更新链接（不影响图文介绍）。
     */
    public function updateLink(Request $request, NavLink $link)
    {
        $validated = $this->validateLink($request, $link);

        $link->update([
            'nav_category_id' => (int) $validated['nav_category_id'],
            'name' => trim($validated['name']),
            'url' => trim($validated['url']),
            'color' => $validated['color'] ?? '',
            'description' => $validated['description'] ?? null,
        ]);

        return back()->with('toast', ['type' => 'success', 'message' => '链接已更新。']);
    }

    /**
     * 删除链接。
     */
    public function destroyLink(NavLink $link)
    {
        $link->delete();

        return back()->with('toast', ['type' => 'success', 'message' => '链接已删除。']);
    }

    /**
     * 批量排序：按前端提交的 id 顺序重写 sort_order。
     */
    public function reorder(Request $request)
    {
        $validated = $request->validate([
            'type' => ['required', 'in:category,link'],
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'integer'],
        ], [
            'type.required' => '参数缺失。',
            'ids.required' => '请提供排序后的 id 列表。',
        ]);

        DB::transaction(function () use ($validated) {
            foreach ($validated['ids'] as $index => $id) {
                if ($validated['type'] === 'category') {
                    NavCategory::where('id', $id)->update(['sort_order' => $index]);
                } else {
                    NavLink::where('id', $id)->update(['sort_order' => $index]);
                }
            }
        });

        return back()->with('toast', ['type' => 'success', 'message' => '排序已保存。']);
    }

    /**
     * 链接图文介绍编辑页（类文章编辑器）。
     */
    public function editIntro(NavLink $link): Response
    {
        return Inertia::render('settings/navigation-intro', [
            'link' => $this->formatLink($link, true),
        ]);
    }

    /**
     * 保存图文介绍（BlockNote JSON 块数组）。
     */
    public function updateIntro(Request $request, NavLink $link)
    {
        $validated = $request->validate([
            'intro_content' => ['nullable', 'array'],
        ]);

        $content = $validated['intro_content'] ?? null;

        // 空内容统一存为 null，前台据此隐藏"查看介绍"入口
        if (is_array($content) && $content === []) {
            $content = null;
        }

        $link->update([
            'intro_content' => $content,
        ]);

        return back()->with('toast', ['type' => 'success', 'message' => '介绍已保存。']);
    }

    /**
     * 上传导航链接图标。
     */
    public function uploadLinkIcon(Request $request, NavLink $link): JsonResponse
    {
        $validated = $request->validate([
            'file' => [
                'required',
                'file',
                'max:2048',
                'mimes:jpg,jpeg,png,gif,webp',
            ],
        ], [
            'file.required' => '请选择一个图片文件。',
            'file.max' => '图标不能超过 2 MB。',
            'file.mimes' => '仅支持 jpg/jpeg/png/gif/webp 格式。',
        ]);

        $meta = $this->attachments->validateUploadedFile($validated['file']);

        // 更换图标：先从文件库删除旧图
        $attachment = $this->attachments->replaceSystemImage('nav_link_icon', $link->id, $validated['file'], $meta);

        /** @var FilesystemAdapter $publicDisk */
        $publicDisk = Storage::disk('public');

        return response()->json([
            'id' => $attachment->id,
            'url' => $publicDisk->url($attachment->file_path),
        ]);
    }

    /**
     * 恢复默认图标（从文件库删除自定义图标，回到颜色+首字样式）。
     */
    public function resetLinkIcon(NavLink $link): JsonResponse
    {
        $deleted = $this->attachments->deleteByParent('nav_link_icon', $link->id);

        return response()->json(['reset' => true, 'deleted' => $deleted]);
    }

    /**
     * 链接表单校验规则。
     *
     * @return array<string, mixed>
     */
    protected function validateLink(Request $request, ?NavLink $link = null): array
    {
        return $request->validate([
            'nav_category_id' => ['required', 'integer', 'exists:nav_categories,id'],
            'name' => ['required', 'string', 'max:100'],
            'url' => ['required', 'string', 'max:500'],
            'color' => ['nullable', 'string', 'max:20'],
            'description' => ['nullable', 'string', 'max:500'],
        ], [
            'nav_category_id.required' => '请选择所属分类。',
            'nav_category_id.exists' => '所属分类不存在。',
            'name.required' => '请输入链接名称。',
            'name.max' => '链接名称不能超过 100 个字符。',
            'url.required' => '请输入链接地址。',
            'url.max' => '链接地址不能超过 500 个字符。',
        ]);
    }

    /**
     * 格式化分类数据（含链接列表）。
     *
     * @return array<string, mixed>
     */
    protected function formatCategory(NavCategory $category): array
    {
        return [
            'id' => $category->id,
            'name' => $category->name,
            'sort_order' => $category->sort_order,
            'links' => $category->links
                ->map(fn (NavLink $link) => $this->formatLink($link))
                ->values(),
        ];
    }

    /**
     * 格式化链接数据。
     *
     * @param  bool  $withIntro  是否附带完整的图文介绍内容
     * @return array<string, mixed>
     */
    protected function formatLink(NavLink $link, bool $withIntro = false): array
    {
        $data = [
            'id' => $link->id,
            'nav_category_id' => $link->nav_category_id,
            'name' => $link->name,
            'url' => $link->url,
            'color' => $link->color,
            'description' => $link->description,
            'has_intro' => $link->intro_content !== null,
            'icon_url' => $this->attachments->systemImageUrl('nav_link_icon', $link->id),
            'clicks' => (int) $link->clicks,
        ];

        if ($withIntro) {
            $data['intro_content'] = $link->intro_content;
        }

        return $data;
    }
}
