<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Models\NavMenu;
use App\Models\NavMenuItem;
use App\Models\Page;
use App\Models\TermTaxonomy;
use App\Services\MenuService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class MenuController extends Controller
{
    /**
     * 菜单项类型白名单。
     */
    private const ITEM_TYPES = ['page', 'article', 'category', 'custom'];

    public function __construct(
        protected MenuService $menuService,
    ) {}

    /**
     * 菜单管理页：固定挂点菜单 + 当前菜单结构 + 可添加对象。
     */
    public function index(Request $request): Response
    {
        $menus = collect(config('menus.locations'))
            ->map(fn (string $name, string $slug) => NavMenu::firstOrCreate(
                ['slug' => $slug],
                ['name' => $name, 'auto_add_pages' => false],
            ))
            ->values();

        $selectedId = (int) $request->query('menu', $menus->first()?->id ?? 0);
        $menu = $menus->firstWhere('id', $selectedId) ?: $menus->first();

        $pages = Page::where('status', '!=', 'trash')
            ->orderByDesc('updated_at')
            ->take(50)
            ->get(['id', 'title', 'slug', 'updated_at'])
            ->map(fn (Page $page) => [
                'id' => $page->id,
                'title' => $page->title,
            ]);

        $articles = Article::where('status', '!=', 'trash')
            ->ofType(Article::TYPE_POST)
            ->orderByDesc('updated_at')
            ->take(50)
            ->get(['id', 'title', 'slug', 'updated_at'])
            ->map(fn (Article $article) => [
                'id' => $article->id,
                'title' => $article->title,
            ]);

        $categories = TermTaxonomy::where('taxonomy', 'category')
            ->with('term')
            ->orderByDesc('term_taxonomy_id')
            ->get()
            ->map(fn (TermTaxonomy $taxonomy) => [
                'id' => $taxonomy->term_taxonomy_id,
                'title' => $taxonomy->term?->name ?? '',
            ]);

        $items = $menu
            ? $this->menuService->resolveItems($menu->items)
            : [];

        return Inertia::render('Menus/Index', [
            'menus' => $menus->map(fn (NavMenu $nav) => [
                'id' => $nav->id,
                'name' => $nav->name,
                'slug' => $nav->slug,
            ])->values(),
            'selectedMenu' => $menu ? [
                'id' => $menu->id,
                'name' => $menu->name,
                'slug' => $menu->slug,
                'auto_add_pages' => (bool) $menu->auto_add_pages,
            ] : null,
            'items' => $items,
            'candidates' => [
                'pages' => $pages,
                'articles' => $articles,
                'categories' => $categories,
            ],
        ]);
    }

    /**
     * 保存菜单项与设置（扁平 DFS 列表）。菜单位置固定，名称不可改。
     */
    public function update(Request $request, NavMenu $menu): RedirectResponse
    {
        $validated = $request->validate([
            'auto_add_pages' => ['nullable', 'in:0,1'],
            'items' => ['array'],
            'items.*.clientId' => ['required', 'string'],
            'items.*.parentClientId' => ['nullable', 'string'],
            'items.*.type' => ['required', Rule::in(self::ITEM_TYPES)],
            'items.*.object_id' => ['nullable', 'integer'],
            'items.*.label' => ['nullable', 'string', 'max:191'],
            'items.*.url' => ['nullable', 'string', 'max:500'],
            'items.*.css_class' => ['nullable', 'string', 'max:100'],
            'items.*.target' => ['nullable', 'string', 'max:20'],
        ]);

        $items = $validated['items'] ?? [];

        DB::transaction(function () use ($menu, $validated, $items) {
            $menu->update([
                'auto_add_pages' => ($validated['auto_add_pages'] ?? '0') === '1',
            ]);

            // 全量重建菜单项
            NavMenuItem::where('menu_id', $menu->id)->delete();

            $idMap = [];

            // 第一遍：按提交顺序创建，parent 先置 0
            foreach ($items as $index => $item) {
                $row = NavMenuItem::create([
                    'menu_id' => $menu->id,
                    'parent_id' => 0,
                    'sort_order' => $index,
                    'type' => $item['type'],
                    'object_id' => (int) ($item['object_id'] ?? 0),
                    'label' => $item['label'] ?? '',
                    'url' => $item['url'] ?? '',
                    'css_class' => $item['css_class'] ?? '',
                    'target' => $item['target'] ?? '',
                ]);
                $idMap[$item['clientId']] = $row->id;
            }

            // 第二遍：回填父级与同级排序（提交顺序即深度优先展示顺序）
            $siblingCounters = [];
            foreach ($items as $item) {
                $parentRealId = 0;
                if (! empty($item['parentClientId']) && isset($idMap[$item['parentClientId']])) {
                    $parentRealId = $idMap[$item['parentClientId']];
                }

                $order = $siblingCounters[$parentRealId] ?? 0;
                $siblingCounters[$parentRealId] = $order + 1;

                NavMenuItem::where('id', $idMap[$item['clientId']])->update([
                    'parent_id' => $parentRealId,
                    'sort_order' => $order,
                ]);
            }
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => '菜单已保存。']);

        return to_route('menus.index', ['menu' => $menu->id]);
    }
}
