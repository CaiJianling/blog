<?php

use App\Models\Article;
use App\Models\Option;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->user = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
});

function archivePost(User $user, string $title): Article
{
    $article = Article::create([
        'author_id' => $user->id,
        'title' => $title,
        'slug' => 'archive-'.md5($title),
        'excerpt' => '',
        'content' => [],
        'status' => 'publish',
        'post_type' => 'post',
    ]);

    // 用确定的历史时间，保证与说说的时间排序稳定（fillable 不含 created_at，走查询更新）
    Article::query()->where('id', $article->id)->update([
        'created_at' => now()->subDays(3),
    ]);

    return $article;
}

function archiveMoment(User $user, string $text, array $attrs = []): Article
{
    $moment = Article::create(array_merge([
        'author_id' => $user->id,
        'title' => '',
        'slug' => '',
        'excerpt' => '',
        'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]]],
        'status' => 'publish',
        'post_type' => 'moment',
    ], $attrs));

    Article::query()->where('id', $moment->id)->update([
        'created_at' => now(),
    ]);

    return $moment;
}

test('archive timeline groups published posts by year', function () {
    $post = archivePost($this->user, '归档里的文章');

    $this->get('/archive')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Archive/Index')
            ->where('total', 1)
            ->where('years.0.year', $post->created_at->format('Y'))
            ->where('years.0.items.0.title', '归档里的文章')
            ->where('years.0.items.0.type', 'article'));
});

test('moments are hidden from the timeline by default', function () {
    archivePost($this->user, '文章');
    archiveMoment($this->user, '默认不进时间轴的说说');

    $this->get('/archive')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('total', 1)
            ->where('years.0.items.0.type', 'article'));
});

test('timeline includes moments when the option is enabled', function () {
    Option::set('timeline_include_moments', '1');

    archivePost($this->user, '文章');
    $moment = archiveMoment($this->user, '被列进时间轴的说说');

    $this->get('/archive')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('total', 2)
            ->where('years.0.count', 2)
            ->where('years.0.items.0.type', 'moment')
            ->where('years.0.items.0.url', '/moments/'.$moment->id));
});

test('draft content never appears in the timeline', function () {
    archivePost($this->user, '已发布文章');
    Article::create([
        'author_id' => $this->user->id,
        'title' => '草稿文章',
        'slug' => 'draft-post',
        'excerpt' => '',
        'content' => [],
        'status' => 'draft',
        'post_type' => 'post',
    ]);
    archiveMoment($this->user, '草稿说说', ['status' => 'draft']);

    Option::set('timeline_include_moments', '1');

    $this->get('/archive')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('total', 1));
});
