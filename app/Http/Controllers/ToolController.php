<?php

namespace App\Http\Controllers;

use App\Models\Tool;
use App\Models\ToolCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * 公开的工具页：分组与工具由后台「工具设置」维护。
 */
class ToolController extends Controller
{
    public function index(): Response
    {
        $toolCategories = ToolCategory::orderBy('sort_order')
            ->with('tools')
            ->get()
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
                    ])
                    ->values(),
            ])
            ->values();

        return Inertia::render('Tools/Index', [
            'toolCategories' => $toolCategories,
        ]);
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

        return Inertia::render('Tools/Show', [
            'tool' => [
                'id' => $tool->id,
                'slug' => $tool->slug,
                'name' => $tool->name,
                'description' => $tool->description,
                'icon' => $tool->icon,
            ],
            'category' => $tool->category->name,
        ]);
    }
}
