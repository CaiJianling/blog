<?php

namespace App\Http\Controllers;

use App\Models\Smiley;
use App\Models\SmileyGroup;
use App\Services\CommentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * 表情后台管理：分组（标签页）与图片表情的维护。
 */
class SmileyController extends Controller
{
    public function __construct(
        protected CommentService $comments,
    ) {}

    /**
     * 表情管理页面。
     */
    public function index(): Response
    {
        $groups = SmileyGroup::orderBy('sort')->with('smileys')->get()->map(function (SmileyGroup $group) {
            return [
                'id' => $group->id,
                'name' => $group->name,
                'sort' => $group->sort,
                'smileys' => $group->smileys->map(fn (Smiley $s) => $this->formatSmiley($s))->values(),
            ];
        })->values();

        return Inertia::render('settings/smilies', [
            'groups' => $groups,
        ]);
    }

    /**
     * 新建表情分组。
     */
    public function storeGroup(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50', 'unique:smiley_groups,name'],
            'sort' => ['nullable', 'integer', 'min:0', 'max:9999'],
        ]);

        SmileyGroup::create([
            'name' => $validated['name'],
            'sort' => $validated['sort'] ?? 0,
        ]);

        $this->comments->flushSmileyCache();

        return back()->with('toast', ['type' => 'success', 'message' => '表情分组已创建。']);
    }

    /**
     * 更新表情分组。
     */
    public function updateGroup(Request $request, SmileyGroup $group)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50', 'unique:smiley_groups,name,'.$group->id],
            'sort' => ['nullable', 'integer', 'min:0', 'max:9999'],
        ]);

        $group->update([
            'name' => $validated['name'],
            'sort' => $validated['sort'] ?? $group->sort,
        ]);

        $this->comments->flushSmileyCache();

        return back()->with('toast', ['type' => 'success', 'message' => '表情分组已更新。']);
    }

    /**
     * 删除表情分组（级联删除其下表情）。
     */
    public function destroyGroup(SmileyGroup $group)
    {
        $group->delete();

        $this->comments->flushSmileyCache();

        return back()->with('toast', ['type' => 'success', 'message' => '表情分组已删除。']);
    }

    /**
     * 新建图片表情（支持文件上传或远程 URL）。
     */
    public function storeSmiley(Request $request)
    {
        $validated = $request->validate([
            'group_id' => ['required', 'integer', 'exists:smiley_groups,id'],
            'code' => ['required', 'string', 'max:50', 'regex:/^[a-zA-Z0-9_\-]+$/', 'unique:smileys,code'],
            'image' => ['required', 'string', 'max:500'],
            'image_file' => ['nullable', 'image', 'max:512'],
            'sort' => ['nullable', 'integer', 'min:0', 'max:9999'],
        ], [
            'code.regex' => '表情代码只能包含字母、数字、下划线和连字符。',
        ]);

        $image = $validated['image'];

        if ($request->hasFile('image_file')) {
            $path = $request->file('image_file')->store('smileys', 'public');
            $image = $path;
        }

        Smiley::create([
            'group_id' => $validated['group_id'],
            'code' => $validated['code'],
            'image' => $image,
            'sort' => $validated['sort'] ?? 0,
        ]);

        $this->comments->flushSmileyCache();

        return back()->with('toast', ['type' => 'success', 'message' => '表情已添加。']);
    }

    /**
     * 删除图片表情。
     */
    public function destroySmiley(Smiley $smiley)
    {
        // 本地上传的文件随记录删除
        if (! str_starts_with((string) $smiley->image, 'http') && Storage::disk('public')->exists((string) $smiley->image)) {
            Storage::disk('public')->delete((string) $smiley->image);
        }

        $smiley->delete();

        $this->comments->flushSmileyCache();

        return back()->with('toast', ['type' => 'success', 'message' => '表情已删除。']);
    }

    /**
     * 格式化表情数据。
     *
     * @return array<string, mixed>
     */
    protected function formatSmiley(Smiley $smiley): array
    {
        $image = $smiley->image;

        return [
            'id' => $smiley->id,
            'group_id' => $smiley->group_id,
            'code' => $smiley->code,
            'image' => $image,
            'url' => str_starts_with((string) $image, 'http') ? $image : Storage::url((string) $image),
            'sort' => $smiley->sort,
        ];
    }
}
