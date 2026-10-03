<?php

use App\Models\Article;
use App\Models\User;
use App\Services\PermalinkService;

beforeEach(function () {
    $this->user = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
});

function feedPost(User $user, string $title, string $status = 'publish'): Article
{
    return Article::create([
        'author_id' => $user->id,
        'title' => $title,
        'slug' => 'feed-'.md5($title.$status),
        'excerpt' => "这是《{$title}》的摘要",
        'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => '正文内容']]]],
        'status' => $status,
        'post_type' => 'post',
    ]);
}

test('feed returns rss xml with published posts', function () {
    feedPost($this->user, 'RSS 里的文章');
    feedPost($this->user, '草稿不进 RSS', 'draft');

    $response = $this->get('/feed');

    $response->assertOk()
        ->assertHeader('Content-Type', 'application/rss+xml; charset=UTF-8');

    $xml = $response->getContent();

    expect($xml)->toContain('<rss version="2.0"')
        ->toContain('<title>RSS 里的文章</title>')
        ->toContain('这是《RSS 里的文章》的摘要')
        ->not->toContain('草稿不进 RSS');
});

test('feed item link uses the site permalink structure', function () {
    $article = feedPost($this->user, '固定链接检查');

    $expected = url(app(PermalinkService::class)->articlePath($article));

    $this->get('/feed')
        ->assertOk()
        ->assertSee($expected, false);
});

test('feed excludes moments', function () {
    feedPost($this->user, '普通文章');

    Article::create([
        'author_id' => $this->user->id,
        'title' => '',
        'slug' => '',
        'excerpt' => '',
        'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => '说说不该出现在 RSS']]]],
        'status' => 'publish',
        'post_type' => 'moment',
    ]);

    $xml = $this->get('/feed')->getContent();

    expect($xml)->toContain('普通文章')
        ->not->toContain('说说不该出现在 RSS');
});
