<?php

use App\Models\Article;
use App\Models\User;

beforeEach(function () {
    $this->user = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
});

function makeReadingArticle(User $user, array $content, string $slug = 'reading-sample'): Article
{
    return Article::create([
        'author_id' => $user->id,
        'title' => '阅读时间样例',
        'slug' => $slug,
        'excerpt' => '',
        'content' => $content,
        'status' => 'publish',
    ]);
}

test('empty content reads as one minute', function () {
    $article = makeReadingArticle($this->user, []);

    expect($article->estimatedReadingMinutes())->toBe(1);
});

test('a 400 char article reads as one minute', function () {
    // 20 字 × 20 段 = 400 字 → 1 分钟
    $text = str_repeat('这是一段用于估算阅读时间的中文正文内容。', 20);
    $article = makeReadingArticle($this->user, [
        ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]],
    ]);

    expect($article->estimatedReadingMinutes())->toBe(1);
});

test('a 2000 char article estimates five minutes', function () {
    // 5 字 × 400 段 = 2000 字 → 5 分钟
    $text = str_repeat('中文正文。', 400);
    $article = makeReadingArticle($this->user, [
        ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]],
    ]);

    expect($article->estimatedReadingMinutes())->toBe(5);
});

test('code block and link inline content count toward reading time', function () {
    $article = makeReadingArticle($this->user, [
        ['type' => 'codeBlock', 'content' => "echo 'hello';"],
        [
            'type' => 'paragraph',
            'content' => [
                [
                    'type' => 'link',
                    'href' => 'https://example.com',
                    'content' => [['type' => 'text', 'text' => '一个很长的链接文字，参与阅读时长计算']],
                ],
            ],
        ],
    ]);

    $plain = Article::extractPlainText($article->content);

    expect($plain)->toContain('hello');
    expect($plain)->toContain('一个很长的链接文字');
    expect($article->estimatedReadingMinutes())->toBeGreaterThanOrEqual(1);
});

test('table cells and nested list children are extracted', function () {
    $article = makeReadingArticle($this->user, [
        ['type' => 'table', 'content' => ['rows' => [['cells' => ['第一列', ['type' => 'text', 'text' => '第二列']]]]]],
        [
            'type' => 'bulletListItem',
            'content' => [['type' => 'text', 'text' => '列表项内容']],
            'children' => [
                ['type' => 'bulletListItem', 'content' => [['type' => 'text', 'text' => '嵌套列表项内容']], 'children' => []],
            ],
        ],
    ]);

    $plain = Article::extractPlainText($article->content);

    expect($plain)
        ->toContain('第一列')
        ->toContain('第二列')
        ->toContain('列表项内容')
        ->toContain('嵌套列表项内容');
});

test('blog index cards expose reading time', function () {
    // 5 字 × 160 段 = 800 字 → 2 分钟
    $article = makeReadingArticle(
        $this->user,
        [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => str_repeat('正文内容。', 160)]]]],
    );

    $this->get('/blog')
        ->assertOk()
        ->assertInertia(function ($page) use ($article) {
            $page->component('Blog/Index')
                ->where('articles.data.0.id', $article->id)
                ->where('articles.data.0.reading_time', 2);
        });
});

test('article detail exposes reading time in meta bar', function () {
    $article = makeReadingArticle(
        $this->user,
        [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => str_repeat('正文内容。', 160)]]]],
    );

    $this->get("/blog/{$article->slug}")
        ->assertOk()
        ->assertInertia(function ($page) {
            $page->component('Blog/Show')
                ->where('article.reading_time', 2);
        });
});

test('home page cards expose reading time', function () {
    $article = makeReadingArticle(
        $this->user,
        [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => str_repeat('正文内容。', 160)]]]],
    );

    $this->get('/')
        ->assertOk()
        ->assertInertia(function ($page) use ($article) {
            $page->component('Home')
                ->where('latestArticles.0.id', $article->id)
                ->where('latestArticles.0.reading_time', 2);
        });
});
