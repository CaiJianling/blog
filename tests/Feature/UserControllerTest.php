<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('admin can create a user with valid data', function () {
    $admin = User::factory()->create(['role' => 'administrator']);

    $response = $this->actingAs($admin)->post(route('users.store'), [
        'name' => 'New User',
        'email' => 'newuser@example.com',
        'password' => 'password123',
        'role' => 'subscriber',
        'is_active' => true,
    ]);

    $response->assertRedirect(route('users.index'));
    expect(User::where('email', 'newuser@example.com')->exists())->toBeTrue();
});

test('store returns validation error when password is shorter than 8 characters', function () {
    $admin = User::factory()->create(['role' => 'administrator']);

    $response = $this->actingAs($admin)->post(route('users.store'), [
        'name' => 'New User',
        'email' => 'newuser@example.com',
        'password' => 'short',
        'role' => 'subscriber',
        'is_active' => true,
    ]);

    $response->assertSessionHasErrors(['password']);
});

test('validation errors are translated according to the locale cookie', function () {
    $admin = User::factory()->create(['role' => 'administrator']);

    $response = $this->actingAs($admin)->withUnencryptedCookie('locale', 'zh')->post(route('users.store'), [
        'name' => 'New User',
        'email' => 'newuser@example.com',
        'password' => 'short',
        'role' => 'subscriber',
        'is_active' => true,
    ]);

    expect(app()->getLocale())->toBe('zh');

    $response->assertSessionHasErrors([
        'password' => '密码至少需要 8 个字符。',
    ]);
});

test('non admin users cannot access user store route', function () {
    $user = User::factory()->create(['role' => 'subscriber']);

    $response = $this->actingAs($user)->post(route('users.store'), [
        'name' => 'New User',
        'email' => 'newuser@example.com',
        'password' => 'password123',
        'role' => 'subscriber',
        'is_active' => true,
    ]);

    $response->assertRedirect(route('dashboard'));
});
