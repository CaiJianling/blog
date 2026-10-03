<?php

use App\Actions\Fortify\CreateNewUser;
use App\Models\Option;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
    $this->regular = User::factory()->create(['role' => 'subscriber', 'email_verified_at' => now()]);
});

test('admin can view site settings page', function () {
    $response = $this
        ->actingAs($this->admin)
        ->get(route('site.edit'));

    $response
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('site-settings')
            ->has('options')
            ->has('site_icon')
            ->has('roles')
            ->has('languages')
            ->has('timezones')
            ->has('weekdays')
            ->has('dateFormats')
            ->has('timeFormats'),
        );
});

test('non-admin cannot view site settings page', function () {
    $response = $this
        ->actingAs($this->regular)
        ->get(route('site.edit'));

    $response->assertRedirect(route('dashboard'));
});

test('admin can update site settings', function () {
    $this
        ->actingAs($this->admin)
        ->put(route('site.update'), [
            'site_title' => 'My New Blog',
            'site_tagline' => 'A new description',
            'site_icon' => '',
            'cms_url' => 'https://example.com/admin',
            'site_url' => 'https://example.com',
            'admin_email' => 'admin@example.com',
            'membership' => '1',
            'default_role' => 'author',
            'site_language' => 'en',
            'timezone' => 'Asia/Tokyo',
            'date_format' => 'Y-m-d',
            'time_format' => 'H:i',
            'start_of_week' => '0',
        ]);

    expect(Option::get('site_title'))->toBe('My New Blog');
    expect(Option::get('site_tagline'))->toBe('A new description');
    expect(Option::get('membership'))->toBe('1');
    expect(Option::get('default_role'))->toBe('author');
    expect(Option::get('site_language'))->toBe('en');
    expect(Option::get('timezone'))->toBe('Asia/Tokyo');
    expect(Option::get('date_format'))->toBe('Y-m-d');
    expect(Option::get('time_format'))->toBe('H:i');
    expect(Option::get('start_of_week'))->toBe('0');
});

test('site settings validation requires required fields', function () {
    $this
        ->actingAs($this->admin)
        ->put(route('site.update'), [
            'site_title' => '',
            'cms_url' => '',
            'site_url' => '',
            'admin_email' => '',
            'default_role' => '',
            'site_language' => '',
            'timezone' => '',
            'date_format' => '',
            'time_format' => '',
            'start_of_week' => '',
        ])
        ->assertSessionHasErrors([
            'site_title',
            'cms_url',
            'site_url',
            'admin_email',
            'default_role',
            'site_language',
            'timezone',
            'date_format',
            'time_format',
            'start_of_week',
        ]);
});

test('option model get returns default when not found', function () {
    expect(Option::get('non_existent_key', 'default'))->toBe('default');
    expect(Option::get('non_existent_key'))->toBeNull();
});

test('option model set creates or updates options', function () {
    Option::set('test_option', 'test_value');
    expect(Option::get('test_option'))->toBe('test_value');

    Option::set('test_option', 'updated_value');
    expect(Option::get('test_option'))->toBe('updated_value');

    expect(Option::where('option_name', 'test_option')->count())->toBe(1);
});

test('option model getMany returns multiple options', function () {
    Option::set('option_a', 'value_a');
    Option::set('option_b', 'value_b');

    $options = Option::getMany(['option_a', 'option_b', 'non_existent']);

    expect($options)->toHaveKeys(['option_a', 'option_b']);
    expect($options['option_a'])->toBe('value_a');
    expect($options['option_b'])->toBe('value_b');
});

test('nickname defaults to name on registration', function () {
    $action = new CreateNewUser;
    $user = $action->create([
        'name' => 'Test User',
        'nickname' => '',
        'email' => 'test@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ]);

    expect($user->nickname)->toBe('Test User');
});

test('nickname can be set differently from name', function () {
    $user = User::create([
        'name' => 'Real Name',
        'nickname' => 'CoolNick',
        'email' => 'test2@example.com',
        'password' => bcrypt('password'),
        'role' => 'subscriber',
    ]);

    expect($user->nickname)->toBe('CoolNick');
    expect($user->name)->toBe('Real Name');
});

test('default options are seeded with migration', function () {
    expect(Option::get('site_title'))->not->toBeNull();
    expect(Option::get('default_role'))->toBe('subscriber');
    expect(Option::get('timezone'))->toBe('Asia/Shanghai');
    expect(Option::get('date_format'))->toBe('Y年n月j日');
    expect(Option::get('membership'))->toBe('0');
});
