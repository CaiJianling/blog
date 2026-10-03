<?php

namespace Database\Seeders;

use App\Models\NavCategory;
use App\Models\NavLink;
use App\Models\Tool;
use App\Models\ToolCategory;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

/**
 * 把 config/tools.php 与 config/navigation.php 中的内容同步进数据库。
 *
 * 幂等：按 slug / URL 判重，只补建缺失的行；已存在的行不做任何修改，
 * 因此可重复执行，也不会覆盖后台对既有工具/链接的编辑。
 */
class ToolsAndNavSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $this->seedTools();
        $this->seedNavLinks();
    }

    /**
     * 同步工具配置。
     */
    protected function seedTools(): void
    {
        $categorySort = 0;

        foreach (config('tools', []) as $categoryName => $tools) {
            $categorySort++;

            $category = ToolCategory::firstOrCreate(
                ['name' => $categoryName],
                ['sort_order' => $categorySort],
            );

            foreach ($tools as $tool) {
                $exists = $tool['slug'] !== null && Tool::where('slug', $tool['slug'])->exists();

                if ($exists) {
                    continue;
                }

                Tool::create([
                    'tool_category_id' => $category->id,
                    'slug' => $tool['slug'],
                    'name' => $tool['name'],
                    'url' => null,
                    'description' => $tool['description'],
                    'icon' => $tool['icon'],
                    'sort_order' => (int) $category->tools()->max('sort_order') + 1,
                ]);
            }
        }
    }

    /**
     * 同步导航链接配置。
     */
    protected function seedNavLinks(): void
    {
        $categorySort = 0;

        foreach (config('navigation', []) as $categoryName => $links) {
            $categorySort++;

            $category = NavCategory::firstOrCreate(
                ['name' => $categoryName],
                ['sort_order' => $categorySort],
            );

            foreach ($links as $link) {
                $exists = NavLink::where('url', $link['url'])->exists();

                if ($exists) {
                    continue;
                }

                NavLink::create([
                    'nav_category_id' => $category->id,
                    'name' => $link['name'],
                    'url' => $link['url'],
                    'color' => $link['color'] ?? '#6b7280',
                    'description' => $link['description'] ?? '',
                    'sort_order' => (int) $category->links()->max('sort_order') + 1,
                ]);
            }
        }
    }
}
