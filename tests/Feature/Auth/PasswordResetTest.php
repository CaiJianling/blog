<?php

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Notification;
use Laravel\Fortify\Features;

beforeEach(function () {
    $this->skipUnlessFortifyHas(Features::resetPasswords());
});

test('reset password link screen can be rendered', function () {
    $response = $this->get(route('password.request'));

    $response->assertOk();
});

test('reset password link can be requested', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post(route('password.email'), ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPassword::class);
});

test('reset password screen can be rendered', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post(route('password.email'), ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPassword::class, function ($notification) {
        $response = $this->get(route('password.reset', $notification->token));

        $response->assertOk();

        return true;
    });
});

test('password can be reset with valid token', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post(route('password.email'), ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPassword::class, function ($notification) use ($user) {
        $response = $this->post(route('password.update'), [
            'token' => $notification->token,
            'email' => $user->email,
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('login'));

        return true;
    });
});

test('password cannot be reset with invalid token', function () {
    $user = User::factory()->create();

    $response = $this->post(route('password.update'), [
        'token' => 'invalid-token',
        'email' => $user->email,
        'password' => 'newpassword123',
        'password_confirmation' => 'newpassword123',
    ]);

    $response->assertSessionHasErrors('email');
});

test('reset password link status is localized to chinese', function () {
    Notification::fake();

    $user = User::factory()->create();

    // 前端通过 document.cookie 写入明文 locale，故使用 withUnencryptedCookie
    $response = $this->withUnencryptedCookie('locale', 'zh')
        ->post(route('password.email'), ['email' => $user->email]);

    $response->assertSessionHas('status', '我们已将密码重置链接发送到您的邮箱。');
});

test('reset password success status is localized to chinese', function () {
    Notification::fake();

    $user = User::factory()->create();

    $this->post(route('password.email'), ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPassword::class, function ($notification) use ($user) {
        // 前端通过 document.cookie 写入明文 locale，故使用 withUnencryptedCookie
        $response = $this->withUnencryptedCookie('locale', 'zh')
            ->post(route('password.update'), [
                'token' => $notification->token,
                'email' => $user->email,
                'password' => 'password',
                'password_confirmation' => 'password',
            ]);

        $response
            ->assertRedirect(route('login'))
            ->assertSessionHas('status', '您的密码已重置。');

        return true;
    });
});

test('login errors are localized to chinese', function () {
    $this->withUnencryptedCookie('locale', 'zh')
        ->post(route('login'), [
            'email' => 'nobody@example.com',
            'password' => 'wrong-password',
        ])
        ->assertSessionHasErrors(['email' => '邮箱或密码错误。']);
});
