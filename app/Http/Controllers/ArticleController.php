<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Models\Term;
use App\Models\TermTaxonomy;
use App\Models\TermRelationship;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class ArticleController extends Controller
{
    public function index(Request $request)
    {
        $status = $request->query('status', 'all');

        $query = Article::with('author')->orderBy('created_at', 'desc');

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $articles = $query->paginate(10)
            ->through(function ($article) {
                $categories = TermTaxonomy::where('taxonomy', 'category')
                    ->whereHas('relationships', function ($query) use ($article) {
                        $query->where('object_id', $article->id)
                            ->where('object_type', 'article');
                    })
                    ->with('term')
                    ->get();

                $tags = TermTaxonomy::where('taxonomy', 'tag')
                    ->whereHas('relationships', function ($query) use ($article) {
                        $query->where('object_id', $article->id)
                            ->where('object_type', 'article');
                    })
                    ->with('term')
                    ->get();

                return [
                    'id' => $article->id,
                    'title' => $article->title,
                    'author_name' => $article->author?->name ?? '',
                    'categories' => $categories->pluck('term.name')->toArray(),
                    'tags' => $tags->pluck('term.name')->toArray(),
                    'comment_count' => $article->comment_count,
                    'created_at' => $article->created_at->format('Y-m-d'),
                    'views' => $article->views,
                    'status' => $article->status,
                ];
            });

        $statusCounts = [
            'all' => Article::count(),
            'publish' => Article::where('status', 'publish')->count(),
            'pending' => Article::where('status', 'pending')->count(),
            'draft' => Article::where('status', 'draft')->count(),
            'trash' => Article::where('status', 'trash')->count(),
        ];

        return Inertia::render('Article/Index', [
            'articles' => $articles,
            'statusCounts' => $statusCounts,
            'currentStatus' => $status,
        ]);
    }

    public function create()
    {
        $categories = TermTaxonomy::where('taxonomy', 'category')
            ->with('term')
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->term_taxonomy_id,
                    'name' => $item->term->name,
                ];
            });

        $tags = TermTaxonomy::where('taxonomy', 'tag')
            ->with('term')
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->term_taxonomy_id,
                    'name' => $item->term->name,
                ];
            });

        return Inertia::render('Article/Create', [
            'categories' => $categories,
            'tags' => $tags,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string',
            'slug' => 'nullable|string|unique:articles',
            'excerpt' => 'nullable|string',
            'content' => 'nullable|array',
            'post_password' => 'nullable|string',
            'status' => 'required|string|in:publish,draft,pending,trash',
            'comment_status' => 'required|string|in:open,close',
            'categories' => 'nullable|array',
            'tags' => 'nullable|array',
        ]);

        $article = Article::create([
            'author_id' => Auth::id(),
            'title' => $validated['title'],
            'slug' => $validated['slug'] ?? str()->slug($validated['title']),
            'excerpt' => $validated['excerpt'] ?? '',
            'content' => $validated['content'] ?? [],
            'post_password' => $validated['post_password'] ?? '',
            'status' => $validated['status'],
            'comment_status' => $validated['comment_status'],
        ]);

        if (!empty($validated['categories'])) {
            foreach ($validated['categories'] as $taxonomyId) {
                TermRelationship::create([
                    'object_id' => $article->id,
                    'object_type' => 'article',
                    'term_taxonomy_id' => $taxonomyId,
                ]);
            }
        }

        if (!empty($validated['tags'])) {
            foreach ($validated['tags'] as $taxonomyId) {
                TermRelationship::create([
                    'object_id' => $article->id,
                    'object_type' => 'article',
                    'term_taxonomy_id' => $taxonomyId,
                ]);
            }
        }

        return redirect()->route('articles.index');
    }

    public function edit(Article $article)
    {
        $categories = TermTaxonomy::where('taxonomy', 'category')
            ->with('term')
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->term_taxonomy_id,
                    'name' => $item->term->name,
                ];
            });

        $tags = TermTaxonomy::where('taxonomy', 'tag')
            ->with('term')
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->term_taxonomy_id,
                    'name' => $item->term->name,
                ];
            });

        $selectedCategories = TermRelationship::where('object_id', $article->id)
            ->where('object_type', 'article')
            ->whereHas('taxonomy', function ($query) {
                $query->where('taxonomy', 'category');
            })
            ->pluck('term_taxonomy_id')
            ->toArray();

        $selectedTags = TermRelationship::where('object_id', $article->id)
            ->where('object_type', 'article')
            ->whereHas('taxonomy', function ($query) {
                $query->where('taxonomy', 'tag');
            })
            ->pluck('term_taxonomy_id')
            ->toArray();

        return Inertia::render('Article/Edit', [
            'article' => [
                'id' => $article->id,
                'title' => $article->title,
                'slug' => $article->slug,
                'excerpt' => $article->excerpt,
                'content' => $article->content,
                'status' => $article->status,
                'comment_status' => $article->comment_status,
            ],
            'categories' => $categories,
            'tags' => $tags,
            'selectedCategories' => $selectedCategories,
            'selectedTags' => $selectedTags,
        ]);
    }

    public function update(Request $request, Article $article)
    {
        $validated = $request->validate([
            'title' => 'required|string',
            'slug' => 'nullable|string|unique:articles,slug,'.$article->id,
            'excerpt' => 'nullable|string',
            'content' => 'nullable|array',
            'post_password' => 'nullable|string',
            'status' => 'required|string|in:publish,draft,pending,trash',
            'comment_status' => 'required|string|in:open,close',
            'categories' => 'nullable|array',
            'tags' => 'nullable|array',
        ]);

        $article->update([
            'title' => $validated['title'],
            'slug' => $validated['slug'] ?? str()->slug($validated['title']),
            'excerpt' => $validated['excerpt'] ?? '',
            'content' => $validated['content'] ?? [],
            'post_password' => $validated['post_password'] ?? '',
            'status' => $validated['status'],
            'comment_status' => $validated['comment_status'],
        ]);

        // 同步分类与标签：先删除旧关联，再写入新关联
        TermRelationship::where('object_id', $article->id)
            ->where('object_type', 'article')
            ->delete();

        $taxonomyIds = array_merge(
            $validated['categories'] ?? [],
            $validated['tags'] ?? [],
        );

        foreach ($taxonomyIds as $taxonomyId) {
            TermRelationship::create([
                'object_id' => $article->id,
                'object_type' => 'article',
                'term_taxonomy_id' => $taxonomyId,
            ]);
        }

        return redirect()->route('articles.index');
    }

    public function categories()
    {
        $categories = TermTaxonomy::where('taxonomy', 'category')
            ->with('term')
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->term_taxonomy_id,
                    'name' => $item->term->name,
                    'description' => $item->description,
                    'slug' => $item->term->slug,
                    'count' => $item->count,
                    'views' => 0,
                ];
            });

        return Inertia::render('Article/Categories', [
            'categories' => $categories,
        ]);
    }

    public function tags()
    {
        $tags = TermTaxonomy::where('taxonomy', 'tag')
            ->with('term')
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->term_taxonomy_id,
                    'name' => $item->term->name,
                    'description' => $item->description,
                    'slug' => $item->term->slug,
                    'count' => $item->count,
                    'views' => 0,
                ];
            });

        return Inertia::render('Article/Tags', [
            'tags' => $tags,
        ]);
    }

    /**
     * 批量更新文章状态。
     */
    public function batchUpdate(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:articles,id',
            'status' => 'required|string|in:publish,pending,draft,trash',
        ]);

        Article::whereIn('id', $validated['ids'])->update(['status' => $validated['status']]);

        return redirect()->back();
    }

    /**
     * 将单篇文章移至回收站。
     */
    public function trash(Article $article)
    {
        $article->update(['status' => 'trash']);

        return redirect()->back();
    }

    /**
     * 从回收站恢复文章为草稿。
     */
    public function restore(Article $article)
    {
        $article->update(['status' => 'draft']);

        return redirect()->back();
    }
}
