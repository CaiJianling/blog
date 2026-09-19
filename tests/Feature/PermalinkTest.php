<?php

use App\Models\Article;
use App\Models\Comment;
use App\Models\Option;
use App\Models\Page;
use App\Models\User;
use App\Services\PermalinkService;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
    $this->regular = User::factory()->create(['role' => 'subscriber', 'email_verified_at' => now()]);
});

test('admin can view permalink settings page', function () {
    $response = $this
        ->actingAs($this->admin)
        ->get(route('permalink.edit'));

    $response
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/permalink')
            ->has('structure')
            ->has('preset')
            ->has('categoryBase')
            ->has('tagBase')
            ->has('presets')
            ->has('tags'),
        );
});

test('non-admin cannot view permalink settings page', function () {
    $this
        ->actingAs($this->regular)
        ->get(route('permalink.edit'))
        ->assertRedirect(route('dashboard'));
});

test('admin can update permalink settings', function () {
    $this
        ->actingAs($this->admin)
        ->put(route('permalink.update'), [
            'preset' => 'postname',
            'category_base' => 'topics',
            'tag_base' => 'labels',
        ]);

    expect(Option::get('permalink_structure'))->toBe('/%postname%/')
        ->and(Option::get('category_base'))->toBe('topics')
        ->and(Option::get('tag_base'))->toBe('labels');
});

test('custom structure requires a tag', function () {
    $response = $this
        ->actingAs($this->admin)
        ->from(route('permalink.edit'))
        ->put(route('permalink.update'), [
            'preset' => 'custom',
            'custom_structure' => '/static/',
        ]);

    $response->assertSessionHasErrors('custom_structure');
});

test('article path and resolution use the configured structure', function () {
    Option::set('permalink_structure', '/%post_id%.html');

    $article = Article::create([
        'author_id' => $this->admin->id,
        'title' => 'Hello World',
        'slug' => 'hello-world',
        'content' => [],
        'excerpt' => '',
        'status' => 'publish',
    ]);

    $service = app(PermalinkService::class);

    expect($service->articlePath($article))->toBe("/{$article->id}.html")
        ->and($service->resolve("{$article->id}.html")?->id)->toBe($article->id);
});

test('postname structure resolves by slug with date constraints', function () {
    Option::set('permalink_structure', '/%year%/%monthnum%/%postname%/');

    $article = Article::create([
        'author_id' => $this->admin->id,
        'title' => 'Dated Post',
        'slug' => 'dated-post',
        'content' => [],
        'excerpt' => '',
        'status' => 'publish',
        'created_at' => now(),
    ]);

    $service = app(PermalinkService::class);
    $path = $service->articlePath($article);

    expect($path)->toBe('/'.now()->format('Y').'/'.now()->format('m').'/dated-post')
        ->and($service->resolve(ltrim($path, '/'))?->id)->toBe($article->id);
});

test('permalink route renders the article page', function () {
    Option::set('permalink_structure', '/%post_id%.html');

    $article = Article::create([
        'author_id' => $this->admin->id,
        'title' => 'Routed Post',
        'slug' => 'routed-post',
        'content' => [],
        'excerpt' => '',
        'status' => 'publish',
    ]);

    $this
        ->get("/{$article->id}.html")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Blog/Show')
            ->has('article')
            ->where('article.id', $article->id),
        );
});

test('plain structure redirects p parameter to canonical permalink', function () {
    Option::set('permalink_structure', '/%post_id%.html');

    $article = Article::create([
        'author_id' => $this->admin->id,
        'title' => 'Redirect Post',
        'slug' => 'redirect-post',
        'content' => [],
        'excerpt' => '',
        'status' => 'publish',
    ]);

    $this
        ->get("/?p={$article->id}")
        ->assertRedirect("/{$article->id}.html");
});

test('unknown paths return 404', function () {
    $this->get('/this-page-does-not-exist')->assertNotFound();
});

test('page path and resolution use the configured structure', function () {
    Option::set('permalink_structure', '/%postname%/');

    $page = Page::create([
        'author_id' => $this->admin->id,
        'title' => 'About Us',
        'slug' => 'about-us',
        'content' => [],
        'status' => 'publish',
    ]);

    $service = app(PermalinkService::class);

    expect($service->pagePath($page))->toBe('/about-us')
        ->and($service->resolvePage('about-us')?->id)->toBe($page->id);
});

test('permalink route renders the page when no article matches', function () {
    Option::set('permalink_structure', '/%postname%/');

    $page = Page::create([
        'author_id' => $this->admin->id,
        'title' => 'Contact',
        'slug' => 'contact-us',
        'content' => [],
        'status' => 'publish',
        'comment_status' => 'open',
    ]);

    $this
        ->get('/contact-us')
        ->assertOk()
        ->assertInertia(fn (Assert $p) => $p
            ->component('Page/Show')
            ->has('page')
            ->where('page.id', $page->id)
            ->has('comments'),
        );
});

test('published page permalink 404s when the page is not published', function () {
    Option::set('permalink_structure', '/%postname%/');

    Page::create([
        'author_id' => $this->admin->id,
        'title' => 'Draft Page',
        'slug' => 'draft-page',
        'content' => [],
        'status' => 'draft',
    ]);

    $this->get('/draft-page')->assertNotFound();
});

test('public comment can be posted to an open page', function () {
    $page = Page::create([
        'author_id' => $this->admin->id,
        'title' => 'Open Page',
        'slug' => 'open-page',
        'content' => [],
        'status' => 'publish',
        'comment_status' => 'open',
    ]);

    $response = $this->actingAs($this->regular)->post(route('comments.public.store'), [
        'object_id' => $page->id,
        'object_type' => 'page',
        'content' => '来自页面的评论',
        'is_markdown' => true,
    ]);

    $response->assertRedirect();

    expect(Comment::where('object_type', 'page')->where('object_id', $page->id)->count())->toBe(1);
});

test('public comment is rejected for a closed page', function () {
    $page = Page::create([
        'author_id' => $this->admin->id,
        'title' => 'Closed Page',
        'slug' => 'closed-page',
        'content' => [],
        'status' => 'publish',
        'comment_status' => 'close',
    ]);

    $response = $this->actingAs($this->regular)->post(route('comments.public.store'), [
        'object_id' => $page->id,
        'object_type' => 'page',
        'content' => '不该成功',
    ]);

    $response->assertSessionHasErrors('message');

    expect(Comment::where('object_type', 'page')->where('object_id', $page->id)->count())->toBe(0);
});
