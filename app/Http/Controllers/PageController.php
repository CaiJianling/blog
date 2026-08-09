<?php

namespace App\Http\Controllers;

use App\Models\Page;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class PageController extends Controller
{
    public function index(Request $request)
    {
        $status = $request->query('status', 'all');

        $query = Page::with('author')->orderBy('created_at', 'desc');

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $pages = $query->paginate(10)
            ->through(function ($page) {
                return [
                    'id' => $page->id,
                    'title' => $page->title,
                    'author_name' => $page->author?->name ?? '',
                    'slug' => $page->slug,
                    'status' => $page->status,
                    'views' => $page->views,
                    'likes' => $page->likes,
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
            'content' => 'nullable|array',
            'status' => 'required|string|in:publish,draft,trash',
            'comment_status' => 'required|string|in:open,close',
        ]);

        Page::create([
            'author_id' => Auth::id(),
            'title' => $validated['title'],
            'slug' => $validated['slug'] ?? str()->slug($validated['title']),
            'content' => $validated['content'] ?? [],
            'status' => $validated['status'],
            'comment_status' => $validated['comment_status'],
        ]);

        return redirect()->route('pages.index');
    }

    public function edit(Page $page)
    {
        return Inertia::render('Page/Edit', [
            'page' => [
                'id' => $page->id,
                'title' => $page->title,
                'slug' => $page->slug,
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
            'content' => 'nullable|array',
            'status' => 'required|string|in:publish,draft,trash',
            'comment_status' => 'required|string|in:open,close',
        ]);

        $page->update([
            'title' => $validated['title'],
            'slug' => $validated['slug'] ?? str()->slug($validated['title']),
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
}
