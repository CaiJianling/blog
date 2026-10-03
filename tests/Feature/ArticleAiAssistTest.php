<?php

use App\Models\Option;
use App\Models\Term;
use App\Models\TermTaxonomy;
use App\Models\User;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    $this->author = User::factory()->create(['role' => 'author', 'email_verified_at' => now()]);

    Option::set('ai_api_url', 'https://api.openai.com/v1');
    Option::set('ai_api_key', 'sk-test');
    Option::set('ai_model', 'test-model');
});

/**
 * 伪造一次聚焦补全的 AI 返回。
 */
function fakeMeta(string $payload): void
{
    Http::fake([
        '*/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => $payload]]],
        ]),
    ]);
}

function blockDoc(string $text): array
{
    return [[
        'id' => 'b1',
        'type' => 'paragraph',
        'props' => [],
        'content' => [['type' => 'text', 'text' => $text, 'styles' => []]],
        'children' => [],
    ]];
}

const META_PAYLOAD = '{"excerpt":"一篇讲清空回收站的短文摘要。","meta_title":"彻底清理电脑垃圾文件的方法","meta_description":"从系统缓存到残留索引，逐步说明如何安全清理电脑垃圾文件。","tags":["电脑清理","效率技巧"],"categories":["博客"]}';

test('assist returns the excerpt for the excerpt target', function () {
    fakeMeta(META_PAYLOAD);

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-assist'), [
            'target' => 'excerpt',
            'title' => '如何彻底清理电脑垃圾文件',
            'content' => blockDoc(str_repeat('清理垃圾文件能释放磁盘空间。', 10)),
        ])
        ->assertOk()
        ->assertJsonPath('excerpt', '一篇讲清空回收站的短文摘要。');
});

test('assist returns both seo fields for the seo target', function () {
    fakeMeta(META_PAYLOAD);

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-assist'), [
            'target' => 'seo',
            'title' => '如何彻底清理电脑垃圾文件',
            'content' => blockDoc(str_repeat('清理垃圾文件能释放磁盘空间。', 10)),
        ])
        ->assertOk()
        ->assertJsonPath('meta_title', '彻底清理电脑垃圾文件的方法')
        ->assertJsonPath('meta_description', '从系统缓存到残留索引，逐步说明如何安全清理电脑垃圾文件。');
});

test('assist reuses an existing category and marks it as not created', function () {
    $term = Term::create(['name' => '博客', 'slug' => 'blog']);
    $taxonomy = TermTaxonomy::create([
        'term_id' => $term->term_id,
        'taxonomy' => 'category',
        'description' => '',
        'parent' => 0,
    ]);

    fakeMeta(META_PAYLOAD);

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-assist'), [
            'target' => 'categories',
            'title' => '如何彻底清理电脑垃圾文件',
            'content' => blockDoc(str_repeat('清理垃圾文件能释放磁盘空间。', 10)),
        ])
        ->assertOk()
        ->assertJsonPath('terms.0.id', $taxonomy->term_taxonomy_id)
        ->assertJsonPath('terms.0.name', '博客')
        ->assertJsonPath('terms.0.created', false);

    // 命中已有词条不应再建同名分类
    expect(Term::where('name', '博客')->count())->toBe(1);
});

test('assist creates a missing tag and reports it so the author can confirm', function () {
    fakeMeta(META_PAYLOAD);

    $response = $this->actingAs($this->author)
        ->postJson(route('articles.ai-assist'), [
            'target' => 'tags',
            'title' => '如何彻底清理电脑垃圾文件',
            'content' => blockDoc(str_repeat('清理垃圾文件能释放磁盘空间。', 10)),
        ])
        ->assertOk()
        ->assertJsonCount(2, 'terms')
        ->assertJsonPath('terms.0.name', '电脑清理')
        ->assertJsonPath('terms.0.created', true);

    $newId = $response->json('terms.0.id');

    expect(TermTaxonomy::find($newId)?->taxonomy)->toBe('tag')
        ->and(Term::where('name', '效率技巧')->exists())->toBeTrue();
});

test('assist rejects an unknown target and refuses to run without any content', function () {
    fakeMeta(META_PAYLOAD);

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-assist'), ['target' => 'whatever', 'title' => '有标题'])
        ->assertJsonValidationErrors(['target']);

    // 既无标题也无正文时不调用 AI，避免生成无依据的建议
    Option::set('ai_api_key', '');

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-assist'), ['target' => 'excerpt', 'title' => '', 'content' => []])
        ->assertStatus(422);
});

test('assist reports unconfigured ai', function () {
    Option::set('ai_api_key', '');
    Option::set('ai_model', '');

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-assist'), [
            'target' => 'excerpt',
            'title' => '如何彻底清理电脑垃圾文件',
            'content' => blockDoc(str_repeat('清理垃圾文件能释放磁盘空间。', 10)),
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', fn (string $message) => str_contains($message, 'AI 设置'));
});
