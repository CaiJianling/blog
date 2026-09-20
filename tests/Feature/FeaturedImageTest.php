<?php

use App\Models\Article;
use App\Models\Attachment;
use App\Models\User;

beforeEach(function () {
    $this->user = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
});

function imageAttachment(User $user, string $name = 'cover.png'): Attachment
{
    return Attachment::create([
        'author_id' => $user->id,
        'file_name' => $name,
        'file_path' => "uploads/{$name}",
        'mime_type' => 'image/png',
        'file_size' => 1234,
    ]);
}

test('featured image url resolves from an image attachment', function () {
    $image = imageAttachment($this->user);

    $article = Article::create([
        'author_id' => $this->user->id,
        'title' => '带图文章',
        'slug' => 'with-image',
        'excerpt' => '',
        'content' => [],
        'status' => 'publish',
        'featured_image' => $image->id,
    ]);

    $url = $article->fresh()->featuredImageUrl();

    expect($url)->not->toBeNull()
        ->and($url)->toContain('uploads/cover.png');
});

test('featured image url is null when unset, deleted, or not an image', function () {
    $article = Article::create([
        'author_id' => $this->user->id,
        'title' => '无图',
        'slug' => 'no-image',
        'excerpt' => '',
        'content' => [],
        'status' => 'publish',
        'featured_image' => null,
    ]);

    expect($article->featuredImageUrl())->toBeNull();

    // 指向不存在的附件
    Article::query()->where('id', $article->id)->update(['featured_image' => 999999]);
    expect($article->refresh()->featuredImageUrl())->toBeNull();

    // 非图片附件（视频）
    $video = Attachment::create([
        'author_id' => $this->user->id,
        'file_name' => 'clip.mp4',
        'file_path' => 'uploads/clip.mp4',
        'mime_type' => 'video/mp4',
        'file_size' => 999,
    ]);
    Article::query()->where('id', $article->id)->update(['featured_image' => $video->id]);
    expect($article->refresh()->featuredImageUrl())->toBeNull();
});

test('blog waterfall card exposes the featured image url', function () {
    $image = imageAttachment($this->user);

    Article::create([
        'author_id' => $this->user->id,
        'title' => '带图文章',
        'slug' => 'with-image',
        'excerpt' => '',
        'content' => [],
        'status' => 'publish',
        'featured_image' => $image->id,
    ]);

    $this->get('/blog')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Blog/Index')
            ->where('articles.data.0.featured_image', fn (?string $url) => $url !== null && str_contains($url, 'uploads/cover.png')),
        );
});

test('blog waterfall card omits featured image when unset', function () {
    Article::create([
        'author_id' => $this->user->id,
        'title' => '无图文章',
        'slug' => 'no-image',
        'excerpt' => '',
        'content' => [],
        'status' => 'publish',
    ]);

    $this->get('/blog')
        ->assertInertia(fn ($page) => $page
            ->where('articles.data.0.featured_image', null),
        );
});

test('home latest article card exposes the featured image url', function () {
    $image = imageAttachment($this->user);

    Article::create([
        'author_id' => $this->user->id,
        'title' => '首页带图文章',
        'slug' => 'home-with-image',
        'excerpt' => '',
        'content' => [],
        'status' => 'publish',
        'post_type' => Article::TYPE_POST,
        'featured_image' => $image->id,
    ]);

    Article::create([
        'author_id' => $this->user->id,
        'title' => '首页无图文章',
        'slug' => 'home-no-image',
        'excerpt' => '',
        'content' => [],
        'status' => 'publish',
        'post_type' => Article::TYPE_POST,
    ]);

    Article::where('slug', 'home-no-image')->update(['created_at' => now()->subWeek()]);

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Home')
            ->has('latestArticles', 2)
            ->where('latestArticles.0.featured_image', fn (?string $url) => $url !== null && str_contains($url, 'uploads/cover.png'))
            ->where('latestArticles.1.featured_image', null),
        );
});

test('article store saves a valid featured image and rejects an unknown one', function () {
    $image = imageAttachment($this->user);

    $this->actingAs($this->user)
        ->post(route('articles.store'), [
            'title' => '带图',
            'slug' => 'feat-valid',
            'excerpt' => '',
            'content' => [],
            'status' => 'publish',
            'comment_status' => 'open',
            'featured_image' => $image->id,
        ])->assertRedirect();

    expect(Article::where('slug', 'feat-valid')->first()->featured_image)->toBe($image->id);

    $this->actingAs($this->user)
        ->post(route('articles.store'), [
            'title' => '坏图',
            'slug' => 'feat-bad',
            'excerpt' => '',
            'content' => [],
            'status' => 'publish',
            'comment_status' => 'open',
            'featured_image' => 999999,
        ])->assertSessionHasErrors(['featured_image']);

    expect(Article::where('slug', 'feat-bad')->exists())->toBeFalse();
});
