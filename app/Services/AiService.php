<?php

namespace App\Services;

use App\Exceptions\AiRequestException;
use App\Models\Option;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * AI 写作服务：支持 OpenAI 兼容（Chat Completions）与 Anthropic（Messages）两种接口格式。
 * 配置存于 options 表（ai_api_format / ai_api_url / ai_api_key / ai_model），由 AI 设置页维护。
 */
class AiService
{
    /**
     * OpenAI 兼容接口默认地址。
     */
    public const DEFAULT_API_URL = 'https://api.openai.com/v1';

    /**
     * Anthropic 接口默认地址。
     */
    public const DEFAULT_ANTHROPIC_API_URL = 'https://api.anthropic.com/v1';

    /**
     * Anthropic API 版本头。
     */
    public const ANTHROPIC_VERSION = '2023-06-01';

    /**
     * Anthropic Messages 必填的最大输出 token 数。
     */
    public const ANTHROPIC_MAX_TOKENS = 4096;

    /**
     * 当前配置的接口格式：openai | anthropic。
     */
    public function format(): string
    {
        return Option::get('ai_api_format', 'openai') === 'anthropic' ? 'anthropic' : 'openai';
    }

    /**
     * 当前格式对应的默认接口地址。
     */
    public function defaultApiUrl(): string
    {
        return $this->format() === 'anthropic'
            ? self::DEFAULT_ANTHROPIC_API_URL
            : self::DEFAULT_API_URL;
    }

    /**
     * 是否已完成 AI 配置（密钥与模型均不为空）。
     */
    public function isConfigured(): bool
    {
        return trim((string) Option::get('ai_api_key', '')) !== ''
            && trim((string) Option::get('ai_model', '')) !== '';
    }

    /**
     * 拉取接口的可用模型列表（GET /models，两种格式均兼容，仅鉴权头不同）。
     *
     * @return array<int, string> 模型 ID 列表
     *
     * @throws \RuntimeException 未配置密钥、接口失败或返回格式异常时抛出
     */
    public function listModels(): array
    {
        $apiKey = trim((string) Option::get('ai_api_key', ''));

        if ($apiKey === '') {
            throw new \RuntimeException('请先填写并保存 API 密钥，再获取模型列表。');
        }

        $modelsUrl = $this->resolveApiUrl().'/models';

        try {
            $response = $this->authorizedRequest($apiKey)->get($modelsUrl);
        } catch (\Throwable $e) {
            Log::warning('AiService: 获取模型列表连接失败', ['error' => $e->getMessage()]);

            throw new AiRequestException('无法连接 AI 接口，请检查接口地址与网络。', [
                'url' => $modelsUrl ?? null,
                'error' => $e->getMessage(),
            ]);
        }

        if ($response->failed()) {
            Log::warning('AiService: 获取模型列表失败', [
                'url' => $modelsUrl ?? null,
                'status' => $response->status(),
                'body' => mb_substr($response->body(), 0, 500),
            ]);

            throw new AiRequestException(
                "获取模型列表失败（HTTP {$response->status()}，GET {$modelsUrl}），请检查接口地址与密钥。",
                [
                    'status' => $response->status(),
                    'url' => $modelsUrl,
                    'body' => mb_substr($response->body(), 0, 500),
                ]
            );
        }

        $data = $response->json('data');

        if (! is_array($data)) {
            throw new AiRequestException('AI 接口返回的模型列表格式不正确。', [
                'status' => $response->status(),
                'url' => $modelsUrl,
                'body' => mb_substr($response->body(), 0, 500),
            ]);
        }

        $ids = collect($data)
            ->map(fn ($item) => is_array($item) ? ($item['id'] ?? null) : null)
            ->filter(fn ($id) => is_string($id) && $id !== '')
            ->unique()
            ->sort()
            ->values()
            ->all();

        if ($ids === []) {
            throw new \RuntimeException('AI 接口未返回可用模型。');
        }

        return $ids;
    }

    /**
     * 根据写作提示生成文章。
     *
     * @param  string  $prompt  作者给出的写作提示
     * @return array{title: string, excerpt: string, markdown: string}
     *
     * @throws \RuntimeException 配置缺失、接口失败或返回格式异常时抛出
     */
    public function generateArticle(string $prompt): array
    {
        $systemPrompt = <<<'PROMPT'
你是一位资深博客写作助手。请根据用户给出的写作要求创作一篇博客文章。
严格输出一个 JSON 对象，不要输出 JSON 以外的任何内容，也不要用 Markdown 代码块包裹。格式：
{"title":"文章标题","excerpt":"不超过 80 字的文章摘要","markdown":"使用 Markdown 语法的文章正文"}
正文要求：使用 Markdown 语法；包含清晰的段落与必要的二级/三级标题（##/###）；适合处使用列表；不要输出一级标题；不要包含标题与摘要的重复说明；使用与写作要求一致的语言。
重要：输出必须是合法 JSON。字符串值内部禁止输出未转义的英文双引号；正文中如需引用词语，请一律使用中文引号「」。
PROMPT;

        $text = $this->chatCompletion([
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => "写作要求：{$prompt}"],
        ]);

        $data = $this->extractArticlePayload($text);

        // 兼容个别模型输出中文键名的情况
        $title = trim((string) ($data['title'] ?? $data['标题'] ?? ''));
        $excerpt = trim((string) ($data['excerpt'] ?? $data['摘要'] ?? ''));
        $markdown = trim((string) ($data['markdown'] ?? $data['正文'] ?? ''));

        if ($title === '' || $markdown === '') {
            Log::warning('AiService: AI 返回内容缺少 title 或 markdown', ['raw' => mb_substr($text, 0, 1000)]);

            throw new AiRequestException('AI 返回的内容格式不正确，请重试或更换模型。', [
                'raw' => mb_substr($text, 0, 800),
            ]);
        }

        return [
            'title' => $title,
            'excerpt' => $excerpt,
            'markdown' => $markdown,
        ];
    }

    /**
     * 调用对话接口（按配置的格式分派），返回首条消息文本。
     *
     * @param  array<int, array{role: string, content: string}>  $messages
     *
     * @throws \RuntimeException
     */
    protected function chatCompletion(array $messages): string
    {
        $apiKey = trim((string) Option::get('ai_api_key', ''));
        $model = trim((string) Option::get('ai_model', ''));

        if ($apiKey === '' || $model === '') {
            throw new \RuntimeException('请先在后台「设置 → AI 设置」中完成 AI 接口配置。');
        }

        $text = $this->format() === 'anthropic'
            ? $this->anthropicText($apiKey, $model, $messages)
            : $this->openaiText($apiKey, $model, $messages);

        if (trim($text) === '') {
            throw new \RuntimeException('AI 接口未返回任何内容，请重试。');
        }

        return $text;
    }

    /**
     * OpenAI 兼容格式：POST /chat/completions。
     *
     * @param  array<int, array{role: string, content: string}>  $messages
     *
     * @throws \RuntimeException
     */
    protected function openaiText(string $apiKey, string $model, array $messages): string
    {
        $url = $this->resolveApiUrl().'/chat/completions';

        try {
            $response = Http::withToken($apiKey)
                ->timeout(120)
                ->connectTimeout(15)
                ->acceptJson()
                ->post($url, [
                    'model' => $model,
                    'messages' => $messages,
                    'temperature' => 0.7,
                ]);
        } catch (\Throwable $e) {
            Log::warning('AiService: AI 接口连接失败', ['url' => $url, 'error' => $e->getMessage()]);

            throw new AiRequestException('无法连接 AI 接口，请检查接口地址与网络后重试。', [
                'url' => $url,
                'error' => $e->getMessage(),
            ]);
        }

        if ($response->failed()) {
            $errorBody = $response->json('error.message') ?? '';

            Log::warning('AiService: AI 接口返回错误', [
                'url' => $url,
                'status' => $response->status(),
                'body' => mb_substr($response->body(), 0, 500),
            ]);

            throw new AiRequestException(
                $errorBody !== ''
                    ? "AI 接口返回错误：{$errorBody}"
                    : $this->requestFailedMessage('POST', $url, $response->status()),
                [
                    'status' => $response->status(),
                    'url' => $url,
                    'body' => mb_substr($response->body(), 0, 800),
                ]
            );
        }

        $content = $response->json('choices.0.message.content');

        // 兼容个别网关把 content 返回成内容分段数组的情况
        if (is_array($content)) {
            $content = collect($content)
                ->map(fn ($part) => is_array($part) ? (string) ($part['text'] ?? '') : (string) $part)
                ->implode("\n");
        }

        return (string) $content;
    }

    /**
     * Anthropic 格式：POST /messages（system 独立字段，max_tokens 必填，响应为 content 块数组）。
     *
     * @param  array<int, array{role: string, content: string}>  $messages
     *
     * @throws \RuntimeException
     */
    protected function anthropicText(string $apiKey, string $model, array $messages): string
    {
        $system = collect($messages)
            ->filter(fn ($message) => $message['role'] === 'system')
            ->map(fn ($message) => $message['content'])
            ->implode("\n\n");

        $chat = array_values(array_filter(
            $messages,
            fn ($message) => $message['role'] !== 'system',
        ));

        $url = $this->resolveApiUrl().'/messages';

        try {
            $response = Http::withHeaders([
                'x-api-key' => $apiKey,
                'anthropic-version' => self::ANTHROPIC_VERSION,
            ])
                ->timeout(120)
                ->connectTimeout(15)
                ->acceptJson()
                ->post($url, [
                    'model' => $model,
                    'max_tokens' => self::ANTHROPIC_MAX_TOKENS,
                    'system' => $system,
                    'messages' => $chat,
                ]);
        } catch (\Throwable $e) {
            Log::warning('AiService: AI 接口连接失败', ['url' => $url, 'error' => $e->getMessage()]);

            throw new AiRequestException('无法连接 AI 接口，请检查接口地址与网络后重试。', [
                'url' => $url,
                'error' => $e->getMessage(),
            ]);
        }

        if ($response->failed()) {
            $errorBody = $response->json('error.message') ?? '';

            Log::warning('AiService: AI 接口返回错误', [
                'url' => $url,
                'status' => $response->status(),
                'body' => mb_substr($response->body(), 0, 500),
            ]);

            throw new AiRequestException(
                $errorBody !== ''
                    ? "AI 接口返回错误：{$errorBody}"
                    : $this->requestFailedMessage('POST', $url, $response->status()),
                [
                    'status' => $response->status(),
                    'url' => $url,
                    'body' => mb_substr($response->body(), 0, 800),
                ]
            );
        }

        $blocks = $response->json('content');

        if (! is_array($blocks)) {
            return '';
        }

        return collect($blocks)
            ->filter(fn ($block) => is_array($block) && ($block['type'] ?? '') === 'text')
            ->map(fn ($block) => (string) ($block['text'] ?? ''))
            ->implode("\n");
    }

    /**
     * 请求失败且无可解析错误信息时的提示：附上方法与 URL，
     * 404 额外提示可能是中转站到上游的链路中断。
     */
    protected function requestFailedMessage(string $method, string $url, int $status): string
    {
        $base = "AI 接口请求失败（HTTP {$status}，{$method} {$url}）";

        if ($status === 404) {
            return $base.'。接口地址确认无误时，多为中转站到上游模型服务的链路临时中断，请稍后重试或联系服务商。';
        }

        return $base.'，请检查 AI 设置中的接口地址。';
    }

    /**
     * 构造带鉴权的请求实例（OpenAI 用 Bearer，Anthropic 用 x-api-key + 版本头）。
     */
    protected function authorizedRequest(string $apiKey): PendingRequest
    {
        $request = Http::timeout(30)->connectTimeout(10)->acceptJson();

        if ($this->format() === 'anthropic') {
            return $request->withHeaders([
                'x-api-key' => $apiKey,
                'anthropic-version' => self::ANTHROPIC_VERSION,
            ]);
        }

        return $request->withToken($apiKey);
    }

    /**
     * 解析接口地址：去首尾斜杠，空值回退到当前格式的默认地址。
     */
    protected function resolveApiUrl(): string
    {
        $apiUrl = rtrim(trim((string) Option::get('ai_api_url', '')) ?: $this->defaultApiUrl(), '/');

        return $apiUrl !== '' ? $apiUrl : $this->defaultApiUrl();
    }

    /**
     * 从模型输出中防御式地提取文章数据。
     *
     * 依次尝试：```json 代码块 → 整段 JSON → 首个 { 到末个 } 的子串（并容错尾逗号）。
     * 若模型完全没输出 JSON（文本中无花括号），把整段当作 Markdown 正文兜底。
     *
     * @return array<string, mixed>
     *
     * @throws \RuntimeException
     */
    protected function extractArticlePayload(string $text): array
    {
        // 去除思考型模型（DeepSeek-R1/Qwen3/GLM 等）输出的推理段
        $cleaned = trim((string) preg_replace('/<think>.*?<\/think>/is', '', $text));

        $candidates = [];

        if (preg_match('/```(?:json)?\s*(.+?)\s*```/s', $cleaned, $matches) === 1) {
            $candidates[] = $matches[1];
        }

        $candidates[] = $cleaned;

        $start = strpos($cleaned, '{');
        $end = strrpos($cleaned, '}');

        if ($start !== false && $end !== false && $end > $start) {
            $candidates[] = substr($cleaned, $start, $end - $start + 1);
        }

        foreach ($candidates as $candidate) {
            // 同时尝试原始串与去除尾逗号后的串
            foreach ([$candidate, (string) preg_replace('/,\s*([}\]])/', '$1', $candidate)] as $json) {
                $decoded = json_decode($json, true);

                if (is_array($decoded) && (isset($decoded['title']) || isset($decoded['markdown']) || isset($decoded['标题']) || isset($decoded['正文']))) {
                    return $decoded;
                }
            }
        }

        // 容错提取：JSON 因值内部含未转义引号等原因非法时，
        // 按 "title"/"excerpt"/"markdown" 键名定位切片取值（值内部的原样引号即正文内容）
        $relaxed = $this->relaxedArticlePayload($cleaned);

        if ($relaxed !== null) {
            return $relaxed;
        }

        // 兜底：模型没输出 JSON（文本中无花括号），把整段当作 Markdown 正文
        if (! str_contains($cleaned, '{')) {
            return $this->markdownFallback($cleaned);
        }

        Log::warning('AiService: AI 返回内容无法解析为 JSON', ['raw' => mb_substr($cleaned, 0, 1000)]);

        throw new AiRequestException('AI 返回的内容无法解析，请重试或更换模型。', [
            'raw' => mb_substr($cleaned, 0, 800),
        ]);
    }

    /**
     * 按键名定位的容错 JSON 提取：不依赖整体 JSON 合法性。
     *
     * 典型场景：模型输出的字符串值内部含未转义的英文双引号，
     * json_decode 整体失败，但各字段的值仍可按已知键名切片取出。
     *
     * @return array{title: string, excerpt: string, markdown: string}|null
     */
    protected function relaxedArticlePayload(string $text): ?array
    {
        $markers = [];

        foreach (['title', 'excerpt', 'markdown'] as $key) {
            if (preg_match('/"'.$key.'"\s*:\s*"/i', $text, $matches, PREG_OFFSET_CAPTURE) === 1) {
                // 值的起点 = 键名 + 冒号 + 起始引号之后
                $markers[$key] = [
                    'match_start' => $matches[0][1],
                    'value_start' => $matches[0][1] + strlen($matches[0][0]),
                ];
            }
        }

        if (! isset($markers['title'], $markers['markdown'])) {
            return null;
        }

        // 按 值起点 排序，每个值截止到下一个键名匹配的开始处
        uasort($markers, fn ($a, $b) => $a['value_start'] <=> $b['value_start']);

        $ordered = array_values($markers);
        $payload = [];

        foreach ($ordered as $index => $marker) {
            $key = array_search($marker, $markers, true);
            $end = isset($ordered[$index + 1])
                ? $ordered[$index + 1]['match_start']
                : strlen($text);

            $slice = substr($text, $marker['value_start'], $end - $marker['value_start']);

            // 去掉结尾的闭合引号及其后的逗号/花括号/空白
            if (preg_match('/"\s*(?:[,\}]\s*)?$/', $slice, $tail, PREG_OFFSET_CAPTURE) === 1) {
                $slice = substr($slice, 0, $tail[0][1]);
            }

            $payload[$key] = $this->unescapeJsonString($slice);
        }

        if (trim($payload['title']) === '' || trim($payload['markdown']) === '') {
            return null;
        }

        return $payload;
    }

    /**
     * 反转义 JSON 字符串中的标准转义序列（\n、\"、\\、\uXXXX 等）。
     */
    protected function unescapeJsonString(string $value): string
    {
        return (string) preg_replace_callback(
            '/\\\\(u[0-9a-fA-F]{4}|[nrtbf"\\\\\/])/',
            function (array $matches): string {
                return match ($matches[1]) {
                    'n' => "\n",
                    'r' => "\r",
                    't' => "\t",
                    'b' => "\b",
                    'f' => "\f",
                    '"' => '"',
                    '\\' => '\\',
                    '/' => '/',
                    default => mb_convert_encoding(pack('H4', substr($matches[1], 1)), 'UTF-8', 'UTF-16BE'),
                };
            },
            $value,
        );
    }

    /**
     * 纯 Markdown 兜底：从首个非空行提取标题（支持 # 标题），整段作为正文。
     *
     * @return array{title: string, excerpt: string, markdown: string}
     */
    protected function markdownFallback(string $text): array
    {
        $firstLine = '';

        foreach (preg_split('/\r\n|\r|\n/', $text) ?: [] as $line) {
            if (trim($line) !== '') {
                $firstLine = trim($line);

                break;
            }
        }

        $title = $firstLine;

        if (preg_match('/^#{1,3}\s+(.+)$/', $firstLine, $matches) === 1) {
            $title = trim($matches[1]);
        } else {
            $title = mb_substr($firstLine, 0, 60);
        }

        $excerpt = trim((string) preg_replace('/\s+/', ' ', (string) preg_replace('/[#*`>\-]/', '', $text)));

        return [
            'title' => $title !== '' ? $title : '未命名文章',
            'excerpt' => mb_substr($excerpt, 0, 100),
            'markdown' => $text,
        ];
    }
}
