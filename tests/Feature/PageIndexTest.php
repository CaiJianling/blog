<?php

use App\Models\Comment;
use App\Models\Page;
use App\Models\User;
use App\Services\PermalinkService;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);

    $this->page = Page::create([
        'author_id' => $this->admin->id,
        'title' => '关于本站',
        'slug' => 'about',
        'content' => [],
        'status' => 'publish',
    ]);

    // 两条属于该页面的评论
    Comment::create([
        'object_id' => $this->page->id,
        'object_type' => 'page',
        'author_name' => '访客甲',
        'content' => '第一条',
        'status' => '1',
        'parent_id' => 0,
        'user_id' => 0,
        'is_private' => false,
        'notify_mail' => false,
    ]);

    Comment::create([
        'object_id' => $this->page->id,
        'object_type' => 'page',
        'author_name' => '访客乙',
        'content' => '第二条',
        'status' => '1',
        'parent_id' => 0,
        'user_id' => 0,
        'is_private' => false,
        'notify_mail' => false,
    ]);

    // 一条属于其他页面的评论，不应计入
    $otherPage = Page::create([
        'author_id' => $this->admin->id,
        'title' => '其他页面',
        'slug' => 'other',
        'content' => [],
        'status' => 'publish',
    ]);

    Comment::create([
        'object_id' => $otherPage->id,
        'object_type' => 'page',
        'author_name' => '访客丙',
        'content' => '属于其他页面',
        'status' => '1',
        'parent_id' => 0,
        'user_id' => 0,
        'is_private' => false,
        'notify_mail' => false,
    ]);
});

test('page index payload includes per-page comment counts', function () {
    $response = $this->actingAs($this->admin)->get('/pages');

    $response->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('Page/Index')
        ->has('pages.data', 2));

    $rows = collect(json_decode(json_encode($response->viewData('page')), true)['props']['pages']['data'])
        ->keyBy('id');

    expect($rows->get($this->page->id)['comment_count'])->toBe(2);
});

test('page index counts only comments of the matching page', function () {
    $response = $this->actingAs($this->admin)->get('/pages');

    $rows = collect(json_decode(json_encode($response->viewData('page')), true)['props']['pages']['data'])
        ->keyBy('id');

    $other = $rows->reject(fn (array $row) => $row['id'] === $this->page->id)->first();

    expect($other['comment_count'])->toBe(1);
});

test('page index payload includes the permalink generated from the structure', function () {
    $response = $this->actingAs($this->admin)->get('/pages');

    $rows = collect(json_decode(json_encode($response->viewData('page')), true)['props']['pages']['data'])
        ->keyBy('id');

    $service = app(PermalinkService::class);

    expect($rows->get($this->page->id)['permalink'])->toBe($service->pagePath($this->page));
});
