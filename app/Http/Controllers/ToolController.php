<?php

namespace App\Http\Controllers;

use App\Models\Tool;
use App\Models\ToolCategory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * 公开的工具页：分组与工具由后台「工具设置」维护。
 */
class ToolController extends Controller
{
    public function index(): Response
    {
        $categories = ToolCategory::orderBy('sort_order')
            ->with('tools')
            ->get();

        $toolCategories = $categories
            ->map(fn (ToolCategory $category) => [
                'id' => $category->id,
                'name' => $category->name,
                'tools' => $category->tools
                    ->map(fn (Tool $tool) => [
                        'id' => $tool->id,
                        'slug' => $tool->slug,
                        'name' => $tool->name,
                        'url' => $tool->url,
                        'description' => $tool->description,
                        'icon' => $tool->icon,
                        'clicks' => (int) $tool->clicks,
                    ])
                    ->values(),
            ])
            ->values();

        return Inertia::render('Tools/Index', [
            'toolCategories' => $toolCategories,
            'meta' => $this->indexMeta($categories),
        ]);
    }

    /**
     * 工具列表页的 SEO 文案：分类名与工具名全部取自后台「工具设置」，
     * 后台改动后前台 meta 自动跟着变，不需要再维护一份。
     *
     * @param  Collection<int, ToolCategory>  $categories
     * @return array{title: string, description: string, keywords: string}
     */
    private function indexMeta(Collection $categories): array
    {
        $toolNames = $categories->flatMap(
            fn (ToolCategory $category) => $category->tools->pluck('name'),
        );
        $total = $toolNames->count();

        if ($total === 0) {
            return [
                'title' => '在线工具',
                'description' => '免安装、即开即用的在线开发工具合集。',
                'keywords' => '',
            ];
        }

        $categoryNames = $categories->pluck('name')->filter()->take(6)->implode('、');

        return [
            'title' => '在线工具',
            'description' => Str::limit("共 {$total} 个免安装、即开即用的在线工具，覆盖 {$categoryNames} 等分类。", 150, '…'),
            'keywords' => $toolNames->filter()->take(12)->implode('，'),
        ];
    }

    /**
     * 服务端哈希计算：浏览器非安全上下文（HTTP）下 WebCrypto 不可用时的兜底。
     */
    public function hash(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'text' => ['required', 'string', 'max:10000'],
            'algorithm' => ['required', 'in:md5,sha1,sha256,sha384,sha512'],
        ], [
            'text.required' => '请输入要哈希的文本。',
            'algorithm.in' => '不支持的算法。',
        ]);

        return response()->json([
            'hash' => hash($validated['algorithm'], $validated['text']),
        ]);
    }

    public function show(string $slug): Response
    {
        $tool = Tool::where('slug', $slug)->first();

        // 外链工具没有内部详情页
        abort_if(! $tool || $tool->isExternal(), 404);

        // 打开工具详情计一次点击
        $tool->increment('clicks');

        /** @var ToolCategory $category */
        $category = $tool->category;

        return Inertia::render('Tools/Show', [
            'tool' => [
                'id' => $tool->id,
                'slug' => $tool->slug,
                'name' => $tool->name,
                'description' => $tool->description,
                'icon' => $tool->icon,
                'clicks' => (int) $tool->clicks,
            ],
            'category' => $category->name,
            'meta' => $this->showMeta($tool, $category),
        ]);
    }

    /**
     * 工具详情页的 SEO 文案：标题与描述直接用后台「工具设置」里该工具的名称和描述，
     * 描述为空时由前端回退到站点级 SEO 描述。
     *
     * @return array{title: string, description: string, keywords: string}
     */
    private function showMeta(Tool $tool, ToolCategory $category): array
    {
        return [
            'title' => $tool->name.' - 在线工具',
            'description' => (string) $tool->description,
            'keywords' => implode('，', array_filter([
                $tool->name,
                $category->name,
            ])),
        ];
    }

    /**
     * 外链工具跳转：计数一次后重定向到工具地址。
     */
    public function go(string $slug)
    {
        $tool = Tool::where('slug', $slug)->first();

        abort_if(! $tool || ! $tool->isExternal(), 404);

        $tool->increment('clicks');

        return redirect()->away($tool->url);
    }
}
