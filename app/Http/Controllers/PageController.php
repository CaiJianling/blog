<?php

namespace App\Http\Controllers;

use App\Exceptions\AiRequestException;
use App\Models\Page;
use App\Services\AiService;
use App\Services\PermalinkService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class PageController extends Controller
{
    public function __construct(
        protected PermalinkService $permalinks,
    ) {}

    public function index(Request $request)
    {
        $status = $request->query('status', 'all');

        $query = Page::with('author')->withCount('comments')->orderBy('created_at', 'desc');

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $pages = $query->paginate(10)
            ->through(function ($page) {
                return [
                    'id' => $page->id,
                    'title' => $page->title,
                    'author_name' => $page->author?->nickname ?: ($page->author?->name ?? ''),
                    'slug' => $page->slug,
                    'permalink' => $this->permalinks->pagePath($page),
                    'status' => $page->status,
                    'views' => $page->views,
                    'likes' => $page->likes,
                    'comment_count' => $page->comments_count,
                    'created_at' => $page->created_at->format('Y-m-d'),
                ];
            });

        $statusCounts = [
            'all' => Page::count(),
            'publish' => Page::where('status', 'publish')->count(),
            'draft' => Page::where('status', 'draft')->count(),
            'trash' => Page::where('status', 'trash')->count(),
        ];

        return Inertia::render('Page/Index', [
            'pages' => $pages,
            'statusCounts' => $statusCounts,
            'currentStatus' => $status,
        ]);
    }

    public function create()
    {
        return Inertia::render('Page/Create');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string',
            'slug' => 'nullable|string|unique:pages',
            'meta_title' => 'nullable|string|max:200',
            'meta_description' => 'nullable|string',
            'content' => 'nullable|array',
            'status' => 'required|string|in:publish,draft,trash',
            'comment_status' => 'required|string|in:open,close',
        ]);

        Page::create([
            'author_id' => Auth::id(),
            'title' => $validated['title'],
            'slug' => $validated['slug'] ?? str()->slug($validated['title']),
            'meta_title' => $validated['meta_title'] ?? null,
            'meta_description' => $validated['meta_description'] ?? null,
            'content' => $validated['content'] ?? [],
            'status' => $validated['status'],
            'comment_status' => $validated['comment_status'],
        ]);

        return redirect()->route('pages.index');
    }

    /**
     * AI 生成页面：根据作者给出的写作提示生成标题、正文与 SEO 元信息，
     * 由前端解析为块数据填入编辑器，作者检查确认后再手动保存。
     */
    public function aiGenerate(Request $request, AiService $ai): JsonResponse
    {
        $validated = $request->validate([
            'prompt' => ['required', 'string', 'max:2000'],
        ], [
            'prompt.required' => '请输入写作提示。',
            'prompt.max' => '写作提示不能超过 2000 个字符。',
        ]);

        if (! $ai->isConfigured()) {
            return response()->json([
                'message' => '请先在后台「设置 → AI 设置」中完成 AI 接口配置。',
            ], 422);
        }

        try {
            $result = $ai->generatePage($validated['prompt']);
        } catch (AiRequestException $e) {
            // 附带真实错误上下文（状态码/URL/上游原始返回），供前端"查看详情"展示
            return response()->json([
                'message' => $e->getMessage(),
                'debug' => $e->context(),
            ], 502);
        } catch (\RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 502);
        }

        return response()->json($result);
    }

    public function edit(Page $page)
    {
        return Inertia::render('Page/Edit', [
            'page' => [
                'id' => $page->id,
                'title' => $page->title,
                'slug' => $page->slug,
                'meta_title' => $page->meta_title,
                'meta_description' => $page->meta_description,
                'content' => $page->content,
                'status' => $page->status,
                'comment_status' => $page->comment_status,
            ],
        ]);
    }

    public function update(Request $request, Page $page)
    {
        $validated = $request->validate([
            'title' => 'required|string',
            'slug' => 'nullable|string|unique:pages,slug,'.$page->id,
            'meta_title' => 'nullable|string|max:200',
            'meta_description' => 'nullable|string',
            'content' => 'nullable|array',
            'status' => 'required|string|in:publish,draft,trash',
            'comment_status' => 'required|string|in:open,close',
        ]);

        $page->update([
            'title' => $validated['title'],
            'slug' => $validated['slug'] ?? str()->slug($validated['title']),
            'meta_title' => $validated['meta_title'] ?? null,
            'meta_description' => $validated['meta_description'] ?? null,
            'content' => $validated['content'] ?? [],
            'status' => $validated['status'],
            'comment_status' => $validated['comment_status'],
        ]);

        return redirect()->route('pages.index');
    }

    /**
     * 批量更新页面状态。
     */
    public function batchUpdate(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:pages,id',
            'status' => 'required|string|in:publish,draft,trash',
        ]);

        Page::whereIn('id', $validated['ids'])->update(['status' => $validated['status']]);

        return redirect()->back();
    }

    /**
     * 将单个页面移至回收站。
     */
    public function trash(Page $page)
    {
        $page->update(['status' => 'trash']);

        return redirect()->back();
    }

    /**
     * 从回收站恢复页面为草稿。
     */
    public function restore(Page $page)
    {
        $page->update(['status' => 'draft']);

        return redirect()->back();
    }

    /**
     * 永久删除页面（仅限回收站中的）。
     */
    public function destroy(Page $page)
    {
        $page->delete();

        return redirect()->back();
    }
}
