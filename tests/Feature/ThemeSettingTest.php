<?php

use App\Http\Controllers\ThemeSettingController;
use App\Models\Option;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
    $this->regular = User::factory()->create(['role' => 'subscriber', 'email_verified_at' => now()]);
});

test('theme settings page renders with color, default and presets', function () {
    Option::set('theme_color', '#bf5af2');

    $this->actingAs($this->admin)
        ->get(route('theme.edit'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('themeColor', '#bf5af2')
            ->where('defaultColor', ThemeSettingController::DEFAULT_COLOR)
            ->has('presets', 8)
            ->where('presets.0', '#2196f3'),
        );
});

test('admin can save a valid theme color', function () {
    $this->actingAs($this->admin)
        ->put(route('theme.update'), ['theme_color' => '#34c759'])
        ->assertRedirect(route('theme.edit'));

    expect(Option::get('theme_color'))->toBe('#34c759');
});

test('saving normalizes color to lowercase hex with leading hash', function () {
    $this->actingAs($this->admin)
        ->put(route('theme.update'), ['theme_color' => 'FF3B30'])
        ->assertRedirect(route('theme.edit'));

    expect(Option::get('theme_color'))->toBe('#ff3b30');
});

test('empty theme color resets to built-in default', function () {
    Option::set('theme_color', '#ff9500');

    $this->actingAs($this->admin)
        ->put(route('theme.update'), ['theme_color' => ''])
        ->assertRedirect(route('theme.edit'));

    expect(Option::get('theme_color'))->toBe('');
});

test('invalid theme color fails validation', function () {
    $this->actingAs($this->admin)
        ->put(route('theme.update'), ['theme_color' => 'zzz'])
        ->assertSessionHasErrors(['theme_color']);

    expect(Option::get('theme_color', ''))->toBe('');
});

test('non-admin cannot view or update theme settings', function () {
    $this->actingAs($this->regular)
        ->get(route('theme.edit'))
        ->assertRedirect(route('dashboard'));

    $this->actingAs($this->regular)
        ->put(route('theme.update'), ['theme_color' => '#ff3b30'])
        ->assertRedirect(route('dashboard'));

    expect(Option::get('theme_color', ''))->toBe('');
});

test('public pages inject per-theme derived primary, adaptive foreground and meta', function () {
    Option::set('theme_color', '#ff9500');

    $light = ThemeSettingController::themePrimary('#ff9500', 'light');
    $dark = ThemeSettingController::themePrimary('#ff9500', 'dark');

    $this->get('/blog')
        ->assertOk()
        ->assertSee('--primary: '.$light, false)
        ->assertSee('--primary: '.$dark, false)
        ->assertSee('--primary-foreground: #0f172a', false)
        ->assertSee('<meta name="theme-color" content="#ff9500">', false);
});

test('light appearance darkens an over-light primary so it stays readable', function () {
    // 过浅的主色（浅蓝）在浅色外观下被压深，保证白底文字/图标可读。
    $light = ThemeSettingController::themePrimary('#64d2ff', 'light');

    expect($light)->toBe('#00aff5')
        ->and(ThemeSettingController::luminance($light))
        ->toBeLessThan(ThemeSettingController::luminance('#64d2ff'));
});

test('dark appearance lightens a dark primary so it stays readable', function () {
    // 较深的主色在深色外观下被提亮，保证黑底可读。
    $dark = ThemeSettingController::themePrimary('#0071e3', 'dark');

    expect($dark)->toBe('#1a8cff')
        ->and(ThemeSettingController::luminance($dark))
        ->toBeGreaterThan(ThemeSettingController::luminance('#0071e3'));
});

test('light and dark appearance derive from the same base in opposite directions', function () {
    // 同一个基准色：浅色外观向下取、深色外观向上取，因此浅色主色不亮于深色主色。
    foreach (['#0071e3', '#64d2ff', '#999999', '#ff9500'] as $base) {
        $light = ThemeSettingController::themePrimary($base, 'light');
        $dark = ThemeSettingController::themePrimary($base, 'dark');

        expect(ThemeSettingController::luminance($light))
            ->toBeLessThanOrEqual(ThemeSettingController::luminance($dark));
    }
});

test('primary foreground stays white for dark colors', function () {
    Option::set('theme_color', '#0071e3');

    $this->get('/blog')
        ->assertOk()
        ->assertSee('--primary-foreground: #ffffff', false);
});

test('primary foreground adapts to light colors', function () {
    expect(ThemeSettingController::primaryForeground('#ff9500'))->toBe('#0f172a')
        ->and(ThemeSettingController::primaryForeground('#64d2ff'))->toBe('#0f172a')
        ->and(ThemeSettingController::primaryForeground('#34c759'))->toBe('#0f172a')
        ->and(ThemeSettingController::primaryForeground('#0071e3'))->toBe('#ffffff')
        ->and(ThemeSettingController::primaryForeground('#ff375f'))->toBe('#ffffff');
});

test('public pages omit the theme override when not configured', function () {
    Option::set('theme_color', '');

    $this->get('/blog')
        ->assertOk()
        ->assertDontSee('--primary: #', false);
});
