<?php

use App\Models\Tool;
use App\Models\ToolCategory;
use Inertia\Testing\AssertableInertia;

test('tools index seo meta is built from the admin tool settings', function () {
    // 排在最前的分组，才能确保自己的工具名与分类名落在 meta 取的头部数量里
    $category = ToolCategory::create(['name' => '编码工具', 'sort_order' => -5]);
    Tool::create([
        'tool_category_id' => $category->id,
        'slug' => 'seo-json',
        'name' => 'SEO 测试工具甲',
        'description' => '美化与压缩 JSON',
        'icon' => 'Braces',
        'sort_order' => 1,
    ]);
    Tool::create([
        'tool_category_id' => $category->id,
        'slug' => 'seo-base64',
        'name' => 'SEO 测试工具乙',
        'description' => 'Base64 编解码',
        'icon' => 'Binary',
        'sort_order' => 2,
    ]);

    $this->get('/tools')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Tools/Index')
            ->where('meta.title', '在线工具')
            ->where('meta.description', fn (string $description) => str_contains($description, '共 '.Tool::count().' 个')
                && str_contains($description, '编码工具'))
            ->where('meta.keywords', fn (string $keywords) => str_contains($keywords, 'SEO 测试工具甲')
                && str_contains($keywords, 'SEO 测试工具乙')),
        );
});

test('tools index seo meta has a fallback when nothing is configured', function () {
    Tool::query()->delete();
    ToolCategory::query()->delete();

    $this->get('/tools')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Tools/Index')
            ->where('meta.description', '免安装、即开即用的在线开发工具合集。')
            ->where('meta.keywords', ''),
        );
});

test('tool detail seo meta uses the tool name and description from the admin settings', function () {
    $category = ToolCategory::create(['name' => '文本工具', 'sort_order' => -4]);
    Tool::create([
        'tool_category_id' => $category->id,
        'slug' => 'seo-regex',
        'name' => 'SEO 详情测试工具',
        'description' => '在线测试正则表达式的匹配结果',
        'icon' => 'Regex',
        'sort_order' => 1,
    ]);

    $this->get('/tools/seo-regex')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Tools/Show')
            ->where('meta.title', 'SEO 详情测试工具 - 在线工具')
            ->where('meta.description', '在线测试正则表达式的匹配结果')
            ->where('meta.keywords', 'SEO 详情测试工具，文本工具'),
        );
});

test('tool detail seo meta keeps the description empty so the site default is used', function () {
    $category = ToolCategory::create(['name' => '空描述工具组', 'sort_order' => -3]);
    Tool::create([
        'tool_category_id' => $category->id,
        'slug' => 'seo-no-desc',
        'name' => '未填描述的工具',
        'description' => null,
        'icon' => 'Wrench',
        'sort_order' => 1,
    ]);

    $this->get('/tools/seo-no-desc')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Tools/Show')
            ->where('meta.description', '')
            ->where('meta.keywords', '未填描述的工具，空描述工具组'),
        );
});
