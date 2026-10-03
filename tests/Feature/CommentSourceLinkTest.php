<?php

use App\Models\Article;
use App\Models\Comment;
use App\Models\Option;
use App\Models\Page;
use App\Models\User;

/**
 * 后台 /comments 的「回复至」列必须指向原文的实际前台地址：
 * 它由 PermalinkService 按站点固定链接结构生成，而不是前端猜的 /articles/{id} 模板。
 */
beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
});

function commentOnArticleSource(Article $article): void
{
    Comment::create([
        'object_id' => $article->id,
        'object_type' => 'article',
        'author_name' => '访客',
        'author_email' => 'guest@example.com',
        'content' => '正文内容',
        'status' => '1',
        'parent_id' => 0,
    ]);
}

test('article comments link to the configured permalink structure', function () {
    Option::set('permalink_structure', '/%year%/%postname%/');

    $article = Article::create([
        'author_id' => $this->admin->id,
        'title' => 'Permalink Source',
        'slug' => 'permalink-source',
        'excerpt' => '',
        'content' => [],
        'status' => 'publish',
    ]);

    commentOnArticleSource($article);

    $expected = '/'.now()->format('Y').'/permalink-source';

    $this->actingAs($this->admin)
        ->get('/admin/comments')
        ->assertOk()
        ->assertInertia(fn ($assert) => $assert->where('comments.data.0.related_permalink', $expected));

    // 链接本身必须真的能打开（旧实现拼的 /articles/{id} 会落到兜底路由然后 404）
    $this->get($expected)->assertOk()->assertInertia(fn ($assert) => $assert->component('Blog/Show'));
});

test('page comments link through the page permalink', function () {
    Option::set('permalink_structure', '/%postname%/');

    $page = Page::create([
        'author_id' => $this->admin->id,
        'title' => 'About Link',
        'slug' => 'about-link',
        'content' => [],
        'status' => 'publish',
    ]);

    Comment::create([
        'object_id' => $page->id,
        'object_type' => 'page',
        'author_name' => '访客',
        'author_email' => 'guest@example.com',
        'content' => '页面下的评论',
        'status' => '1',
        'parent_id' => 0,
    ]);

    $this->actingAs($this->admin)
        ->get('/admin/comments')
        ->assertOk()
        ->assertInertia(fn ($assert) => $assert->where('comments.data.0.related_permalink', '/about-link'));
});

test('moment comments link to the moments stream', function () {
    Option::set('permalink_structure', '/%postname%/');

    $moment = Article::create([
        'author_id' => $this->admin->id,
        'title' => '一条说说',
        'slug' => 'moment-'.uniqid(),
        'excerpt' => '',
        'content' => [],
        'status' => 'publish',
        'post_type' => Article::TYPE_MOMENT,
    ]);

    commentOnArticleSource($moment);

    // 说说不参与固定链接解析，只能指向它自己的时间流详情
    $this->actingAs($this->admin)
        ->get('/admin/comments')
        ->assertOk()
        ->assertInertia(fn ($assert) => $assert->where('comments.data.0.related_permalink', '/moments/'.$moment->id));

    $this->get('/moments/'.$moment->id)->assertOk();
});

test('comments whose source was deleted report no link', function () {
    $article = Article::create([
        'author_id' => $this->admin->id,
        'title' => 'Ghost Source',
        'slug' => 'ghost-source',
        'excerpt' => '',
        'content' => [],
        'status' => 'publish',
    ]);

    commentOnArticleSource($article);

    $article->forceDelete();

    $this->actingAs($this->admin)
        ->get('/admin/comments')
        ->assertOk()
        ->assertInertia(fn ($assert) => $assert
            ->where('comments.data.0.related_permalink', null)
            ->where('comments.data.0.related_title', null));
});
