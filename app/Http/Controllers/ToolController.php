<?php

namespace App\Http\Controllers;

use App\Models\Tool;
use App\Models\ToolCategory;
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
