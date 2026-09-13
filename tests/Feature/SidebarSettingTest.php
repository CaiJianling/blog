<?php

use App\Models\Article;
use App\Models\Attachment;
use App\Models\Option;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
    $this->regular = User::factory()->create(['role' => 'subscriber', 'email_verified_at' => now()]);
});

test('sidebar settings page redirects to merged frontend page', function () {
    Option::set('sidebar_blogger_name', '教主');

    $this->actingAs($this->admin)
        ->get(route('home.edit'))
        ->assertRedirect(route('home.edit'));

    $this->actingAs($this->admin)
        ->get(route('home.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/home')
            ->where('sidebar.sidebar_blogger_name', '教主')
            ->where('sidebar.sidebar_menus', []),
        );
});

test('admin can save sidebar settings with menus', function () {
    $response = $this->actingAs($this->admin)
        ->put(route('sidebar.update'), [
            'sidebar_blogger_name' => '教主 ica',
            'sidebar_blogger_intro' => '信吾者，得永生',
            'menus' => [
                ['name' => '友链', 'url' => '/links'],
                ['name' => 'GitHub', 'url' => 'https://github.com/example'],
            ],
        ]);

    dump('loc: '.$response->headers->get('Location').' status: '.$response->getStatusCode());
    dump('saved: '.Option::get('sidebar_blogger_name'));

    expect(Option::get('sidebar_blogger_name'))->toBe('教主 ica')
        ->and(Option::get('sidebar_blogger_intro'))->toBe('信吾者，得永生');

    $menus = json_decode((string) Option::get('sidebar_menus'), true);

    expect($menus)->toBe([
        ['name' => '友链', 'url' => '/links'],
        ['name' => 'GitHub', 'url' => 'https://github.com/example'],
    ]);
});

test('menu entries require name and url', function () {
    $this->actingAs($this->admin)
        ->put(route('sidebar.update'), [
            'menus' => [
                ['name' => '', 'url' => ''],
            ],
        ])
        ->assertSessionHasErrors(['menus.0.name', 'menus.0.url']);
});

test('admin can upload and remove blogger avatar', function () {
    Storage::fake('public');

    $file = UploadedFile::fake()->image('blogger.png', 200, 200);

    $response = $this->actingAs($this->admin)
        ->postJson(route('sidebar.avatar.store'), ['file' => $file]);

    $response->assertOk()->assertJsonStructure(['id', 'url']);

    expect(Option::get('sidebar_blogger_avatar'))->toBe((string) Attachment::first()->id);

    $this->actingAs($this->admin)
        ->delete(route('sidebar.avatar.destroy'))
        ->assertRedirect();

    expect(Option::get('sidebar_blogger_avatar'))->toBe('');
});

test('non-admin cannot view or update sidebar settings', function () {
    $this->actingAs($this->regular)
        ->get(route('home.edit'))
        ->assertRedirect(route('home.edit'));

    $this->actingAs($this->regular)
        ->put(route('sidebar.update'), ['sidebar_blogger_name' => 'hack'])
        ->assertRedirect(route('dashboard'));

    expect(Option::get('sidebar_blogger_name', ''))->toBe('');
});

test('blog index provides sidebar payload with blogger info stats and menus', function () {
    $author = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);

    Article::create([
        'author_id' => $author->id,
        'title' => '测试文章',
        'slug' => 'test-post',
        'excerpt' => '摘要',
        'content' => [],
        'status' => 'publish',
        'views' => 123,
        'comment_count' => 4,
    ]);

    Option::set('sidebar_blogger_name', '教主 ica');
    Option::set('sidebar_blogger_intro', '信吾者，得永生');
    Option::set('sidebar_menus', json_encode([
        ['name' => '友链', 'url' => '/links'],
        ['name' => 'GitHub', 'url' => 'https://github.com/example'],
    ], JSON_UNESCAPED_UNICODE));

    $this->get('/blog')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Blog/Index')
            ->where('sidebar.blogger.name', '教主 ica')
            ->where('sidebar.blogger.intro', '信吾者，得永生')
            ->where('sidebar.blogger.avatar_url', null)
            ->where('sidebar.stats.articles', 1)
            ->where('sidebar.stats.views', 123)
            ->where('sidebar.stats.comments', 4)
            ->has('sidebar.menus', 2)
            ->where('sidebar.menus.0.name', '友链')
            ->where('sidebar.menus.1.url', 'https://github.com/example'),
        );
});

test('blog index sidebar defaults when nothing configured', function () {
    $this->get('/blog')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Blog/Index')
            ->where('sidebar.blogger.name', '博主')
            ->has('sidebar.menus', 0),
        );
});
