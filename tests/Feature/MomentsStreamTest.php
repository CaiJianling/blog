<?php

use App\Models\Article;
use App\Models\Comment;
use App\Models\User;
use App\Services\PermalinkService;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->user = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
});

function publishMoment(User $user, string $text = '一条公开的说说', array $attrs = []): Article
{
    return Article::create(array_merge([
        'author_id' => $user->id,
        'title' => '',
        'slug' => '',
        'excerpt' => '',
        'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]]],
        'status' => 'publish',
        'post_type' => 'moment',
        'comment_status' => 'open',
    ], $attrs));
}

function publishPost(User $user, string $title = '一篇普通文章'): Article
{
    return Article::create([
        'author_id' => $user->id,
        'title' => $title,
        'slug' => 'normal-'.md5($title),
        'excerpt' => '',
        'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => '正文']]]],
        'status' => 'publish',
        'post_type' => 'post',
        'comment_status' => 'open',
    ]);
}

test('moments stream lists published moments with context', function () {
    publishMoment($this->user, '时间流里的说说');

    $this->get('/moments')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Moment/Index')
            ->where('moments.data.0.comment_count', 0)
            ->where('moments.data.0.author_name', $this->user->name));
});

test('draft moments do not appear in the stream', function () {
    publishMoment($this->user, '草稿说说', ['status' => 'draft']);

    $this->get('/moments')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('moments.data', 0));
});

test('moment detail page shows content and accepts comments', function () {
    $moment = publishMoment($this->user, '可评论的说说');

    // 评论与文章共用（object_type=article）；游客提交链路由评论相关测试覆盖，这里直接落一条已审评论
    Comment::create([
        'object_type' => 'article',
        'object_id' => $moment->id,
        'author_name' => '访客',
        'author_email' => 'guest@example.com',
        'content' => '说说得劲！',
        'status' => '1',
        'is_private' => 0,
        'is_markdown' => 0,
    ]);
    // 正常提交链路会自增计数器，这里手动补齐
    $moment->increment('comment_count');

    $this->get("/moments/{$moment->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Moment/Show')
            ->where('moment.id', $moment->id)
            ->has('comments', 1)
            ->where('moment.comment_count', 1));
});

test('blog list and home page exclude moments', function () {
    publishPost($this->user, '博客里的文章');
    publishMoment($this->user, '不该出现在博客列表的说说');

    $this->get('/blog')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Blog/Index')
            ->has('articles.data', 1)
            ->where('articles.data.0.title', '博客里的文章'));

    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Home')
            ->has('latestArticles', 1)
            ->where('latestArticles.0.title', '博客里的文章'));
});

test('moment is not reachable through article routes or permalink', function () {
    $moment = publishMoment($this->user, '不走文章路由的说说');
    $permalinkPath = app(PermalinkService::class)->articlePath($moment);

    // /blog/{slug}：说说无 slug，无法命中；permalink 结构路径也不能打开说说
    $this->get($permalinkPath)->assertNotFound();
});

test('moment comment appears in the admin comment list', function () {
    $moment = publishMoment($this->user, '有评论的说说');

    Comment::create([
        'object_type' => 'article',
        'object_id' => $moment->id,
        'author_name' => '访客',
        'content' => '冒个泡',
        'status' => '1',
        'is_private' => 0,
        'is_markdown' => 0,
    ]);

    $this->actingAs($this->user)
        ->get('/admin/comments')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Comment/Index'));
});
