<?php

use App\Models\Option;
use App\Models\User;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    $this->author = User::factory()->create(['role' => 'author', 'email_verified_at' => now()]);
});

test('guests are redirected to login on pages ai-generate', function () {
    $this->post(route('pages.ai-generate'), ['prompt' => '写一个关于我们页面'])
        ->assertRedirect(route('login'));
});

test('prompt is required for pages ai-generate', function () {
    $this->actingAs($this->author)
        ->postJson(route('pages.ai-generate'), ['prompt' => ''])
        ->assertJsonValidationErrors(['prompt']);
});

test('returns 422 when ai is not configured for pages', function () {
    Option::set('ai_api_key', '');
    Option::set('ai_model', '');

    $this->actingAs($this->author)
        ->postJson(route('pages.ai-generate'), ['prompt' => '写一个关于我们页面'])
        ->assertStatus(422)
        ->assertJsonPath('message', fn (string $message) => str_contains($message, 'AI 设置'));
});

test('generates page fields (title, markdown, seo) without tags/categories', function () {
    Option::set('ai_api_url', 'https://api.openai.com/v1');
    Option::set('ai_api_key', 'sk-test');
    Option::set('ai_model', 'gpt-4o-mini');

    $content = json_encode([
        'title' => '关于我们',
        'markdown' => "## 我们的故事\n\n成立于 2026 年。",
        'meta_title' => '关于我们｜博客',
        'meta_description' => '了解我们的网站定位与团队。',
    ]);

    Http::fake([
        'https://api.openai.com/v1/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => $content]]],
        ]),
    ]);

    $data = $this->actingAs($this->author)
        ->postJson(route('pages.ai-generate'), ['prompt' => '写一个关于我们页面'])
        ->assertOk()
        ->json();

    expect($data['title'])->toBe('关于我们')
        ->and($data['markdown'])->toContain('成立于 2026 年')
        ->and($data['meta_title'])->toBe('关于我们｜博客')
        ->and($data['meta_description'])->toBe('了解我们的网站定位与团队。')
        // 页面无标签/分类，接口不应回传这些字段
        ->and(array_key_exists('tags', $data))->toBeFalse()
        ->and(array_key_exists('categories', $data))->toBeFalse()
        ->and(array_key_exists('category_ids', $data))->toBeFalse()
        ->and(array_key_exists('tag_ids', $data))->toBeFalse();
});

test('falls back to plain markdown and defaults meta_title to the title (page)', function () {
    Option::set('ai_api_key', 'sk-test');
    Option::set('ai_model', 'test-model');

    $markdown = "## 联系我们\n\n邮箱 contact@example.com";

    Http::fake([
        '*/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => $markdown]]],
        ]),
    ]);

    $data = $this->actingAs($this->author)
        ->postJson(route('pages.ai-generate'), ['prompt' => '写一个联系我们页面'])
        ->assertOk()
        ->json();

    expect($data['title'])->toBe('联系我们')
        ->and($data['markdown'])->toBe($markdown)
        ->and($data['meta_title'])->toBe('联系我们');
});

test('returns 502 with debug context when the ai api fails (page)', function () {
    Option::set('ai_api_key', 'sk-test');
    Option::set('ai_model', 'test-model');

    Http::fake([
        '*/chat/completions' => Http::response(['error' => ['message' => 'Invalid API key']], 401),
    ]);

    $this->actingAs($this->author)
        ->postJson(route('pages.ai-generate'), ['prompt' => '写点什么'])
        ->assertStatus(502)
        ->assertJsonPath('message', fn (string $message) => str_contains($message, 'Invalid API key'))
        ->assertJsonPath('debug.status', 401);
});
