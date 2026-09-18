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
    $user = User::factory()->create([
        'locale' => 'en',
        'effects_enabled' => true,
        'filter_saturation' => 140,
        'filter_brightness' => 60,
    ]);

    $this
        ->actingAs($user)
        ->get(route('user-settings.show'))
        ->assertOk()
        ->assertJson([
            'locale' => 'en',
            'effectsEnabled' => true,
            'filterSaturation' => 140,
            'filterBrightness' => 60,
        ]);
});

test('preferences can be updated', function () {
    $user = User::factory()->create();

    $this
        ->actingAs($user)
        ->put(route('user-settings.update'), [
            'locale' => 'en',
            'effects_enabled' => true,
            'filter_saturation' => 140,
            'filter_brightness' => 60,
        ])
        ->assertOk()
        ->assertJson([
            'locale' => 'en',
            'effectsEnabled' => true,
            'filterSaturation' => 140,
            'filterBrightness' => 60,
        ]);

    $user->refresh();

    expect($user->locale)->toBe('en');
    expect($user->effects_enabled)->toBeTrue();
    expect($user->filter_saturation)->toBe(140);
    expect($user->filter_brightness)->toBe(60);
});

test('preferences can be partially updated', function () {
    $user = User::factory()->create(['locale' => 'en', 'effects_enabled' => true]);

    $this
        ->actingAs($user)
        ->put(route('user-settings.update'), ['locale' => 'zh'])
        ->assertOk()
        ->assertJson([
            'locale' => 'zh',
            'effectsEnabled' => true,
            'filterSaturation' => 100,
            'filterBrightness' => 100,
        ]);

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

test('out of range filter values are rejected', function () {
    $user = User::factory()->create();

    $this
        ->actingAs($user)
        ->put(route('user-settings.update'), ['filter_saturation' => 300])
        ->assertSessionHasErrors(['filter_saturation']);

    $this
        ->actingAs($user)
        ->put(route('user-settings.update'), ['filter_brightness' => 10])
        ->assertSessionHasErrors(['filter_brightness']);
});
