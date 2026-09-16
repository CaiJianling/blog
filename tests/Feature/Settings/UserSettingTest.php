<?php

use App\Models\User;

test('preferences require authentication', function () {
    $this
        ->get(route('user-settings.show'))
        ->assertRedirect(route('login'));

    $this
        ->put(route('user-settings.update'), ['locale' => 'en'])
        ->assertRedirect(route('login'));
});

test('preferences are returned for the current user', function () {
    $user = User::factory()->create(['locale' => 'en', 'effects_enabled' => true]);

    $this
        ->actingAs($user)
        ->get(route('user-settings.show'))
        ->assertOk()
        ->assertJson([
            'locale' => 'en',
            'effectsEnabled' => true,
        ]);
});

test('preferences can be updated', function () {
    $user = User::factory()->create();

    $this
        ->actingAs($user)
        ->put(route('user-settings.update'), [
            'locale' => 'en',
            'effects_enabled' => true,
        ])
        ->assertOk()
        ->assertJson([
            'locale' => 'en',
            'effectsEnabled' => true,
        ]);

    $user->refresh();

    expect($user->locale)->toBe('en');
    expect($user->effects_enabled)->toBeTrue();
});

test('preferences can be partially updated', function () {
    $user = User::factory()->create(['locale' => 'en', 'effects_enabled' => true]);

    $this
        ->actingAs($user)
        ->put(route('user-settings.update'), ['locale' => 'zh'])
        ->assertOk()
        ->assertJson(['locale' => 'zh', 'effectsEnabled' => true]);

    $user->refresh();

    expect($user->locale)->toBe('zh');
    expect($user->effects_enabled)->toBeTrue();
});

test('invalid locale is rejected', function () {
    $user = User::factory()->create();

    $this
        ->actingAs($user)
        ->put(route('user-settings.update'), ['locale' => 'fr'])
        ->assertSessionHasErrors(['locale']);
});
