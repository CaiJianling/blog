<?php

use App\Models\PageView;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
    $this->editor = User::factory()->create(['role' => 'editor', 'email_verified_at' => now()]);
});

function makePageView(array $overrides = []): PageView
{
    return PageView::create(array_merge([
        'visitor_id' => hash('sha256', 'visitor-1'),
        'user_id' => null,
        'page_type' => 'home',
        'object_id' => null,
        'path' => '/',
        'referrer' => null,
        'referrer_class' => 'direct',
        'browser' => 'Chrome',
        'os' => 'Windows',
        'device' => 'desktop',
        'ip_hash' => hash('sha256', '192.168.1.1'),
        'viewed_at' => now(),
    ], $overrides));
}

test('admin can open the site stats page with aggregates', function () {
    makePageView();
    makePageView(['referrer_class' => 'search', 'referrer' => 'https://www.baidu.com/s?wd=blog', 'path' => '/blog']);

    $this->actingAs($this->admin)
        ->get('/site-stats')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Stats/Index')
            ->where('range', 30)
            ->where('isEmpty', false)
            ->where('overview.pv', 2)
            ->where('overview.uv', 1)
            ->has('series', 30));
});

test('stats respect the range query parameter', function () {
    // 一条 60 天前的访问记录：落在 90 天范围、但不在 30 天范围
    makePageView(['viewed_at' => now()->subDays(60)]);

    // 默认 30 天范围内无记录
    $this->actingAs($this->admin)
        ->get('/site-stats')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('isEmpty', true)
            ->where('overview.pv', 0));

    // 90 天范围内可见
    $this->actingAs($this->admin)
        ->get('/site-stats?range=90')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('range', 90)
            ->where('isEmpty', false)
            ->where('overview.pv', 1));
});

test('source class percentages and access paths are aggregated', function () {
    // 两条直接访问（同一落地页 /）+ 一条站内跳转（/ 来自 → /blog）
    makePageView(['path' => '/']);
    makePageView(['path' => '/']);
    makePageView(['path' => '/blog', 'referrer_class' => 'internal', 'referrer' => 'https://blog.local.host/']);

    $this->actingAs($this->admin)
        ->get('/site-stats')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('sources.byClass.0.name', 'direct')
            ->where('sources.byClass.0.views', 2)
            ->where('sources.byClass.0.percent', 66.7)
            ->where('paths.0.from', '/')
            ->where('paths.0.to', '/blog')
            ->where('paths.0.views', 1)
            ->where('landings.0.path', '/')
            ->where('landings.0.views', 2));
});

test('non admin users cannot open the site stats page', function () {
    $this->actingAs($this->editor)
        ->get('/site-stats')
        ->assertRedirect(route('dashboard'));
});

test('profile columns are aggregated for audiences', function () {
    makePageView(['browser' => 'Chrome', 'os' => 'Windows', 'device' => 'desktop']);
    makePageView(['browser' => 'Chrome', 'os' => 'Windows', 'device' => 'desktop']);
    makePageView(['browser' => 'Safari', 'os' => 'iOS', 'device' => 'mobile']);

    $this->actingAs($this->admin)
        ->get('/site-stats')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('profiles.browsers.0.name', 'Chrome')
            ->where('profiles.browsers.0.views', 2)
            ->where('profiles.os.0.name', 'Windows')
            ->where('profiles.os.0.views', 2)
            ->where('profiles.devices.0.name', 'desktop')
            ->where('profiles.devices.0.views', 2));
});
