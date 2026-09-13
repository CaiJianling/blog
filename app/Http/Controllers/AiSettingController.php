<?php

namespace App\Http\Controllers;

use App\Exceptions\AiRequestException;
use App\Models\Option;
use App\Services\AiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * AI 设置：接入 OpenAI 兼容接口（接口地址 / 密钥 / 模型）。
 */
class AiSettingController extends Controller
{
    /**
     * AI 设置页面。
     */
    public function edit(): Response
    {
        $apiKey = (string) Option::get('ai_api_key', '');
        $format = Option::get('ai_api_format', 'openai') === 'anthropic' ? 'anthropic' : 'openai';

        return Inertia::render('settings/ai', [
            'ai_api_format' => $format,
            'assistant' => AssistantSettingController::props(),
            'ai_api_url' => (string) Option::get('ai_api_url', ''),
            'ai_model' => (string) Option::get('ai_model', ''),
            // 密钥不回传明文，仅提示是否已配置与尾号
            'ai_api_key_masked' => $apiKey !== ''
                ? str_repeat('•', 12).mb_substr($apiKey, -4)
                : '',
            'ai_configured' => app(AiService::class)->isConfigured(),
            'api_url_defaults' => [
                'openai' => AiService::DEFAULT_API_URL,
                'anthropic' => AiService::DEFAULT_ANTHROPIC_API_URL,
            ],
        ]);
    }

    /**
     * 保存 AI 设置。密钥留空表示保持不变。
     */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'ai_api_format' => ['required', 'in:openai,anthropic'],
            'ai_api_url' => ['nullable', 'string', 'max:500'],
            'ai_model' => ['nullable', 'string', 'max:191'],
            'ai_api_key' => ['nullable', 'string', 'max:500'],
        ], [
            'ai_api_format.required' => '请选择接口格式。',
            'ai_api_format.in' => '接口格式不正确。',
            'ai_api_url.max' => '接口地址不能超过 500 个字符。',
            'ai_model.max' => '模型名称不能超过 191 个字符。',
        ]);

        Option::set('ai_api_format', $validated['ai_api_format']);

        $apiUrl = trim($validated['ai_api_url'] ?? '');

        Option::set('ai_api_url', $apiUrl);

        Option::set('ai_model', trim($validated['ai_model'] ?? ''));

        $apiKey = trim($validated['ai_api_key'] ?? '');

        if ($apiKey !== '') {
            Option::set('ai_api_key', $apiKey);
        }

        return to_route('ai.edit')->with('toast', ['type' => 'success', 'message' => 'AI 设置已保存。']);
    }

    /**
     * 从已配置的 AI 接口拉取可用模型列表，供设置页选择。
     */
    public function models(AiService $ai): JsonResponse
    {
        if (trim((string) Option::get('ai_api_key', '')) === '') {
            return response()->json([
                'message' => '请先填写并保存 API 密钥，再获取模型列表。',
            ], 422);
        }

        try {
            $models = $ai->listModels();
        } catch (AiRequestException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'debug' => $e->context(),
            ], 502);
        } catch (\RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 502);
        }

        return response()->json([
            'data' => $models,
        ]);
    }
}
