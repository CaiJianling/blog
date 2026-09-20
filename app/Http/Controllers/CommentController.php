<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Models\Comment;
use App\Models\Page;
use App\Services\PermalinkService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class CommentController extends Controller
{
    public function __construct(
        protected PermalinkService $permalinks,
    ) {}

    public function index(Request $request)
    {
        $status = $request->query('status', 'all');
        $objectType = $request->query('object_type', 'all');
        $search = $request->query('search', '');

        $query = Comment::orderBy('created_at', 'desc');

        if ($status !== 'all') {
            $query->where('status', $status);
        }
        if ($objectType !== 'all') {
            $query->where('object_type', $objectType);
        }
        if (! empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('content', 'like', "%{$search}%")
                    ->orWhere('author_name', 'like', "%{$search}%")
                    ->orWhere('author_email', 'like', "%{$search}%");
            });
        }

        $comments = $query->paginate(10)
            ->through(function ($comment) {
                $related = match ($comment->object_type) {
                    'article' => Article::find($comment->object_id),
                    'page' => Page::find($comment->object_id),
                    default => null,
                };

                return [
                    'comment_id' => $comment->comment_id,
                    'author_name' => $comment->author_name,
                    'author_email' => $comment->author_email,
                    'author_url' => $comment->author_url,
                    'ip' => $comment->ip,
                    'content' => $comment->content,
                    'edited_content' => $comment->edited_content,
                    'edited_at' => $comment->edited_at?->format('Y-m-d H:i'),
                    'has_pending_edit' => $comment->hasPendingEdit(),
                    'like_num' => $comment->like_num,
                    'status' => $comment->status,
                    'status_text' => $comment->status_text,
                    'parent_id' => $comment->parent_id,
                    'object_id' => $comment->object_id,
                    'object_type' => $comment->object_type,
                    'related_title' => $related?->title,
                    'related_permalink' => $this->relatedPermalink($related),
                    'created_at' => $comment->created_at?->format('Y-m-d H:i'),
                    'created_at_human' => $comment->created_at?->diffForHumans(),
                    'is_author' => $comment->user_id === Auth::id(),
                ];
            });

        $statusCounts = [
            'all' => Comment::count(),
            'mine' => Comment::where('user_id', Auth::id())->count(),
            '0' => Comment::where('status', '0')->count(),
            '1' => Comment::where('status', '1')->count(),
            'spam' => Comment::where('status', 'spam')->count(),
            'trash' => Comment::where('status', 'trash')->count(),
        ];

        return Inertia::render('Comment/Index', [
            'comments' => $comments,
            'statusCounts' => $statusCounts,
            'currentStatus' => $status,
            'currentObjectType' => $objectType,
            'currentSearch' => $search,
        ]);
    }

    /**
     * 评论所挂内容的实际前台地址（跟随固定链接设置）；内容已删除时为 null。
     */
    protected function relatedPermalink(Article|Page|null $related): ?string
    {
        return $related ? $this->permalinks->objectPath($related) : null;
    }

    public function approve(Comment $comment)
    {
        $comment->update(['status' => '1']);

        return redirect()->back();
    }

    public function reject(Comment $comment)
    {
        $comment->update(['status' => '0']);

        return redirect()->back();
    }

    public function spam(Comment $comment)
    {
        $comment->update(['status' => 'spam']);

        return redirect()->back();
    }

    public function trash(Comment $comment)
    {
        $comment->update(['status' => 'trash']);

        return redirect()->back();
    }

    public function restore(Comment $comment)
    {
        $comment->update(['status' => '1']);

        return redirect()->back();
    }

    public function destroy(Comment $comment)
    {
        $comment->delete();

        return redirect()->back();
    }

    public function batchUpdate(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:comments,comment_id',
            'action' => 'required|string|in:approve,reject,spam,trash,restore,delete',
        ]);

        if ($validated['action'] === 'delete') {
            Comment::whereIn('comment_id', $validated['ids'])->delete();
        } else {
            $statusMap = [
                'approve' => '1',
                'reject' => '0',
                'spam' => 'spam',
                'trash' => 'trash',
                'restore' => '1',
            ];

            Comment::whereIn('comment_id', $validated['ids'])
                ->update(['status' => $statusMap[$validated['action']]]);
        }

        return redirect()->back();
    }

    /**
     * 后台编辑评论内容：管理员直接生效；非管理员写入待审修订（edited_content）。
     */
    public function update(Request $request, Comment $comment)
    {
        $validated = $request->validate([
            'content' => ['required', 'string', 'max:5000'],
        ]);

        $user = $request->user();

        if ((string) $user?->role === 'administrator') {
            $comment->update([
                'content' => $validated['content'],
                'edited_content' => null,
                'edited_at' => now(),
            ]);
        } else {
            $comment->update([
                'edited_content' => $validated['content'],
            ]);
        }

        return redirect()->back();
    }

    /**
     * 通过待审修订：edited_content 替换正文并记录最后编辑时间。
     */
    public function approveEdit(Comment $comment)
    {
        if ($comment->edited_content === null) {
            abort(404, '该评论没有待审修订。');
        }

        $comment->update([
            'content' => $comment->edited_content,
            'edited_content' => null,
            'edited_at' => now(),
        ]);

        return redirect()->back();
    }

    /**
     * 拒绝待审修订：丢弃 edited_content，正文保持不变。
     */
    public function rejectEdit(Comment $comment)
    {
        $comment->update(['edited_content' => null]);

        return redirect()->back();
    }
}
