<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Models\ArticleLike;
use App\Models\Attachment;
use App\Models\Comment;
use App\Models\Option;
use App\Models\SmileyGroup;
use App\Models\TermTaxonomy;
use App\Models\User;
use App\Services\CommentService;
use App\Services\PermalinkService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

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

        $query = Article::where('status', 'publish')
            ->with('author')
            ->orderBy('created_at', 'desc');

        if ($q) {
            $query->where('title', 'like', '%'.$q.'%');
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
                'author_name' => $article->author?->nickname ?: ($article->author?->name ?? ''),
                'author_avatar' => $article->author?->avatarUrl() ?? '',
                'categories' => $categories,
                'tags' => $tags,
                'views' => $article->views,
                'likes' => $article->likes,
                'comment_count' => $article->comment_count,
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
            'sidebar' => $this->sidebarPayload(),
        ]);
    }

    public function show(Article $article, Request $request)
    {
        abort_if($article->status !== 'publish', 404);

        return $this->renderArticle($article, $request);
    }

    /**
     * 按固定链接结构解析路径并展示文章。
     */
    public function permalink(string $permalink, Request $request)
    {
        $article = $this->permalinks->resolve($permalink);

        abort_if($article === null, 404);

        return $this->renderArticle($article, $request);
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
                'articles' => Article::where('status', 'publish')->count(),
                'views' => (int) Article::where('status', 'publish')->sum('views'),
                'comments' => (int) Article::where('status', 'publish')->sum('comment_count'),
            ],
            'menus' => SidebarSettingController::menus(),
        ];
    }

    /**
     * 渲染文章详情页（浏览计数、评论、相关文章、上下篇）。
     */
    private function renderArticle(Article $article, Request $request)
    {
        $article->increment('views');
        $article->refresh();

        $categories = $this->getArticleTaxonomies($article->id, 'category');
        $tags = $this->getArticleTaxonomies($article->id, 'tag');

        $allComments = Comment::where('object_id', $article->id)
            ->where('object_type', 'article')
            ->where('status', '1')
            ->orderBy('created_at')
            ->get();

        $user = $request->user();

        // 过滤无权查看的悄悄话评论
        $visible = $allComments->filter(fn (Comment $c) => $this->commentService->canView($c, $user, $article));

        $commentItems = $visible->map(fn (Comment $c) => $this->formatComment($c, $user));

        // 组装两级评论树：顶层 + 回复
        $commentTree = $commentItems
            ->filter(fn ($c) => (int) $c['parent_id'] === 0)
            ->map(function ($c) use ($commentItems) {
                $c['replies'] = $commentItems
                    ->filter(fn ($r) => (int) $r['parent_id'] === (int) $c['comment_id'])
                    ->values();

                return $c;
            })
            ->values();

        $captcha = $user === null ? $this->commentService->generateCaptcha() : null;

        $smileyGroups = SmileyGroup::orderBy('sort')->with('smileys')->get()->map(function ($group) {
            return [
                'id' => $group->id,
                'name' => $group->name,
                'smileys' => $group->smileys->map(fn ($s) => [
                    'code' => $s->code,
                    'url' => str_starts_with((string) $s->image, 'http')
                        ? $s->image
                        : Storage::url((string) $s->image),
                ])->values(),
            ];
        })->values();

        $related = Article::where('status', 'publish')
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
            ->where('id', '<', $article->id)
            ->orderBy('id', 'desc')
            ->first();

        $next = Article::where('status', 'publish')
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
                'created_at' => $article->created_at->format('Y-m-d'),
                'permalink' => $this->permalinks->articlePath($article),
                'comment_status' => $article->comment_status,
                'likes' => $article->likes,
                'liked_by_me' => $request->user()
                    ? ArticleLike::where('article_id', $article->id)->where('user_id', $request->user()->id)->exists()
                    : null,
            ],
            'comments' => $commentTree,
            'captcha' => $captcha,
            'smileyGroups' => $smileyGroups,
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
     * 格式化单条评论数据。
     *
     * @return array<string, mixed>
     */
    private function formatComment(Comment $comment, ?User $user): array
    {
        return [
            'comment_id' => $comment->comment_id,
            'parent_id' => $comment->parent_id,
            'author_name' => $comment->user?->nickname ?: ($comment->user?->name ?? $comment->author_name),
            'author_url' => $comment->author_url,
            'author_qq' => $comment->author_qq,
            'avatar' => $comment->avatar_url,
            'html' => $this->commentService->renderContent($comment),
            'is_private' => $comment->is_private,
            'is_markdown' => $comment->is_markdown,
            'is_own' => $user !== null && (int) $comment->user_id === (int) $user->id,
            'created_at' => $comment->created_at?->format('Y-m-d H:i'),
        ];
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
