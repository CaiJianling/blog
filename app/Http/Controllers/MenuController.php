<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Models\NavMenu;
use App\Models\NavMenuItem;
use App\Models\Page;
use App\Models\TermTaxonomy;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
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

    /**
     * 菜单管理页：菜单列表 + 当前菜单结构 + 可添加对象。
     */
    public function index(Request $request): Response
    {
        $menus = NavMenu::orderBy('id')->get(['id', 'name', 'slug']);

        $selectedId = (int) $request->query('menu', $menus->first()?->id ?? 0);
        $menu = NavMenu::find($selectedId) ?? $menus->first();

        $pages = Page::where('status', '!=', 'trash')
            ->orderByDesc('updated_at')
            ->take(50)
            ->get(['id', 'title', 'slug', 'updated_at'])
            ->map(fn (Page $page) => [
                'id' => $page->id,
                'title' => $page->title,
            ]);

        $articles = Article::where('status', '!=', 'trash')
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
            ? $this->resolveItems($menu->items)
            : [];

        return Inertia::render('Menus/Index', [
            'menus' => $menus,
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
     * 创建新菜单。
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:191',
        ]);

        $count = NavMenu::count();
        $menu = NavMenu::create([
            'name' => $validated['name'],
            'slug' => 'menu-'.($count + 1),
            'auto_add_pages' => false,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => '菜单已创建。']);

        return to_route('menus.index', ['menu' => $menu->id]);
    }

    /**
     * 保存菜单：名称、设置 + 全量同步菜单项（扁平 DFS 列表）。
     */
    public function update(Request $request, NavMenu $menu): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:191',
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
                'name' => $validated['name'],
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

    /**
     * 删除菜单及其全部菜单项。
     */
    public function destroy(NavMenu $menu): RedirectResponse
    {
        DB::transaction(function () use ($menu) {
            NavMenuItem::where('menu_id', $menu->id)->delete();
            $menu->delete();
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => '菜单已删除。']);

        return to_route('menus.index');
    }

    /**
     * 为菜单项补充对象标题与解析后的链接。
     *
     * @param  Collection<int, NavMenuItem>  $items
     * @return array<int, array<string, mixed>>
     */
    private function resolveItems($items): array
    {
        $pageIds = $items->where('type', 'page')->pluck('object_id')->unique()->filter();
        $articleIds = $items->where('type', 'article')->pluck('object_id')->unique()->filter();
        $categoryIds = $items->where('type', 'category')->pluck('object_id')->unique()->filter();

        $pages = Page::whereIn('id', $pageIds)->pluck('title', 'id');
        $articles = Article::whereIn('id', $articleIds)->pluck('title', 'id');
        $pageSlugs = Page::whereIn('id', $pageIds)->pluck('slug', 'id');
        $articleSlugs = Article::whereIn('id', $articleIds)->pluck('slug', 'id');

        $categories = TermTaxonomy::whereIn('term_taxonomy_id', $categoryIds)
            ->with('term')
            ->get()
            ->mapWithKeys(function (TermTaxonomy $taxonomy) {
                return [
                    $taxonomy->term_taxonomy_id => [
                        'title' => $taxonomy->term?->name ?? '',
                        'slug' => $taxonomy->term?->slug ?? '',
                    ],
                ];
            });

        return $items->map(function (NavMenuItem $item) use ($pages, $articles, $pageSlugs, $articleSlugs, $categories) {
            $objectLabel = '';
            $resolvedUrl = $item->url;

            switch ($item->type) {
                case 'page':
                    $objectLabel = $pages->get($item->object_id, '');
                    $slug = $pageSlugs->get($item->object_id, '');
                    $resolvedUrl = $slug ? '/'.$slug : '';
                    break;
                case 'article':
                    $objectLabel = $articles->get($item->object_id, '');
                    $slug = $articleSlugs->get($item->object_id, '');
                    $resolvedUrl = $slug ? '/article/'.$slug : '';
                    break;
                case 'category':
                    $category = $categories->get($item->object_id);
                    $objectLabel = $category['title'] ?? '';
                    $resolvedUrl = ! empty($category['slug']) ? '/category/'.$category['slug'] : '';
                    break;
            }

            return [
                'id' => $item->id,
                'parent_id' => $item->parent_id,
                'type' => $item->type,
                'object_id' => $item->object_id,
                'label' => $item->label,
                'url' => $resolvedUrl,
                'custom_url' => $item->type === 'custom' ? $item->url : '',
                'css_class' => $item->css_class,
                'target' => $item->target,
                'object_label' => $objectLabel,
                'display_label' => $item->label !== '' ? $item->label : $objectLabel,
            ];
        })->values()->all();
    }
}
