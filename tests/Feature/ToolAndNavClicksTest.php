<?php

use App\Models\NavCategory;
use App\Models\NavLink;
use App\Models\Tool;
use App\Models\ToolCategory;
use App\Models\User;
use Database\Seeders\ToolsAndNavSeeder;
use Inertia\Testing\AssertableInertia;

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
});

test('tool show page increments clicks and passes the count', function () {
    $category = ToolCategory::create(['name' => '点击测试分类', 'sort_order' => 99]);
    $tool = Tool::create([
        'tool_category_id' => $category->id,
        'slug' => 'click-test-tool',
        'name' => '点击测试工具',
        'description' => '测试用',
        'icon' => 'Wrench',
        'sort_order' => 1,
    ]);

    $this->get('/tools/click-test-tool')->assertOk();
    $this->get('/tools/click-test-tool')->assertOk();

    expect($tool->fresh()->clicks)->toBe(2);
});

test('tools index payload includes clicks', function () {
    $category = ToolCategory::create(['name' => '点击列表分类', 'sort_order' => 99]);
    Tool::create([
        'tool_category_id' => $category->id,
        'slug' => 'click-list-tool',
        'name' => '点击列表工具',
        'description' => '测试用',
        'icon' => 'Wrench',
        'sort_order' => 1,
        'clicks' => 42,
    ]);

    $this->get('/tools')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('toolCategories', fn ($categories) => collect($categories)
                ->flatMap(fn ($c) => $c['tools'])
                ->firstWhere('slug', 'click-list-tool')['clicks'] === 42),
        );
});

test('external tool go route counts and redirects', function () {
    $category = ToolCategory::create(['name' => '外链点击分类', 'sort_order' => 99]);
    Tool::create([
        'tool_category_id' => $category->id,
        'slug' => 'ext-click-tool',
        'name' => '外链工具',
        'url' => 'https://example.com/tool',
        'description' => '测试用',
        'icon' => 'Wrench',
        'sort_order' => 1,
    ]);

    $this->get('/tools/ext-click-tool/go')
        ->assertRedirect('https://example.com/tool');

    expect(Tool::where('slug', 'ext-click-tool')->first()->clicks)->toBe(1);
});

test('internal tool go route returns 404', function () {
    $category = ToolCategory::create(['name' => '内链点击分类', 'sort_order' => 99]);
    Tool::create([
        'tool_category_id' => $category->id,
        'slug' => 'internal-click-tool',
        'name' => '内链工具',
        'description' => '测试用',
        'icon' => 'Wrench',
        'sort_order' => 1,
    ]);

    $this->get('/tools/internal-click-tool/go')->assertNotFound();
});

test('nav link go route counts and redirects', function () {
    $category = NavCategory::create(['name' => '点击测试导航', 'sort_order' => 99]);
    $link = NavLink::create([
        'nav_category_id' => $category->id,
        'name' => '测试站点',
        'url' => 'https://example.com/nav',
        'color' => '#000000',
        'sort_order' => 1,
    ]);

    $this->get("/nav/links/{$link->id}/go")
        ->assertRedirect('https://example.com/nav');

    expect($link->fresh()->clicks)->toBe(1);
});

test('nav intro page increments clicks and passes the count', function () {
    $category = NavCategory::create(['name' => 'Intro 点击分类', 'sort_order' => 99]);
    $link = NavLink::create([
        'nav_category_id' => $category->id,
        'name' => 'Intro 站点',
        'url' => 'https://example.com/intro',
        'color' => '#000000',
        'sort_order' => 1,
    ]);

    $this->get("/nav/links/{$link->id}")
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('link.clicks', 1),
        );
});

test('nav index payload includes clicks', function () {
    $category = NavCategory::create(['name' => '导航列表点击', 'sort_order' => 99]);
    NavLink::create([
        'nav_category_id' => $category->id,
        'name' => '列表站点',
        'url' => 'https://example.com/list',
        'color' => '#000000',
        'sort_order' => 1,
        'clicks' => 7,
    ]);

    $this->get('/nav')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('navigationCategories', fn ($categories) => collect($categories)
                ->flatMap(fn ($c) => $c['links'])
                ->firstWhere('name', '列表站点')['clicks'] === 7),
        );
});

test('admin tool settings show clicks', function () {
    $category = ToolCategory::create(['name' => '后台点击分类', 'sort_order' => 99]);
    Tool::create([
        'tool_category_id' => $category->id,
        'slug' => 'admin-click-tool',
        'name' => '后台点击工具',
        'description' => '测试用',
        'icon' => 'Wrench',
        'sort_order' => 1,
        'clicks' => 99,
    ]);

    $this->actingAs($this->admin)
        ->get(route('tools.admin'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('categories', fn ($categories) => collect($categories)
                ->flatMap(fn ($c) => $c['tools'])
                ->firstWhere('slug', 'admin-click-tool')['clicks'] === 99),
        );
});

test('admin navigation settings show clicks', function () {
    $category = NavCategory::create(['name' => '后台导航点击', 'sort_order' => 99]);
    NavLink::create([
        'nav_category_id' => $category->id,
        'name' => '后台点击站点',
        'url' => 'https://example.com/admin-click',
        'color' => '#000000',
        'sort_order' => 1,
        'clicks' => 66,
    ]);

    $this->actingAs($this->admin)
        ->get(route('navigation.edit'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('categories', fn ($categories) => collect($categories)
                ->flatMap(fn ($c) => $c['links'])
                ->firstWhere('name', '后台点击站点')['clicks'] === 66),
        );
});

test('tools and nav seeder syncs config idempotently', function () {
    // config 中定义的工具/链接总数
    $expectedTools = collect(config('tools'))->flatten(1)->count();
    $expectedLinks = collect(config('navigation'))->flatten(1)->count();

    $this->seed(ToolsAndNavSeeder::class);

    // 无论起始状态如何，播种后工具/链接数量与 config 一致
    expect(Tool::count())->toBe($expectedTools)
        ->and(NavLink::count())->toBe($expectedLinks);

    // 对现有行不做覆盖
    expect(Tool::where('slug', 'json-formatter')->first()->name)->toBe('JSON 格式化');

    // 幂等：再次执行数量不变
    $this->seed(ToolsAndNavSeeder::class);

    expect(Tool::count())->toBe($expectedTools)
        ->and(NavLink::count())->toBe($expectedLinks);
});
