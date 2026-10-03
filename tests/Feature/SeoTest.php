<?php

use App\Models\Article;
use App\Models\Option;
use App\Models\Page;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
});

test('site seo description and keywords are saved', function () {
    $this
        ->actingAs($this->admin)
        ->put(route('site.update'), [
            'site_title' => 'My Blog',
            'site_tagline' => 'A blog',
            'seo_description' => '这是一个测试站点的 SEO 描述。',
            'seo_keywords' => '博客, Laravel, 测试',
            'site_icon' => '',
            'cms_url' => 'https://example.com/admin',
            'site_url' => 'https://example.com',
            'admin_email' => 'admin@example.com',
            'membership' => '1',
            'default_role' => 'author',
            'site_language' => 'en',
            'timezone' => 'Asia/Shanghai',
            'date_format' => 'Y-m-d',
            'time_format' => 'H:i',
            'start_of_week' => '0',
        ]);

    expect(Option::get('seo_description'))->toBe('这是一个测试站点的 SEO 描述。')
        ->and(Option::get('seo_keywords'))->toBe('博客, Laravel, 测试');
});

test('site seo fields are optional', function () {
    $this
        ->actingAs($this->admin)
        ->put(route('site.update'), [
            'site_title' => 'My Blog',
            'site_icon' => '',
            'cms_url' => 'https://example.com/admin',
            'site_url' => 'https://example.com',
            'admin_email' => 'admin@example.com',
            'default_role' => 'author',
            'site_language' => 'en',
            'timezone' => 'Asia/Shanghai',
            'date_format' => 'Y-m-d',
            'time_format' => 'H:i',
            'start_of_week' => '0',
        ]);

    expect(Option::get('seo_description'))->toBe('')
        ->and(Option::get('seo_keywords'))->toBe('');
});

test('article store persists meta title and description', function () {
    $this
        ->actingAs($this->admin)
        ->post(route('articles.store'), [
            'title' => 'SEO 测试文章',
            'excerpt' => '摘要',
            'meta_title' => '自定义 SEO 标题',
            'meta_description' => '自定义 SEO 描述',
            'content' => [],
            'status' => 'draft',
            'comment_status' => 'open',
        ]);

    $article = Article::where('title', 'SEO 测试文章')->first();

    expect($article)->not->toBeNull()
        ->and($article->meta_title)->toBe('自定义 SEO 标题')
        ->and($article->meta_description)->toBe('自定义 SEO 描述');
});

test('article update persists meta title and description', function () {
    $article = Article::create([
        'author_id' => $this->admin->id,
        'title' => '待更新文章',
        'slug' => 'update-seo-post',
        'excerpt' => '摘要',
        'content' => [],
        'status' => 'draft',
    ]);

    $this
        ->actingAs($this->admin)
        ->put(route('articles.update', $article), [
            'title' => '待更新文章',
            'meta_title' => '更新后的 SEO 标题',
            'meta_description' => '更新后的 SEO 描述',
            'content' => [],
            'status' => 'draft',
            'comment_status' => 'open',
        ]);

    $article->refresh();

    expect($article->meta_title)->toBe('更新后的 SEO 标题')
        ->and($article->meta_description)->toBe('更新后的 SEO 描述');
});

test('page store and update persist meta fields', function () {
    $this
        ->actingAs($this->admin)
        ->post(route('pages.store'), [
            'title' => 'SEO 测试页面',
            'meta_title' => '页面 SEO 标题',
            'meta_description' => '页面 SEO 描述',
            'content' => [],
            'status' => 'draft',
            'comment_status' => 'close',
        ]);

    $page = Page::where('title', 'SEO 测试页面')->first();

    expect($page)->not->toBeNull()
        ->and($page->meta_title)->toBe('页面 SEO 标题')
        ->and($page->meta_description)->toBe('页面 SEO 描述');

    $this
        ->actingAs($this->admin)
        ->put(route('pages.update', $page), [
            'title' => 'SEO 测试页面',
            'meta_title' => '页面 SEO 标题 2',
            'meta_description' => '页面 SEO 描述 2',
            'content' => [],
            'status' => 'draft',
            'comment_status' => 'close',
        ]);

    $page->refresh();

    expect($page->meta_title)->toBe('页面 SEO 标题 2')
        ->and($page->meta_description)->toBe('页面 SEO 描述 2');
});

test('article page exposes meta props and shared seo', function () {
    $article = Article::create([
        'author_id' => $this->admin->id,
        'title' => '前台 SEO 文章',
        'slug' => 'front-seo-post',
        'excerpt' => '摘要',
        'meta_title' => '前台 SEO 标题',
        'meta_description' => '前台 SEO 描述',
        'content' => [],
        'status' => 'publish',
    ]);

    $this
        ->get(route('blog.show', $article->slug))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Blog/Show')
            ->where('article.meta_title', '前台 SEO 标题')
            ->where('article.meta_description', '前台 SEO 描述')
            ->where('seo.title', fn ($v) => $v !== '')
            ->has('seo')
            ->has('seo.description')
            ->has('seo.keywords'),
        );
});

test('shared seo prop is present on front pages', function () {
    Option::set('seo_description', '站点描述');
    Option::set('seo_keywords', '关键词A, 关键词B');

    $this
        ->get(route('blog.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('seo.title', fn ($v) => $v !== '')
            ->where('seo.description', '站点描述')
            ->where('seo.keywords', '关键词A, 关键词B'),
        );
});
