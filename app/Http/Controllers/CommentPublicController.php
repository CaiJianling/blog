<?php

namespace App\Http\Controllers;

use App\Mail\CommentReplyMail;
use App\Models\Article;
use App\Models\Comment;
use App\Services\CaptchaService;
use App\Services\CommentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

/**
 * 前台评论提交：登录用户直接评论，游客需昵称、邮箱/QQ 和验证码
 * （方式由 comment_captcha_type 决定：math 算术 token / image 图形字符 / image_math 图形算式）。
 * 响应为 Inertia 重定向（错误通过 ValidationException 传回前端）。
 */
class CommentPublicController extends Controller
{
    public function __construct(
        protected CommentService $comments,
        protected CaptchaService $captchas,
    ) {}

    /**
     * 处理评论提交。
     */
    public function store(Request $request)
    {
        // 先校验文章并检查评论开关，再验证其余字段
        $request->validate(['object_id' => ['required', 'integer', 'exists:articles,id']]);

        $article = Article::where('status', 'publish')->find($request->integer('object_id'));

        if ($article === null) {
            abort(404);
        }

        if ($article->comment_status !== 'open') {
            throw ValidationException::withMessages([
                'message' => '该文章已关闭评论。',
            ]);
        }

        $user = $request->user();
        $isGuest = $user === null;
        $captchaIsMath = $this->captchas->commentType() === CaptchaService::TYPE_MATH;

        $rules = [
            'parent_id' => ['nullable', 'integer', 'exists:comments,comment_id'],
            'content' => ['required', 'string', 'max:5000'],
            'is_markdown' => ['boolean'],
            'is_private' => ['boolean'],
            'notify_mail' => ['boolean'],
        ];

        if ($isGuest) {
            $rules += [
                'author_name' => ['required', 'string', 'max:50'],
                'author_email' => ['required', 'string', 'max:100'],
                'author_url' => ['nullable', 'string', 'max:255'],
            ];

            // math：加密 token + 整数答案；image / image_math：图形答案文本
            $rules += $captchaIsMath
                ? [
                    'captcha_token' => ['required', 'string'],
                    'captcha_answer' => ['required', 'integer'],
                ]
                : [
                    'captcha_answer' => ['required', 'string', 'max:8'],
                ];
        }

        $validated = $request->validate($rules, [
            'author_name.required' => '请填写昵称。',
            'author_email.required' => '请填写邮箱或 QQ 号。',
            'captcha_token.required' => '验证码不能为空。',
            'captcha_answer.required' => '请填写验证码。',
            'captcha_answer.max' => '验证码最多 8 个字符。',
        ]);

        $authorName = $validated['author_name'] ?? null;
        $authorEmail = $validated['author_email'] ?? null;
        $authorQq = null;

        if ($user !== null) {
            $authorName = $user->nickname ?: $user->name;
            $authorEmail = $user->email;
        } else {
            // 纯数字视为 QQ 号
            if (preg_match('/^[1-9][0-9]{4,10}$/', (string) $authorEmail)) {
                $authorQq = $authorEmail;
                $authorEmail = $authorQq.'@qq.com';
            } elseif (! filter_var((string) $authorEmail, FILTER_VALIDATE_EMAIL)) {
                throw ValidationException::withMessages([
                    'message' => '请输入有效的邮箱地址或 QQ 号。',
                ]);
            }

            $captchaVerified = $captchaIsMath
                ? $this->comments->verifyCaptcha($validated['captcha_token'] ?? null, $validated['captcha_answer'] ?? null)
                : $this->captchas->verifyImage(CaptchaService::SCOPE_COMMENT, $validated['captcha_answer'] ?? null);

            if (! $captchaVerified) {
                throw ValidationException::withMessages([
                    'message' => '验证码错误，请重试。',
                ]);
            }
        }

        // 回复目标必须属于同一篇文章
        $parentId = $validated['parent_id'] ?? null;
        $parent = null;

        if ($parentId !== null) {
            $parent = Comment::where('comment_id', $parentId)
                ->where('object_id', $article->id)
                ->first();

            if ($parent === null) {
                throw ValidationException::withMessages([
                    'message' => '回复的评论不存在。',
                ]);
            }
        }

        $comment = Comment::create([
            'object_id' => $article->id,
            'object_type' => 'article',
            'author_name' => $authorName,
            'author_email' => $authorEmail,
            'author_qq' => $authorQq,
            'author_url' => $user === null ? ($validated['author_url'] ?? '') : '',
            'ip' => $request->ip(),
            'content' => $validated['content'],
            'status' => '1',
            'parent_id' => $parentId ?? 0,
            'user_id' => $user?->id,
            'is_private' => (bool) ($validated['is_private'] ?? false),
            'notify_mail' => (bool) ($validated['notify_mail'] ?? false),
            'is_markdown' => (bool) ($validated['is_markdown'] ?? true),
        ]);

        $article->increment('comment_count');

        // 邮件提醒：被回复的评论人勾选过提醒且非悄悄话场景
        if ($parent !== null && $parent->notify_mail && ! $comment->is_private && $parent->author_email) {
            Mail::to($parent->author_email)->queue(new CommentReplyMail(
                $comment,
                $parent,
                $article->title,
                url('/'.$article->id.'.html#comment-'.$parent->comment_id),
            ));
        }

        return back();
    }

    /**
     * 登录用户编辑本人评论。
     *
     * 管理员直接生效；非管理员写入 edited_content 进入待审批，
     * 原内容保持可见，由后台「评论管理」审批后才替换。
     */
    public function update(Request $request, Comment $comment)
    {
        $user = $request->user();

        if ($user === null || (int) $comment->user_id !== (int) $user->id) {
            abort(403, '只能编辑自己发布的评论。');
        }

        if ($comment->status === 'trash') {
            throw ValidationException::withMessages([
                'message' => '回收站中的评论不能编辑。',
            ]);
        }

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:5000'],
        ]);

        if ((string) $user->role === 'administrator') {
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

        return back();
    }
}
