<?php

namespace App\Http\Controllers;

use App\Models\Tool;
use App\Models\ToolCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * 工具页后台管理：分组、工具（含排序与自定义链接地址）的维护。
 */
class ToolSettingController extends Controller
{
    /**
     * 工具管理页面。
     */
    public function edit(): Response
    {
        $categories = ToolCategory::orderBy('sort_order')
            ->with('tools')
            ->get()
            ->map(fn (ToolCategory $category) => $this->formatCategory($category))
            ->values();

        return Inertia::render('settings/tools', [
            'categories' => $categories,
        ]);
    }

    /**
     * 新建分组。
     */
    public function storeCategory(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ], [
            'name.required' => '请输入分组名称。',
            'name.max' => '分组名称不能超过 100 个字符。',
        ]);

        ToolCategory::create([
            'name' => trim($validated['name']),
            'sort_order' => (int) ToolCategory::max('sort_order') + 1,
        ]);

        return back()->with('toast', ['type' => 'success', 'message' => '分组已创建。']);
    }

    /**
     * 更新分组。
     */
    public function updateCategory(Request $request, ToolCategory $category)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ], [
            'name.required' => '请输入分组名称。',
            'name.max' => '分组名称不能超过 100 个字符。',
        ]);

        $category->update([
            'name' => trim($validated['name']),
        ]);

        return back()->with('toast', ['type' => 'success', 'message' => '分组已更新。']);
    }

    /**
     * 删除分组（同时删除其下工具）。
     */
    public function destroyCategory(ToolCategory $category)
    {
        $category->tools()->delete();
        $category->delete();

        return back()->with('toast', ['type' => 'success', 'message' => '分组及其工具已删除。']);
    }

    /**
     * 新建工具。
     */
    public function storeTool(Request $request)
    {
        $validated = $this->validateTool($request);

        Tool::create([
            'tool_category_id' => (int) $validated['tool_category_id'],
            'slug' => $this->resolveSlug($validated),
            'name' => trim($validated['name']),
            'url' => $validated['url'] ?? null,
            'description' => $validated['description'] ?? null,
            'icon' => $validated['icon'] ?? 'Wrench',
            'sort_order' => (int) Tool::where('tool_category_id', (int) $validated['tool_category_id'])->max('sort_order') + 1,
        ]);

        return back()->with('toast', ['type' => 'success', 'message' => '工具已添加。']);
    }

    /**
     * 更新工具。
     */
    public function updateTool(Request $request, Tool $tool)
    {
        $validated = $this->validateTool($request, $tool);

        $tool->update([
            'tool_category_id' => (int) $validated['tool_category_id'],
            'slug' => $this->resolveSlug($validated, $tool),
            'name' => trim($validated['name']),
            'url' => $validated['url'] ?? null,
            'description' => $validated['description'] ?? null,
            'icon' => $validated['icon'] ?? 'Wrench',
        ]);

        return back()->with('toast', ['type' => 'success', 'message' => '工具已更新。']);
    }

    /**
     * 删除工具。
     */
    public function destroyTool(Tool $tool)
    {
        $tool->delete();

        return back()->with('toast', ['type' => 'success', 'message' => '工具已删除。']);
    }

    /**
     * 批量排序：按前端提交的 id 顺序重写 sort_order。
     */
    public function reorder(Request $request)
    {
        $validated = $request->validate([
            'type' => ['required', 'in:category,tool'],
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['required', 'integer'],
        ], [
            'type.required' => '参数缺失。',
            'ids.required' => '请提供排序后的 id 列表。',
        ]);

        DB::transaction(function () use ($validated) {
            foreach ($validated['ids'] as $index => $id) {
                if ($validated['type'] === 'category') {
                    ToolCategory::where('id', $id)->update(['sort_order' => $index]);
                } else {
                    Tool::where('id', $id)->update(['sort_order' => $index]);
                }
            }
        });

        return back()->with('toast', ['type' => 'success', 'message' => '排序已保存。']);
    }

    /**
     * 工具表单校验规则。
     *
     * @return array<string, mixed>
     */
    protected function validateTool(Request $request, ?Tool $tool = null): array
    {
        return $request->validate([
            'tool_category_id' => ['required', 'integer', 'exists:tool_categories,id'],
            'name' => ['required', 'string', 'max:100'],
            'url' => ['nullable', 'string', 'max:500'],
            'slug' => [
                'nullable',
                'string',
                'max:191',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                'unique:tools,slug'.($tool ? ','.$tool->id : ''),
            ],
            'description' => ['nullable', 'string', 'max:500'],
            'icon' => ['nullable', 'string', 'max:50'],
        ], [
            'tool_category_id.required' => '请选择所属分组。',
            'tool_category_id.exists' => '所属分组不存在。',
            'name.required' => '请输入工具名称。',
            'name.max' => '工具名称不能超过 100 个字符。',
            'url.max' => '链接地址不能超过 500 个字符。',
            'slug.regex' => '工具标识只能包含小写字母、数字和连字符（如 json-formatter）。',
            'slug.unique' => '该工具标识已被使用。',
        ]);
    }

    /**
     * 解析工具标识：外链工具可为空；无外链时若留空则按名称自动生成并保证唯一。
     *
     * @param  array<string, mixed>  $validated
     */
    protected function resolveSlug(array $validated, ?Tool $tool = null): ?string
    {
        $slug = isset($validated['slug']) ? trim((string) $validated['slug']) : '';

        if ($slug !== '') {
            return $slug;
        }

        // 外链工具不需要 slug
        if (trim((string) ($validated['url'] ?? '')) !== '') {
            return null;
        }

        $base = Str::slug(trim((string) $validated['name']));

        // 纯中文名等无法生成 ASCII slug 时，退化为随机标识
        if ($base === '') {
            $base = 'tool-'.Str::lower(Str::random(6));
        }

        $slug = $base;
        $suffix = 2;

        while (Tool::where('slug', $slug)->when($tool, fn ($query) => $query->where('id', '!=', $tool->id))->exists()) {
            $slug = $base.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    /**
     * 格式化分组数据（含工具列表）。
     *
     * @return array<string, mixed>
     */
    protected function formatCategory(ToolCategory $category): array
    {
        return [
            'id' => $category->id,
            'name' => $category->name,
            'sort_order' => $category->sort_order,
            'tools' => $category->tools
                ->map(fn (Tool $tool) => $this->formatTool($tool))
                ->values(),
        ];
    }

    /**
     * 格式化工具数据。
     *
     * @return array<string, mixed>
     */
    protected function formatTool(Tool $tool): array
    {
        return [
            'id' => $tool->id,
            'tool_category_id' => $tool->tool_category_id,
            'slug' => $tool->slug,
            'name' => $tool->name,
            'url' => $tool->url,
            'description' => $tool->description,
            'icon' => $tool->icon,
            'sort_order' => $tool->sort_order,
            'is_external' => $tool->isExternal(),
        ];
    }
}
