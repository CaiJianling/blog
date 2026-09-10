<?php

use App\Mail\CommentReplyMail;
use App\Models\Article;
use App\Models\Comment;
use App\Models\Smiley;
use App\Models\SmileyGroup;
use App\Models\User;
use App\Services\CommentService;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Mail;

beforeEach(function () {
    $this->service = app(CommentService::class);
    $this->admin = User::factory()->create(['role' => 'administrator', 'email_verified_at' => now()]);
    $this->article = Article::create([
        'author_id' => $this->admin->id,
        'title' => 'Comment Test Post',
        'slug' => 'comment-test',
        'excerpt' => '',
        'content' => [],
        'status' => 'publish',
    ]);
});

function guestCaptcha(): array
{
    $captcha = app(CommentService::class)->generateCaptcha();
    // 从加密 token 中解出答案用于测试
    $payload = Crypt::decrypt($captcha['token']);

    return ['token' => $captcha['token'], 'answer' => $payload['answer']];
}

test('guest can comment with valid captcha', function () {
    $captcha = guestCaptcha();

    $response = $this->post('/comments', [
        'object_id' => $this->article->id,
        'content' => '游客评论 **加粗**',
        'author_name' => '访客甲',
        'author_email' => 'guest@example.com',
        'captcha_token' => $captcha['token'],
        'captcha_answer' => $captcha['answer'],
        'is_markdown' => true,
    ]);

    $response->assertRedirect();

    $comment = Comment::where('object_id', $this->article->id)->first();
    expect($comment)->not->toBeNull()
        ->and($comment->author_name)->toBe('访客甲')
        ->and($comment->status)->toBe('1');
});

test('guest comment rejected with wrong captcha', function () {
    $captcha = guestCaptcha();

    $this->postJson('/comments', [
        'object_id' => $this->article->id,
        'content' => '验证码错误',
        'author_name' => '访客乙',
        'author_email' => 'guest2@example.com',
        'captcha_token' => $captcha['token'],
        'captcha_answer' => $captcha['answer'] + 999,
    ])->assertStatus(422);

    expect(Comment::where('object_id', $this->article->id)->count())->toBe(0);
});

test('numeric email is treated as qq and stored', function () {
    $captcha = guestCaptcha();

    $this->post('/comments', [
        'object_id' => $this->article->id,
        'content' => 'QQ 评论',
        'author_name' => 'QQ 用户',
        'author_email' => '12345678',
        'captcha_token' => $captcha['token'],
        'captcha_answer' => $captcha['answer'],
    ]);

    $comment = Comment::where('object_id', $this->article->id)->first();

    expect($comment->author_qq)->toBe('12345678')
        ->and($comment->author_email)->toBe('12345678@qq.com')
        ->and($comment->avatar_url)->toContain('qlogo.cn');
});

test('logged in user can comment without captcha', function () {
    $user = User::factory()->create(['role' => 'subscriber']);

    $this->actingAs($user)->postJson('/comments', [
        'object_id' => $this->article->id,
        'content' => '登录用户评论',
    ])->assertRedirect();

    $comment = Comment::where('object_id', $this->article->id)->first();

    expect((int) $comment->user_id)->toBe($user->id)
        ->and($comment->author_email)->toBe($user->email);
});

test('closed comment status rejects new comments', function () {
    $this->article->update(['comment_status' => 'closed']);

    $this->postJson('/comments', [
        'object_id' => $this->article->id,
        'content' => '不该成功',
        'author_name' => '访客丙',
        'author_email' => 'guest3@example.com',
    ])->assertStatus(422);

    expect(Comment::where('object_id', $this->article->id)->count())->toBe(0);
});

test('private comments are hidden from guests and visible to article author', function () {
    Comment::create([
        'object_id' => $this->article->id,
        'object_type' => 'article',
        'author_name' => '悄悄话用户',
        'author_email' => 'secret@example.com',
        'content' => '悄悄话内容',
        'status' => '1',
        'parent_id' => 0,
        'is_private' => true,
    ]);

    Comment::create([
        'object_id' => $this->article->id,
        'object_type' => 'article',
        'author_name' => '公开用户',
        'author_email' => 'open@example.com',
        'content' => '公开内容',
        'status' => '1',
        'parent_id' => 0,
    ]);

    // 游客只能看到公开评论
    $this->get('/'.$this->article->id.'.html')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('Blog/Show')
            ->has('comments', 1)
            ->etc(),
        );

    // 文章作者可见全部
    $this->actingAs($this->admin)->get('/'.$this->article->id.'.html')
        ->assertInertia(fn ($page) => $page->has('comments', 2));

    // 评论人邮箱匹配者可见自己的悄悄话
    $commenter = User::factory()->create(['email' => 'secret@example.com', 'role' => 'subscriber']);
    $this->actingAs($commenter)->get('/'.$this->article->id.'.html')
        ->assertInertia(fn ($page) => $page->has('comments', 2));
});

test('markdown is rendered to html with html stripped', function () {
    $comment = Comment::create([
        'object_id' => $this->article->id,
        'object_type' => 'article',
        'author_name' => 'MD 用户',
        'author_email' => 'md@example.com',
        'content' => "# 标题\n\n**粗体** <script>alert(1)</script>",
        'status' => '1',
        'parent_id' => 0,
        'is_markdown' => true,
    ]);

    $html = $this->service->renderContent($comment);

    expect($html)->toContain('<strong>粗体</strong>')
        ->not->toContain('<script>');
});

test('plain comments are escaped', function () {
    $comment = Comment::create([
        'object_id' => $this->article->id,
        'object_type' => 'article',
        'author_name' => '纯文本',
        'author_email' => 'plain@example.com',
        'content' => "第一行\n<b>不解析</b>",
        'status' => '1',
        'parent_id' => 0,
        'is_markdown' => false,
    ]);

    $html = $this->service->renderContent($comment);

    expect($html)->toContain('&lt;b&gt;不解析&lt;/b&gt;')
        ->toContain('<br');
});

test('smiley codes are replaced with images', function () {
    $group = SmileyGroup::create(['name' => '默认', 'sort' => 0]);
    Smiley::create(['group_id' => $group->id, 'code' => 'smile', 'image' => 'smileys/smile.png', 'sort' => 0]);
    $this->service->flushSmileyCache();

    $comment = Comment::create([
        'object_id' => $this->article->id,
        'object_type' => 'article',
        'author_name' => '表情用户',
        'author_email' => 'emo@example.com',
        'content' => '你好 :smile: :unknown:',
        'status' => '1',
        'parent_id' => 0,
    ]);

    $html = $this->service->renderContent($comment);

    expect($html)->toContain('/storage/smileys/smile.png')
        ->toContain(':unknown:');
});

test('reply notification email is queued when enabled', function () {
    Mail::fake();

    $parent = Comment::create([
        'object_id' => $this->article->id,
        'object_type' => 'article',
        'author_name' => '被回复人',
        'author_email' => 'parent@example.com',
        'content' => '原始评论',
        'status' => '1',
        'parent_id' => 0,
        'notify_mail' => true,
    ]);

    $captcha = guestCaptcha();

    $this->post('/comments', [
        'object_id' => $this->article->id,
        'parent_id' => $parent->comment_id,
        'content' => '这是回复',
        'author_name' => '回复人',
        'author_email' => 'replier@example.com',
        'captcha_token' => $captcha['token'],
        'captcha_answer' => $captcha['answer'],
        'notify_mail' => true,
    ]);

    Mail::assertQueued(CommentReplyMail::class, fn ($mail) => $mail->hasTo('parent@example.com'));
});

test('no notification for private replies', function () {
    Mail::fake();

    $parent = Comment::create([
        'object_id' => $this->article->id,
        'object_type' => 'article',
        'author_name' => '被回复人',
        'author_email' => 'parent2@example.com',
        'content' => '原始评论',
        'status' => '1',
        'parent_id' => 0,
        'notify_mail' => true,
    ]);

    $captcha = guestCaptcha();

    $this->post('/comments', [
        'object_id' => $this->article->id,
        'parent_id' => $parent->comment_id,
        'content' => '悄悄话回复',
        'author_name' => '回复人',
        'author_email' => 'replier2@example.com',
        'captcha_token' => $captcha['token'],
        'captcha_answer' => $captcha['answer'],
        'is_private' => true,
    ]);

    Mail::assertNothingQueued();
});

test('admin can manage smiley groups', function () {
    $this->actingAs($this->admin)->post('/smiley-groups', ['name' => '新手组'])
        ->assertRedirect();

    expect(SmileyGroup::where('name', '新手组')->exists())->toBeTrue();

    $group = SmileyGroup::where('name', '新手组')->first();

    $this->actingAs($this->admin)->post('/smileys', [
        'group_id' => $group->id,
        'code' => 'hi',
        'image' => 'smileys/hi.png',
    ])->assertRedirect();

    expect(Smiley::where('code', 'hi')->exists())->toBeTrue();

    $this->actingAs($this->admin)->get(route('smilies.index'))->assertOk();
});

test('non-admin cannot manage smileys', function () {
    $user = User::factory()->create(['role' => 'subscriber']);

    $this->actingAs($user)->post('/smiley-groups', ['name' => '越权组'])
        ->assertRedirect();

    expect(SmileyGroup::where('name', '越权组')->exists())->toBeFalse();
});
