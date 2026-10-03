<?php

use App\Models\Article;
use App\Models\ArticleLike;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;

beforeEach(function () {
    $this->author = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);

    $this->article = Article::create([
        'author_id' => $this->author->id,
        'title' => '点赞测试文章',
        'slug' => 'like-test-post',
        'excerpt' => '摘要',
        'content' => [],
        'status' => 'publish',
        'permalink' => 'like-test-post',
    ]);
});

test('guest can like and unlike by guest id', function () {
    $guestId = 'guest-abc-123';

    $response = $this->postJson(route('articles.like', $this->article), ['guestId' => $guestId]);

    $response->assertOk()
        ->assertJsonPath('liked', true)
        ->assertJsonPath('likes', 1);

    expect($this->article->refresh()->likes)->toBe(1)
        ->and(ArticleLike::where('guest_id', $guestId)->exists())->toBeTrue();

    // 重复点赞视为取消
    $this->postJson(route('articles.like', $this->article), ['guestId' => $guestId])
        ->assertOk()
        ->assertJsonPath('liked', false)
        ->assertJsonPath('likes', 0);

    expect($this->article->refresh()->likes)->toBe(0)
        ->and(ArticleLike::count())->toBe(0);
});

test('guest like requires a guest id', function () {
    $this->postJson(route('articles.like', $this->article), [])
        ->assertStatus(422);
});

test('logged-in user can like and unlike', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);

    $this->actingAs($user)
        ->postJson(route('articles.like', $this->article), [])
        ->assertOk()
        ->assertJsonPath('liked', true)
        ->assertJsonPath('likes', 1);

    $like = ArticleLike::first();

    expect($like->user_id)->toBe($user->id)
        ->and($like->guest_id)->toBeNull();

    $this->actingAs($user)
        ->postJson(route('articles.like', $this->article), [])
        ->assertOk()
        ->assertJsonPath('liked', false)
        ->assertJsonPath('likes', 0);
});

test('guest and logged-in likes are tracked independently', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);

    $this->postJson(route('articles.like', $this->article), ['guestId' => 'guest-1'])
        ->assertOk();

    $this->actingAs($user)
        ->postJson(route('articles.like', $this->article), [])
        ->assertOk();

    expect($this->article->refresh()->likes)->toBe(2)
        ->and(DB::table('article_likes')->count())->toBe(2);
});

test('article page exposes like count and viewer like state', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);

    ArticleLike::create(['article_id' => $this->article->id, 'user_id' => $user->id]);
    $this->article->increment('likes');

    $this->actingAs($user)
        ->get("/{$this->article->id}.html")
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('article.likes', 1)
            ->where('article.liked_by_me', true),
        );

    // 游客不携带个人点赞状态，由浏览器本地判断
    $this->app['auth']->forgetGuards();

    $this->get("/{$this->article->id}.html")
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('article.likes', 1)
            ->where('article.liked_by_me', null),
        );
});
