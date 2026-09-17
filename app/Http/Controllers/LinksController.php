<?php

namespace App\Http\Controllers;

use App\Models\Link;
use App\Services\AttachmentService;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * 友情链接：前台「友链」页与后台「友链设置」维护。
 *
 * 图片统一走系统用途附件（parent_type=link_image，parent_id=link_id）：
 * 更换图片先删旧图再存新图，删除友链时一并清理其图片，避免残留文件。
 */
class LinksController extends Controller
{
    public function __construct(
        protected AttachmentService $attachments,
    ) {}

    /**
     * 前台友链页：仅展示 link_visible=Y 的友链，按评分从高到低排序。
     */
    public function index(): Response
    {
        $links = Link::where('link_visible', 'Y')
            ->orderByDesc('link_rating')
            ->orderBy('link_id')
            ->get()
            ->map(fn (Link $link) => $this->formatLink($link))
            ->values();

        return Inertia::render('Links/Index', [
            'links' => $links,
        ]);
    }

    /**
     * 后台友链管理页：全部友链（含隐藏），按评分降序。
     */
    public function edit(): Response
    {
        $links = Link::orderByDesc('link_rating')
            ->orderBy('link_id')
            ->get()
            ->map(fn (Link $link) => $this->formatLink($link))
            ->values();

        return Inertia::render('settings/links', [
            'links' => $links,
        ]);
    }

    /**
     * 新建友链。
     */
    public function store(Request $request)
    {
        $validated = $this->validateLink($request);

        Link::create([
            ...$validated,
            'link_rating' => (int) Link::max('link_rating') + 1,
        ]);

        return back()->with('toast', ['type' => 'success', 'message' => '友链已添加。']);
    }

    /**
     * 更新友链。
     */
    public function update(Request $request, Link $link)
    {
        $link->update($this->validateLink($request, $link));

        return back()->with('toast', ['type' => 'success', 'message' => '友链已更新。']);
    }

    /**
     * 删除友链（同时从文件库移除其未使用的图片）。
     */
    public function destroy(Link $link)
    {
        $this->attachments->deleteByParent('link_image', (int) $link->link_id);
        $link->delete();

        return back()->with('toast', ['type' => 'success', 'message' => '友链及其图片已删除。']);
    }

    /**
     * 批量排序：按前端提交的 link_id 顺序重写 link_rating（越大越靠前）。
     */
    public function reorder(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'integer'],
        ], [
            'ids.required' => '请提供排序后的 id 列表。',
        ]);

        DB::transaction(function () use ($validated) {
            $max = (int) Link::max('link_rating');

            foreach (array_values($validated['ids']) as $index => $id) {
                Link::where('link_id', $id)->update(['link_rating' => $max + 1 - $index]);
            }
        });

        return back()->with('toast', ['type' => 'success', 'message' => '排序已保存。']);
    }

    /**
     * 上传友链图片：更换时先删除旧图，避免文件库残留。
     */
    public function uploadImage(Request $request, Link $link): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'max:5120', 'mimes:jpg,jpeg,png,gif,webp'],
        ], [
            'file.required' => '请选择一个图片文件。',
            'file.max' => '图片不能超过 5 MB。',
            'file.mimes' => '仅支持 jpg/jpeg/png/gif/webp 格式。',
        ]);

        $meta = $this->attachments->validateUploadedFile($validated['file']);

        // 更换图片：先从文件库删除旧图
        $attachment = $this->attachments->replaceSystemImage('link_image', (int) $link->link_id, $validated['file'], $meta);

        $link->update(['link_image' => (string) $attachment->id]);

        /** @var FilesystemAdapter $publicDisk */
        $publicDisk = Storage::disk('public');

        return response()->json([
            'id' => $attachment->id,
            'url' => $publicDisk->url($attachment->file_path),
        ]);
    }

    /**
     * 移除友链图片（删除文件库旧图，回到无图状态）。
     */
    public function removeImage(Link $link): JsonResponse
    {
        $deleted = $this->attachments->deleteByParent('link_image', (int) $link->link_id);
        $link->update(['link_image' => '']);

        return response()->json(['removed' => true, 'deleted' => $deleted]);
    }

    /**
     * 友链表单校验规则。
     *
     * @return array<string, mixed>
     */
    protected function validateLink(Request $request, ?Link $link = null): array
    {
        $validated = $request->validate([
            'link_url' => ['required', 'string', 'max:255'],
            'link_name' => ['required', 'string', 'max:255'],
            'link_target' => ['nullable', 'string', 'max:25'],
            'link_description' => ['nullable', 'string', 'max:255'],
            'link_visible' => ['required', 'in:Y,N'],
            'link_rating' => ['nullable', 'integer', 'min:0'],
        ], [
            'link_url.required' => '请输入跳转地址。',
            'link_name.required' => '请输入链接名称。',
            'link_visible.required' => '请选择是否显示。',
        ]);

        $url = trim($validated['link_url']);

        if (! preg_match('#^https?://#i', $url)) {
            $validated['link_url'] = 'https://'.$url;
        }

        $validated['link_target'] = ($validated['link_target'] ?? '') === '_blank' ? '_blank' : '';
        $validated['link_description'] = trim($validated['link_description'] ?? '');

        return $validated;
    }

    /**
     * 格式化友链数据。
     *
     * @return array<string, mixed>
     */
    protected function formatLink(Link $link): array
    {
        return [
            'id' => $link->link_id,
            'link_url' => $link->link_url,
            'link_name' => $link->link_name,
            'link_image' => $this->attachments->systemImageUrl('link_image', (int) $link->link_id),
            'link_target' => $link->link_target,
            'link_description' => $link->link_description,
            'link_visible' => $link->link_visible,
            'link_rating' => $link->link_rating,
        ];
    }
}
