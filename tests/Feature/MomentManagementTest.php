<?php

use App\Models\Article;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->user = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);

    $this->actingAs($this->user);
});

function makeMoment(User $user, array $attrs = []): Article
{
    return Article::create(array_merge([
        'author_id' => $user->id,
        'title' => '',
        'slug' => '',
        'excerpt' => '',
        'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => '今天天气不错，出来走走。']]]],
        'status' => 'publish',
        'post_type' => 'moment',
        'comment_status' => 'open',
    ], $attrs));
}

test('admin can view the moments management page', function () {
    makeMoment($this->user);

    $this->get('/admin/moments')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Moments/Index')
            ->where('statusCounts.all', 1)
            ->where('moments.data.0.snippet', '今天天气不错，出来走走。'));
});

test('admin can create a moment', function () {
    $this->post('/admin/moments', [
        'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => '第一条说说']]]],
        'status' => 'publish',
        'comment_status' => 'open',
    ])->assertRedirect();

    $moment = Article::where('post_type', 'moment')->first();
    expect($moment)->not->toBeNull()
        ->and($moment->title)->toBe('')
        ->and($moment->status)->toBe('publish');
});

test('admin can update a moment', function () {
    $moment = makeMoment($this->user);

    $this->put("/admin/moments/{$moment->id}", [
        'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => '修改后的说说']]]],
        'status' => 'draft',
        'comment_status' => 'close',
    ])->assertRedirect();

    $moment->refresh();
    expect($moment->status)->toBe('draft')
        ->and($moment->comment_status)->toBe('close');
});

test('moments can be trashed restored and force deleted', function () {
    $moment = makeMoment($this->user);

    $this->put("/admin/moments/{$moment->id}/trash")->assertRedirect();
    expect($moment->fresh()->status)->toBe('trash');

    $this->put("/admin/moments/{$moment->id}/restore")->assertRedirect();
    expect($moment->fresh()->status)->toBe('draft');

    $this->delete("/admin/moments/{$moment->id}")->assertRedirect();
    expect(Article::find($moment->id))->toBeNull();
});

test('regular articles are not listed on the moments page', function () {
    Article::create([
        'author_id' => $this->user->id,
        'title' => '普通文章',
        'slug' => 'normal-post',
        'excerpt' => '',
        'content' => [],
        'status' => 'publish',
        'post_type' => 'post',
    ]);
    makeMoment($this->user);

    $this->get('/admin/moments')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('statusCounts.all', 1)
            ->where('moments.data.0.snippet', '今天天气不错，出来走走。'));
});

test('moment edit page rejects regular articles', function () {
    $article = Article::create([
        'author_id' => $this->user->id,
        'title' => '普通文章',
        'slug' => 'normal-post',
        'excerpt' => '',
        'content' => [],
        'status' => 'publish',
        'post_type' => 'post',
    ]);

    $this->get("/admin/moments/{$article->id}/edit")->assertNotFound();
});
