<?php

use App\Models\Option;
use App\Models\User;

/**
 * Hero 背景不透明度：管理员在「主题设置 → 页面背景」里设置，作用于首页 Hero 背景层。
 * 文案与按钮不受该值影响（由 resources/js/pages/Home.tsx 分层保证）。
 */
beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
});

function saveHeroOpacity(int|string $value): mixed
{
    return test()
        ->actingAs(test()->admin)
        ->put(route('theme.update'), [
            'theme_color' => '',
            'background_mode' => '',
            'background_opacity' => 100,
            'default_glass_frost' => 50,
            'hero_opacity' => $value,
        ]);
}

test('hero opacity defaults to fully opaque', function () {
    $this->actingAs($this->admin)
        ->get(route('theme.edit'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('heroOpacity', 100));

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('Home')->where('heroOpacity', 100));
});

test('admin can save hero opacity and it reaches the frontend', function () {
    saveHeroOpacity(45)->assertRedirect(route('theme.edit'));

    expect(Option::get('hero_opacity'))->toBe('45');

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('heroOpacity', 45));
});

test('hero opacity can be turned fully transparent', function () {
    saveHeroOpacity(0)->assertSessionHasNoErrors();

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('heroOpacity', 0));
});

test('out of range hero opacity is rejected', function () {
    saveHeroOpacity(40);

    $this->actingAs($this->admin)
        ->put(route('theme.update'), ['hero_opacity' => 130])
        ->assertSessionHasErrors('hero_opacity');

    $this->actingAs($this->admin)
        ->put(route('theme.update'), ['hero_opacity' => -1])
        ->assertSessionHasErrors('hero_opacity');

    // 非法值不覆盖已保存的设置
    expect(Option::get('hero_opacity'))->toBe('40');
});

test('blank hero opacity falls back to the default', function () {
    Option::set('hero_opacity', '25');

    saveHeroOpacity('')->assertSessionHasNoErrors();

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->where('heroOpacity', 100));
});

test('corrupted stored value is clamped instead of breaking the page', function () {
    Option::set('hero_opacity', '900');

    $this->get('/')->assertOk()->assertInertia(fn ($page) => $page->where('heroOpacity', 100));

    Option::set('hero_opacity', 'abc');

    $this->get('/')->assertOk()->assertInertia(fn ($page) => $page->where('heroOpacity', 0));

    Option::set('hero_opacity', '-30');

    $this->get('/')->assertOk()->assertInertia(fn ($page) => $page->where('heroOpacity', 0));
});

test('theme settings page still receives the other values', function () {
    saveHeroOpacity(60);

    $this->actingAs($this->admin)
        ->get(route('theme.edit'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('heroOpacity', 60)
            ->where('defaultGlassFrost', 50));
});
