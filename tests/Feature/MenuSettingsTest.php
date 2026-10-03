<?php

use App\Models\NavMenu;
use App\Models\NavMenuItem;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
});

test('menu settings lists the fixed locations and recreates a missing one', function () {
    // 挂点由 config/menus.php 固定，记录被误删时菜单管理页仍能补回
    NavMenuItem::query()->delete();
    NavMenu::query()->delete();

    $this->actingAs($this->admin)
        ->get(route('menus.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Menus/Index')
            ->has('menus', 1)
            ->where('menus.0.slug', 'top')
            ->where('menus.0.name', '顶部导航')
            ->where('selectedMenu.slug', 'top'));

    expect(NavMenu::where('slug', 'top')->count())->toBe(1);
});

test('the top menu ships with the default entries that drive the navbar', function () {
    $menu = NavMenu::where('slug', 'top')->firstOrFail();

    expect(NavMenuItem::where('menu_id', $menu->id)->orderBy('sort_order')->pluck('label')->all())
        ->toBe(['首页', '博客', '说说', '归档', '工具', '导航', '友链']);

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('top_nav.0.label', '首页')
            ->where('top_nav.1.url', '/blog')
            ->has('top_nav', 7));
});

test('menu name is fixed and cannot be renamed through save', function () {
    $menu = NavMenu::firstOrCreate(['slug' => 'top'], [
        'name' => '顶部导航',
        'auto_add_pages' => false,
    ]);

    $this->actingAs($this->admin)
        ->put(route('menus.update', $menu), [
            'name' => '改名试试',
            'auto_add_pages' => '0',
            'items' => [[
                'clientId' => 'c1',
                'parentClientId' => null,
                'type' => 'custom',
                'object_id' => 0,
                'label' => '首页',
                'url' => '/',
                'css_class' => '',
                'target' => '',
            ]],
        ])
        ->assertRedirect();

    expect($menu->refresh()->name)->toBe('顶部导航')
        ->and(NavMenuItem::where('menu_id', $menu->id)->count())->toBe(1);
});

test('menus cannot be created or deleted from outside', function () {
    $menu = NavMenu::firstOrCreate(['slug' => 'top'], [
        'name' => '顶部导航',
        'auto_add_pages' => false,
    ]);

    $this->actingAs($this->admin)
        ->post(route('menus.index'), ['name' => '多余菜单'])
        ->assertMethodNotAllowed();

    $this->actingAs($this->admin)
        ->delete(route('menus.update', $menu))
        ->assertMethodNotAllowed();

    expect(NavMenu::count())->toBe(1);
});
