<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * 顶栏导航数据化：把原先写死在前端 public-navbar.tsx 里的默认入口，
 * 连同已发布页面（如「留言板」）一起预置进 slug=top 的菜单，
 * 使顶栏完全由后台「菜单设置」维护。
 */
return new class extends Migration
{
    /**
     * 默认入口，顺序即顶栏顺序。
     *
     * @var array<int, array{label: string, url: string}>
     */
    private const DEFAULT_ITEMS = [
        ['label' => '首页', 'url' => '/'],
        ['label' => '博客', 'url' => '/blog'],
        ['label' => '说说', 'url' => '/moments'],
        ['label' => '归档', 'url' => '/archive'],
        ['label' => '工具', 'url' => '/tools'],
        ['label' => '导航', 'url' => '/nav'],
        ['label' => '友链', 'url' => '/links'],
    ];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $now = now();
        $menu = DB::table('nav_menus')->where('slug', 'top')->first();

        if ($menu === null) {
            $menuId = DB::table('nav_menus')->insertGetId([
                'name' => '顶部导航',
                'slug' => 'top',
                'auto_add_pages' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        } else {
            $menuId = $menu->id;
        }

        // 已经自行维护过菜单项的站点不覆盖，避免抹掉手工配置
        if (DB::table('nav_menu_items')->where('menu_id', $menuId)->exists()) {
            return;
        }

        foreach (self::DEFAULT_ITEMS as $order => $item) {
            DB::table('nav_menu_items')->insert($this->row($menuId, [
                'sort_order' => $order,
                'label' => $item['label'],
                'url' => $item['url'],
            ], $now));
        }

        // 页面项 label 留空，显示文字跟随页面标题，页面改名后菜单自动同步
        $order = count(self::DEFAULT_ITEMS);
        $pages = DB::table('pages')->where('status', 'publish')->orderBy('id')->get(['id']);

        foreach ($pages as $page) {
            DB::table('nav_menu_items')->insert($this->row($menuId, [
                'sort_order' => $order++,
                'type' => 'page',
                'object_id' => $page->id,
            ], $now));
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('nav_menu_items')
            ->where('type', 'custom')
            ->whereIn('url', array_column(self::DEFAULT_ITEMS, 'url'))
            ->delete();
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    private function row(
        int $menuId,
        array $attributes,
        DateTimeInterface $now,
    ): array {
        return array_merge([
            'menu_id' => $menuId,
            'parent_id' => 0,
            'sort_order' => 0,
            'type' => 'custom',
            'object_id' => 0,
            'label' => '',
            'url' => '',
            'css_class' => '',
            'target' => '',
            'created_at' => $now,
            'updated_at' => $now,
        ], $attributes);
    }
};
