<?php

namespace App\Http\Controllers;

use App\Models\Article;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * 后台「说说」管理：说说与文章共用 articles 表（post_type=moment），
 * 无标题，仅内容 + 状态 + 评论开关。
 */
class MomentsController extends Controller
{
    /**
     * 说说列表页。
     */
    public function index(Request $request): Response
    {
        $status = $request->query('status', 'all');

        $query = Article::ofType(Article::TYPE_MOMENT)
            ->with('author')
            ->orderBy('created_at', 'desc');

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $moments = $query->paginate(10)->through(fn (Article $moment) => [
            'id' => $moment->id,
            'snippet' => mb_substr(trim((string) Article::extractPlainText($moment->content)), 0, 80),
            'author_name' => $moment->author?->nickname ?: ($moment->author?->name ?? ''),
            'permalink' => '/moments/'.$moment->id,
            'comment_count' => $moment->comment_count,
            'views' => $moment->views,
            'likes' => $moment->likes,
            'status' => $moment->status,
            'created_at' => $moment->created_at->format('Y-m-d H:i'),
        ]);

        $base = Article::ofType(Article::TYPE_MOMENT);
        $statusCounts = [
            'all' => (clone $base)->count(),
            'publish' => (clone $base)->where('status', 'publish')->count(),
            'pending' => (clone $base)->where('status', 'pending')->count(),
            'draft' => (clone $base)->where('status', 'draft')->count(),
            'trash' => (clone $base)->where('status', 'trash')->count(),
        ];

        return Inertia::render('Moments/Index', [
            'moments' => $moments,
            'statusCounts' => $statusCounts,
            'currentStatus' => $status,
        ]);
    }

    /**
     * 写说说页。
     */
    public function create(): Response
    {
        return Inertia::render('Moments/Create');
    }

    /**
     * 保存新说说。
     */
    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validateMoment($request);

        $moment = Article::create([
            'author_id' => $request->user()->id,
            'title' => '',
            'slug' => '',
            'excerpt' => '',
            'content' => $validated['content'] ?? [],
            'status' => $validated['status'],
            'post_type' => Article::TYPE_MOMENT,
            'comment_status' => $validated['comment_status'],
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => '说说已发布。']);

        return to_route('moments.admin.edit', ['moment' => $moment->id]);
    }

    /**
     * 编辑说说页。
     */
    public function edit(Article $moment): Response
    {
        abort_unless($moment->isMoment(), 404);

        return Inertia::render('Moments/Edit', [
            'moment' => [
                'id' => $moment->id,
                'content' => $moment->content,
                'status' => $moment->status,
                'comment_status' => $moment->comment_status,
                'permalink' => '/moments/'.$moment->id,
                'created_at' => $moment->created_at->format('Y-m-d H:i'),
            ],
        ]);
    }

    /**
     * 更新说说。
     */
    public function update(Request $request, Article $moment): RedirectResponse
    {
        abort_unless($moment->isMoment(), 404);

        $validated = $this->validateMoment($request);

        $moment->update([
            'content' => $validated['content'] ?? [],
            'status' => $validated['status'],
            'comment_status' => $validated['comment_status'],
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => '说说已保存。']);

        return to_route('moments.admin.edit', ['moment' => $moment->id]);
    }

    /**
     * 批量更新说说状态。
     */
    public function batchUpdate(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:articles,id',
            'status' => 'required|string|in:publish,pending,draft,trash',
        ]);

        Article::ofType(Article::TYPE_MOMENT)
            ->whereIn('id', $validated['ids'])
            ->update(['status' => $validated['status']]);

        return redirect()->back();
    }

    /**
     * 移入回收站。
     */
    public function trash(Article $moment): RedirectResponse
    {
        abort_unless($moment->isMoment(), 404);
        $moment->update(['status' => 'trash']);

        return redirect()->back();
    }

    /**
     * 从回收站恢复为草稿。
     */
    public function restore(Article $moment): RedirectResponse
    {
        abort_unless($moment->isMoment(), 404);
        $moment->update(['status' => 'draft']);

        return redirect()->back();
    }

    /**
     * 永久删除。
     */
    public function destroy(Article $moment): RedirectResponse
    {
        abort_unless($moment->isMoment(), 404);
        $moment->delete();

        return redirect()->back();
    }

    /**
     * 说说公共校验规则。
     *
     * @return array{content: array|null, status: string, comment_status: string}
     */
    private function validateMoment(Request $request): array
    {
        return $request->validate([
            'content' => 'nullable|array',
            'status' => 'required|string|in:publish,draft,pending,trash',
            'comment_status' => 'required|string|in:open,close',
        ]);
    }
}
