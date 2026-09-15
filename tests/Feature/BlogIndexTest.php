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
