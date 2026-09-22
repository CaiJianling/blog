<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Models\ArticleLike;
use App\Models\Attachment;
use App\Models\Option;
use App\Models\Page;
use App\Models\TermTaxonomy;
use App\Services\CommentService;
use App\Services\PermalinkService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\RenderingResponse;

class BlogController extends Controller
{
    public function __construct(
        protected PermalinkService $permalinks,
        protected CommentService $commentService,
    ) {}

    public function index(Request $request)
    {
        $category = $request->query('category');
        $tag = $request->query('tag');
        $q = $request->query('q');
        $scope = $request->query('scope');
        $scope = in_array($scope, ['title', 'content', 'title_content'], true) ? $scope : 'title';

        $query = Article::where('status', 'publish')
            ->ofType(Article::TYPE_POST)
            ->with('author')
            ->orderBy('created_at', 'desc');

        if ($q) {
            $like = '%'.$q.'%';

            $query->where(function (Builder $search) use ($scope, $like) {
                if ($scope === 'content') {
                    $search->where('content', 'like', $like);
                } elseif ($scope === 'title_content') {
                    $search->where('title', 'like', $like)->orWhere('content', 'like', $like);
                } else {
                    $search->where('title', 'like', $like);
                }
            });
        }

        if ($category) {
            $query->whereHas('categories', function ($q) use ($category) {
                $q->where('slug', $category);
            });
        }

        if ($tag) {
            $query->whereHas('tags', function ($q) use ($tag) {
                $q->where('slug', $tag);
            });
        }

        $articles = $query->paginate(10)->through(function ($article) {
            $categories = $this->getArticleTaxonomies($article->id, 'category');
            $tags = $this->getArticleTaxonomies($article->id, 'tag');

            return [
                'id' => $article->id,
                'title' => $article->title,
                'slug' => $article->slug,
                'permalink' => $this->permalinks->articlePath($article),
                'excerpt' => $article->excerpt,
                'featured_image' => $article->featuredImageUrl(),
                'author_name' => $article->author?->nickname ?: ($article->author?->name ?? ''),
                'author_avatar' => $article->author?->avatarUrl() ?? '',
                'categories' => $categories,
                'tags' => $tags,
                'views' => $article->views,
                'likes' => $article->likes,
                'comment_count' => $article->comment_count,
                'reading_time' => $article->estimatedReadingMinutes(),
                'created_at' => $article->created_at->format('Y-m-d'),
            ];
        });

        $categories = TermTaxonomy::where('taxonomy', 'category')
            ->with('term')
            ->withCount(['relationships as article_count' => function ($q) {
                $q->where('object_type', 'article');
            }])
            ->get()
            ->map(fn ($t) => [
                'name' => $t->term->name,
                'slug' => $t->term->slug,
                'count' => $t->article_count,
            ]);

        return Inertia::render('Blog/Index', [
            'articles' => $articles,
            'categories' => $categories,
            'currentCategory' => $category,
            'currentTag' => $tag,
            'currentQuery' => $q,
            'currentScope' => $scope,
            'sidebar' => $this->sidebarPayload(),
        ]);
    }

    public function show(Article $article, Request $request)
    {
        abort_if($article->status !== 'publish', 404);

        return $this->renderArticle($article, $request);
    }

    /**
     * 按固定链接结构解析路径并展示内容：
     * 文章与页面共用同一固定链接结构，先按文章解析，未命中再按页面解析。
     */
    public function permalink(string $permalink, Request $request)
    {
        $article = $this->permalinks->resolve($permalink);

        if ($article !== null) {
            return $this->renderArticle($article, $request);
        }

        $page = $this->permalinks->resolvePage($permalink);

        abort_if($page === null, 404);

        return $this->renderPage($page, $request);
    }

    /**
     * 博客侧边栏数据：博主信息、站点统计与后台维护的自定义菜单。
     *
     * @return array<string, mixed>
     */
    private function sidebarPayload(): array
    {
        $avatarId = (int) Option::get('sidebar_blogger_avatar', '');
        $avatarUrl = null;

        if ($avatarId > 0) {
            $attachment = Attachment::find($avatarId);

            if ($attachment && $attachment->isImage()) {
                $avatarUrl = Storage::disk('public')->url($attachment->file_path);
            }
        }

        return [
            'blogger' => [
                'name' => trim((string) Option::get('sidebar_blogger_name', '')) ?: '博主',
                'avatar_url' => $avatarUrl,
                'intro' => (string) Option::get('sidebar_blogger_intro', ''),
            ],
            'stats' => [
                'articles' => Article::where('status', 'publish')->ofType(Article::TYPE_POST)->count(),
                'views' => (int) Article::where('status', 'publish')->ofType(Article::TYPE_POST)->sum('views'),
                'comments' => (int) Article::where('status', 'publish')->ofType(Article::TYPE_POST)->sum('comment_count'),
            ],
            'menus' => SidebarSettingController::menus(),
        ];
    }

    /**
     * 渲染文章详情页（浏览计数、评论、相关文章、上下篇）。
     */
    private function renderArticle(Article $article, Request $request)
    {
        // 说说走独立的 /moments 展示，不占用文章详情路由
        abort_if($article->isMoment(), 404);

        $article->increment('views');
        $article->refresh();

        $categories = $this->getArticleTaxonomies($article->id, 'category');
        $tags = $this->getArticleTaxonomies($article->id, 'tag');

        $user = $request->user();

        $commentTree = $this->commentService->threadTree('article', $article->id, $user, $article);
        $extras = $this->commentService->discussionExtras($user);

        $related = Article::where('status', 'publish')
            ->ofType(Article::TYPE_POST)
            ->where('id', '!=', $article->id)
            ->orderBy('views', 'desc')
            ->take(5)
            ->get()
            ->map(fn ($a) => [
                'id' => $a->id,
                'title' => $a->title,
                'slug' => $a->slug,
                'permalink' => $this->permalinks->articlePath($a),
                'created_at' => $a->created_at->format('Y-m-d'),
            ]);

        $previous = Article::where('status', 'publish')
            ->ofType(Article::TYPE_POST)
            ->where('id', '<', $article->id)
            ->orderBy('id', 'desc')
            ->first();

        $next = Article::where('status', 'publish')
            ->ofType(Article::TYPE_POST)
            ->where('id', '>', $article->id)
            ->orderBy('id')
            ->first();

        return Inertia::render('Blog/Show', [
            'article' => [
                'id' => $article->id,
                'title' => $article->title,
                'content' => $article->content,
                'excerpt' => $article->excerpt,
                'meta_title' => $article->meta_title,
                'meta_description' => $article->meta_description,
                'author_name' => $article->author?->nickname ?: ($article->author?->name ?? ''),
                'author_avatar' => $article->author?->avatarUrl() ?? '',
                'categories' => $categories,
                'tags' => $tags,
                'views' => $article->views,
                'comment_count' => $article->comment_count,
                'reading_time' => $article->estimatedReadingMinutes(),
                'created_at' => $article->created_at->format('Y-m-d'),
                'permalink' => $this->permalinks->articlePath($article),
                'comment_status' => $article->comment_status,
                'likes' => $article->likes,
                'liked_by_me' => $request->user()
                    ? ArticleLike::where('article_id', $article->id)->where('user_id', $request->user()->id)->exists()
                    : null,
                // 仅文章作者本人可在前台看到「快捷编辑」悬浮入口
                'can_edit' => $user !== null && (int) $article->author_id === (int) $user->id,
            ],
            'comments' => $commentTree,
            'captcha' => $extras['captcha'],
            'smileyGroups' => $extras['smileyGroups'],
            'relatedArticles' => $related,
            'prevArticle' => $previous ? [
                'title' => $previous->title,
                'permalink' => $this->permalinks->articlePath($previous),
            ] : null,
            'nextArticle' => $next ? [
                'title' => $next->title,
                'permalink' => $this->permalinks->articlePath($next),
            ] : null,
        ]);
    }

    /**
     * 渲染页面公开详情（浏览计数、评论区）。
     *
     * @return RenderingResponse
     */
    private function renderPage(Page $page, Request $request)
    {
        $page->increment('views');
        $page->refresh();

        $user = $request->user();

        $commentTree = $this->commentService->threadTree('page', $page->id, $user, $page);
        $extras = $this->commentService->discussionExtras($user);

        return Inertia::render('Page/Show', [
            'page' => [
                'id' => $page->id,
                'title' => $page->title,
                'slug' => $page->slug,
                'content' => $page->content,
                'meta_title' => $page->meta_title,
                'meta_description' => $page->meta_description,
                'author_name' => $page->author?->nickname ?: ($page->author?->name ?? ''),
                'author_avatar' => $page->author?->avatarUrl() ?? '',
                'views' => $page->views,
                'likes' => $page->likes,
                'comment_count' => $page->comments()->where('status', '1')->count(),
                'comment_status' => $page->comment_status,
                'created_at' => $page->created_at->format('Y-m-d'),
                'permalink' => $this->permalinks->pagePath($page),
            ],
            'comments' => $commentTree,
            'captcha' => $extras['captcha'],
            'smileyGroups' => $extras['smileyGroups'],
        ]);
    }

    /**
     * 获取文章关联的分类或标签。
     *
     * @return array<int, array{name: string, slug: string}>
     */
    private function getArticleTaxonomies(int $articleId, string $taxonomy): array
    {
        return TermTaxonomy::where('taxonomy', $taxonomy)
            ->whereHas('relationships', function ($q) use ($articleId) {
                $q->where('object_id', $articleId)->where('object_type', 'article');
            })
            ->with('term')
            ->get()
            ->map(fn ($t) => [
                'name' => $t->term->name,
                'slug' => $t->term->slug,
            ])
            ->toArray();
    }
}
