<?php

use App\Models\Option;
use App\Models\Term;
use App\Models\TermTaxonomy;
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

test('returns seo meta fields and normalized tag/category names', function () {
    Option::set('ai_api_key', 'sk-test');
    Option::set('ai_model', 'test-model');

    $content = json_encode([
        'title' => '本地咖啡店探店指南',
        'excerpt' => '一篇探店指南。',
        'markdown' => "## 开头\n\n正文。",
        'meta_title' => '本地咖啡店探店指南｜点单避坑全攻略',
        'meta_description' => '带你系统了解本地咖啡店的点单、避坑与推荐。',
        'tags' => ['咖啡', '探店', '攻略'],
        'categories' => ['生活', '美食'],
    ], JSON_UNESCAPED_UNICODE);

    Http::fake([
        '*/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => $content]]],
        ]),
    ]);

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-generate'), ['prompt' => '写一篇探店指南'])
        ->assertOk()
        ->assertJsonPath('meta_title', '本地咖啡店探店指南｜点单避坑全攻略')
        ->assertJsonPath('meta_description', '带你系统了解本地咖啡店的点单、避坑与推荐。')
        ->assertJsonPath('tags', ['咖啡', '探店', '攻略'])
        ->assertJsonPath('categories', ['生活', '美食'])
        ->assertJsonPath('category_ids', fn (array $ids) => count($ids) === 2)
        ->assertJsonPath('tag_ids', fn (array $ids) => count($ids) === 3);

    // 无现有词条 → 全部新建
    expect(TermTaxonomy::where('taxonomy', 'category')->count())->toBe(2);
    expect(TermTaxonomy::where('taxonomy', 'tag')->count())->toBe(3);
});

test('reuses existing taxonomies and only creates the missing ones', function () {
    Option::set('ai_api_key', 'sk-test');
    Option::set('ai_model', 'test-model');

    $existingCat = Term::create(['name' => '生活', 'slug' => 'sheng-huo']);
    $existingCatTax = TermTaxonomy::create(['term_id' => $existingCat->term_id, 'taxonomy' => 'category', 'description' => '', 'parent' => 0]);
    $existingTag = Term::create(['name' => '咖啡', 'slug' => 'ka-fei']);
    $existingTagTax = TermTaxonomy::create(['term_id' => $existingTag->term_id, 'taxonomy' => 'tag', 'description' => '', 'parent' => 0]);

    $content = json_encode([
        'title' => '探店',
        'excerpt' => '摘要',
        'markdown' => '正文',
        'tags' => ['咖啡', '新标签'],
        'categories' => ['生活', '美食'],
    ], JSON_UNESCAPED_UNICODE);

    Http::fake([
        '*/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => $content]]],
        ]),
    ]);

    $data = $this->actingAs($this->author)
        ->postJson(route('articles.ai-generate'), ['prompt' => '探店'])
        ->assertOk()
        ->json();

    // 命中已有 → 复用其 id；缺失 → 新建
    expect($data['category_ids'])->toHaveCount(2);
    expect($data['tag_ids'])->toHaveCount(2);
    expect($data['category_ids'])->toContain($existingCatTax->term_taxonomy_id);
    expect($data['tag_ids'])->toContain($existingTagTax->term_taxonomy_id);
    expect($data['created_categories'])->toHaveCount(1);
    expect($data['created_categories'][0]['name'])->toBe('美食');
    expect($data['created_tags'])->toHaveCount(1);
    expect($data['created_tags'][0]['name'])->toBe('新标签');

    // DB 里各 2 个（复用的 1 个 + 新建的 1 个）
    expect(TermTaxonomy::where('taxonomy', 'category')->count())->toBe(2);
    expect(TermTaxonomy::where('taxonomy', 'tag')->count())->toBe(2);
});

test('passes existing categories and tags to the ai as context', function () {
    Option::set('ai_api_key', 'sk-test');
    Option::set('ai_model', 'test-model');

    $tech = Term::create(['name' => '技术', 'slug' => 'ji-zhu']);
    TermTaxonomy::create(['term_id' => $tech->term_id, 'taxonomy' => 'category', 'description' => '', 'parent' => 0]);
    $coffee = Term::create(['name' => '咖啡', 'slug' => 'ka-fei']);
    TermTaxonomy::create(['term_id' => $coffee->term_id, 'taxonomy' => 'tag', 'description' => '', 'parent' => 0]);

    Http::fake([
        '*/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => json_encode(['title' => 't', 'markdown' => 'm'])]]],
        ]),
    ]);

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-generate'), ['prompt' => '写一篇关于烘焙的文章'])
        ->assertOk();

    // 现有分类/标签名应进入 AI 的用户消息（作为选词上下文）
    Http::assertSent(function ($request) {
        $userMessage = $request['messages'][1]['content'] ?? '';

        return str_contains($userMessage, '技术') && str_contains($userMessage, '咖啡');
    });
});

test('main call already returns tags/categories so no fallback call is made', function () {
    Option::set('ai_api_key', 'sk-test');
    Option::set('ai_model', 'test-model');

    $content = json_encode([
        'title' => '秋日漫步',
        'excerpt' => '摘要',
        'markdown' => '正文',
        'tags' => ['秋天', '散步'],
        'categories' => ['生活'],
    ], JSON_UNESCAPED_UNICODE);

    Http::fake([
        '*/chat/completions' => Http::response([
            'choices' => [['message' => ['content' => $content]]],
        ]),
    ]);

    $this->actingAs($this->author)
        ->postJson(route('articles.ai-generate'), ['prompt' => '写秋天的文章'])
        ->assertOk()
        ->assertJsonPath('tags', ['秋天', '散步']);

    // 已有标签/分类 → 只调用一次主生成，不触发补全
    Http::assertSentCount(1);
});

test('falls back to a focused meta call when the main call omits tags and categories', function () {
    Option::set('ai_api_key', 'sk-test');
    Option::set('ai_model', 'test-model');

    // 主生成：只有标题/摘要/正文（模拟弱模型漏掉新字段）
    $main = json_encode([
        'title' => '秋日漫步',
        'excerpt' => '关于秋天的散文。',
        'markdown' => "## 开头\n\n秋天的第一缕风。",
    ], JSON_UNESCAPED_UNICODE);

    // 补全调用：聚焦输出 SEO/标签/分类
    $meta = json_encode([
        'meta_title' => '秋日漫步指南：散步与散文',
        'meta_description' => '一篇关于秋天散步与散文的暖心文章。',
        'tags' => ['秋天', '散步', '散文'],
        'categories' => ['生活'],
    ], JSON_UNESCAPED_UNICODE);

    Http::fake([
        '*/chat/completions' => Http::sequence()
            ->push(['choices' => [['message' => ['content' => $main]]]])
            ->push(['choices' => [['message' => ['content' => $meta]]]]),
    ]);

    $data = $this->actingAs($this->author)
        ->postJson(route('articles.ai-generate'), ['prompt' => '写秋天的文章'])
        ->assertOk()
        ->json();

    // 补全调用把 标签/分类/SEO 填上了
    expect($data['tags'])->toBe(['秋天', '散步', '散文']);
    expect($data['categories'])->toBe(['生活']);
    expect($data['meta_title'])->toBe('秋日漫步指南：散步与散文');
    expect($data['tag_ids'])->toHaveCount(3);
    expect($data['category_ids'])->toHaveCount(1);

    // 发生了两次调用：主生成 + 补全
    Http::assertSentCount(2);
});
