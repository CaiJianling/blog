<?php

use App\Models\Article;
use App\Models\NavMenu;
use App\Models\NavMenuItem;
use App\Models\Page;
use App\Models\Term;
use App\Models\TermTaxonomy;
use App\Models\User;
use App\Services\PermalinkService;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->user = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
    // 迁移内置了 slug=top 的默认菜单，先清空保证用例隔离
    NavMenuItem::query()->delete();
    NavMenu::query()->delete();
});

function makeTopMenu(array $attrs = []): NavMenu
{
    return NavMenu::create(array_merge([
        'name' => '顶部导航',
        'slug' => 'top',
        'auto_add_pages' => false,
    ], $attrs));
}

function makeMenuItem(NavMenu $menu, array $attrs = []): NavMenuItem
{
    static $order = 0;

    return NavMenuItem::create(array_merge([
        'menu_id' => $menu->id,
        'parent_id' => 0,
        'sort_order' => $order++,
        'type' => 'custom',
        'object_id' => 0,
        'label' => '',
        'url' => 'https://example.com',
        'css_class' => '',
        'target' => '',
    ], $attrs));
}

test('front pages share an empty top_nav when no top menu exists', function () {
    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('top_nav', []));
});

test('top menu items drive the navbar with resolved frontend urls', function () {
    $article = Article::create([
        'author_id' => $this->user->id,
        'title' => '前台菜单样例',
        'slug' => 'menu-sample',
        'excerpt' => '',
        'content' => [],
        'status' => 'publish',
    ]);

    $menu = makeTopMenu();
    $parent = makeMenuItem($menu, [
        'type' => 'article',
        'object_id' => $article->id,
        'url' => '',
    ]);

    makeMenuItem($menu, [
        'type' => 'custom',
        'label' => '示例站',
        'url' => 'https://example.com/site',
        'target' => '_blank',
        'parent_id' => $parent->id,
        'sort_order' => 0,
    ]);

    $expectedUrl = app(PermalinkService::class)->articlePath($article);

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('top_nav.0.label', '前台菜单样例')
            ->where('top_nav.0.url', $expectedUrl)
            ->where('top_nav.0.children.0.label', '示例站')
            ->where('top_nav.0.children.0.url', 'https://example.com/site')
            ->where('top_nav.0.children.0.target', '_blank'));
});

test('category menu items resolve to the blog category filter url', function () {
    $term = Term::create(['name' => '教程', 'slug' => 'tutorials']);
    $taxonomy = TermTaxonomy::create([
        'term_id' => $term->term_id,
        'taxonomy' => 'category',
        'description' => '',
        'parent' => 0,
    ]);

    $menu = makeTopMenu();
    makeMenuItem($menu, [
        'type' => 'category',
        'object_id' => $taxonomy->term_taxonomy_id,
        'url' => '',
    ]);

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('top_nav.0.label', '教程')
            ->where('top_nav.0.url', '/blog?category=tutorials'));
});

test('auto add pages appends published pages to the top menu', function () {
    $page = Page::create([
        'title' => '关于我们',
        'slug' => 'about',
        'content' => [],
        'status' => 'publish',
    ]);
    $draft = Page::create([
        'title' => '草稿页',
        'slug' => 'draft-page',
        'content' => [],
        'status' => 'draft',
    ]);

    $menu = makeTopMenu(['auto_add_pages' => true]);
    makeMenuItem($menu, ['type' => 'custom', 'label' => '首页', 'url' => '/']);

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('top_nav.0.label', '首页')
            ->where('top_nav.1.label', '关于我们')
            ->where('top_nav.1.url', '/about')
            ->has('top_nav', 2));

    expect($draft->id)->toBeGreaterThan(0);
});

test('items pointing at missing objects are dropped from the navbar', function () {
    $menu = makeTopMenu();
    // object_id 指向不存在的文章，链接无法解析
    makeMenuItem($menu, ['type' => 'article', 'object_id' => 999999, 'url' => '']);
    makeMenuItem($menu, ['type' => 'custom', 'label' => '有效链接', 'url' => 'https://ok.example.com']);

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('top_nav.0.label', '有效链接')
            ->has('top_nav', 1));
});
