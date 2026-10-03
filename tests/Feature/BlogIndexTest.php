<?php

use App\Models\Article;
use App\Models\Term;
use App\Models\TermRelationship;
use App\Models\TermTaxonomy;
use App\Models\User;

beforeEach(function () {
    $this->user = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);

    Article::create([
        'author_id' => $this->user->id,
        'title' => 'Laravel 入门指南',
        'slug' => 'laravel-intro',
        'excerpt' => 'Laravel 基础',
        'content' => [],
        'status' => 'publish',
    ]);

    Article::create([
        'author_id' => $this->user->id,
        'title' => 'React 19 新特性',
        'slug' => 'react-19',
        'excerpt' => 'React 新特性',
        'content' => [],
        'status' => 'publish',
    ]);
});

test('blog index lists published articles', function () {
    $this->get('/blog')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Blog/Index')
            ->has('articles.data', 2));
});

test('blog index searches by title keyword', function () {
    $this->get('/blog?q=Laravel')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Blog/Index')
            ->has('articles.data', 1)
            ->where('currentQuery', 'Laravel')
            ->where('articles.data.0.title', 'Laravel 入门指南'));
});

test('blog index search without match shows empty list', function () {
    $this->get('/blog?q=不存在的关键词')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Blog/Index')
            ->has('articles.data', 0)
            ->where('currentQuery', '不存在的关键词'));
});

test('blog index exposes article likes count', function () {
    Article::where('title', 'Laravel 入门指南')->update(['likes' => 5]);

    $this->get('/blog?q=Laravel')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Blog/Index')
            ->where('articles.data.0.likes', 5));
});

test('blog index searches content when scope is content', function () {
    Article::create([
        'author_id' => $this->user->id,
        'title' => '一个不含关键词的标题',
        'slug' => 'content-match',
        'excerpt' => '',
        'content' => [
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => '这里提到了 Vue 的响应式原理']]],
        ],
        'status' => 'publish',
    ]);

    $this->get('/blog?q=Vue&scope=content')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Blog/Index')
            ->has('articles.data', 1)
            ->where('currentScope', 'content')
            ->where('articles.data.0.title', '一个不含关键词的标题'));
});

test('blog index title scope ignores matches inside content', function () {
    Article::create([
        'author_id' => $this->user->id,
        'title' => '一个不含关键词的标题',
        'slug' => 'content-match-2',
        'excerpt' => '',
        'content' => [
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => '这里提到了 Vue 的响应式原理']]],
        ],
        'status' => 'publish',
    ]);

    $this->get('/blog?q=Vue')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Blog/Index')
            ->has('articles.data', 0)
            ->where('currentScope', 'title'));
});

test('blog index title_content scope matches title or content', function () {
    Article::create([
        'author_id' => $this->user->id,
        'title' => '一个不含关键词的标题',
        'slug' => 'content-match-3',
        'excerpt' => '',
        'content' => [
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => '这里提到了 Vue 的响应式原理']]],
        ],
        'status' => 'publish',
    ]);

    $this->get('/blog?q=Vue&scope=title_content')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Blog/Index')
            ->has('articles.data', 1)
            ->where('currentScope', 'title_content')
            ->where('articles.data.0.title', '一个不含关键词的标题'));
});

test('blog index search works together with category filter', function () {
    $term = Term::factory()->create(['name' => '教程', 'slug' => 'tutorials']);

    $category = TermTaxonomy::create([
        'term_id' => $term->term_id,
        'taxonomy' => 'category',
        'description' => '',
        'parent' => 0,
    ]);

    $article = Article::where('title', 'Laravel 入门指南')->first();

    TermRelationship::create([
        'term_taxonomy_id' => $category->term_taxonomy_id,
        'object_type' => 'article',
        'object_id' => $article->id,
    ]);

    $this->get('/blog?q=Laravel&category=tutorials')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Blog/Index')
            ->has('articles.data', 1));

    $this->get('/blog?q=React&category=tutorials')
        ->assertInertia(fn ($page) => $page
            ->component('Blog/Index')
            ->has('articles.data', 0));
});
