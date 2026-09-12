<?php

use App\Models\Option;
use App\Models\User;
use App\Services\AiService;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    $this->author = User::factory()->create(['role' => 'author', 'email_verified_at' => now()]);
});

test('guests are redirected to login', function () {
    $this->post(route('articles.ai-generate'), ['prompt' => '写一篇关于秋天的文章'])
        ->assertRedirect(route('login'));
});

test('prompt is required', function () {
    $this->actingAs($this->author)
        ->postJson(route('articles.ai-generate'), ['prompt' => ''])
        ->assertJsonValidationErrors(['prompt']);
});

test('returns 422 when ai is not configured', function () {
    Option::set('ai_api_key', '');
    Option::set('ai_model', '');

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-generate'), ['prompt' => '写一篇关于秋天的文章'])
        ->assertStatus(422)
        ->assertJsonPath('message', fn (string $message) => str_contains($message, 'AI 设置'));
});

test('generates article fields from openai compatible api', function () {
    Option::set('ai_api_url', 'https://api.openai.com/v1');
    Option::set('ai_api_key', 'sk-test');
    Option::set('ai_model', 'gpt-4o-mini');

    $content = json_encode([
        'title' => '秋日漫步指南',
        'excerpt' => '一篇关于秋天的散文。',
        'markdown' => "## 开头\n\n秋天的第一缕风。",
    ]);

    Http::fake([
        'https://api.openai.com/v1/chat/completions' => Http::response([
            'choices' => [
                ['message' => ['content' => $content]],
            ],
        ]),
    ]);

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-generate'), ['prompt' => '写一篇关于秋天的文章'])
        ->assertOk()
        ->assertJsonPath('title', '秋日漫步指南')
        ->assertJsonPath('excerpt', '一篇关于秋天的散文。')
        ->assertJsonPath('markdown', "## 开头\n\n秋天的第一缕风。");

    Http::assertSent(function ($request) {
        return $request->url() === 'https://api.openai.com/v1/chat/completions'
            && $request['model'] === 'gpt-4o-mini'
            && str_contains($request['messages'][1]['content'], '秋天的文章');
    });
});

test('parses ai output wrapped in markdown code fences', function () {
    Option::set('ai_api_key', 'sk-test');
    Option::set('ai_model', 'test-model');

    $content = "```json\n".json_encode([
        'title' => '标题',
        'excerpt' => '摘要',
        'markdown' => '正文',
    ])."\n```";

    Http::fake([
        '*/chat/completions' => Http::response([
            'choices' => [
                ['message' => ['content' => $content]],
            ],
        ]),
    ]);

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-generate'), ['prompt' => '随便写点什么'])
        ->assertOk()
        ->assertJsonPath('title', '标题');
});

test('returns 502 when ai response contains unparseable json', function () {
    Option::set('ai_api_key', 'sk-test');
    Option::set('ai_model', 'test-model');

    Http::fake([
        '*/chat/completions' => Http::response([
            'choices' => [
                ['message' => ['content' => '前缀文字 {title: 断掉的JSON,]] 后缀']],
            ],
        ]),
    ]);

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-generate'), ['prompt' => '写点什么'])
        ->assertStatus(502)
        ->assertJsonPath('message', fn (string $message) => str_contains($message, '解析'))
        ->assertJsonPath('debug.raw', fn (string $raw) => str_contains($raw, '断掉的JSON'));
});

test('tolerates unescaped quotes inside json string values', function () {
    Option::set('ai_api_key', 'sk-test');
    Option::set('ai_model', 'test-model');

    // 模拟模型输出：markdown 值内部含未转义的英文双引号，整体 JSON 非法
    $content = '{"title":"新手探店指南","excerpt":"一次不踩雷的探店体验。","markdown":"这份指南就是写给"第一次认真探本地咖啡店"的你。\\n\\n## 出门前\\n\\n- 留意"豆子产地"这类细节。"}';

    Http::fake([
        '*/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => $content]]],
        ]),
    ]);

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-generate'), ['prompt' => '写点什么'])
        ->assertOk()
        ->assertJsonPath('title', '新手探店指南')
        ->assertJsonPath('excerpt', '一次不踩雷的探店体验。')
        ->assertJsonPath('markdown', fn (string $markdown) => str_contains($markdown, '写给"第一次认真探本地咖啡店"的你。')
            && str_contains($markdown, '## 出门前')
            && str_contains($markdown, '留意"豆子产地"这类细节。'));
});

test('tolerates json fields in non-standard order', function () {
    Option::set('ai_api_key', 'sk-test');
    Option::set('ai_model', 'test-model');

    $content = '{"markdown":"正文"引用"段落。","excerpt":"摘","title":"标"}';

    Http::fake([
        '*/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => $content]]],
        ]),
    ]);

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-generate'), ['prompt' => '写点什么'])
        ->assertOk()
        ->assertJsonPath('title', '标')
        ->assertJsonPath('excerpt', '摘')
        ->assertJsonPath('markdown', fn (string $markdown) => str_contains($markdown, '正文"引用"段落。'));
});

test('supports chinese json keys', function () {
    Option::set('ai_api_key', 'sk-test');
    Option::set('ai_model', 'test-model');

    $content = '{"标题":"秋日","摘要":"关于秋天。","正文":"## 秋日\n\n正文"}';

    Http::fake([
        '*/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => $content]]],
        ]),
    ]);

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-generate'), ['prompt' => '写点什么'])
        ->assertOk()
        ->assertJsonPath('title', '秋日')
        ->assertJsonPath('markdown', fn (string $markdown) => str_contains($markdown, '正文'));
});

test('returns 502 with url and link hint on 404', function () {
    Option::set('ai_api_key', 'sk-test');
    Option::set('ai_model', 'test-model');

    Http::fake([
        '*/chat/completions' => Http::response('<!DOCTYPE html><html><title>Not Found</title></html>', 404),
    ]);

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-generate'), ['prompt' => '写点什么'])
        ->assertStatus(502)
        ->assertJsonPath('message', fn (string $message) => str_contains($message, 'HTTP 404')
            && str_contains($message, 'POST')
            && str_contains($message, '链路临时中断'));

    // 不自动重试：仅请求一次，快速失败返回
    Http::assertSentCount(1);
});

test('returns 502 when ai api fails', function () {
    Option::set('ai_api_key', 'sk-test');
    Option::set('ai_model', 'test-model');

    Http::fake([
        '*/chat/completions' => Http::response(['error' => ['message' => 'Invalid API key']], 401),
    ]);

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-generate'), ['prompt' => '写点什么'])
        ->assertStatus(502)
        ->assertJsonPath('message', fn (string $message) => str_contains($message, 'Invalid API key'))
        ->assertJsonPath('debug.status', 401)
        ->assertJsonPath('debug.url', fn (string $url) => str_contains($url, '/chat/completions'));
});

test('strips think blocks from reasoning models', function () {
    Option::set('ai_api_key', 'sk-test');
    Option::set('ai_model', 'deepseek-reasoner');

    $content = "<think>\n用户想要一篇关于秋天的文章，我先构思一下……\n</think>\n\n"
        .json_encode([
            'title' => '秋日私语',
            'excerpt' => '摘要',
            'markdown' => '## 秋日私语\n\n正文',
        ], JSON_UNESCAPED_UNICODE);

    Http::fake([
        '*/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => $content]]],
        ]),
    ]);

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-generate'), ['prompt' => '写点什么'])
        ->assertOk()
        ->assertJsonPath('title', '秋日私语');
});

test('falls back to plain markdown when ai returns no json at all', function () {
    Option::set('ai_api_key', 'sk-test');
    Option::set('ai_model', 'test-model');

    $markdown = "## 漫步秋天\n\n秋天来了，天气转凉。\n\n- 落叶\n- 微风";

    Http::fake([
        '*/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => $markdown]]],
        ]),
    ]);

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-generate'), ['prompt' => '写点什么'])
        ->assertOk()
        ->assertJsonPath('title', '漫步秋天')
        ->assertJsonPath('markdown', $markdown)
        ->assertJsonPath('excerpt', fn (string $excerpt) => str_contains($excerpt, '秋天来了'));
});

test('generates article via anthropic messages api', function () {
    Option::set('ai_api_format', 'anthropic');
    Option::set('ai_api_url', '');
    Option::set('ai_api_key', 'sk-ant-test');
    Option::set('ai_model', 'claude-sonnet-4-5');

    $content = json_encode([
        'title' => '秋天的信',
        'excerpt' => 'Anthropic 生成的摘要。',
        'markdown' => '## 秋天的信\n\n正文内容。',
    ], JSON_UNESCAPED_UNICODE);

    Http::fake([
        'https://api.anthropic.com/v1/messages' => Http::response([
            'id' => 'msg_1',
            'role' => 'assistant',
            'content' => [
                ['type' => 'text', 'text' => $content],
            ],
        ]),
    ]);

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-generate'), ['prompt' => '写一篇关于秋天的文章'])
        ->assertOk()
        ->assertJsonPath('title', '秋天的信')
        ->assertJsonPath('excerpt', 'Anthropic 生成的摘要。');

    Http::assertSent(function ($request) {
        return $request->url() === 'https://api.anthropic.com/v1/messages'
            && $request->header('x-api-key')[0] === 'sk-ant-test'
            && $request['model'] === 'claude-sonnet-4-5'
            && isset($request['max_tokens'])
            && str_contains($request['system'], '博客写作助手')
            && str_contains($request['messages'][0]['content'], '秋天的文章');
    });
});

test('models endpoint uses anthropic auth headers and endpoint', function () {
    Option::set('ai_api_format', 'anthropic');
    Option::set('ai_api_key', 'sk-ant-test');

    Http::fake([
        'https://api.anthropic.com/v1/models' => Http::response([
            'data' => [['id' => 'claude-sonnet-4-5'], ['id' => 'claude-haiku-4-5']],
        ]),
    ]);

    $this->actingAs($this->admin ?? User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]))
        ->getJson(route('ai.models'))
        ->assertOk()
        ->assertJsonPath('data', ['claude-haiku-4-5', 'claude-sonnet-4-5']);

    Http::assertSent(fn ($request) => $request->header('x-api-key')[0] === 'sk-ant-test'
        && $request->header('anthropic-version')[0] === AiService::ANTHROPIC_VERSION);
});
