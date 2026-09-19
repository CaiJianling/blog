<?php

use App\Models\Option;
use App\Models\User;
use App\Services\CaptchaService;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia;

beforeEach(function () {
    $this->user = User::factory()->create([
        'email' => 'captcha-user@example.com',
        'password' => Hash::make('secret1234'),
    ]);
});

/** 在会话中预置一个已知答案的验证码（expiresDeltaMinutes 为负表示已过期）。 */
function seedLoginCaptcha(string $code, int $expiresDeltaMinutes = 5): void
{
    session()->put('login_captcha', [
        'hash' => hash('sha256', strtolower($code)),
        'expires' => now()->addMinutes($expiresDeltaMinutes)->timestamp,
    ]);
}

test('captcha endpoint returns 404 when disabled', function () {
    Option::set('login_captcha_enabled', '0');

    $this->get(route('captcha.show'))
        ->assertNotFound();
});

test('login page reflects the captcha enabled flag', function () {
    Option::set('login_captcha_enabled', '1');

    $this->get(route('login'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->where('captchaEnabled', true));

    Option::set('login_captcha_enabled', '0');

    $this->get(route('login'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->where('captchaEnabled', false));
});

test('captcha endpoint returns png and stores the answer when enabled', function () {
    Option::set('login_captcha_enabled', '1');
    Option::set('login_captcha_complexity', 'medium');

    $response = $this->get(route('captcha.show'));

    $response->assertOk()
        ->assertHeader('Content-Type', 'image/png');

    $bytes = $response->getContent();

    expect(str_starts_with((string) $bytes, "\x89PNG"))->toBeTrue()
        ->and(session('login_captcha.hash'))->not->toBeNull()
        ->and(session('login_captcha.expires'))->toBeGreaterThan(now()->timestamp);
});

test('login proceeds without captcha when the feature is disabled', function () {
    Option::set('login_captcha_enabled', '0');

    $this->post(route('login'), ['email' => '', 'password' => ''])
        ->assertSessionHasErrors(['email'])
        ->assertSessionDoesntHaveErrors(['captcha']);
});

test('login requires the captcha when enabled', function () {
    Option::set('login_captcha_enabled', '1');

    $this->post(route('login'), ['email' => 'someone@example.com', 'password' => 'whatever'])
        ->assertSessionHasErrors(['captcha']);

    $this->assertGuest();
});

test('login rejects a wrong captcha', function () {
    Option::set('login_captcha_enabled', '1');
    seedLoginCaptcha('abcd7');

    $this->post(route('login'), ['email' => $this->user->email, 'password' => 'secret1234', 'captcha' => 'zzz12'])
        ->assertSessionHasErrors(['captcha']);

    $this->assertGuest();
});

test('correct captcha passes but credentials are still validated', function () {
    Option::set('login_captcha_enabled', '1');
    seedLoginCaptcha('abcd7');

    $this->post(route('login'), ['email' => $this->user->email, 'password' => 'wrong-pass', 'captcha' => 'ABCD7'])
        ->assertSessionDoesntHaveErrors(['captcha'])
        ->assertSessionHasErrors(['email']);
});

test('correct captcha and credentials log the user in', function () {
    Option::set('login_captcha_enabled', '1');
    seedLoginCaptcha('abcd7');

    $this->post(route('login'), ['email' => $this->user->email, 'password' => 'secret1234', 'captcha' => 'ABCD7'])
        ->assertRedirect();

    $this->assertAuthenticatedAs($this->user);
});

test('captcha is consumed per attempt and cannot be replayed', function () {
    Option::set('login_captcha_enabled', '1');
    seedLoginCaptcha('abcd7');

    // 第一次：验证码正确但密码错误（验证码被消费）
    $this->post(route('login'), ['email' => $this->user->email, 'password' => 'wrong-pass', 'captcha' => 'abcd7'])
        ->assertSessionDoesntHaveErrors(['captcha']);

    // 第二次：重放同一验证码 → 失败
    $this->post(route('login'), ['email' => $this->user->email, 'password' => 'secret1234', 'captcha' => 'abcd7'])
        ->assertSessionHasErrors(['captcha']);

    $this->assertGuest();
});

test('expired captcha fails even with the right answer', function () {
    Option::set('login_captcha_enabled', '1');
    seedLoginCaptcha('abcd7', -1);

    $this->post(route('login'), ['email' => $this->user->email, 'password' => 'secret1234', 'captcha' => 'abcd7'])
        ->assertSessionHasErrors(['captcha']);

    $this->assertGuest();
});

test('captcha service builds codes with per-complexity length and charset', function () {
    $service = new CaptchaService;

    expect(strlen($service->buildCode('easy')))->toBe(4)
        ->and(strlen($service->buildCode('medium')))->toBe(4)
        ->and(strlen($service->buildCode('hard')))->toBe(5)
        ->and($service->buildCode('hard'))
        ->toMatch('/^[23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ]{5}$/')
        // 非法复杂程度回退 medium（4 位）
        ->and(strlen($service->buildCode('bogus')))->toBe(4);
});

test('captcha service generates a valid png with a session answer', function () {
    Option::set('login_captcha_complexity', 'hard');

    $bytes = (new CaptchaService)->generate();

    expect(str_starts_with($bytes, "\x89PNG"))->toBeTrue()
        ->and(session('login_captcha.hash'))->not->toBeNull();
});

test('admin can toggle login captcha and complexity in site settings', function () {
    $admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);

    $this->actingAs($admin)
        ->put(route('site.update'), [
            'site_title' => 'My Blog',
            'site_tagline' => 'A blog',
            'seo_description' => 'desc',
            'seo_keywords' => 'kw',
            'site_icon' => '',
            'cms_url' => 'https://example.com/admin',
            'site_url' => 'https://example.com',
            'admin_email' => 'admin@example.com',
            'membership' => '0',
            'login_captcha_enabled' => '1',
            'login_captcha_complexity' => 'hard',
            'default_role' => 'author',
            'site_language' => 'en',
            'timezone' => 'Asia/Shanghai',
            'date_format' => 'Y-m-d',
            'time_format' => 'H:i',
            'start_of_week' => '0',
        ])
        ->assertRedirect(route('site.edit'));

    expect(Option::get('login_captcha_enabled'))->toBe('1')
        ->and(Option::get('login_captcha_complexity'))->toBe('hard');
});

test('invalid captcha complexity falls back to medium when saving site settings', function () {
    $admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);

    $this->actingAs($admin)
        ->put(route('site.update'), [
            'site_title' => 'My Blog',
            'site_icon' => '',
            'cms_url' => 'https://example.com/admin',
            'site_url' => 'https://example.com',
            'admin_email' => 'admin@example.com',
            'login_captcha_enabled' => '1',
            'login_captcha_complexity' => 'extreme',
            'default_role' => 'author',
            'site_language' => 'en',
            'timezone' => 'Asia/Shanghai',
            'date_format' => 'Y-m-d',
            'time_format' => 'H:i',
            'start_of_week' => '0',
        ])
        ->assertRedirect(route('site.edit'));

    expect(Option::get('login_captcha_complexity'))->toBe(CaptchaService::COMPLEXITY_MEDIUM);
});
