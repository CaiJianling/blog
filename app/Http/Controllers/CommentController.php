<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Models\Comment;
use App\Models\Page;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class CommentController extends Controller
{
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

        $comments = $query->paginate(20)
            ->through(function ($comment) {
                $relatedTitle = null;
                $relatedSlug = null;

                if ($comment->object_type === 'article') {
                    $article = Article::find($comment->object_id);
                    $relatedTitle = $article?->title;
                    $relatedSlug = $article?->slug;
                } elseif ($comment->object_type === 'page') {
                    $page = Page::find($comment->object_id);
                    $relatedTitle = $page?->title;
                    $relatedSlug = $page?->slug;
                }

                return [
                    'comment_id' => $comment->comment_id,
                    'author_name' => $comment->author_name,
                    'author_email' => $comment->author_email,
                    'author_url' => $comment->author_url,
                    'ip' => $comment->ip,
                    'content' => $comment->content,
                    'like_num' => $comment->like_num,
                    'status' => $comment->status,
                    'status_text' => $comment->status_text,
                    'parent_id' => $comment->parent_id,
                    'object_id' => $comment->object_id,
                    'object_type' => $comment->object_type,
                    'related_title' => $relatedTitle,
                    'related_slug' => $relatedSlug,
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
}
