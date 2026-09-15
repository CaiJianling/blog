<?php

use App\Models\Option;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
    $this->regular = User::factory()->create(['role' => 'subscriber', 'email_verified_at' => now()]);
});

test('footer settings page redirects to merged frontend page', function () {
    $this->actingAs($this->admin)
        ->get(route('footer.edit'))
        ->assertRedirect(route('home.edit'));

    $this->actingAs($this->admin)
        ->get(route('home.edit'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('footer.resources', 3)
            ->where('footer.resources.0.name', 'GitHub')
            ->has('footer.contacts', 3)
            ->where('footer.contacts.2.url', 'mailto:hello@example.com')
            ->where('footer.icp_markdown', ''),
        );
});

test('admin can save footer resources and contacts', function () {
    $this->actingAs($this->admin)
        ->put(route('footer.update'), [
            'resources' => [
                ['name' => 'Laravel', 'url' => 'https://laravel.com'],
                ['name' => '文档', 'url' => '/docs'],
            ],
            'contacts' => [
                ['name' => '邮箱', 'url' => 'mailto:me@example.com'],
            ],
            'icp_markdown' => '[京ICP备12345678号](https://beian.miit.gov.cn/)',
        ])
        ->assertRedirect();

    $resources = json_decode((string) Option::get('footer_resources'), true);
    $contacts = json_decode((string) Option::get('footer_contacts'), true);
    $icp = (string) Option::get('footer_icp_markdown');

    expect($resources)->toBe([
        ['name' => 'Laravel', 'url' => 'https://laravel.com'],
        ['name' => '文档', 'url' => '/docs'],
    ])->and($contacts)->toBe([
        ['name' => '邮箱', 'url' => 'mailto:me@example.com'],
    ])->and($icp)->toBe('[京ICP备12345678号](https://beian.miit.gov.cn/)');
});

test('footer entries require name and url', function () {
    $this->actingAs($this->admin)
        ->put(route('footer.update'), [
            'resources' => [['name' => '', 'url' => '']],
        ])
        ->assertSessionHasErrors(['resources.0.name', 'resources.0.url']);
});

test('non-admin cannot view or update footer settings', function () {
    $this->actingAs($this->regular)
        ->get(route('home.edit'))
        ->assertRedirect(route('dashboard'));

    $this->actingAs($this->regular)
        ->put(route('footer.update'), ['resources' => []])
        ->assertRedirect(route('dashboard'));

    expect(Option::get('footer_resources', ''))->toBe('');
});

test('public pages share configured footer links', function () {
    Option::set('footer_resources', json_encode([
        ['name' => '自定义资源', 'url' => 'https://example.com/res'],
    ], JSON_UNESCAPED_UNICODE));
    Option::set('footer_contacts', json_encode([
        ['name' => '邮箱联系', 'url' => 'mailto:blog@example.com'],
    ], JSON_UNESCAPED_UNICODE));
    Option::set('footer_icp_markdown', '[粤ICP备88888888号](https://beian.miit.gov.cn/)');

    $this->get('/blog')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('footer.resources.0.name', '自定义资源')
            ->where('footer.resources.0.url', 'https://example.com/res')
            ->where('footer.contacts.0.name', '邮箱联系')
            ->where('footer.contacts.0.url', 'mailto:blog@example.com')
            ->where('footer.icp_markdown', '[粤ICP备88888888号](https://beian.miit.gov.cn/)'),
        );
});

test('public pages use default footer links when not configured', function () {
    Option::set('footer_resources', '');
    Option::set('footer_contacts', '');
    Option::set('footer_icp_markdown', '');

    $this->get('/blog')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('footer.resources', 3)
            ->where('footer.resources.0.name', 'GitHub')
            ->has('footer.contacts', 3)
            ->where('footer.icp_markdown', ''),
        );
});
