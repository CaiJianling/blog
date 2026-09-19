<?php

use App\Models\Option;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Inertia\Testing\AssertableInertia;

beforeEach(function () {
    // 关闭登录验证码，隔离注册/邮箱相关断言
    Option::set('login_captcha_enabled', '0');
});

function registerPayload(string $email): array
{
    return [
        'name' => '测试用户',
        'email' => $email,
        'password' => 'password',
        'password_confirmation' => 'password',
    ];
}

// ---- 注册验证码 ----

test('register view exposes captcha props when register captcha is enabled', function () {
    Option::set('register_captcha_enabled', '1');
    Option::set('register_captcha_type', 'math');

    $this->get(route('register'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('captchaEnabled', true)
            ->where('captcha.type', 'math'),
        );
});

test('register view omits captcha props when register captcha is disabled', function () {
    Option::set('register_captcha_enabled', '0');

    $this->get(route('register'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('captchaEnabled', false)
            ->where('captcha', null),
        );
});

test('registration requires a valid math captcha when enabled', function () {
    Option::set('register_captcha_enabled', '1');
    Option::set('register_captcha_type', 'math');

    // 未提供验证码 → 校验失败，账号未创建
    $this->postJson(route('register.store'), registerPayload('bad@example.com'))
        ->assertJsonValidationErrors(['captcha']);
    expect(User::where('email', 'bad@example.com')->exists())->toBeFalse();

    // 答案不匹配 token → 校验失败
    $token = Crypt::encrypt(['answer' => 10, 'expires' => Carbon::now()->addMinutes(10)->getTimestamp()]);
    $this->postJson(route('register.store'), registerPayload('bad2@example.com') + [
        'captcha_answer' => 999,
        'captcha_token' => $token,
    ])->assertJsonValidationErrors(['captcha']);
    expect(User::where('email', 'bad2@example.com')->exists())->toBeFalse();
});

test('registration succeeds with the correct math captcha answer', function () {
    Option::set('register_captcha_enabled', '1');
    Option::set('register_captcha_type', 'math');

    $token = Crypt::encrypt(['answer' => 42, 'expires' => Carbon::now()->addMinutes(10)->getTimestamp()]);

    $this->postJson(route('register.store'), registerPayload('ok@example.com') + [
        'captcha_answer' => 42,
        'captcha_token' => $token,
    ])->assertRedirect();

    expect(User::where('email', 'ok@example.com')->exists())->toBeTrue();
});

test('registration proceeds without captcha when it is disabled', function () {
    Option::set('register_captcha_enabled', '0');

    $this->postJson(route('register.store'), registerPayload('plain@example.com'))
        ->assertRedirect();

    expect(User::where('email', 'plain@example.com')->exists())->toBeTrue();
});

// ---- 注册后须验证邮箱才能登录 ----

test('unverified user is blocked from login when email verification is required', function () {
    Option::set('require_email_verification', '1');
    $user = User::factory()->create(['email_verified_at' => null]);

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])
        ->assertSessionHasErrors(['email']);

    expect(auth()->check())->toBeFalse();
});

test('unverified user can log in when email verification is not required', function () {
    Option::set('require_email_verification', '0');
    $user = User::factory()->create(['email_verified_at' => null]);

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])
        ->assertRedirect(route('dashboard'));

    expect(auth()->check())->toBeTrue();
});

test('verified user can log in even when email verification is required', function () {
    Option::set('require_email_verification', '1');
    $user = User::factory()->create(['email_verified_at' => Carbon::now()]);

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])
        ->assertRedirect(route('dashboard'));

    expect(auth()->check())->toBeTrue();
});
