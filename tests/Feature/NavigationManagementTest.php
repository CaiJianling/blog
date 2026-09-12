<?php

use App\Models\NavCategory;
use App\Models\NavLink;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    // 迁移会从 config/navigation.php 预置数据，测试用例先清空再自行构造
    NavLink::query()->delete();
    NavCategory::query()->delete();

    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
    $this->regular = User::factory()->create(['role' => 'subscriber', 'email_verified_at' => now()]);
});

test('public nav page renders categories and links from database', function () {
    $category = NavCategory::factory()->create(['name' => 'AI 工具', 'sort_order' => 0]);
    NavLink::factory()->create([
        'nav_category_id' => $category->id,
        'name' => 'ChatGPT',
        'url' => 'https://chat.openai.com',
        'sort_order' => 0,
    ]);
    NavLink::factory()->withIntro()->create([
        'nav_category_id' => $category->id,
        'name' => 'Claude',
        'sort_order' => 1,
    ]);

    $response = $this->get(route('nav.index'));

    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Nav/Index')
            ->has('navigationCategories', 1)
            ->has('navigationCategories.0.links', 2)
            ->where('navigationCategories.0.name', 'AI 工具')
            ->where('navigationCategories.0.links.0.name', 'ChatGPT')
            ->where('navigationCategories.0.links.0.has_intro', false)
            ->where('navigationCategories.0.links.1.name', 'Claude')
            ->where('navigationCategories.0.links.1.has_intro', true),
        );
});

test('nav intro page renders link with intro content', function () {
    $link = NavLink::factory()->withIntro()->create();

    $this->get(route('nav.show', $link))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Nav/Intro')
            ->where('link.name', $link->name)
            ->where('link.url', $link->url)
            ->where('link.description', $link->description)
            ->has('link.intro_content'),
        );
});

test('nav intro page renders link without intro content', function () {
    $link = NavLink::factory()->create(['intro_content' => null]);

    $this->get(route('nav.show', $link))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Nav/Intro')
            ->where('link.name', $link->name)
            ->where('link.intro_content', null),
        );
});

test('admin can view navigation settings page', function () {
    $category = NavCategory::factory()->create(['name' => 'AI 工具', 'sort_order' => 0]);
    NavLink::factory()->create(['nav_category_id' => $category->id]);

    $this->actingAs($this->admin)
        ->get(route('navigation.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/navigation')
            ->has('categories', 1)
            ->has('categories.0.links', 1),
        );
});

test('non-admin cannot view navigation settings page', function () {
    $this->actingAs($this->regular)
        ->get(route('navigation.edit'))
        ->assertRedirect(route('dashboard'));
});

test('admin can create category', function () {
    NavCategory::factory()->create(['sort_order' => 5]);

    $this->actingAs($this->admin)
        ->post(route('navigation.categories.store'), ['name' => '新分类'])
        ->assertRedirect();

    $category = NavCategory::where('name', '新分类')->first();

    expect($category)->not->toBeNull();
    expect($category->sort_order)->toBe(6);
});

test('category name is required', function () {
    $this->actingAs($this->admin)
        ->post(route('navigation.categories.store'), ['name' => ''])
        ->assertSessionHasErrors(['name']);
});

test('admin can update category', function () {
    $category = NavCategory::factory()->create(['name' => '旧名称']);

    $this->actingAs($this->admin)
        ->put(route('navigation.categories.update', $category), ['name' => '新名称'])
        ->assertRedirect();

    expect($category->refresh()->name)->toBe('新名称');
});

test('deleting a category removes its links', function () {
    $category = NavCategory::factory()->create();
    NavLink::factory()->count(2)->create(['nav_category_id' => $category->id]);

    $this->actingAs($this->admin)
        ->delete(route('navigation.categories.destroy', $category))
        ->assertRedirect();

    expect(NavCategory::count())->toBe(0);
    expect(NavLink::count())->toBe(0);
});

test('admin can create link', function () {
    $category = NavCategory::factory()->create();

    $this->actingAs($this->admin)
        ->post(route('navigation.links.store'), [
            'nav_category_id' => $category->id,
            'name' => 'ChatGPT',
            'url' => 'https://chat.openai.com',
            'color' => '#10a37f',
            'description' => 'OpenAI 智能对话助手',
        ])
        ->assertRedirect();

    $link = NavLink::where('name', 'ChatGPT')->first();

    expect($link)->not->toBeNull();
    expect($link->url)->toBe('https://chat.openai.com');
    expect($link->color)->toBe('#10a37f');
    expect($link->description)->toBe('OpenAI 智能对话助手');
    expect($link->intro_content)->toBeNull();
});

test('link requires name and category', function () {
    $this->actingAs($this->admin)
        ->post(route('navigation.links.store'), ['url' => 'https://example.com'])
        ->assertSessionHasErrors(['nav_category_id', 'name']);
});

test('admin can update link without touching intro', function () {
    $link = NavLink::factory()->withIntro()->create(['name' => '旧名称']);

    $this->actingAs($this->admin)
        ->put(route('navigation.links.update', $link), [
            'nav_category_id' => $link->nav_category_id,
            'name' => '新名称',
            'url' => 'https://example.com/new',
            'color' => '#ff0000',
            'description' => '更新后的介绍',
        ])
        ->assertRedirect();

    $link->refresh();

    expect($link->name)->toBe('新名称');
    expect($link->url)->toBe('https://example.com/new');
    expect($link->intro_content)->not->toBeNull();
});

test('admin can delete link', function () {
    $link = NavLink::factory()->create();

    $this->actingAs($this->admin)
        ->delete(route('navigation.links.destroy', $link))
        ->assertRedirect();

    expect(NavLink::count())->toBe(0);
});

test('admin can reorder categories', function () {
    $first = NavCategory::factory()->create(['sort_order' => 0]);
    $second = NavCategory::factory()->create(['sort_order' => 1]);
    $third = NavCategory::factory()->create(['sort_order' => 2]);

    $this->actingAs($this->admin)
        ->put(route('navigation.reorder'), [
            'type' => 'category',
            'ids' => [$third->id, $first->id, $second->id],
        ])
        ->assertRedirect();

    expect($third->refresh()->sort_order)->toBe(0);
    expect($first->refresh()->sort_order)->toBe(1);
    expect($second->refresh()->sort_order)->toBe(2);
});

test('admin can reorder links', function () {
    $category = NavCategory::factory()->create();
    $first = NavLink::factory()->create(['nav_category_id' => $category->id, 'sort_order' => 0]);
    $second = NavLink::factory()->create(['nav_category_id' => $category->id, 'sort_order' => 1]);

    $this->actingAs($this->admin)
        ->put(route('navigation.reorder'), [
            'type' => 'link',
            'ids' => [$second->id, $first->id],
        ])
        ->assertRedirect();

    expect($second->refresh()->sort_order)->toBe(0);
    expect($first->refresh()->sort_order)->toBe(1);
});

test('reorder requires valid type and ids', function () {
    $this->actingAs($this->admin)
        ->put(route('navigation.reorder'), ['type' => 'invalid', 'ids' => [1, 2]])
        ->assertSessionHasErrors(['type']);
});

test('admin can view link intro editor page', function () {
    $link = NavLink::factory()->withIntro()->create();

    $this->actingAs($this->admin)
        ->get(route('navigation.links.intro', $link))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/navigation-intro')
            ->where('link.name', $link->name)
            ->where('link.has_intro', true)
            ->has('link.intro_content'),
        );
});

test('admin can save link intro content', function () {
    $link = NavLink::factory()->create();

    $content = [
        [
            'type' => 'paragraph',
            'content' => [
                ['type' => 'text', 'text' => '这是一段介绍文字。'],
            ],
        ],
    ];

    $this->actingAs($this->admin)
        ->put(route('navigation.links.intro.update', $link), ['intro_content' => $content])
        ->assertRedirect();

    $link->refresh();

    expect($link->intro_content)->toBe($content);
});

test('empty intro content is stored as null', function () {
    $link = NavLink::factory()->withIntro()->create();

    $this->actingAs($this->admin)
        ->put(route('navigation.links.intro.update', $link), ['intro_content' => []])
        ->assertRedirect();

    expect($link->refresh()->intro_content)->toBeNull();
});

test('non-admin cannot manage navigation', function () {
    $category = NavCategory::factory()->create();
    $link = NavLink::factory()->create(['nav_category_id' => $category->id]);

    $this->actingAs($this->regular)
        ->post(route('navigation.categories.store'), ['name' => '尝试'])
        ->assertRedirect(route('dashboard'));

    $this->actingAs($this->regular)
        ->put(route('navigation.links.intro.update', $link), ['intro_content' => []])
        ->assertRedirect(route('dashboard'));

    expect(NavCategory::count())->toBe(1);
    expect($link->refresh()->intro_content)->toBeNull();
});
