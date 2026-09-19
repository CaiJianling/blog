<?php

namespace App\Services;

use App\Models\Article;
use App\Models\Comment;
use App\Models\Smiley;
use App\Models\SmileyGroup;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * 评论服务：算术验证码生成/校验、评论内容渲染（Markdown + 表情）、
 * 悄悄话可见性判断、回复邮件通知。
 */
class CommentService
{
    public function __construct(protected CaptchaService $captchas) {}

    /**
     * 生成算术验证码，返回题目与加密 token。
     *
     * @return array{question: string, token: string}
     */
    public function generateCaptcha(): array
    {
        return $this->captchas->generateMath();
    }

    /**
     * 校验验证码答案。
     */
    public function verifyCaptcha(?string $token, mixed $answer): bool
    {
        return $this->captchas->verifyMath($token, $answer);
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

                $url = Storage::url($smileys->get($code));

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

    /**
     * 组装某对象（文章/说说/页面）的两级评论树，含悄悄话过滤。
     *
     * @return array<int, array<string, mixed>>
     */
    public function threadTree(string $objectType, int $objectId, ?User $user, Article $owner): array
    {
        $allComments = Comment::where('object_id', $objectId)
            ->where('object_type', $objectType)
            ->where('status', '1')
            ->orderBy('created_at')
            ->get();

        // 过滤无权查看的悄悄话评论
        $visible = $allComments->filter(fn (Comment $c) => $this->canView($c, $user, $owner));

        $commentItems = $visible->map(fn (Comment $c) => $this->formatComment($c, $user));

        // 组装两级评论树：顶层 + 回复
        return $commentItems
            ->filter(fn ($c) => (int) $c['parent_id'] === 0)
            ->map(function ($c) use ($commentItems) {
                $c['replies'] = $commentItems
                    ->filter(fn ($r) => (int) $r['parent_id'] === (int) $c['comment_id'])
                    ->values();

                return $c;
            })
            ->values()
            ->all();
    }

    /**
     * 前台评论表单所需数据：游客验证码（登录用户免，方式由 comment_captcha_type
     * 决定：math 文本算术 / image 图形字符 / image_math 图形算式）与表情分组。
     *
     * @return array{captcha: array{type: string, question?: string, token?: string, src?: string}|null, smileyGroups: array}
     */
    public function discussionExtras(?User $user): array
    {
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
        })->values()->all();

        return [
            'captcha' => $user === null ? $this->captchas->commentCaptchaProps() : null,
            'smileyGroups' => $smileyGroups,
        ];
    }

    /**
     * 格式化单条评论数据。
     *
     * @return array<string, mixed>
     */
    private function formatComment(Comment $comment, ?User $user): array
    {
        $isOwn = $user !== null && (int) $comment->user_id === (int) $user->id;

        return [
            'comment_id' => $comment->comment_id,
            'parent_id' => $comment->parent_id,
            'author_name' => $comment->user?->nickname ?: ($comment->user?->name ?? $comment->author_name),
            'author_url' => $comment->author_url,
            'author_qq' => $comment->author_qq,
            'avatar' => $comment->avatar_url,
            'html' => $this->renderContent($comment),
            // 原文（未渲染），供本人编辑时回填编辑器
            'content' => $comment->content,
            'user_id' => $comment->user_id,
            'is_private' => $comment->is_private,
            'is_markdown' => $comment->is_markdown,
            'is_own' => $isOwn,
            // 本人评论是否有待审批的编辑修订
            'has_pending_edit' => $isOwn && $comment->hasPendingEdit(),
            // 待审修订原文（本人评论编辑时回填；无则为 null）
            'pending_edit' => $isOwn ? $comment->edited_content : null,
            'edited_at' => $comment->edited_at?->format('Y-m-d H:i'),
            'created_at' => $comment->created_at?->format('Y-m-d H:i'),
        ];
    }
}
