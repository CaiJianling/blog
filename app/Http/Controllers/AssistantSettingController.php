<?php

namespace App\Http\Controllers;

use App\Models\Attachment;
use App\Models\Option;
use App\Services\AttachmentService;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * AI 小助手设置：开关、名称、欢迎语、提示词、接口模式与 API 配置、头像。
 */
class AssistantSettingController extends Controller
{
    public function __construct(
        protected AttachmentService $attachments,
    ) {}

    /**
     * AI 小助手设置页。
     */
    public function edit(): Response
    {
        return Inertia::render('settings/assistant', self::props());
    }

    /**
     * 组装小助手设置数据（供设置页与合并后的 AI 设置页共用）。
     *
     * @return array<string, mixed>
     */
    public static function props(): array
    {
        $apiKey = (string) Option::get('assistant_api_key', '');

        return [
            'assistant_enabled' => Option::get('assistant_enabled') === '1',
            'assistant_name' => (string) Option::get('assistant_name', 'AI 小助手'),
            'assistant_welcome' => (string) Option::get('assistant_welcome', '你好！我是 AI 小助手，有什么可以帮你？'),
            'assistant_system_prompt' => (string) Option::get('assistant_system_prompt', ''),
            'assistant_mode' => Option::get('assistant_mode', 'standard') === 'fastgpt' ? 'fastgpt' : 'standard',
            'assistant_api_url' => (string) Option::get('assistant_api_url', ''),
            'assistant_model' => (string) Option::get('assistant_model', ''),
            'assistant_api_key_masked' => $apiKey !== ''
                ? str_repeat('•', 12).mb_substr($apiKey, -4)
                : '',
            'assistant_avatar' => self::avatar(),
        ];
    }

    /**
     * 保存 AI 小助手设置。密钥留空表示保持不变。
     */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'assistant_enabled' => ['required', 'in:0,1,true,false'],
            'assistant_name' => ['required', 'string', 'max:50'],
            'assistant_welcome' => ['nullable', 'string', 'max:500'],
            'assistant_system_prompt' => ['nullable', 'string', 'max:4000'],
            'assistant_mode' => ['required', 'in:standard,fastgpt'],
            'assistant_api_url' => ['nullable', 'string', 'max:500'],
            'assistant_model' => ['nullable', 'string', 'max:191'],
            'assistant_api_key' => ['nullable', 'string', 'max:500'],
        ], [
            'assistant_name.required' => '请输入助手名称。',
            'assistant_mode.required' => '请选择接口模式。',
        ]);

        Option::set('assistant_enabled', in_array($validated['assistant_enabled'], ['1', 'true'], true) ? '1' : '0');
        Option::set('assistant_name', trim($validated['assistant_name']));
        Option::set('assistant_welcome', trim($validated['assistant_welcome'] ?? ''));
        Option::set('assistant_system_prompt', trim($validated['assistant_system_prompt'] ?? ''));
        Option::set('assistant_mode', $validated['assistant_mode']);
        Option::set('assistant_api_url', trim($validated['assistant_api_url'] ?? ''));
        Option::set('assistant_model', trim($validated['assistant_model'] ?? ''));

        $apiKey = trim($validated['assistant_api_key'] ?? '');

        if ($apiKey !== '') {
            Option::set('assistant_api_key', $apiKey);
        }

        return to_route('ai.edit')->with('toast', ['type' => 'success', 'message' => 'AI 小助手设置已保存。']);
    }

    /**
     * 上传助手头像。
     */
    public function uploadAvatar(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => [
                'required',
                'file',
                'max:5120',
                'mimes:jpg,jpeg,png,gif,webp',
            ],
        ], [
            'file.required' => '请选择一个图片文件。',
            'file.max' => '头像不能超过 5 MB。',
            'file.mimes' => '仅支持 jpg/jpeg/png/gif/webp 格式。',
        ]);

        $meta = $this->attachments->validateUploadedFile($validated['file']);

        // 更换头像：先从文件库删除旧图
        $attachment = $this->attachments->replaceSystemImage('assistant_avatar', null, $validated['file'], $meta);

        Option::set('assistant_avatar', (string) $attachment->id);

        /** @var FilesystemAdapter $publicDisk */
        $publicDisk = Storage::disk('public');

        return response()->json([
            'id' => $attachment->id,
            'url' => $publicDisk->url($attachment->file_path),
        ]);
    }

    /**
     * 移除助手头像。
     */
    public function removeAvatar()
    {
        // 恢复默认头像：从文件库删除自定义头像
        $this->attachments->deleteByParent('assistant_avatar', null);
        Option::set('assistant_avatar', '');

        return to_route('ai.edit')->with('toast', ['type' => 'success', 'message' => '已恢复默认头像。']);
    }

    /**
     * 解析当前头像信息。
     */
    protected static function avatar(): ?array
    {
        $avatarId = (int) Option::get('assistant_avatar', '');

        if ($avatarId <= 0) {
            return null;
        }

        $attachment = Attachment::find($avatarId);

        if (! $attachment || ! $attachment->isImage()) {
            return null;
        }

        /** @var FilesystemAdapter $publicDisk */
        $publicDisk = Storage::disk('public');

        return [
            'id' => $attachment->id,
            'url' => $publicDisk->url($attachment->file_path),
        ];
    }
}
