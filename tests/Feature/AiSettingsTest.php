<?php

use App\Models\Option;
use App\Models\User;
use App\Services\AiService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
    $this->regular = User::factory()->create(['role' => 'subscriber', 'email_verified_at' => now()]);
});

test('admin can view ai settings page', function () {
    $this->actingAs($this->admin)
        ->get(route('ai.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/ai')
            ->where('ai_api_format', 'openai')
            ->where('ai_api_url', '')
            ->where('ai_api_key_masked', '')
            ->where('ai_configured', false)
            ->has('api_url_defaults.openai')
            ->has('api_url_defaults.anthropic'),
        );
});

test('ai api key is masked and never returned in plain text', function () {
    Option::set('ai_api_key', 'sk-secret-1234567890');
    Option::set('ai_model', 'gpt-4o-mini');

    $this->actingAs($this->admin)
        ->get(route('ai.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('ai_api_key_masked', fn (string $masked) => str_ends_with($masked, '7890') && ! str_contains($masked, 'secret'))
            ->where('ai_configured', true),
        );
});

test('admin can save ai settings', function () {
    $this->actingAs($this->admin)
        ->put(route('ai.update'), [
            'ai_api_format' => 'anthropic',
            'ai_api_url' => 'https://proxy.example.com/v1',
            'ai_api_key' => 'sk-new-key',
            'ai_model' => 'deepseek-chat',
        ])
        ->assertRedirect(route('ai.edit'));

    expect(Option::get('ai_api_format'))->toBe('anthropic');
    expect(Option::get('ai_api_url'))->toBe('https://proxy.example.com/v1');
    expect(Option::get('ai_api_key'))->toBe('sk-new-key');
    expect(Option::get('ai_model'))->toBe('deepseek-chat');
});

test('api format must be openai or anthropic', function () {
    $this->actingAs($this->admin)
        ->put(route('ai.update'), [
            'ai_api_format' => 'gemini',
            'ai_model' => 'gpt-4o-mini',
        ])
        ->assertSessionHasErrors(['ai_api_format']);
});

test('empty api key keeps the existing one', function () {
    Option::set('ai_api_key', 'sk-keep-me');

    $this->actingAs($this->admin)
        ->put(route('ai.update'), [
            'ai_api_format' => 'openai',
            'ai_api_url' => 'https://api.openai.com/v1',
            'ai_api_key' => '',
            'ai_model' => 'gpt-4o-mini',
        ])
        ->assertRedirect(route('ai.edit'));

    expect(Option::get('ai_api_key'))->toBe('sk-keep-me');
    expect(Option::get('ai_model'))->toBe('gpt-4o-mini');
});

test('empty api url is stored as-is and falls back at runtime', function () {
    Option::set('ai_api_url', 'https://api.deepseek.com/v1');

    $this->actingAs($this->admin)
        ->put(route('ai.update'), [
            'ai_api_format' => 'openai',
            'ai_api_url' => '',
            'ai_model' => 'gpt-4o-mini',
        ])
        ->assertRedirect(route('ai.edit'));

    // 留空保存为空串，运行时按当前格式回退默认地址
    expect(Option::get('ai_api_url'))->toBe('');

    Option::set('ai_api_key', 'sk-test');

    Http::fake([
        AiService::DEFAULT_API_URL.'/models' => Http::response([
            'data' => [['id' => 'gpt-4o-mini']],
        ]),
    ]);

    $this->actingAs($this->admin)
        ->getJson(route('ai.models'))
        ->assertOk()
        ->assertJsonPath('data', ['gpt-4o-mini']);
});

test('non-admin cannot view or update ai settings', function () {
    $this->actingAs($this->regular)
        ->get(route('ai.edit'))
        ->assertRedirect(route('dashboard'));

    $this->actingAs($this->regular)
        ->put(route('ai.update'), ['ai_model' => 'hack'])
        ->assertRedirect(route('dashboard'));

    expect(Option::get('ai_model', ''))->toBe('');
});

test('models endpoint requires a saved api key', function () {
    Option::set('ai_api_key', '');

    $this->actingAs($this->admin)
        ->getJson(route('ai.models'))
        ->assertStatus(422)
        ->assertJsonPath('message', fn (string $message) => str_contains($message, 'API 密钥'));
});

test('non-admin cannot fetch models', function () {
    $this->actingAs($this->regular)
        ->getJson(route('ai.models'))
        ->assertStatus(403);
});

test('models endpoint returns model ids from openai compatible api', function () {
    Option::set('ai_api_url', 'https://api.example.com/v1');
    Option::set('ai_api_key', 'sk-test');

    Http::fake([
        'https://api.example.com/v1/models' => Http::response([
            'data' => [
                ['id' => 'gpt-4o-mini'],
                ['id' => 'deepseek-chat'],
                ['id' => 'gpt-4o'],
                ['id' => 'deepseek-chat'], // 重复项应被去重
                ['object' => 'no-id'], // 无 id 的项应被忽略
            ],
        ]),
    ]);

    $this->actingAs($this->admin)
        ->getJson(route('ai.models'))
        ->assertOk()
        ->assertJsonPath('data', ['deepseek-chat', 'gpt-4o', 'gpt-4o-mini']);
});

test('models endpoint returns 502 when api fails', function () {
    Option::set('ai_api_key', 'sk-test');

    Http::fake([
        '*/models' => Http::response(['error' => ['message' => 'bad key']], 401),
    ]);

    $this->actingAs($this->admin)
        ->getJson(route('ai.models'))
        ->assertStatus(502)
        ->assertJsonPath('message', fn (string $message) => str_contains($message, '401'));
});

test('listModels throws when api returns unexpected format', function () {
    Option::set('ai_api_key', 'sk-test');

    Http::fake([
        '*/models' => Http::response(['unexpected' => true]),
    ]);

    $this->actingAs($this->admin)
        ->getJson(route('ai.models'))
        ->assertStatus(502)
        ->assertJsonPath('message', fn (string $message) => str_contains($message, '格式'))
        ->assertJsonPath('debug.status', 200)
        ->assertJsonPath('debug.url', fn (string $url) => str_contains($url, '/models'));
});

test('assistant models endpoint uses the assistant own credentials', function () {
    // 全局 AI 配置同时存在，但小助手必须用自己的接口与密钥
    Option::set('ai_api_key', 'sk-global');
    Option::set('ai_api_url', 'https://global.example.com/v1');
    Option::set('assistant_api_url', 'https://assistant.example.com/v1/');
    Option::set('assistant_api_key', 'sk-assistant');

    Http::fake([
        'https://assistant.example.com/v1/models' => Http::response([
            'data' => [['id' => 'qwen-plus'], ['id' => 'gpt-4o-mini'], ['id' => 'qwen-plus']],
        ]),
    ]);

    $this->actingAs($this->admin)
        ->getJson(route('assistant.models'))
        ->assertOk()
        ->assertJsonPath('data', ['gpt-4o-mini', 'qwen-plus']);

    Http::assertSent(
        fn (Request $request) => $request->url() === 'https://assistant.example.com/v1/models'
            && $request->hasHeader('Authorization', 'Bearer sk-assistant'),
    );
});

test('assistant models endpoint requires the assistant own api key', function () {
    Option::set('ai_api_key', 'sk-global');
    Option::set('assistant_api_url', 'https://assistant.example.com/v1');
    Option::set('assistant_api_key', '');

    Http::fake();

    $this->actingAs($this->admin)
        ->getJson(route('assistant.models'))
        ->assertStatus(422)
        ->assertJsonPath('message', fn (string $message) => str_contains($message, '小助手'));

    Http::assertNothingSent();
});

test('assistant models endpoint reports a missing api url', function () {
    Option::set('assistant_api_key', 'sk-assistant');
    Option::set('assistant_api_url', '');

    Http::fake();

    $this->actingAs($this->admin)
        ->getJson(route('assistant.models'))
        ->assertStatus(502)
        ->assertJsonPath('message', fn (string $message) => str_contains($message, '接口地址'));

    Http::assertNothingSent();
});

test('assistant models endpoint returns 502 when api fails', function () {
    Option::set('assistant_api_url', 'https://assistant.example.com/v1');
    Option::set('assistant_api_key', 'sk-assistant');

    Http::fake([
        '*/models' => Http::response(['error' => ['message' => 'bad key']], 403),
    ]);

    $this->actingAs($this->admin)
        ->getJson(route('assistant.models'))
        ->assertStatus(502)
        ->assertJsonPath('message', fn (string $message) => str_contains($message, '403'));
});

test('non-admin cannot fetch assistant models', function () {
    $this->actingAs($this->regular)
        ->getJson(route('assistant.models'))
        ->assertStatus(403);
});
