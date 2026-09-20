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
     * 文章 JSON 可能出现的字段名（含中文键名兼容）。
     *
     * 容错切片取字符串值时用作右边界，避免正文吞掉其后的字段。
     *
     * @var array<int, string>
     */
    protected const RELAXED_FIELD_NAMES = [
        'title',
        'excerpt',
        'markdown',
        'meta_title',
        'meta_description',
        'seo_title',
        'seo_description',
        'tags',
        'categories',
        '标题',
        '摘要',
        '正文',
        'seo标题',
        'seo描述',
        '标签',
        '分类',
        '栏目',
    ];

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
     * 除标题/摘要/正文外，同时生成 SEO（meta_title/meta_description）、标签与分类，
     * 供前端在作者确认前一并填入表单。
     *
     * @param  string  $prompt  作者给出的写作提示
     * @param  array{categories?: array<int, string>, tags?: array<int, string>}  $context  现有分类/标签名，供 AI 优先选用
     * @return array{
     *     title: string,
     *     excerpt: string,
     *     markdown: string,
     *     meta_title: string,
     *     meta_description: string,
     *     tags: array<int, string>,
     *     categories: array<int, string>
     * }
     *
     * @throws \RuntimeException 配置缺失、接口失败或返回格式异常时抛出
     */
    public function generateArticle(string $prompt, array $context = []): array
    {
        $systemPrompt = <<<'PROMPT'
你是一位资深博客写作助手。请根据用户给出的写作要求创作一篇博客文章，并为其补充 SEO 元信息、标签与分类。
严格输出一个 JSON 对象，不要输出 JSON 以外的任何内容，也不要用 Markdown 代码块包裹。格式：
{"title":"文章标题","excerpt":"不超过 80 字的文章摘要","markdown":"使用 Markdown 语法的文章正文","meta_title":"SEO 标题","meta_description":"SEO 描述","tags":["标签1","标签2","标签3"],"categories":["分类1"]}
字段要求：
- 正文：使用 Markdown 语法；包含清晰的段落与必要的二级/三级标题（##/###）；适合处使用列表；不要输出一级标题；不要包含标题与摘要的重复说明；使用与写作要求一致的语言。
- meta_title（SEO 标题）：约 20~30 字，突出主题与核心关键词，语言与正文一致。
- meta_description（SEO 描述）：约 50~120 字，概括正文并自然包含关键词。
- tags：3~5 个具体、相关的标签名（短词或短语，单个标签内不含逗号）；若提供了「现有标签」，请优先从中挑选最贴合的，没有合适的再自拟。
- categories：1~3 个合适的栏目/分类名；若提供了「现有分类」，请优先从中挑选最贴合的，没有合适的再自拟。
重要：输出必须是合法 JSON。字符串值内部禁止输出未转义的英文双引号；正文中如需引用词语，请一律使用中文引号「」。
PROMPT;

        $userMessage = "写作要求：{$prompt}";

        if (($context['categories'] ?? []) !== []) {
            $userMessage .= "\n现有分类（categories 请优先从中挑选）：".implode('、', $context['categories']);
        }

        if (($context['tags'] ?? []) !== []) {
            $userMessage .= "\n现有标签（tags 请优先从中挑选）：".implode('、', $context['tags']);
        }

        $text = $this->chatCompletion([
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userMessage],
        ]);

        $data = $this->extractArticlePayload($text);

        // 兼容个别模型输出中文键名的情况
        $title = trim((string) ($data['title'] ?? $data['标题'] ?? ''));
        $excerpt = trim((string) ($data['excerpt'] ?? $data['摘要'] ?? ''));
        $markdown = trim((string) ($data['markdown'] ?? $data['正文'] ?? ''));
        $metaTitle = trim((string) ($data['meta_title'] ?? $data['seo_title'] ?? $data['seo标题'] ?? ''));
        $metaDescription = trim((string) ($data['meta_description'] ?? $data['seo_description'] ?? $data['seo描述'] ?? ''));

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
            'meta_title' => $metaTitle !== '' ? $metaTitle : $title,
            'meta_description' => $metaDescription !== '' ? $metaDescription : $excerpt,
            'tags' => $this->normalizeNameList($data, ['tags', '标签']),
            'categories' => $this->normalizeNameList($data, ['categories', '分类', '栏目']),
        ];
    }

    /**
     * 根据写作提示生成独立页面（标题 + 正文 + SEO），供前端填入编辑器，作者确认后再保存。
     *
     * 页面没有摘要/标签/分类字段，只产出标题、Markdown 正文与 SEO 元信息。
     *
     * @return array{title: string, markdown: string, meta_title: string, meta_description: string}
     *
     * @throws \RuntimeException 配置缺失、接口失败或返回格式异常时抛出
     */
    public function generatePage(string $prompt): array
    {
        $systemPrompt = <<<'PROMPT'
你是一位资深的网页内容写作助手。请根据用户给出的要求创作一个网站独立页面（如关于我们、联系、服务介绍、政策、落地页等）的内容，并为其补充 SEO 元信息。
严格输出一个 JSON 对象，不要输出 JSON 以外的任何内容，也不要用 Markdown 代码块包裹。格式：
{"title":"页面标题","markdown":"使用 Markdown 语法的页面正文","meta_title":"SEO 标题","meta_description":"SEO 描述"}
字段要求：
- 正文：使用 Markdown 语法；包含清晰的段落与必要的二级/三级标题（##/###）；适合处使用列表；不要输出一级标题；语言与写作要求一致。
- meta_title（SEO 标题）：约 20~30 字，突出主题与核心关键词。
- meta_description（SEO 描述）：约 50~120 字，概括正文并自然包含关键词。
重要：输出必须是合法 JSON。字符串值内部禁止输出未转义的英文双引号；正文中如需引用词语，请一律使用中文引号「」。
PROMPT;

        $userMessage = "页面要求：{$prompt}";

        $text = $this->chatCompletion([
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userMessage],
        ]);

        $data = $this->extractArticlePayload($text);

        // 兼容个别模型输出中文键名的情况
        $title = trim((string) ($data['title'] ?? $data['标题'] ?? ''));
        $markdown = trim((string) ($data['markdown'] ?? $data['正文'] ?? ''));
        $metaTitle = trim((string) ($data['meta_title'] ?? $data['seo_title'] ?? $data['seo标题'] ?? ''));
        $metaDescription = trim((string) ($data['meta_description'] ?? $data['seo_description'] ?? $data['seo描述'] ?? ''));

        if ($title === '' || $markdown === '') {
            Log::warning('AiService: AI 返回内容缺少 title 或 markdown（页面）', ['raw' => mb_substr($text, 0, 1000)]);

            throw new AiRequestException('AI 返回的内容格式不正确，请重试或更换模型。', [
                'raw' => mb_substr($text, 0, 800),
            ]);
        }

        return [
            'title' => $title,
            'markdown' => $markdown,
            'meta_title' => $metaTitle !== '' ? $metaTitle : $title,
            'meta_description' => $metaDescription,
        ];
    }

    /**
     * 依据已生成的文章内容，专门补全 SEO 与归类（标签/分类）。
     *
     * 主生成调用有时（弱模型或 JSON 被容错解析）会漏掉这些字段，此方法用一次
     * 聚焦的短指令（仅 4 个字段）重新提取，命中率更高，且结果贴合正文。
     *
     * @param  string  $title  文章标题
     * @param  string  $excerpt  文章摘要
     * @param  string  $markdown  文章正文（Markdown，仅取前段）
     * @param  array{categories?: array<int, string>, tags?: array<int, string>}  $context  现有分类/标签名，供 AI 优先选用
     * @return array{meta_title: string, meta_description: string, tags: array<int, string>, categories: array<int, string>}
     *
     * @throws \RuntimeException 接口失败时抛出（调用方自行决定是否兜底）
     */
    public function extractArticleMeta(string $title, string $excerpt, string $markdown, array $context = []): array
    {
        $systemPrompt = <<<'PROMPT'
你是一位 SEO 与内容运营专家。请根据给定文章的标题、摘要与正文，补全搜索优化信息与归类。
严格输出一个 JSON 对象，不要输出 JSON 以外的任何内容，也不要用 Markdown 代码块包裹。格式：
{"meta_title":"SEO标题","meta_description":"SEO描述","tags":["标签1","标签2","标签3"],"categories":["分类1"]}
要求：meta_title 约 20~30 字；meta_description 约 50~120 字；tags 给 3~5 个；categories 给 1~3 个；语言与文章一致。
重要：输出必须是合法 JSON；字符串值内部禁止未转义的英文双引号。
PROMPT;

        $userMessage = "文章标题：{$title}\n文章摘要：{$excerpt}\n文章正文：".mb_substr($markdown, 0, 1500);

        if (($context['categories'] ?? []) !== []) {
            $userMessage .= "\n现有分类（categories 请优先从中挑选最贴合的）：".implode('、', $context['categories']);
        }

        if (($context['tags'] ?? []) !== []) {
            $userMessage .= "\n现有标签（tags 请优先从中挑选最贴合的）：".implode('、', $context['tags']);
        }

        $text = $this->chatCompletion([
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userMessage],
        ]);

        $data = $this->extractMetaPayload($text);

        return [
            'meta_title' => trim((string) ($data['meta_title'] ?? $data['seo_title'] ?? '')),
            'meta_description' => trim((string) ($data['meta_description'] ?? $data['seo_description'] ?? '')),
            'tags' => $this->normalizeNameList($data, ['tags', '标签']),
            'categories' => $this->normalizeNameList($data, ['categories', '分类', '栏目']),
        ];
    }

    /**
     * 提取聚焦式 meta 调用的 JSON 输出（去代码块/思考段，取首个 { 到末个 }，并容错尾逗号）。
     *
     * @return array<string, mixed>
     */
    protected function extractMetaPayload(string $text): array
    {
        $cleaned = trim((string) preg_replace('/<!--.*?-->/s', '', $text));
        $cleaned = trim((string) preg_replace('/.*?<\/think>/is', '', $cleaned));

        if (preg_match('/```(?:json)?\s*(.+?)\s*```/s', $cleaned, $matches) === 1) {
            $cleaned = $matches[1];
        }

        $start = strpos($cleaned, '{');
        $end = strrpos($cleaned, '}');

        if ($start !== false && $end !== false && $end > $start) {
            $candidate = substr($cleaned, $start, $end - $start + 1);

            foreach ([$candidate, (string) preg_replace('/,\s*([}\]])/', '$1', $candidate)] as $json) {
                $decoded = json_decode($json, true);

                if (is_array($decoded)) {
                    return $decoded;
                }
            }
        }

        return [];
    }

    /**
     * 从 AI 输出中取出一个字符串数组字段（兼容英文/中文键名与标量），并清洗、去重、限量。
     *
     * @param  array<string, mixed>  $data
     * @param  array<int, string>  $keys  候选键名（按优先级）
     * @return array<int, string>
     */
    protected function normalizeNameList(array $data, array $keys): array
    {
        $raw = null;

        foreach ($keys as $key) {
            if (array_key_exists($key, $data)) {
                $raw = $data[$key];

                break;
            }
        }

        if ($raw === null) {
            return [];
        }

        // 兼容 AI 把列表写成逗号分隔字符串的情况
        if (is_string($raw)) {
            $raw = preg_split('/[,，、;；\s]+/', $raw);
        }

        if (! is_array($raw)) {
            return [];
        }

        $names = [];

        foreach ($raw as $item) {
            $name = trim((string) $item);

            if ($name !== '' && mb_strlen($name) <= 100) {
                $names[] = $name;
            }
        }

        return array_values(array_slice(array_unique($names), 0, 8));
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
            // 最后一个值（通常是 markdown）没有后继键名可参照，若直接取到文本末尾，
            // 会把紧随其后的 "meta_title" / "tags" 等整段 JSON 一起吞进正文，
            // 故退回到「其后首个已知字段名」处截止。
            $end = $ordered[$index + 1]['match_start']
                ?? $this->nextFieldNameOffset($text, $marker['value_start']);

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
     * 自 $from 起向后出现的第一个已知字段名的偏移；此后再无字段名时返回文本末尾。
     */
    protected function nextFieldNameOffset(string $text, int $from): int
    {
        $earliest = strlen($text);

        foreach (self::RELAXED_FIELD_NAMES as $name) {
            $pattern = '/"'.preg_quote($name, '/').'"\s*:/';

            if (preg_match($pattern, $text, $matches, PREG_OFFSET_CAPTURE, $from) === 1
                && $matches[0][1] < $earliest) {
                $earliest = $matches[0][1];
            }
        }

        return $earliest;
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
