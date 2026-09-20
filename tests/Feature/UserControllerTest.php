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

// 用户管理的新建 / 编辑 / 详情均在用户列表页的 Dialog 内完成（POST/PUT），
// 无独立 Inertia 页面。直接访问这些资源 GET 路由时须回落列表，而非 500。
test('users create route redirects to the index', function () {
    $admin = User::factory()->create(['role' => 'administrator']);

    $this->actingAs($admin)->get(route('users.create'))
        ->assertRedirect(route('users.index'));
});

test('users edit route redirects to the index', function () {
    $admin = User::factory()->create(['role' => 'administrator']);
    $target = User::factory()->create();

    $this->actingAs($admin)->get(route('users.edit', $target))
        ->assertRedirect(route('users.index'));
});

test('users show route redirects to the index', function () {
    $admin = User::factory()->create(['role' => 'administrator']);
    $target = User::factory()->create();

    $this->actingAs($admin)->get(route('users.show', $target))
        ->assertRedirect(route('users.index'));
});
