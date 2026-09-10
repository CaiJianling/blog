<?php

namespace App\Services;

use App\Models\Article;
use App\Models\Comment;
use App\Models\Smiley;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;

/**
 * 评论服务：算术验证码生成/校验、评论内容渲染（Markdown + 表情）、
 * 悄悄话可见性判断、回复邮件通知。
 */
class CommentService
{
    /**
     * 生成算术验证码，返回题目与加密 token。
     *
     * @return array{question: string, token: string}
     */
    public function generateCaptcha(): array
    {
        $operators = ['+', '-', '*'];
        $operator = $operators[random_int(0, 2)];

        $max = $operator === '*' ? 9 : 20;
        $a = random_int(1, $max);
        $b = random_int(1, $max);

        if ($operator === '-' && $b > $a) {
            [$a, $b] = [$b, $a];
        }

        $answer = match ($operator) {
            '+' => $a + $b,
            '-' => $a - $b,
            default => $a * $b,
        };

        $token = Crypt::encrypt([
            'answer' => $answer,
            'expires' => Carbon::now()->addMinutes(10)->timestamp,
        ]);

        return [
            'question' => "{$a} {$operator} {$b}",
            'token' => $token,
        ];
    }

    /**
     * 校验验证码答案。
     */
    public function verifyCaptcha(?string $token, mixed $answer): bool
    {
        if ($token === null || $token === '' || $answer === null || $answer === '') {
            return false;
        }

        try {
            $payload = Crypt::decrypt($token);
        } catch (\Throwable) {
            return false;
        }

        if (! is_array($payload) || (int) ($payload['expires'] ?? 0) < Carbon::now()->timestamp) {
            return false;
        }

        return (int) $payload['answer'] === (int) $answer;
    }

    /**
     * 渲染评论内容为安全 HTML：Markdown 解析、表情替换、转义。
     */
    public function renderContent(Comment $comment): string
    {
        if ($comment->is_markdown) {
            $html = Str::markdown($comment->content ?? '', [
                'html_input' => 'strip',
                'allow_unsafe_links' => false,
            ]);
        } else {
            $html = nl2br(e($comment->content ?? ''));
        }

        return $this->replaceSmileys($html);
    }

    /**
     * 将 :code: 表情标识替换为图片。
     */
    public function replaceSmileys(string $html): string
    {
        $smileys = $this->smileyMap();

        if ($smileys->isEmpty() || ! str_contains($html, ':')) {
            return $html;
        }

        return preg_replace_callback(
            '/:([a-zA-Z0-9_\-]+):/',
            function ($matches) use ($smileys) {
                $code = $matches[1];

                if (! $smileys->has($code)) {
                    return $matches[0];
                }

                $url = \Storage::url($smileys->get($code));

                return sprintf(
                    '<img src="%s" alt="%s" class="inline-block h-6 w-6 align-text-bottom" loading="lazy" />',
                    e($url),
                    e($code),
                );
            },
            $html,
        ) ?? $html;
    }

    /**
     * 表情代码到图片路径的映射（缓存纯数组，避免 Eloquent 序列化问题）。
     */
    protected function smileyMap(): Collection
    {
        $map = Cache::rememberForever('smileys.map', function () {
            return Smiley::query()->pluck('image', 'code')->all();
        });

        return collect(is_array($map) ? $map : []);
    }

    /**
     * 判断用户是否可以查看这条（悄悄话）评论。
     */
    public function canView(Comment $comment, ?User $user, Article $article): bool
    {
        if (! $comment->is_private) {
            return true;
        }

        if ($user === null) {
            return false;
        }

        // 评论作者本人（登录评论）或文章作者可见
        if ((int) $comment->user_id === (int) $user->id) {
            return true;
        }

        // 游客以邮箱/QQ 匹配评论作者
        if ($comment->author_email !== null && $comment->author_email !== ''
            && strcasecmp($comment->author_email, (string) $user->email) === 0) {
            return true;
        }

        return (int) $article->author_id === (int) $user->id;
    }

    /**
     * 清空表情映射缓存。
     */
    public function flushSmileyCache(): void
    {
        Cache::forget('smileys.map');
    }
}
