<?php

use App\Models\Article;
use App\Models\Option;
use App\Models\User;
use App\Services\PermalinkService;
use Illuminate\Support\Collection;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);

    $this->published = Article::create([
        'author_id' => $this->admin->id,
        'title' => 'Laravel 入门指南',
        'slug' => 'laravel-intro',
        'excerpt' => 'Laravel 基础',
        'content' => [],
        'status' => 'publish',
    ]);

    $this->draft = Article::create([
        'author_id' => $this->admin->id,
        'title' => '未发布草稿',
        'slug' => 'my-draft',
        'excerpt' => '草稿',
        'content' => [],
        'status' => 'draft',
    ]);
});

function articleIndexRows(TestResponse $response): Collection
{
    $page = json_decode(json_encode($response->viewData('page')), true);

    return collect($page['props']['articles']['data'])->keyBy('id');
}

test('article index payload includes each article permalink', function () {
    $response = $this->actingAs($this->admin)->get('/admin/articles');

    $response->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('Article/Index')
        ->has('articles.data', 2));

    $rows = articleIndexRows($response);
    $permalinks = app(PermalinkService::class);

    expect($rows->get($this->published->id)['permalink'])
        ->toBe($permalinks->articlePath($this->published));
    expect($rows->get($this->draft->id)['permalink'])
        ->toBe($permalinks->articlePath($this->draft));
});

test('article index permalink follows the permalink structure option', function () {
    Option::set('permalink_structure', '/%postname%/');

    $response = $this->actingAs($this->admin)->get('/admin/articles');

    $response->assertOk();

    $rows = articleIndexRows($response);

    expect($rows->get($this->published->id)['permalink'])
        ->toBe('/laravel-intro');
});
