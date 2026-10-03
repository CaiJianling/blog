<?php

use App\Models\Article;
use App\Models\Option;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

/*
 * 前台「快捷编辑」悬浮按钮的可见性：BlogController 按 author_id 下发 article.can_edit，
 * floating-actions.tsx 据此决定是否渲染指向 /admin/articles/{id}/edit 的入口。
 */
beforeEach(function () {
    $this->author = User::factory()->create(['email_verified_at' => now()]);
    $this->other = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);

    $this->article = Article::create([
        'author_id' => $this->author->id,
        'title' => '悬浮编辑测试文章',
        'slug' => 'floating-edit-post',
        'excerpt' => '摘要',
        'content' => [],
        'status' => 'publish',
    ]);
});

test('author sees the quick edit entry on their own article', function () {
    $this->actingAs($this->author)
        ->get(route('blog.show', $this->article->slug))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Blog/Show')
            ->where('article.can_edit', true),
        );
});

test('other logged in users do not see the quick edit entry', function () {
    $this->actingAs($this->other)
        ->get(route('blog.show', $this->article->slug))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('article.can_edit', false),
        );
});

test('guests do not see the quick edit entry', function () {
    $this->get(route('blog.show', $this->article->slug))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('article.can_edit', false),
        );
});

test('quick edit entry is resolved through the permalink route as well', function () {
    Option::set('permalink_structure', '/%postname%/');

    $this->actingAs($this->author)
        ->get('/'.$this->article->slug)
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Blog/Show')
            ->where('article.can_edit', true),
        );
});
