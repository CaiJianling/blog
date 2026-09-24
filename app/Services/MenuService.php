<?php

namespace App\Services;

use App\Models\Article;
use App\Models\NavMenu;
use App\Models\NavMenuItem;
use App\Models\Page;
use App\Models\TermTaxonomy;
use Illuminate\Support\Collection;

/**
 * 站点菜单服务：把后台「菜单管理」（nav_menus / nav_menu_items）
 * 解析为前台可消费的结构，并按 slug 定位到具体挂点（如顶栏）。
 */
class MenuService
{
    /**
     * 前台顶栏对应的菜单 slug（后台建菜单时以 slug 标识挂点位置）。
     */
    public const TOP_NAV_SLUG = 'top';

    public function __construct(
        protected PermalinkService $permalinks,
    ) {}

    /**
     * 为菜单项补充对象标题与解析后的链接（与后台管理页共用同一套解析）。
     *
     * @param  Collection<int, NavMenuItem>  $items
     * @return array<int, array<string, mixed>>
     */
    public function resolveItems(Collection $items): array
    {
        $pageIds = $items->where('type', 'page')->pluck('object_id')->unique()->filter();
        $articleIds = $items->where('type', 'article')->pluck('object_id')->unique()->filter();
        $categoryIds = $items->where('type', 'category')->pluck('object_id')->unique()->filter();

        $pages = Page::whereIn('id', $pageIds)->get(['id', 'title', 'slug', 'created_at']);
        $articles = Article::whereIn('id', $articleIds)->get(['id', 'title', 'slug', 'created_at']);
        $articleUrls = $articles
            ->mapWithKeys(fn (Article $article) => [$article->id => $this->permalinks->articlePath($article)]);

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

        return $items->map(function (NavMenuItem $item) use ($pages, $articles, $articleUrls, $categories) {
            $objectLabel = '';
            $resolvedUrl = $item->url;

            switch ($item->type) {
                case 'page':
                    $page = $pages->firstWhere('id', $item->object_id);
                    $objectLabel = $page?->title ?? '';
                    // 页面同样走固定链接结构：slug 可以为空（如「留言板」），
                    // 直接拼 '/'.slug 会解析成空链接并被 buildTree 过滤掉
                    $resolvedUrl = $page ? $this->permalinks->pagePath($page) : '';
                    break;
                case 'article':
                    $article = $articles->firstWhere('id', $item->object_id);
                    $objectLabel = $article?->title ?? '';
                    // 文章链接按站点固定链接结构生成，与前台文章路由保持一致
                    $resolvedUrl = $article ? $articleUrls[$item->object_id] : '';
                    break;
                case 'category':
                    $category = $categories->get($item->object_id);
                    $objectLabel = $category['title'] ?? '';
                    $resolvedUrl = ! empty($category['slug']) ? '/blog?category='.$category['slug'] : '';
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

    /**
     * 取前台顶栏导航：slug=top 的菜单，解析为嵌套树（自动挂接 auto_add_pages）。
     * 链接无法解析的项会被过滤，保证前台不会出现死链。
     *
     * @return array<int, array{label: string, url: string, target: string, children: array}>
     */
    public function topNav(): array
    {
        $menu = NavMenu::where('slug', self::TOP_NAV_SLUG)->first();

        if ($menu === null) {
            return [];
        }

        $items = $menu->items;

        if ($menu->auto_add_pages) {
            $referenced = $items->where('type', 'page')->pluck('object_id')->filter()->values();

            $autoPages = Page::where('status', 'publish')
                ->whereNotIn('id', $referenced)
                ->orderBy('sort')
                ->get();

            $items = $items->concat($autoPages->map(function (Page $page) {
                $item = new NavMenuItem;
                $item->type = 'page';
                $item->object_id = $page->id;
                $item->label = $page->title;
                $item->url = '';
                $item->css_class = '';
                $item->target = '';
                $item->parent_id = 0;

                return $item;
            }));
        }

        $flat = $this->resolveItems($items);

        return $this->buildTree($flat);
    }

    /**
     * 将扁平菜单项（含 parent_id）构建为嵌套树，过滤无效链接。
     *
     * @param  array<int, array<string, mixed>>  $flat
     * @return array<int, array{label: string, url: string, target: string, children: array}>
     */
    private function buildTree(array $flat): array
    {
        // 稳定键：列表下标；parent_id（菜单项真实 id）→ 下标
        $idToIndex = [];
        foreach ($flat as $index => $item) {
            if (! empty($item['id'])) {
                $idToIndex[$item['id']] = $index;
            }
        }

        $childrenOf = [];
        $roots = [];

        foreach ($flat as $index => $item) {
            $parentIndex = $item['parent_id'] > 0 ? ($idToIndex[$item['parent_id']] ?? null) : null;

            if ($parentIndex !== null) {
                $childrenOf[$parentIndex][] = $index;
            } else {
                $roots[] = $index;
            }
        }

        $toNode = function (int $index) use (&$toNode, $flat, $childrenOf): ?array {
            $item = $flat[$index];

            $children = [];
            foreach ($childrenOf[$index] ?? [] as $childIndex) {
                $child = $toNode($childIndex);
                if ($child !== null) {
                    $children[] = $child;
                }
            }

            // 自身无链接且没有有效子项 → 整支丢弃
            if ($item['url'] === '' && $children === []) {
                return null;
            }

            return [
                'label' => (string) ($item['display_label'] ?: $item['label']),
                'url' => (string) $item['url'],
                'target' => (string) $item['target'],
                'children' => $children,
            ];
        };

        $tree = [];
        foreach ($roots as $rootIndex) {
            $node = $toNode($rootIndex);
            if ($node !== null) {
                $tree[] = $node;
            }
        }

        return $tree;
    }
}
