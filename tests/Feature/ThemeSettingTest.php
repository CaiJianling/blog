<?php

use App\Http\Controllers\ThemeSettingController;
use App\Models\Attachment;
use App\Models\Option;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
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

test('theme settings page renders background settings', function () {
    Option::set('page_background_mode', 'custom');
    Option::set('page_background_opacity', '60');

    $this->actingAs($this->admin)
        ->get(route('theme.edit'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('background')
            ->where('background.mode', 'custom')
            ->where('background.opacity', 60)
            ->where('background.url', null)
            ->where('background.customUrl', null)
        );
});

test('admin can save background mode and opacity', function () {
    $this->actingAs($this->admin)
        ->put(route('theme.update'), ['background_mode' => 'custom', 'background_opacity' => 55])
        ->assertRedirect(route('theme.edit'));

    expect(Option::get('page_background_mode'))->toBe('custom')
        ->and(Option::get('page_background_opacity'))->toBe('55');

    // 空模式 = 不使用壁纸
    $this->actingAs($this->admin)
        ->put(route('theme.update'), ['background_mode' => '', 'background_opacity' => 100])
        ->assertRedirect(route('theme.edit'));

    expect(Option::get('page_background_mode'))->toBe('');
});

test('background mode and opacity validate strictly', function () {
    $this->actingAs($this->admin)
        ->put(route('theme.update'), ['background_mode' => 'weird'])
        ->assertSessionHasErrors(['background_mode']);

    $this->actingAs($this->admin)
        ->put(route('theme.update'), ['background_opacity' => 150])
        ->assertSessionHasErrors(['background_opacity']);

    expect(Option::get('page_background_mode', ''))->toBe('');
});

test('uploading a wallpaper replaces and deletes the previous stored one', function () {
    Storage::fake('public');

    $first = $this->actingAs($this->admin)
        ->postJson(route('theme.background.store'), ['file' => UploadedFile::fake()->image('w1.jpg', 100, 100)])
        ->assertOk()
        ->assertJsonStructure(['id', 'url']);

    $firstId = $first->json('id');
    $firstPath = Attachment::find($firstId)->file_path;

    expect(Storage::disk('public')->exists($firstPath))->toBeTrue()
        ->and(Option::get('page_background_mode'))->toBe('custom');

    // 更换：第二张上传后第一张（文件 + 记录）被删除
    $second = $this->actingAs($this->admin)
        ->postJson(route('theme.background.store'), ['file' => UploadedFile::fake()->image('w2.jpg', 100, 100)])
        ->assertOk();

    expect($second->json('id'))->not->toBe($firstId)
        ->and(Attachment::where('parent_type', 'page_background_custom')->count())->toBe(1)
        ->and(Storage::disk('public')->exists($firstPath))->toBeFalse();
});

test('removing the wallpaper deletes the stored file and resets mode', function () {
    Storage::fake('public');

    $this->actingAs($this->admin)
        ->postJson(route('theme.background.store'), ['file' => UploadedFile::fake()->image('w.jpg', 100, 100)])
        ->assertOk();

    $path = Attachment::where('parent_type', 'page_background_custom')->first()->file_path;

    $this->actingAs($this->admin)
        ->deleteJson(route('theme.background.destroy'))
        ->assertOk();

    expect(Attachment::where('parent_type', 'page_background_custom')->count())->toBe(0)
        ->and(Storage::disk('public')->exists($path))->toBeFalse()
        ->and(Option::get('page_background_mode'))->toBe('');
});

test('switching away from custom mode deletes the stored wallpaper', function () {
    Storage::fake('public');

    $this->actingAs($this->admin)
        ->postJson(route('theme.background.store'), ['file' => UploadedFile::fake()->image('w.jpg', 100, 100)])
        ->assertOk();

    $path = Attachment::where('parent_type', 'page_background_custom')->first()->file_path;

    // 切到必应模式（Http::fake 必应接口），自定义壁纸应被删除
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');

    Http::fake([
        '*HPImageArchive*' => Http::response(['images' => [['url' => '/th?id=OHR.Test_1920x1080.jpg']]]),
        '*th?id=*' => Http::response($png, 200, ['Content-Type' => 'image/png']),
    ]);

    $this->actingAs($this->admin)
        ->put(route('theme.update'), ['background_mode' => 'bing'])
        ->assertRedirect(route('theme.edit'));

    expect(Attachment::where('parent_type', 'page_background_custom')->count())->toBe(0)
        ->and(Storage::disk('public')->exists($path))->toBeFalse()
        ->and(Option::get('page_background_mode'))->toBe('bing');
});

test('bing mode fetches the daily wallpaper and refresh deletes the previous one', function () {
    Storage::fake('public');

    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');

    Http::fake([
        '*HPImageArchive*' => Http::response(['images' => [['url' => '/th?id=OHR.Test_1920x1080.jpg']]]),
        '*th?id=*' => Http::response($png, 200, ['Content-Type' => 'image/png']),
    ]);

    $this->actingAs($this->admin)
        ->put(route('theme.update'), ['background_mode' => 'bing'])
        ->assertRedirect(route('theme.edit'));

    $first = Attachment::where('parent_type', 'page_background_bing')->first();

    expect($first)->not->toBeNull()
        ->and(Option::get('page_background_mode'))->toBe('bing')
        ->and(Option::get('page_background_bing_date'))->toBe(now()->toDateString());

    // 次日刷新：上一张必应壁纸（文件 + 记录）被删除，新壁纸替换
    Option::set('page_background_bing_date', now()->subDay()->toDateString());

    $this->actingAs($this->admin)
        ->put(route('theme.update'), ['background_mode' => 'bing'])
        ->assertRedirect(route('theme.edit'));

    expect(Attachment::where('parent_type', 'page_background_bing')->count())->toBe(1)
        ->and(Attachment::where('parent_type', 'page_background_bing')->first()->id)->not->toBe($first->id)
        ->and(Storage::disk('public')->exists($first->file_path))->toBeFalse();
});

test('public pages share pageBackground props for the wallpaper layer', function () {
    Option::set('page_background_mode', '');
    Option::set('page_background_opacity', '35');

    $this->get('/blog')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('pageBackground')
            ->where('pageBackground.mode', '')
            ->where('pageBackground.opacity', 35)
            ->where('pageBackground.url', null)
        );
});

test('theme settings page renders default glass frost with fallback when unset', function () {
    $this->actingAs($this->admin)
        ->get(route('theme.edit'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('defaultGlassFrost', ThemeSettingController::DEFAULT_GLASS_FROST),
        );
});

test('theme settings page reflects a saved default glass frost value', function () {
    Option::set('default_glass_frost', '30');

    $this->actingAs($this->admin)
        ->get(route('theme.edit'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('defaultGlassFrost', 30),
        );
});

test('admin can save the default glass frost value', function () {
    $this->actingAs($this->admin)
        ->put(route('theme.update'), ['theme_color' => '', 'default_glass_frost' => 75])
        ->assertRedirect(route('theme.edit'));

    expect(Option::get('default_glass_frost'))->toBe('75');
});

test('default glass frost out of range fails validation', function () {
    $this->actingAs($this->admin)
        ->put(route('theme.update'), ['theme_color' => '', 'default_glass_frost' => 150])
        ->assertSessionHasErrors(['default_glass_frost']);

    expect(Option::get('default_glass_frost', ''))->toBe('');
});

test('public pages share the default glass frost in the theme prop', function () {
    Option::set('default_glass_frost', '40');

    $this->get('/blog')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('theme.defaultGlassFrost', 40),
        );
});
