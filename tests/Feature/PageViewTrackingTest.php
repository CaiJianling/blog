<?php

use App\Models\Article;
use App\Models\PageView;
use App\Models\User;
use App\Services\UserAgentInspector;

beforeEach(function () {
    $this->user = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);

    $this->article = Article::create([
        'author_id' => $this->user->id,
        'title' => '跟踪样例文章',
        'slug' => 'tracking-sample',
        'excerpt' => '',
        'content' => [],
        'status' => 'publish',
    ]);
});

test('visiting an article page records a page view with article context', function () {
    $response = $this->withHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36')
        ->get('/blog/tracking-sample')
        ->assertOk()
        ->assertCookie('blog_visitor');

    $this->assertDatabaseHas('page_views', [
        'path' => '/blog/tracking-sample',
        'page_type' => 'article',
        'object_id' => $this->article->id,
        'referrer_class' => 'direct',
        'browser' => 'Chrome',
        'os' => 'Windows',
        'device' => 'desktop',
    ]);

    // 明文 IP 不落库，只存 SHA256 哈希
    $row = PageView::first();
    expect($row->ip_hash)->toHaveLength(64);
});

test('crawler user agents are not tracked', function () {
    $this->withHeader('User-Agent', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')
        ->get('/blog/tracking-sample')
        ->assertOk();

    $this->assertDatabaseCount('page_views', 0);
});

test('duplicate visits within the dedupe window record only once', function () {
    $ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
    // 固定的 32 位 hex 访客指纹，两次请求共用同一 visitor id
    $raw = str_repeat('a', 32);

    $this->withCookie('blog_visitor', $raw)->withHeader('User-Agent', $ua)->get('/blog/tracking-sample')->assertOk();
    $this->withCookie('blog_visitor', $raw)->withHeader('User-Agent', $ua)->get('/blog/tracking-sample')->assertOk();

    $this->assertDatabaseCount('page_views', 1);
});

test('search engine referrer is classified as search', function () {
    $this->withHeader('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0')
        ->withHeader('Referer', 'https://www.baidu.com/s?wd=laravel')
        ->get('/blog')
        ->assertOk();

    $this->assertDatabaseHas('page_views', [
        'path' => '/blog',
        'page_type' => 'blog_list',
        'referrer_class' => 'search',
    ]);
});

test('same site referrer is classified as internal', function () {
    $sameSiteReferrer = rtrim(config('app.url'), '/').'/blog';

    $this->withHeader('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
        ->withHeader('Referer', $sameSiteReferrer)
        ->get('/blog')
        ->assertOk();

    $this->assertDatabaseHas('page_views', [
        'path' => '/blog',
        'referrer_class' => 'internal',
        'device' => 'mobile',
    ]);
});

test('social referrer is classified as social', function () {
    $this->withHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0')
        ->withHeader('Referer', 'https://space.bilibili.com/1234')
        ->get('/blog')
        ->assertOk();

    $this->assertDatabaseHas('page_views', [
        'path' => '/blog',
        'referrer_class' => 'external',
    ]);

    $this->withHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0')
        ->withHeader('Referer', 'https://weibo.com/tv/show/1034')
        ->get('/tools')
        ->assertOk();

    $this->assertDatabaseHas('page_views', [
        'path' => '/tools',
        'referrer_class' => 'social',
    ]);
});

test('user agent inspector parses browser os and device', function () {
    $inspector = new UserAgentInspector;

    expect($inspector->inspect('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'))
        ->toEqual(['browser' => 'Chrome', 'os' => 'Windows', 'device' => 'desktop']);

    expect($inspector->inspect('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'))
        ->toEqual(['browser' => 'Edge', 'os' => 'Windows', 'device' => 'desktop']);

    expect($inspector->inspect('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'))
        ->toEqual(['browser' => 'Chrome', 'os' => 'Android', 'device' => 'mobile']);

    expect($inspector->inspect('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'))
        ->toEqual(['browser' => 'Safari', 'os' => 'iOS', 'device' => 'tablet']);

    expect($inspector->inspect('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49'))
        ->toEqual(['browser' => 'WeChat', 'os' => 'iOS', 'device' => 'mobile']);

    expect($inspector->inspect('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0'))
        ->toEqual(['browser' => 'Firefox', 'os' => 'Windows', 'device' => 'desktop']);
});

test('post requests are not tracked', function () {
    $this->post('/comments', [
        'object_type' => 'article',
        'object_id' => $this->article->id,
        'author_name' => '测试',
        'content' => '一条测试评论',
    ]);

    $this->assertDatabaseCount('page_views', 0);
});
