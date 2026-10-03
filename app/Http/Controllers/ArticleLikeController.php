<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Models\ArticleLike;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * 文章点赞：登录用户按 user_id 记录，游客按浏览器生成的 guest_id 记录。
 * 点赞数量冗余存储在 articles.likes。
 */
class ArticleLikeController extends Controller
{
    public function __invoke(Request $request, Article $article): JsonResponse
    {
        $validated = $request->validate([
            'guestId' => ['nullable', 'string', 'max:64'],
        ]);

        $user = Auth::user();
        $guestId = $user ? null : ($validated['guestId'] ?? null);

        if (! $user && ($guestId === null || $guestId === '')) {
            return response()->json(['message' => '缺少游客标识。'], 422);
        }

        $existing = ArticleLike::where('article_id', $article->id)
            ->when($user, fn ($query) => $query->where('user_id', $user->id))
            ->when(! $user, fn ($query) => $query->where('guest_id', $guestId))
            ->first();

        if ($existing) {
            $existing->delete();
            $article->decrement('likes');
            $liked = false;
        } else {
            ArticleLike::create([
                'article_id' => $article->id,
                'user_id' => $user?->id,
                'guest_id' => $guestId,
            ]);
            $article->increment('likes');
            $liked = true;
        }

        $article->refresh();

        return response()->json([
            'liked' => $liked,
            'likes' => $article->likes,
        ]);
    }
}
