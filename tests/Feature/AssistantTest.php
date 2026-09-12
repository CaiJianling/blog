<?php

use App\Models\Attachment;
use App\Models\Option;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
    $this->regular = User::factory()->create(['role' => 'subscriber', 'email_verified_at' => now()]);
});

test('admin can view assistant settings page', function () {
    Option::set('assistant_enabled', '1');
    Option::set('assistant_name', '博客助手');

    $this->actingAs($this->admin)
        ->get(route('assistant.edit'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('settings/assistant')
            ->where('assistant_enabled', true)
            ->where('assistant_name', '博客助手')
            ->where('assistant_mode', 'standard')
            ->where('assistant_api_key_masked', ''),
        );
});

test('admin can save assistant settings', function () {
    $this->actingAs($this->admin)
        ->put(route('assistant.update'), [
            'assistant_enabled' => '1',
            'assistant_name' => '小助手',
            'assistant_welcome' => '你好呀',
            'assistant_system_prompt' => '你是博客助手',
            'assistant_mode' => 'fastgpt',
            'assistant_api_url' => 'https://fastgpt.example.com/api/v1',
            'assistant_model' => '',
            'assistant_api_key' => 'fastgpt-key',
        ])
        ->assertRedirect(route('assistant.edit'));

    expect(Option::get('assistant_enabled'))->toBe('1')
        ->and(Option::get('assistant_name'))->toBe('小助手')
        ->and(Option::get('assistant_system_prompt'))->toBe('你是博客助手')
        ->and(Option::get('assistant_mode'))->toBe('fastgpt')
        ->and(Option::get('assistant_api_url'))->toBe('https://fastgpt.example.com/api/v1')
        ->and(Option::get('assistant_api_key'))->toBe('fastgpt-key');
});

test('empty assistant api key keeps the existing one', function () {
    Option::set('assistant_api_key', 'keep-me');

    $this->actingAs($this->admin)
        ->put(route('assistant.update'), [
            'assistant_enabled' => '0',
            'assistant_name' => '助手',
            'assistant_mode' => 'standard',
            'assistant_api_key' => '',
        ])
        ->assertRedirect(route('assistant.edit'));

    expect(Option::get('assistant_api_key'))->toBe('keep-me')
        ->and(Option::get('assistant_enabled'))->toBe('0');
});

test('admin can upload and remove assistant avatar', function () {
    Storage::fake('public');

    $file = UploadedFile::fake()->image('avatar.png', 128, 128);

    $response = $this->actingAs($this->admin)
        ->postJson(route('assistant.avatar.store'), ['file' => $file]);

    $response->assertOk()->assertJsonStructure(['id', 'url']);

    expect(Option::get('assistant_avatar'))->toBe((string) Attachment::first()->id);

    $this->actingAs($this->admin)
        ->delete(route('assistant.avatar.destroy'))
        ->assertRedirect();

    expect(Option::get('assistant_avatar'))->toBe('');
});

test('non-admin cannot view or update assistant settings', function () {
    $this->actingAs($this->regular)
        ->get(route('assistant.edit'))
        ->assertRedirect(route('dashboard'));

    $this->actingAs($this->regular)
        ->put(route('assistant.update'), ['assistant_name' => 'hack'])
        ->assertRedirect(route('dashboard'));

    expect(Option::get('assistant_name', 'AI 小助手'))->toBe('AI 小助手');
});

test('chat endpoint is forbidden when assistant disabled', function () {
    Option::set('assistant_enabled', '0');

    $this->postJson(route('assistant.chat'), ['message' => '你好'])
        ->assertStatus(403);
});

test('chat endpoint requires message', function () {
    Option::set('assistant_enabled', '1');
    Option::set('assistant_api_key', 'sk-test');
    Option::set('assistant_api_url', 'https://api.example.com/v1');

    $this->postJson(route('assistant.chat'), ['message' => ''])
        ->assertJsonValidationErrors(['message']);
});

test('chat endpoint returns 502 when api not configured', function () {
    Option::set('assistant_enabled', '1');
    Option::set('assistant_api_key', '');
    Option::set('assistant_api_url', '');

    $this->postJson(route('assistant.chat'), ['message' => '你好'])
        ->assertStatus(502)
        ->assertJsonPath('message', fn (string $message) => str_contains($message, '未配置'));
});

test('standard mode sends system prompt history and user message', function () {
    Option::set('assistant_enabled', '1');
    Option::set('assistant_mode', 'standard');
    Option::set('assistant_system_prompt', '你是博客助手');
    Option::set('assistant_model', 'gpt-4o-mini');
    Option::set('assistant_api_key', 'sk-test');
    Option::set('assistant_api_url', 'https://api.example.com/v1');

    Http::fake([
        'https://api.example.com/v1/chat/completions' => Http::response([
            'choices' => [['message' => ['role' => 'assistant', 'content' => '你好，我是助手。']]],
        ]),
    ]);

    $this->postJson(route('assistant.chat'), [
        'message' => '你好',
        'history' => [
            ['role' => 'user', 'content' => '上一问'],
            ['role' => 'assistant', 'content' => '上一答'],
        ],
    ])
        ->assertOk()
        ->assertJsonPath('reply', '你好，我是助手。')
        ->assertJsonPath('chatId', null);

    Http::assertSent(function ($request) {
        $messages = $request['messages'];

        return $request['model'] === 'gpt-4o-mini'
            && $request['stream'] === false
            && $messages[0]['role'] === 'system'
            && $messages[1]['role'] === 'user'
            && $messages[2]['role'] === 'assistant'
            && $messages[3]['role'] === 'user';
    });
});

test('fastgpt mode sends chatId and detail false', function () {
    Option::set('assistant_enabled', '1');
    Option::set('assistant_mode', 'fastgpt');
    Option::set('assistant_system_prompt', '不会生效的提示词');
    Option::set('assistant_api_key', 'fastgpt-key');
    Option::set('assistant_api_url', 'https://fastgpt.example.com/api/v1');

    Http::fake([
        'https://fastgpt.example.com/api/v1/chat/completions' => Http::response([
            'choices' => [['message' => ['role' => 'assistant', 'content' => '根据知识库……']]],
        ]),
    ]);

    $this->postJson(route('assistant.chat'), [
        'message' => '博客怎么部署？',
        'chatId' => 'conv-abc-123',
    ])
        ->assertOk()
        ->assertJsonPath('reply', '根据知识库……')
        ->assertJsonPath('chatId', 'conv-abc-123');

    Http::assertSent(function ($request) {
        $messages = $request['messages'];

        return $request['chatId'] === 'conv-abc-123'
            && $request['detail'] === false
            && $request['stream'] === false
            // FastGPT 只取 messages 最后一条作为用户输入
            && count($messages) === 1
            && $messages[0]['role'] === 'user'
            && ! isset($request['model']);
    });
});

test('fastgpt mode generates chatId when absent', function () {
    Option::set('assistant_enabled', '1');
    Option::set('assistant_mode', 'fastgpt');
    Option::set('assistant_api_key', 'fastgpt-key');
    Option::set('assistant_api_url', 'https://fastgpt.example.com/api/v1');

    Http::fake([
        '*/chat/completions' => Http::response([
            'choices' => [['message' => ['role' => 'assistant', 'content' => '好的']]],
        ]),
    ]);

    $response = $this->postJson(route('assistant.chat'), ['message' => '你好'])
        ->assertOk();

    $chatId = $response->json('chatId');

    expect($chatId)->toBeString()
        ->and(strlen((string) $chatId))->toBeGreaterThan(10);

    Http::assertSent(fn ($request) => $request['chatId'] === $chatId);
});

test('chat endpoint strips think blocks from reply', function () {
    Option::set('assistant_enabled', '1');
    Option::set('assistant_mode', 'standard');
    Option::set('assistant_api_key', 'sk-test');
    Option::set('assistant_api_url', 'https://api.example.com/v1');

    Http::fake([
        '*/chat/completions' => Http::response([
            'choices' => [['message' => ['role' => 'assistant', 'content' => "<think>推理过程</think>\n最终回答"]]],
        ]),
    ]);

    $this->postJson(route('assistant.chat'), ['message' => '你好'])
        ->assertOk()
        ->assertJsonPath('reply', '最终回答');
});

test('chat endpoint is rate limited', function () {
    Option::set('assistant_enabled', '1');
    Option::set('assistant_api_key', 'sk-test');
    Option::set('assistant_api_url', 'https://api.example.com/v1');

    Http::fake(['*/chat/completions' => Http::response([
        'choices' => [['message' => ['role' => 'assistant', 'content' => 'ok']]],
    ])]);

    $last = null;

    for ($i = 0; $i < 21; $i++) {
        $last = $this->postJson(route('assistant.chat'), ['message' => '第'.$i.'条']);
    }

    $last->assertStatus(429);
});
