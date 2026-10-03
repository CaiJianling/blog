<?php

namespace App\Http\Controllers;

use App\Models\Option;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * AI 小助手对话代理：隐藏 API 密钥，支持 OpenAI 兼容与 FastGPT 知识库两种接口模式。
 *
 * FastGPT（OpenAI 兼容扩展）：POST {base}/chat/completions，
 * 传入 chatId 时由 FastGPT 服务端保存/续接会话上下文（此时仅取 messages 最后一条作为用户输入），
 * detail=false 返回简洁的 OpenAI 结构。
 *
 * 标准 OpenAI 兼容接口：由前端传入近期历史（history）构建上下文。
 */
class AssistantChatController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        if (Option::get('assistant_enabled') !== '1') {
            return response()->json(['message' => 'AI 小助手未启用。'], 403);
        }

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
            'history' => ['nullable', 'array', 'max:20'],
            'history.*.role' => ['required', 'in:user,assistant'],
            'history.*.content' => ['required', 'string', 'max:4000'],
            'chatId' => ['nullable', 'string', 'max:250'],
        ], [
            'message.required' => '请输入消息内容。',
            'message.max' => '消息内容不能超过 2000 个字符。',
        ]);

        $apiUrl = rtrim(trim((string) Option::get('assistant_api_url', '')), '/');
        $apiKey = trim((string) Option::get('assistant_api_key', ''));

        if ($apiUrl === '' || $apiKey === '') {
            return response()->json(['message' => 'AI 小助手接口未配置，请在后台完成设置。'], 502);
        }

        $message = trim($validated['message']);
        $mode = Option::get('assistant_mode', 'standard') === 'fastgpt' ? 'fastgpt' : 'standard';
        $chatId = isset($validated['chatId']) && $validated['chatId'] !== ''
            ? (string) $validated['chatId']
            : (string) Str::uuid();

        $payload = $mode === 'fastgpt'
            ? $this->fastgptPayload($message, $chatId)
            : $this->standardPayload($message, $validated['history'] ?? [], $chatId);

        try {
            $response = Http::withToken($apiKey)
                ->timeout(120)
                ->connectTimeout(15)
                ->acceptJson()
                ->post($apiUrl.'/chat/completions', $payload);
        } catch (\Throwable $e) {
            Log::warning('AssistantChat: 连接失败', ['url' => $apiUrl, 'error' => $e->getMessage()]);

            return response()->json(['message' => '无法连接 AI 接口，请稍后重试。'], 502);
        }

        if ($response->failed()) {
            $errorBody = $response->json('error.message') ?? mb_substr($response->body(), 0, 200);

            Log::warning('AssistantChat: 接口返回错误', [
                'url' => $apiUrl,
                'status' => $response->status(),
                'body' => mb_substr($response->body(), 0, 500),
            ]);

            return response()->json([
                'message' => $errorBody !== ''
                    ? "AI 接口返回错误：{$errorBody}"
                    : "AI 接口请求失败（HTTP {$response->status()}），请稍后重试。",
            ], 502);
        }

        $reply = (string) ($response->json('choices.0.message.content') ?? '');

        // 去除思考型模型输出的推理段
        $reply = trim((string) preg_replace('/<think>.*?<\/think>/is', '', $reply));

        if ($reply === '') {
            return response()->json(['message' => 'AI 接口未返回内容，请稍后重试。'], 502);
        }

        return response()->json([
            'reply' => $reply,
            'chatId' => $mode === 'fastgpt' ? $chatId : null,
        ]);
    }

    /**
     * 标准 OpenAI 兼容负载：服务端无会话记忆，由前端传入的近期历史构建上下文。
     *
     * @param  array<int, array{role: string, content: string}>  $history
     * @return array<string, mixed>
     */
    protected function standardPayload(string $message, array $history, string $chatId): array
    {
        $messages = [];

        $systemPrompt = trim((string) Option::get('assistant_system_prompt', ''));

        if ($systemPrompt !== '') {
            $messages[] = ['role' => 'system', 'content' => $systemPrompt];
        }

        foreach (array_slice($history, -20) as $item) {
            $messages[] = ['role' => $item['role'], 'content' => $item['content']];
        }

        $messages[] = ['role' => 'user', 'content' => $message];

        $payload = [
            'stream' => false,
            'messages' => $messages,
        ];

        $model = trim((string) Option::get('assistant_model', ''));

        if ($model !== '') {
            $payload['model'] = $model;
        }

        return $payload;
    }

    /**
     * FastGPT 负载：chatId 由服务端保存会话，仅传最后一条用户输入；提示词由应用编排决定。
     *
     * @return array<string, mixed>
     */
    protected function fastgptPayload(string $message, string $chatId): array
    {
        return [
            'stream' => false,
            'detail' => false,
            'chatId' => $chatId,
            'messages' => [
                ['role' => 'user', 'content' => $message],
            ],
        ];
    }
}
