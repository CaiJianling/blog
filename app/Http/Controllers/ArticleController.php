<?php

namespace App\Http\Controllers;

use App\Exceptions\AiRequestException;
use App\Models\Article;
use App\Models\Term;
use App\Models\TermRelationship;
use App\Models\TermTaxonomy;
use App\Services\AiService;
use App\Services\PermalinkService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class ArticleController extends Controller
{
    public function __construct(
        protected PermalinkService $permalinks,
    ) {}

    public function index(Request $request)
    {
        $status = $request->query('status', 'all');

        $query = Article::ofType(Article::TYPE_POST)
            ->with('author')
            ->orderBy('created_at', 'desc');

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
                    'author_name' => $article->author?->nickname ?: ($article->author?->name ?? ''),
                    'permalink' => $this->permalinks->articlePath($article),
                    'categories' => $categories->pluck('term.name')->toArray(),
                    'tags' => $tags->pluck('term.name')->toArray(),
                    'comment_count' => $article->comment_count,
                    'created_at' => $article->created_at->format('Y-m-d'),
                    'views' => $article->views,
                    'status' => $article->status,
                ];
            });

        $statusCounts = [
            'all' => Article::ofType(Article::TYPE_POST)->count(),
            'publish' => Article::ofType(Article::TYPE_POST)->where('status', 'publish')->count(),
            'pending' => Article::ofType(Article::TYPE_POST)->where('status', 'pending')->count(),
            'draft' => Article::ofType(Article::TYPE_POST)->where('status', 'draft')->count(),
            'trash' => Article::ofType(Article::TYPE_POST)->where('status', 'trash')->count(),
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
            'meta_title' => 'nullable|string|max:200',
            'meta_description' => 'nullable|string',
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
            'meta_title' => $validated['meta_title'] ?? null,
            'meta_description' => $validated['meta_description'] ?? null,
            'content' => $validated['content'] ?? [],
            'post_password' => $validated['post_password'] ?? '',
            'status' => $validated['status'],
            'post_type' => Article::TYPE_POST,
            'comment_status' => $validated['comment_status'],
        ]);

        if (! empty($validated['categories'])) {
            foreach ($validated['categories'] as $taxonomyId) {
                TermRelationship::create([
                    'object_id' => $article->id,
                    'object_type' => 'article',
                    'term_taxonomy_id' => $taxonomyId,
                ]);
            }
        }

        if (! empty($validated['tags'])) {
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

    /**
     * AI 生成文章：根据作者给出的写作提示生成标题、摘要与 Markdown 正文，
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

        $context = [
            'categories' => $this->existingTaxonomyNames('category'),
            'tags' => $this->existingTaxonomyNames('tag'),
        ];

        try {
            $result = $ai->generateArticle($validated['prompt'], $context);
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

        // 主生成若漏掉 标签/分类（弱模型或 JSON 被容错解析时会缺失），
        // 再发一次聚焦的提取调用，依据正文补齐，保证贴合内容；补齐失败不影响已生成的标题/正文。
        if (($result['tags'] ?? []) === [] || ($result['categories'] ?? []) === []) {
            try {
                $meta = $ai->extractArticleMeta($result['title'], $result['excerpt'], $result['markdown'], $context);

                $result['tags'] = ($result['tags'] ?? []) !== [] ? $result['tags'] : $meta['tags'];
                $result['categories'] = ($result['categories'] ?? []) !== [] ? $result['categories'] : $meta['categories'];
                // 主生成若未产出更好的 SEO，则采用补全调用的（更贴切）
                $result['meta_title'] = $meta['meta_title'] !== '' ? $meta['meta_title'] : $result['meta_title'];
                $result['meta_description'] = $meta['meta_description'] !== '' ? $meta['meta_description'] : $result['meta_description'];
            } catch (\Throwable $e) {
                Log::warning('AiService: 补全 SEO/标签/分类失败，保留主生成内容', ['error' => $e->getMessage()]);
            }
        }

        // 把 AI 生成的分类/标签名解析为 term_taxonomy_id：命中已有则复用，否则创建，
        // 供前端直接选中（新创建的也会回填到选择器列表以便展示）。
        $categories = $this->resolveTaxonomyIds('category', $result['categories'] ?? []);
        $tags = $this->resolveTaxonomyIds('tag', $result['tags'] ?? []);

        return response()->json(array_merge($result, [
            'category_ids' => $categories['ids'],
            'tag_ids' => $tags['ids'],
            'created_categories' => $categories['created'],
            'created_tags' => $tags['created'],
        ]));
    }

    /**
     * 列出某类（category/tag）下现有的词条名，作为 AI 选词上下文。
     *
     * @return array<int, string>
     */
    private function existingTaxonomyNames(string $taxonomy): array
    {
        return TermTaxonomy::where('taxonomy', $taxonomy)
            ->with('term')
            ->get()
            ->map(fn (TermTaxonomy $item) => (string) $item->term->name)
            ->filter(fn (string $name) => $name !== '')
            ->values()
            ->all();
    }

    /**
     * 将词条名解析为 term_taxonomy_id 列表：命中已有（忽略大小写）则复用，否则创建新的词条。
     *
     * @param  array<int, string>  $names
     * @return array{ids: array<int, int>, created: array<int, array{id: int, name: string}>}
     */
    private function resolveTaxonomyIds(string $taxonomy, array $names): array
    {
        $existing = TermTaxonomy::where('taxonomy', $taxonomy)
            ->with('term')
            ->get()
            ->keyBy(fn (TermTaxonomy $item) => mb_strtolower((string) $item->term->name));

        $ids = [];
        $created = [];

        foreach ($names as $rawName) {
            $name = trim((string) $rawName);

            if ($name === '' || mb_strlen($name) > 100) {
                continue;
            }

            $key = mb_strtolower($name);

            if (isset($existing[$key])) {
                $id = $existing[$key]->term_taxonomy_id;

                if (! in_array($id, $ids, true)) {
                    $ids[] = $id;
                }

                continue;
            }

            $term = Term::create([
                'name' => $name,
                'slug' => str()->slug($name),
            ]);

            $tt = TermTaxonomy::create([
                'term_id' => $term->term_id,
                'taxonomy' => $taxonomy,
                'description' => '',
                'parent' => 0,
            ]);

            // 登记到 existing，避免同一次请求内重复创建同名词条
            $existing[$key] = $tt;
            $ids[] = $tt->term_taxonomy_id;
            $created[] = ['id' => $tt->term_taxonomy_id, 'name' => $name];
        }

        return ['ids' => $ids, 'created' => $created];
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
                'meta_title' => $article->meta_title,
                'meta_description' => $article->meta_description,
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
            'meta_title' => 'nullable|string|max:200',
            'meta_description' => 'nullable|string',
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
            'meta_title' => $validated['meta_title'] ?? null,
            'meta_description' => $validated['meta_description'] ?? null,
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

    /**
     * 永久删除文章（仅限回收站中的）。
     */
    public function destroy(Article $article)
    {
        $article->delete();

        return redirect()->back();
    }
}
