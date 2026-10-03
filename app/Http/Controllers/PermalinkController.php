<?php

namespace App\Http\Controllers;

use App\Models\Option;
use App\Services\PermalinkService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PermalinkController extends Controller
{
    public function __construct(
        protected PermalinkService $permalinks,
    ) {}

    /**
     * 显示固定链接设置页面。
     */
    public function edit(): Response
    {
        $example = now();

        return Inertia::render('settings/permalink', [
            'structure' => $this->permalinks->structure(),
            'preset' => $this->permalinks->presetKey(),
            'categoryBase' => (string) Option::get('category_base', ''),
            'tagBase' => (string) Option::get('tag_base', ''),
            'presets' => collect(PermalinkService::PRESETS)->map(function ($structure, $key) use ($example) {
                $sample = str_replace(
                    ['%year%', '%monthnum%', '%day%', '%postname%', '%post_id%'],
                    [$example->format('Y'), $example->format('m'), $example->format('d'), 'sample-post', '123'],
                    $structure === '' ? '/?p=123' : $structure,
                );

                return ['key' => $key, 'structure' => $structure, 'sample' => $sample];
            })->values(),
            'tags' => [
                '%year%', '%monthnum%', '%day%', '%hour%', '%minute%',
                '%second%', '%post_id%', '%postname%', '%category%', '%author%',
            ],
        ]);
    }

    /**
     * 更新固定链接设置。
     */
    public function update(Request $request)
    {
        $validated = $request->validate([
            'preset' => ['required', 'in:plain,day,month,numeric,postname,custom'],
            'custom_structure' => ['nullable', 'string', 'max:255'],
            'category_base' => ['nullable', 'string', 'max:100', 'regex:/^[a-zA-Z0-9_-]*$/'],
            'tag_base' => ['nullable', 'string', 'max:100', 'regex:/^[a-zA-Z0-9_-]*$/'],
        ]);

        $structure = $validated['preset'] === 'custom'
            ? trim((string) $validated['custom_structure'])
            : PermalinkService::PRESETS[$validated['preset']];

        if ($validated['preset'] === 'custom' && ($structure === '' || ! str_contains($structure, '%'))) {
            return back()->withErrors([
                'custom_structure' => '自定义结构必须包含至少一个可用标签，例如 %postname%。',
            ])->withInput();
        }

        Option::set('permalink_structure', $structure);
        Option::set('category_base', $validated['category_base'] ?? '');
        Option::set('tag_base', $validated['tag_base'] ?? '');

        Inertia::flash('toast', ['type' => 'success', 'message' => '固定链接设置已保存。']);

        return to_route('permalink.edit');
    }
}
