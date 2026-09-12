<?php

namespace App\Http\Controllers;

use App\Models\Option;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * 页脚设置：底部「资源」与「联系」栏目为后台可维护的自定义链接。
 */
class FooterSettingController extends Controller
{
    /**
     * 资源栏默认值（未配置时使用）。
     *
     * @return array<int, array{name: string, url: string}>
     */
    public static function defaultResources(): array
    {
        return [
            ['name' => 'GitHub', 'url' => 'https://github.com'],
            ['name' => 'Laravel 文档', 'url' => 'https://laravel.com/docs'],
            ['name' => 'React 文档', 'url' => 'https://react.dev'],
        ];
    }

    /**
     * 联系栏默认值（未配置时使用）。
     *
     * @return array<int, array{name: string, url: string}>
     */
    public static function defaultContacts(): array
    {
        return [
            ['name' => 'GitHub', 'url' => 'https://github.com'],
            ['name' => 'Twitter', 'url' => 'https://twitter.com'],
            ['name' => '邮箱', 'url' => 'mailto:hello@example.com'],
        ];
    }

    /**
     * 解析资源链接列表。
     *
     * @return array<int, array{name: string, url: string}>
     */
    public static function resources(): array
    {
        return self::decode('footer_resources') ?: self::defaultResources();
    }

    /**
     * 解析联系方式列表。
     *
     * @return array<int, array{name: string, url: string}>
     */
    public static function contacts(): array
    {
        return self::decode('footer_contacts') ?: self::defaultContacts();
    }

    /**
     * 页脚设置页面。
     */
    public function edit(): Response
    {
        return Inertia::render('settings/footer', [
            'resources' => self::resources(),
            'contacts' => self::contacts(),
        ]);
    }

    /**
     * 保存页脚设置。
     */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'resources' => ['nullable', 'array', 'max:20'],
            'resources.*.name' => ['required', 'string', 'max:50'],
            'resources.*.url' => ['required', 'string', 'max:500'],
            'contacts' => ['nullable', 'array', 'max:20'],
            'contacts.*.name' => ['required', 'string', 'max:50'],
            'contacts.*.url' => ['required', 'string', 'max:500'],
        ], [
            'resources.max' => '资源链接最多 20 项。',
            'resources.*.name.required' => '资源名称不能为空。',
            'resources.*.name.max' => '资源名称不能超过 50 个字符。',
            'resources.*.url.required' => '资源链接不能为空。',
            'resources.*.url.max' => '资源链接不能超过 500 个字符。',
            'contacts.max' => '联系方式最多 20 项。',
            'contacts.*.name.required' => '联系方式名称不能为空。',
            'contacts.*.name.max' => '联系方式名称不能超过 50 个字符。',
            'contacts.*.url.required' => '联系方式链接不能为空。',
            'contacts.*.url.max' => '联系方式链接不能超过 500 个字符。',
        ]);

        Option::set('footer_resources', json_encode(
            array_map(fn ($item) => ['name' => trim($item['name']), 'url' => trim($item['url'])], $validated['resources'] ?? []),
            JSON_UNESCAPED_UNICODE,
        ));

        Option::set('footer_contacts', json_encode(
            array_map(fn ($item) => ['name' => trim($item['name']), 'url' => trim($item['url'])], $validated['contacts'] ?? []),
            JSON_UNESCAPED_UNICODE,
        ));

        return to_route('footer.edit')->with('toast', ['type' => 'success', 'message' => '页脚设置已保存。']);
    }

    /**
     * 解析存储的 JSON 列表，过滤无效项。
     *
     * @return array<int, array{name: string, url: string}>
     */
    protected static function decode(string $key): array
    {
        $decoded = json_decode((string) Option::get($key, ''), true);

        if (! is_array($decoded)) {
            return [];
        }

        return array_values(array_filter(
            $decoded,
            fn ($item) => is_array($item) && isset($item['name'], $item['url']) && $item['name'] !== '' && $item['url'] !== '',
        ));
    }
}
